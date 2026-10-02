import { API_BASE_URL, ApiResponse, apiRequest, tryRefreshSession } from "./api";

export type ParticipantRow = {
  id: string;
  code: string;
  name: string;
  organization: string;
  status: string;
  printed_at: string | null;
};

export type EventRow = {
  id: string;
  name: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  status: string;
  audience: string;
  scan_open_before_min: number | null;
  scan_close_after_min: number | null;
  allow_duplicate: boolean;
  color: string;
  present: number;
  expected: number;
  percent: number;
  participant_ids: string[];
};

export type ScanResponse = {
  result: "success" | "already" | "unknown" | "not_invited" | "closed" | "debounced" | "rejected";
  message: string;
  participant: { id: string; code: string; name: string; organization: string; status: string } | null;
  scanned_at: string | null;
  counts: { present: number; expected: number; percent: number };
};

async function parseEnvelope<T>(response: Response): Promise<ApiResponse<T>> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      success: false,
      message: data.message || data.detail || "Terjadi kesalahan",
    };
  }
  return { success: true, message: data.message || "Success", data: data.data as T };
}

async function postJson<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, { method: "POST", body: JSON.stringify(body) });
}

export const attendanceAPI = {
  dashboard: () => apiRequest<Record<string, unknown>>("/attendance/dashboard"),
  listParticipants: (params: Record<string, string | number | boolean | undefined>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") q.set(key, String(value));
    });
    const query = q.toString();
    return apiRequest<{ participants: ParticipantRow[]; pagination?: { page: number; total: number; totalPages: number } }>(
      `/participants/${query ? `?${query}` : ""}`
    );
  },
  organizations: () => apiRequest<{ organizations: string[] }>("/participants/organizations"),
  createParticipant: (body: { code: string; name: string; organization: string; status: string }) =>
    apiRequest<ParticipantRow>("/participants/", { method: "POST", body: JSON.stringify(body) }),
  updateParticipant: (id: string, body: { code: string; name: string; organization: string; status: string }) =>
    apiRequest<ParticipantRow>(`/participants/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteParticipant: (id: string) => apiRequest(`/participants/${id}`, { method: "DELETE" }),
  previewImport: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    let response = await fetch(`${API_BASE_URL}/participants/import/preview`, {
      method: "POST",
      body: form,
      credentials: "include",
    });
    if (response.status === 401 && (await tryRefreshSession())) {
      const retry = new FormData();
      retry.append("file", file);
      response = await fetch(`${API_BASE_URL}/participants/import/preview`, {
        method: "POST",
        body: retry,
        credentials: "include",
      });
    }
    return parseEnvelope<{
      total: number;
      create: number;
      update: number;
      errors: { row: number; code: string; messages: string[] }[];
      rows: { code: string; name: string; organization: string; status: string; action: string }[];
    }>(response);
  },
  commitImport: (rows: { code: string; name: string; organization: string; status: string }[]) =>
    postJson<{ created: number; updated: number }>("/participants/import/commit", { rows }),
  listEvents: () => apiRequest<{ events: EventRow[] }>("/events/"),
  currentEvent: () => apiRequest<{ event: EventRow | null }>("/events/current"),
  saveEvent: (body: Record<string, unknown>, id?: string) =>
    apiRequest<EventRow>(id ? `/events/${id}` : "/events/", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(body),
    }),
  archiveEvent: (id: string) => postJson(`/events/${id}/archive`, {}),
  duplicateEvent: (id: string) => postJson<EventRow>(`/events/${id}/duplicate`, {}),
  deleteEvent: (id: string) => apiRequest(`/events/${id}`, { method: "DELETE" }),
  scan: (body: { event_id: string; code: string; method: string; force?: boolean }) =>
    postJson<ScanResponse>("/attendance/scan", body),
  undo: (event_id: string) => postJson<{ counts: ScanResponse["counts"] }>("/attendance/undo", { event_id }),
  recent: (event_id: string) =>
    apiRequest<{ scans: { id: string; time_label: string; participant: { name: string; organization: string; code: string } | null }[] }>(
      `/attendance/recent?event_id=${encodeURIComponent(event_id)}`
    ),
  report: (event_id: string) =>
    apiRequest<{
      event: { id: string; name: string; event_date: string };
      present: number;
      absent: number;
      rows: { code: string; name: string; organization: string; status: string; scanned_at: string }[];
    }>(`/reports/events/${event_id}`),
  exportReport: async (event_id: string) => {
    const response = await fetch(`${API_BASE_URL}/reports/events/${event_id}/export`, { credentials: "include" });
    if (!response.ok) return { success: false as const, message: "Gagal mengekspor" };
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "kehadiran.xlsx";
    link.click();
    URL.revokeObjectURL(url);
    return { success: true as const };
  },
  printPdf: async (participant_ids: string[], symbology: string) => {
    const response = await fetch(`${API_BASE_URL}/prints/barcode`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participant_ids, symbology }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false as const, message: data.detail || data.message || "Gagal membuat PDF" };
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "barcode-rakernas.pdf";
    link.click();
    URL.revokeObjectURL(url);
    return { success: true as const };
  },
};

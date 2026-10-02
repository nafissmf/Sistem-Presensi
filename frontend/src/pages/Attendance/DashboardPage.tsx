import { useEffect, useState } from "react";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { attendanceAPI } from "../../utils/attendanceApi";
import { getApiV1BaseUrl } from "../../utils/api";

type FeedItem = { id: string; name: string; organization: string; event_name: string; time_label: string };
type EventCard = {
  id: string;
  name: string;
  status: string;
  color: string;
  start_time: string;
  end_time: string;
  present: number;
  expected: number;
  percent: number;
};
type Snapshot = {
  total_participants: number;
  present_today: number;
  active_event: { id: string; name: string; present: number; expected: number; percent: number } | null;
  events: EventCard[];
  feed: FeedItem[];
  hourly: { hour: string; count: number }[];
  organizations: { name: string; count: number }[];
};

export default function DashboardPage() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await attendanceAPI.dashboard();
    if (res.success && res.data) {
      setData(res.data as unknown as Snapshot);
      setError(null);
    } else {
      setError(res.message || "Gagal memuat dashboard");
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 15000);
    const base = getApiV1BaseUrl().replace(/^http/, "ws");
    const url = base.startsWith("ws") ? `${base}/ws/dashboard` : `${window.location.origin.replace(/^http/, "ws")}${base}/ws/dashboard`;
    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(url);
      socket.onmessage = () => load();
    } catch {
      socket = null;
    }
    return () => {
      window.clearInterval(timer);
      socket?.close();
    };
  }, []);

  const maxHour = Math.max(1, ...(data?.hourly.map((item) => item.count) || [1]));
  const maxOrg = Math.max(1, ...(data?.organizations.map((item) => item.count) || [1]));

  return (
    <>
      <PageMeta title="Dashboard" description="Kehadiran Rakernas secara langsung" />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">Dashboard kehadiran</h1>
          <p className="text-sm text-gray-500">Diperbarui langsung saat ada scan baru.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/scan" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white">Mulai Scan</Link>
          <Link to="/kegiatan" className="rounded-xl border border-gray-200 px-4 py-2 text-sm dark:border-gray-700">Tambah Kegiatan</Link>
        </div>
      </div>
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Total peserta" value={data?.total_participants ?? "—"} />
        <Stat label="Hadir hari ini" value={data?.present_today ?? "—"} />
        <Stat label="Hadir kegiatan aktif" value={data?.active_event ? `${data.active_event.present}/${data.active_event.expected}` : "—"} />
        <Stat label="Persentase" value={data?.active_event ? `${data.active_event.percent}%` : "—"} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:col-span-2">
          <h2 className="mb-4 font-medium">Kegiatan hari ini</h2>
          {!data?.events.length && <p className="text-sm text-gray-500">Belum ada kegiatan hari ini.</p>}
          <div className="space-y-4">
            {data?.events.map((event) => (
              <div key={event.id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium">{event.name}</span>
                  <span className="tabular-nums text-gray-500">{event.present}/{event.expected}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className="h-full rounded-full" style={{ width: `${event.percent}%`, background: event.color || "#4F46E5" }} />
                </div>
              </div>
            ))}
          </div>
          <h2 className="mb-3 mt-8 font-medium">Kehadiran per jam</h2>
          <div className="flex h-28 items-end gap-1">
            {data?.hourly.map((item) => (
              <div key={item.hour} className="flex flex-1 flex-col items-center justify-end">
                <div className="w-full rounded-sm bg-cyan-500/80" style={{ height: `${(item.count / maxHour) * 100}%`, minHeight: item.count ? 4 : 0 }} />
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <h2 className="mb-4 font-medium">Baru saja hadir</h2>
          <div className="space-y-3">
            {data?.feed.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                  {item.name.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="truncate text-xs text-gray-500">{item.organization} · {item.event_name}</p>
                </div>
                <span className="font-mono text-xs tabular-nums">{item.time_label}</span>
              </div>
            ))}
            {!data?.feed.length && <p className="text-sm text-gray-500">Belum ada scan hari ini.</p>}
          </div>
          <h2 className="mb-3 mt-8 font-medium">Per instansi</h2>
          <div className="space-y-2">
            {data?.organizations.map((org) => (
              <div key={org.name}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="truncate pr-2">{org.name}</span>
                  <span className="tabular-nums">{org.count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(org.count / maxOrg) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

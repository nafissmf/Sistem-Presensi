import { FormEvent, useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { useToast } from "../../context/ToastContext";
import { attendanceAPI, EventRow } from "../../utils/attendanceApi";

const empty = {
  name: "",
  event_date: "",
  start_time: "08:00",
  end_time: "10:00",
  location: "",
  status: "draft",
  audience: "all",
  scan_open_before_min: "",
  scan_close_after_min: "",
  allow_duplicate: false,
  color: "#4F46E5",
  codes: "",
};

export default function EventsPage() {
  const toast = useToast();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(empty);

  const load = () => attendanceAPI.listEvents().then((res) => setEvents(res.data?.events || []));
  useEffect(() => {
    load();
  }, []);

  const startCreate = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const startEdit = (event: EventRow) => {
    setEditing(event.id);
    setForm({
      name: event.name,
      event_date: event.event_date,
      start_time: event.start_time,
      end_time: event.end_time,
      location: event.location || "",
      status: event.status,
      audience: event.audience,
      scan_open_before_min: event.scan_open_before_min?.toString() || "",
      scan_close_after_min: event.scan_close_after_min?.toString() || "",
      allow_duplicate: event.allow_duplicate,
      color: event.color,
      codes: "",
    });
    setOpen(true);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const body = {
      ...form,
      location: form.location || null,
      scan_open_before_min: form.scan_open_before_min === "" ? null : Number(form.scan_open_before_min),
      scan_close_after_min: form.scan_close_after_min === "" ? null : Number(form.scan_close_after_min),
      participant_ids: form.audience === "subset"
        ? (form.codes.trim()
          ? form.codes.split(/[\s,]+/).map((code) => code.trim()).filter(Boolean)
          : (events.find((item) => item.id === editing)?.participant_ids || []))
        : [],
    };
    const res = await attendanceAPI.saveEvent(body, editing || undefined);
    if (!res.success) {
      toast.error(res.message || "Gagal menyimpan");
      return;
    }
    toast.success(editing ? "Kegiatan diperbarui" : "Kegiatan dibuat");
    setOpen(false);
    load();
  };

  return (
    <>
      <PageMeta title="Kegiatan" description="Kelola kegiatan Rakernas" />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Kegiatan</h1>
        <button type="button" onClick={startCreate} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white">Tambah kegiatan</button>
      </div>
      {!events.length && (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="mb-3 text-gray-500">Belum ada kegiatan, buat yang pertama.</p>
          <button type="button" onClick={startCreate} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white">Buat kegiatan</button>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {events.map((event) => (
          <article key={event.id} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]" style={{ borderTopColor: event.color, borderTopWidth: 4 }}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-medium">{event.name}</h2>
              <span className="rounded-full bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">{event.status}</span>
            </div>
            <p className="text-sm text-gray-500">{event.event_date} · {event.start_time}–{event.end_time}</p>
            <p className="text-sm text-gray-500">{event.location || "Tanpa lokasi"}</p>
            <p className="mt-3 text-sm tabular-nums">{event.present}/{event.expected} hadir</p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <button type="button" onClick={() => startEdit(event)}>Ubah</button>
              <button type="button" onClick={() => attendanceAPI.duplicateEvent(event.id).then(load)}>Duplikat</button>
              <button type="button" onClick={() => attendanceAPI.archiveEvent(event.id).then(load)}>Arsipkan</button>
              <button type="button" onClick={() => attendanceAPI.deleteEvent(event.id).then((res) => { if (!res.success) toast.error(res.message || "Tidak bisa dihapus"); load(); })}>Hapus</button>
            </div>
          </article>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <form onSubmit={onSubmit} className="h-full w-full max-w-md space-y-3 overflow-auto bg-white p-6 dark:bg-gray-900">
            <h2 className="text-lg font-semibold">{editing ? "Ubah kegiatan" : "Kegiatan baru"}</h2>
            <Field label="Nama" value={form.name} onChange={(name) => setForm({ ...form, name })} />
            <label className="block text-sm">Tanggal
              <input type="date" required className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-gray-700 dark:bg-transparent" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">Mulai
                <input type="time" required className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-gray-700 dark:bg-transparent" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              </label>
              <label className="text-sm">Selesai
                <input type="time" required className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-gray-700 dark:bg-transparent" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </label>
            </div>
            <Field label="Lokasi" value={form.location} onChange={(location) => setForm({ ...form, location })} />
            <label className="block text-sm">Status
              <select className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-gray-700 dark:bg-gray-900" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="draft">Draft</option>
                <option value="active">Aktif</option>
                <option value="done">Selesai</option>
                <option value="archived">Diarsipkan</option>
              </select>
            </label>
            <label className="block text-sm">Peserta
              <select className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-gray-700 dark:bg-gray-900" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                <option value="all">Semua peserta</option>
                <option value="subset">Hanya kode yang diisi</option>
              </select>
            </label>
            {form.audience === "subset" && (
              <label className="block text-sm">Kode peserta
                <textarea className="mt-1 w-full rounded-xl border px-3 py-2 font-mono text-xs dark:border-gray-700 dark:bg-transparent" rows={4} placeholder="Rakernas-001, Rakernas-002" value={form.codes} onChange={(e) => setForm({ ...form, codes: e.target.value })} />
              </label>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.allow_duplicate} onChange={(e) => setForm({ ...form, allow_duplicate: e.target.checked })} />
              Izinkan scan memperbarui jam hadir
            </label>
            <div className="flex gap-2 pt-4">
              <button type="submit" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white">Simpan</button>
              <button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={() => setOpen(false)}>Tutup</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm">{label}
      <input required={label === "Nama"} className="mt-1 w-full rounded-xl border px-3 py-2 dark:border-gray-700 dark:bg-transparent" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

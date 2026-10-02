import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { attendanceAPI, EventRow } from "../../utils/attendanceApi";

type Report = {
  event: { name: string; event_date: string };
  present: number;
  absent: number;
  rows: { code: string; name: string; organization: string; status: string; scanned_at: string }[];
};

export default function ReportsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventId, setEventId] = useState("");
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    attendanceAPI.listEvents().then((res) => setEvents(res.data?.events || []));
  }, []);

  useEffect(() => {
    if (!eventId) return;
    attendanceAPI.report(eventId).then((res) => setReport((res.data as Report) || null));
  }, [eventId]);

  return (
    <>
      <PageMeta title="Laporan" description="Rekap kehadiran" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Laporan</h1>
        <div className="flex gap-2">
          <select className="rounded-xl border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">Pilih kegiatan</option>
            {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
          </select>
          <button type="button" disabled={!eventId} className="rounded-xl bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50" onClick={() => attendanceAPI.exportReport(eventId)}>
            Ekspor Excel
          </button>
        </div>
      </div>
      {report && (
        <>
          <p className="mb-3 text-sm text-gray-500">{report.event.event_date} · hadir {report.present} · tidak hadir {report.absent}</p>
          <div className="overflow-auto rounded-2xl border dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-white/[0.03]"><tr><th className="px-3 py-2">Kode</th><th>Nama</th><th>Instansi</th><th>Status</th><th>Jam</th></tr></thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.code} className="border-t dark:border-gray-800">
                    <td className="px-3 py-2 font-mono">{row.code}</td>
                    <td>{row.name}</td>
                    <td>{row.organization}</td>
                    <td>{row.status}</td>
                    <td>{row.scanned_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

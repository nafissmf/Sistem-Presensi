import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import PageMeta from "../../components/common/PageMeta";
import { useToast } from "../../context/ToastContext";
import { attendanceAPI, ParticipantRow } from "../../utils/attendanceApi";

export default function PrintPage() {
  const toast = useToast();
  const [rows, setRows] = useState<ParticipantRow[]>([]);
  const [orgs, setOrgs] = useState<string[]>([]);
  const [organization, setOrganization] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [symbology, setSymbology] = useState("code128");
  const svgRef = useRef<SVGSVGElement>(null);
  const preview = rows.find((row) => selected.includes(row.id)) || rows[0];

  useEffect(() => {
    attendanceAPI.organizations().then((res) => setOrgs(res.data?.organizations || []));
  }, []);

  useEffect(() => {
    attendanceAPI.listParticipants({ all: true, organization, limit: 500 }).then((res) => {
      setRows(res.data?.participants || []);
    });
  }, [organization]);

  useEffect(() => {
    if (!preview || !svgRef.current || symbology !== "code128") return;
    JsBarcode(svgRef.current, preview.code, {
      format: "CODE128",
      displayValue: true,
      font: "monospace",
      height: 48,
      margin: 8,
    });
  }, [preview, symbology]);

  const toggle = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  return (
    <>
      <PageMeta title="Cetak Barcode" description="Kartu nama peserta" />
      <h1 className="mb-4 text-2xl font-semibold">Cetak barcode</h1>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <select className="rounded-xl border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" value={organization} onChange={(e) => setOrganization(e.target.value)}>
              <option value="">Semua instansi</option>
              {orgs.map((org) => <option key={org} value={org}>{org}</option>)}
            </select>
            <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => setSelected(rows.map((row) => row.id))}>Pilih yang tampil</button>
            <select className="rounded-xl border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" value={symbology} onChange={(e) => setSymbology(e.target.value)}>
              <option value="code128">Code 128</option>
              <option value="qr">QR</option>
            </select>
            <button
              type="button"
              className="rounded-xl bg-indigo-600 px-3 py-2 text-sm text-white"
              onClick={async () => {
                const ids = selected.length ? selected : rows.map((row) => row.id);
                const res = await attendanceAPI.printPdf(ids, symbology);
                if (!res.success) toast.error(res.message || "Gagal membuat PDF");
              }}
            >
              Unduh PDF
            </button>
          </div>
          <div className="max-h-[560px] overflow-auto rounded-2xl border dark:border-gray-800">
            {rows.map((row) => (
              <label key={row.id} className="flex items-center gap-3 border-b px-3 py-2 text-sm dark:border-gray-800">
                <input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggle(row.id)} />
                <span className="font-mono text-xs">{row.code}</span>
                <span className="flex-1">{row.name}</span>
                <span className="text-gray-500">{row.organization}</span>
                {row.printed_at && <span className="text-xs text-emerald-600">Sudah dicetak</span>}
              </label>
            ))}
          </div>
        </div>
        <aside className="rounded-2xl border bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="mb-3 text-sm text-gray-500">Pratinjau</p>
          {preview ? (
            <div className="rounded-xl border p-3">
              <p className="text-sm font-semibold leading-snug">{preview.name}</p>
              <p className="mt-1 text-xs leading-snug text-gray-500">{preview.organization}</p>
              {symbology === "code128" ? <svg ref={svgRef} className="mt-3 w-full" /> : <p className="mt-4 text-center font-mono text-sm">{preview.code}</p>}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Pilih peserta untuk melihat kartu.</p>
          )}
        </aside>
      </div>
    </>
  );
}

import { FormEvent, useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { useToast } from "../../context/ToastContext";
import { attendanceAPI, ParticipantRow } from "../../utils/attendanceApi";

const blank = { code: "", name: "", organization: "", status: "active" };

export default function ParticipantsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<ParticipantRow[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [orgs, setOrgs] = useState<string[]>([]);
  const [organization, setOrganization] = useState("");
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof attendanceAPI.previewImport>>["data"] | null>(null);

  const load = () => {
    attendanceAPI.listParticipants({ page, limit: 20, search, organization }).then((res) => {
      setRows(res.data?.participants || []);
      setPages(res.data?.pagination?.totalPages || 1);
    });
  };

  useEffect(() => {
    attendanceAPI.organizations().then((res) => setOrgs(res.data?.organizations || []));
  }, []);

  useEffect(() => {
    load();
  }, [page, organization]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const res = editing
      ? await attendanceAPI.updateParticipant(editing, form)
      : await attendanceAPI.createParticipant(form);
    if (!res.success) {
      toast.error(res.message || "Gagal menyimpan");
      return;
    }
    setForm(blank);
    setEditing(null);
    load();
  };

  return (
    <>
      <PageMeta title="Peserta" description="Daftar peserta Rakernas" />
      <h1 className="mb-4 text-2xl font-semibold">Peserta</h1>
      <form onSubmit={save} className="mb-6 grid gap-2 rounded-2xl border p-4 md:grid-cols-5 dark:border-gray-800">
        <input className="rounded-xl border px-3 py-2 font-mono text-sm dark:border-gray-700 dark:bg-transparent" placeholder="Kode" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
        <input className="rounded-xl border px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent" placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="rounded-xl border px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent" placeholder="Instansi" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} required />
        <select className="rounded-xl border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="active">Aktif</option>
          <option value="pending">Menunggu</option>
          <option value="hold">Tunda bayar</option>
          <option value="rejected">Ditolak</option>
        </select>
        <button className="rounded-xl bg-indigo-600 px-3 py-2 text-sm text-white" type="submit">{editing ? "Simpan" : "Tambah"}</button>
      </form>
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="rounded-xl border px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent" placeholder="Cari nama, instansi, kode" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (setPage(1), load())} />
        <select className="rounded-xl border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" value={organization} onChange={(e) => { setOrganization(e.target.value); setPage(1); }}>
          <option value="">Semua instansi</option>
          {orgs.map((org) => <option key={org} value={org}>{org}</option>)}
        </select>
        <label className="rounded-xl border px-3 py-2 text-sm dark:border-gray-700">
          Import Excel
          <input type="file" accept=".xlsx,.csv" className="hidden" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const res = await attendanceAPI.previewImport(file);
            if (!res.success) toast.error(res.message || "Gagal membaca file");
            else setPreview(res.data || null);
          }} />
        </label>
      </div>
      {preview && (
        <div className="mb-4 rounded-2xl border p-4 text-sm dark:border-gray-800">
          <p>Baru {preview.create}, diperbarui {preview.update}, error {preview.errors.length}.</p>
          {preview.errors.slice(0, 5).map((err) => (
            <p key={err.row} className="text-rose-500">Baris {err.row}: {err.messages.join(", ")}</p>
          ))}
          <button type="button" className="mt-3 rounded-xl bg-indigo-600 px-3 py-2 text-white" onClick={async () => {
            const res = await attendanceAPI.commitImport(preview.rows);
            if (!res.success) toast.error(res.message || "Import gagal");
            else toast.success(`Masuk ${res.data?.created}, diperbarui ${res.data?.updated}`);
            setPreview(null);
            load();
          }}>Simpan import</button>
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border dark:border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500 dark:bg-white/[0.03]">
            <tr><th className="px-3 py-2">Kode</th><th>Nama</th><th>Instansi</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t dark:border-gray-800">
                <td className="px-3 py-2 font-mono">{row.code}</td>
                <td>{row.name}</td>
                <td>{row.organization}</td>
                <td>{row.status}</td>
                <td className="space-x-2 pr-3 text-right">
                  <button type="button" onClick={() => { setEditing(row.id); setForm({ code: row.code, name: row.name, organization: row.organization, status: row.status }); }}>Ubah</button>
                  <button type="button" onClick={() => attendanceAPI.deleteParticipant(row.id).then((res) => { if (!res.success) toast.error(res.message || "Tidak bisa dihapus"); load(); })}>Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex gap-2 text-sm">
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Sebelumnya</button>
        <span>{page} / {pages}</span>
        <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Berikutnya</button>
      </div>
    </>
  );
}

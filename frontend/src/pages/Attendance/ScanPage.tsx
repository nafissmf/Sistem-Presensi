import { FormEvent, useEffect, useRef, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { useAuth } from "../../context/AuthContext";
import { attendanceAPI, EventRow, ScanResponse } from "../../utils/attendanceApi";

const RESULT_MS = 2600;

function tone(kind: ScanResponse["result"] | "idle", muted: boolean) {
  if (muted || kind === "idle" || kind === "debounced") return;
  const ctx = new AudioContext();
  const play = (freq: number, at: number, dur: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.08, ctx.currentTime + at);
    osc.start(ctx.currentTime + at);
    osc.stop(ctx.currentTime + at + dur);
  };
  if (kind === "success") {
    play(523, 0, 0.08);
    play(784, 0.09, 0.12);
  } else if (kind === "already" || kind === "not_invited") {
    play(440, 0, 0.08);
    play(440, 0.12, 0.08);
  } else {
    play(196, 0, 0.18);
  }
}

export default function ScanPage() {
  const { hasPermission } = useAuth();
  const canForce = hasPermission(["update_event", "create_event"]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventId, setEventId] = useState("");
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [recent, setRecent] = useState<{ id: string; time_label: string; participant: { name: string; organization: string; code: string } | null }[]>([]);
  const [counts, setCounts] = useState({ present: 0, expected: 0, percent: 0 });
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [manual, setManual] = useState("");
  const lastCode = useRef("");
  const lastAt = useRef(0);

  const focusInput = () => window.setTimeout(() => inputRef.current?.focus(), 30);

  useEffect(() => {
    attendanceAPI.listEvents().then((res) => {
      const rows = res.data?.events || [];
      setEvents(rows.filter((item) => item.status !== "archived"));
    });
    attendanceAPI.currentEvent().then((res) => {
      if (res.data?.event) setEventId(res.data.event.id);
    });
    focusInput();
  }, []);

  useEffect(() => {
    if (!eventId) return;
    attendanceAPI.recent(eventId).then((res) => setRecent(res.data?.scans || []));
    const selected = events.find((item) => item.id === eventId);
    if (selected) setCounts({ present: selected.present, expected: selected.expected, percent: selected.percent });
  }, [eventId, events]);

  useEffect(() => {
    if (!result) return;
    const timer = window.setTimeout(() => setResult(null), RESULT_MS);
    return () => window.clearTimeout(timer);
  }, [result]);

  useEffect(() => {
    if (!cameraOn) return;
    let stop = false;
    let scanner: { stop: () => Promise<void> } | null = null;
    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      const instance = new Html5Qrcode("camera-reader");
      scanner = instance;
      await instance.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: 220 },
        (text) => {
          if (!stop) submit(text, "camera");
        },
        () => undefined
      );
    })();
    return () => {
      stop = true;
      scanner?.stop().catch(() => undefined);
    };
  }, [cameraOn, eventId]);

  async function submit(raw: string, method: "scanner" | "camera" | "manual", force = false) {
    const value = raw.trim();
    if (!eventId || !value) return;
    const now = Date.now();
    if (value === lastCode.current && now - lastAt.current < 3000 && !force) return;
    lastCode.current = value;
    lastAt.current = now;
    const res = await attendanceAPI.scan({ event_id: eventId, code: value, method, force });
    if (res.success && res.data) {
      setResult(res.data);
      setCounts(res.data.counts);
      tone(res.data.result, muted);
      const recentRes = await attendanceAPI.recent(eventId);
      setRecent(recentRes.data?.scans || []);
    } else {
      setResult({
        result: "unknown",
        message: res.message || "Gagal memindai",
        participant: null,
        scanned_at: null,
        counts,
      });
    }
    setCode("");
    setManual("");
    focusInput();
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(code, "scanner");
  };

  const palette =
    result?.result === "success"
      ? "bg-emerald-500"
      : result?.result === "already"
        ? "bg-amber-500"
        : result?.result === "not_invited"
          ? "bg-orange-500"
          : result?.result === "closed"
            ? "bg-slate-500"
            : result && result.result !== "debounced"
              ? "bg-rose-500"
              : "";

  return (
    <>
      <PageMeta title="Scan Presensi" description="Pindai barcode peserta" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm text-emerald-600">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Scanner siap
          </p>
          <h1 className="text-2xl font-semibold">Scan presensi</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-xl border px-3 py-2 text-sm dark:border-gray-700" onClick={() => setMuted((v) => !v)}>
            {muted ? "Suara mati" : "Suara nyala"}
          </button>
          <button type="button" className="rounded-xl border px-3 py-2 text-sm dark:border-gray-700" onClick={() => setCameraOn((v) => !v)}>
            {cameraOn ? "Tutup kamera" : "Kamera"}
          </button>
          <button
            type="button"
            className="rounded-xl border px-3 py-2 text-sm dark:border-gray-700"
            onClick={() => document.documentElement.requestFullscreen?.()}
          >
            Layar penuh
          </button>
          <button
            type="button"
            className="rounded-xl bg-gray-900 px-3 py-2 text-sm text-white"
            onClick={() => eventId && attendanceAPI.undo(eventId).then(() => attendanceAPI.recent(eventId).then((res) => setRecent(res.data?.scans || [])))}
          >
            Batalkan scan terakhir
          </button>
        </div>
      </div>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
        <div className="h-full bg-indigo-500" style={{ width: `${counts.percent}%` }} />
      </div>
      <p className="mb-4 text-3xl font-semibold tabular-nums">{counts.present} / {counts.expected} hadir</p>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className={`relative min-h-[420px] overflow-hidden rounded-3xl ${palette || "bg-slate-950"} p-6 text-white`}>
          <select
            className="mb-4 rounded-xl bg-white/10 px-3 py-2 text-sm"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
          >
            <option value="">Pilih kegiatan</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>{event.name}</option>
            ))}
          </select>
          <form onSubmit={onSubmit}>
            <input
              ref={inputRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              placeholder="Arahkan scanner ke barcode"
              className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-4 font-mono text-2xl outline-none"
            />
          </form>
          {result && result.result !== "debounced" && (
            <div className="mt-8">
              <p className="text-lg uppercase tracking-wide">{result.message}</p>
              <p className="mt-2 text-5xl font-semibold leading-tight md:text-6xl">{result.participant?.name || result.message}</p>
              <p className="mt-3 text-xl text-white/80">{result.participant?.organization}</p>
              {result.result === "not_invited" && canForce && result.participant && (
                <button
                  type="button"
                  className="mt-6 rounded-xl bg-white px-4 py-2 text-sm font-medium text-orange-700"
                  onClick={() => submit(result.participant!.code, "manual", true)}
                >
                  Tetap catat
                </button>
              )}
            </div>
          )}
          <div className="mt-6 flex gap-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Ketik kode atau nama bila barcode rusak"
              className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") submit(manual, "manual");
              }}
            />
          </div>
          {cameraOn && <div id="camera-reader" className="mt-4 overflow-hidden rounded-2xl bg-black" />}
        </div>
        <aside className="rounded-3xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <h2 className="mb-3 font-medium">10 scan terakhir</h2>
          <div className="space-y-3">
            {recent.map((item) => (
              <div key={item.id}>
                <p className="text-sm font-medium">{item.participant?.name}</p>
                <p className="text-xs text-gray-500">{item.participant?.organization} · {item.time_label}</p>
              </div>
            ))}
            {!recent.length && <p className="text-sm text-gray-500">Belum ada scan.</p>}
          </div>
        </aside>
      </div>
    </>
  );
}

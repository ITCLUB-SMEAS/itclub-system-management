import { useEffect, useState, type FormEvent } from "react";
import {
  Download,
  Eye,
  ExternalLink,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import {
  financeApi,
  orgApi,
  requireAuth,
  type FinanceReport,
  type Period,
  type Transaction,
} from "../../lib/api";
import DashboardShell from "../common/DashboardShell";

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function FinancePage() {
  const [tx, setTx] = useState<Transaction[]>([]);
  const [report, setReport] = useState<FinanceReport | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState("");

  const [type, setType] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [exporting, setExporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState("");

  function closePreview() {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
  }

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  async function load(pid?: string) {
    const [list, rep] = await Promise.all([
      financeApi.list(pid || undefined),
      financeApi.report(pid || undefined),
    ]);
    setTx(list);
    setReport(rep);
  }

  useEffect(() => {
    const u = requireAuth();
    setRole(u.role ?? "");
    if (u.role !== "KETUA" && u.role !== "BENDAHARA") {
      setError("Hanya Bendahara / Ketua");
      return;
    }
    void orgApi.periods().then((p) => {
      setPeriods(p);
      const active = p.find((x) => x.isActive);
      if (active) setPeriodId(active.id);
    });
    void load().catch((e) => setError(e instanceof Error ? e.message : "Gagal"));
  }, []);

  useEffect(() => {
    if (role !== "KETUA" && role !== "BENDAHARA") return;
    void load(periodId || undefined).catch((e) =>
      setError(e instanceof Error ? e.message : "Gagal"),
    );
  }, [periodId]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await financeApi.create({
        type,
        amount: Number(amount),
        description,
        category: category || undefined,
        periodId: periodId || undefined,
      });
      setAmount("");
      setDescription("");
      setCategory("");
      setShowForm(false);
      await load(periodId || undefined);
      setOkMsg("Transaksi dicatat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell active="/dashboard/finance" title="Keuangan" crumbs={["Dashboard", "Keuangan"]}>

          {error && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {error}
            </div>
          )}
          {okMsg && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {okMsg}
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <select
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm"
            >
              <option value="">Semua periode</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.isActive ? " (aktif)" : ""}
                </option>
              ))}
            </select>
            {(role === "BENDAHARA" || role === "KETUA") && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void financeApi
                      .snapshot(periodId || undefined)
                      .then(() => setOkMsg("Snapshot laporan disimpan"))
                      .catch((e) =>
                        setError(e instanceof Error ? e.message : "Gagal snapshot"),
                      )
                      .finally(() => setBusy(false));
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
                >
                  Snapshot
                </button>
                <button
                  type="button"
                  disabled={exporting}
                  onClick={() => {
                    setExporting(true);
                    void financeApi
                      .downloadReportCsv(periodId || undefined)
                      .catch((e) =>
                        setError(e instanceof Error ? e.message : "CSV gagal"),
                      )
                      .finally(() => setExporting(false));
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
                >
                  <Download size={16} /> CSV
                </button>
                <button
                  type="button"
                  disabled={previewing}
                  onClick={() => {
                    setPreviewing(true);
                    setError("");
                    void financeApi
                      .previewReportPdf(periodId || undefined)
                      .then((url) => {
                        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
                        setPdfUrl(url);
                      })
                      .catch((e) =>
                        setError(e instanceof Error ? e.message : "Preview gagal"),
                      )
                      .finally(() => setPreviewing(false));
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                >
                  <Eye size={16} />
                  {previewing ? "Loading..." : "Preview PDF"}
                </button>
                <button
                  type="button"
                  disabled={exporting}
                  onClick={() => {
                    setExporting(true);
                    void financeApi
                      .downloadReportPdf(periodId || undefined)
                      .catch((e) =>
                        setError(e instanceof Error ? e.message : "Export gagal"),
                      )
                      .finally(() => setExporting(false));
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Download size={16} />
                  {exporting ? "Exporting..." : "Download"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm((s) => !s)}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white"
                >
                  <Plus size={16} /> Catat transaksi
                </button>
              </div>
            )}
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-5">
              <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
                <TrendingUp size={16} className="text-emerald-500" /> Pemasukan
              </div>
              <p className="text-2xl font-semibold text-slate-900">
                {fmt(report?.income ?? 0)}
              </p>
            </div>
            <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-sky-50 to-white p-5">
              <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
                <TrendingDown size={16} className="text-rose-500" /> Pengeluaran
              </div>
              <p className="text-2xl font-semibold text-slate-900">
                {fmt(report?.expense ?? 0)}
              </p>
            </div>
            <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-indigo-50 to-white p-5">
              <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
                <Wallet size={16} className="text-brand-600" /> Saldo
              </div>
              <p className="text-2xl font-semibold text-slate-900">
                {fmt(report?.balance ?? 0)}
              </p>
            </div>
          </div>

          {showForm && (
            <form
              onSubmit={create}
              className="mb-6 grid gap-3 rounded-2xl border border-brand-100 bg-white p-5 sm:grid-cols-2"
            >
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "INCOME" | "EXPENSE")}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="INCOME">Pemasukan</option>
                <option value="EXPENSE">Pengeluaran</option>
              </select>
              <input
                required
                type="number"
                min={0}
                step="1000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Jumlah (Rp)"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Kategori (Iuran, Donasi, ATK…)"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Keterangan"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-brand-600 py-2.5 text-sm font-semibold text-white sm:col-span-2"
              >
                Simpan
              </button>
            </form>
          )}

          {!!report?.byCategory?.length && (
            <div className="mb-4 flex flex-wrap gap-2">
              {report.byCategory.map((c) => (
                <span
                  key={c.category}
                  className="rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-600"
                >
                  {c.category}: {fmt(c.net)} ({c.count})
                </span>
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-brand-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="font-semibold text-slate-900">Transaksi</h3>
              <p className="text-sm text-slate-500">{tx.length} records</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Tanggal</th>
                    <th className="px-5 py-3">Tipe</th>
                    <th className="px-5 py-3">Keterangan</th>
                    <th className="px-5 py-3">Oleh</th>
                    <th className="px-5 py-3 text-right">Jumlah</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {tx.map((t) => (
                    <tr
                      key={t.id}
                      className={`border-t border-slate-50 ${t.voidedAt ? "opacity-40 line-through" : ""}`}
                    >
                      <td className="px-5 py-3 text-slate-500">
                        {new Date(t.occurredAt).toLocaleDateString("id-ID")}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            t.type === "INCOME"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {t.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-800">
                        {t.category ? (
                          <span className="mr-1 text-xs text-slate-400">
                            [{t.category}]
                          </span>
                        ) : null}
                        {t.description}
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {t.recordedBy?.fullName ?? "—"}
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-semibold ${
                          t.type === "INCOME" ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {t.type === "EXPENSE" ? "−" : "+"}
                        {fmt(Number(t.amount))}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {!t.voidedAt && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              if (!confirm("Void transaksi ini?")) return;
                              setBusy(true);
                              void financeApi
                                .voidTx(t.id)
                                .then(() => load(periodId || undefined))
                                .then(() => setOkMsg("Transaksi di-void"))
                                .catch((e) =>
                                  setError(
                                    e instanceof Error ? e.message : "Gagal void",
                                  ),
                                )
                                .finally(() => setBusy(false));
                            }}
                            className="text-xs text-rose-500 hover:underline"
                          >
                            Void
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!tx.length && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                        Belum ada transaksi
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {pdfUrl && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
              <div className="flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">Preview Laporan PDF</h3>
                    <p className="text-xs text-slate-400">
                      {periodId
                        ? periods.find((p) => p.id === periodId)?.name ?? "Periode"
                        : "Semua periode"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.open(pdfUrl, "_blank", "noopener,noreferrer")}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <ExternalLink size={14} />
                      Tab baru
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void financeApi
                          .downloadReportPdf(periodId || undefined)
                          .catch((e) =>
                            setError(e instanceof Error ? e.message : "Download gagal"),
                          );
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                    >
                      <Download size={14} />
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={closePreview}
                      className="rounded-full p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                      aria-label="Tutup preview"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
                <iframe
                  title="Preview laporan keuangan PDF"
                  src={pdfUrl}
                  className="min-h-0 flex-1 w-full border-0 bg-slate-100"
                />
              </div>
            </div>
          )}
        
    </DashboardShell>
  );
}

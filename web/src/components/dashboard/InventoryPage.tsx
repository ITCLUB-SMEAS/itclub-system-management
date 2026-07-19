import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Package, Plus } from "lucide-react";
import DashboardShell from "../common/DashboardShell";
import EmptyState from "../common/EmptyState";
import LoadingSpinner from "../common/LoadingSpinner";
import { useToast } from "../common/ToastProvider";
import {
  inventoryApi,
  requireAuth,
  isPengurus,
  type InventoryItem,
  type InventoryLoan,
} from "../../lib/api";

function statusStyle(s: string) {
  switch (s) {
    case "REQUESTED":
      return "bg-amber-50 text-amber-700";
    case "BORROWED":
    case "APPROVED":
      return "bg-brand-50 text-brand-700";
    case "RETURNED":
      return "bg-emerald-50 text-emerald-700";
    case "REJECTED":
      return "bg-rose-50 text-rose-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function itemAvailability(item: InventoryItem) {
  const active = item.loans?.find((l) =>
    ["REQUESTED", "APPROVED", "BORROWED"].includes(l.status),
  );
  if (!active) return { label: "Available", ok: true };
  if (active.status === "REQUESTED")
    return { label: "Pending request", ok: false };
  return { label: "Borrowed", ok: false };
}

export default function InventoryPage() {
  const toast = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loans, setLoans] = useState<InventoryLoan[]>([]);
  const [myLoans, setMyLoans] = useState<InventoryLoan[]>([]);
  const [pengurus, setPengurus] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<"items" | "requests" | "mine">("items");
  const [name, setName] = useState("");
  const [condition, setCondition] = useState("");

  async function load() {
    const [i, mine] = await Promise.all([
      inventoryApi.list(),
      inventoryApi.myLoans().catch(() => [] as InventoryLoan[]),
    ]);
    setItems(i);
    setMyLoans(mine);
  }

  async function loadLoans() {
    if (!pengurus) return;
    setLoans(await inventoryApi.loans());
  }

  useEffect(() => {
    const u = requireAuth();
    setPengurus(isPengurus(u.role));
    void load()
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (pengurus) {
      void loadLoans().catch(() => {});
    }
  }, [pengurus]);

  const pending = useMemo(
    () => loans.filter((l) => l.status === "REQUESTED"),
    [loans],
  );
  const activeLoans = useMemo(
    () => loans.filter((l) => l.status === "BORROWED" || l.status === "APPROVED"),
    [loans],
  );

  async function createItem(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await inventoryApi.create({
        name,
        condition: condition || undefined,
      });
      setName("");
      setCondition("");
      setShowForm(false);
      toast.success("Aset ditambahkan");
      await load();
    } catch (err) {
      const m = err instanceof Error ? err.message : "Gagal";
      setError(m);
      toast.error(m);
    } finally {
      setBusy(false);
    }
  }

  async function request(itemId: string) {
    setBusy(true);
    setError("");
    try {
      await inventoryApi.requestLoan(itemId);
      toast.success("Permintaan pinjam terkirim");
      await load();
      if (pengurus) await loadLoans();
    } catch (err) {
      const m = err instanceof Error ? err.message : "Gagal";
      setError(m);
      toast.error(m);
    } finally {
      setBusy(false);
    }
  }

  async function act(loanId: string, action: "approve" | "reject" | "return") {
    setBusy(true);
    setError("");
    try {
      if (action === "approve") await inventoryApi.approve(loanId);
      else if (action === "reject") await inventoryApi.reject(loanId);
      else await inventoryApi.return(loanId);
      toast.success(
        action === "approve"
          ? "Disetujui & dipinjamkan"
          : action === "reject"
            ? "Ditolak"
            : "Dikembalikan",
      );
      await load();
      await loadLoans();
    } catch (err) {
      const m = err instanceof Error ? err.message : "Gagal";
      setError(m);
      toast.error(m);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell
      active="/dashboard/inventory"
      title="Inventaris"
      crumbs={["Dashboard", "Inventaris"]}
    >
          {error && (
            <div
              className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
              role="alert"
            >
              {error}
            </div>
          )}

          {loading ? (
            <LoadingSpinner label="Memuat inventaris..." />
          ) : (
            <>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-full border border-slate-200 bg-white p-1 text-sm">
              <button
                type="button"
                onClick={() => setTab("items")}
                className={`rounded-full px-4 py-1.5 font-medium ${
                  tab === "items" ? "bg-brand-600 text-white" : "text-slate-600"
                }`}
              >
                Aset
              </button>
              <button
                type="button"
                onClick={() => setTab("mine")}
                className={`rounded-full px-4 py-1.5 font-medium ${
                  tab === "mine" ? "bg-brand-600 text-white" : "text-slate-600"
                }`}
              >
                Pinjaman saya
              </button>
              {pengurus && (
                <button
                  type="button"
                  onClick={() => {
                    setTab("requests");
                    void loadLoans();
                  }}
                  className={`rounded-full px-4 py-1.5 font-medium ${
                    tab === "requests"
                      ? "bg-brand-600 text-white"
                      : "text-slate-600"
                  }`}
                >
                  Kelola
                  {pending.length > 0 && (
                    <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[10px]">
                      {pending.length}
                    </span>
                  )}
                </button>
              )}
            </div>
            {pengurus && tab === "items" && (
              <button
                type="button"
                onClick={() => setShowForm((s) => !s)}
                className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-3 py-2 text-sm font-medium text-white"
              >
                <Plus size={16} /> Tambah aset
              </button>
            )}
          </div>

          {showForm && (
            <form
              onSubmit={createItem}
              className="mb-4 grid gap-2 rounded-2xl border border-brand-100 bg-white p-4 sm:grid-cols-3"
            >
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama aset (laptop, proyektor...)"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
              />
              <input
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                placeholder="Kondisi"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-brand-600 py-2 text-sm font-medium text-white sm:col-span-3"
              >
                Simpan
              </button>
            </form>
          )}

          {tab === "items" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => {
                const av = itemAvailability(item);
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm"
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                        <Package size={20} />
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          av.ok
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {av.label}
                      </span>
                    </div>
                    <h3 className="font-semibold text-slate-900">{item.name}</h3>
                    <p className="text-xs text-slate-400">
                      {item.condition ?? "Kondisi tidak dicatat"}
                    </p>
                    {item.loans?.[0] && !av.ok && (
                      <p className="mt-2 text-xs text-slate-500">
                        {item.loans[0].member?.fullName ?? "—"} ·{" "}
                        {item.loans[0].status}
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={busy || !av.ok}
                      onClick={() => void request(item.id)}
                      className="mt-4 w-full rounded-full bg-brand-600 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Ajukan pinjam
                    </button>
                  </div>
                );
              })}
              {!items.length && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <EmptyState
                    title="Belum ada aset"
                    description="Pengurus bisa menambah laptop, proyektor, mic, dll."
                    icon={Package}
                    action={
                      pengurus
                        ? {
                            label: "Tambah aset",
                            onClick: () => setShowForm(true),
                          }
                        : undefined
                    }
                  />
                </div>
              )}
            </div>
          )}

          {tab === "mine" && (
            <div className="rounded-2xl border border-brand-100 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-5 py-3">Aset</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Dipinjam</th>
                      <th className="px-5 py-3">Kembali</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myLoans.map((l) => (
                      <tr key={l.id} className="border-t border-slate-50">
                        <td className="px-5 py-3 font-medium">
                          {l.item?.name ?? l.itemId}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle(l.status)}`}
                          >
                            {l.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-500">
                          {l.borrowedAt
                            ? new Date(l.borrowedAt).toLocaleString("id-ID")
                            : "—"}
                        </td>
                        <td className="px-5 py-3 text-slate-500">
                          {l.returnedAt
                            ? new Date(l.returnedAt).toLocaleString("id-ID")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                    {!myLoans.length && (
                      <tr>
                        <td colSpan={4} className="px-5 py-10 text-center text-slate-400">
                          Belum ada pinjaman
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "requests" && pengurus && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-brand-100 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-3">
                  <h3 className="font-semibold text-slate-900">
                    Menunggu approval ({pending.length})
                  </h3>
                </div>
                <ul className="divide-y divide-slate-50">
                  {pending.map((l) => (
                    <li
                      key={l.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {l.item?.name ?? l.itemId}
                        </p>
                        <p className="text-xs text-slate-400">
                          {l.member?.fullName ?? l.memberId}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void act(l.id, "approve")}
                          className="rounded-full bg-brand-600 px-3 py-1.5 text-xs font-medium text-white"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void act(l.id, "reject")}
                          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs"
                        >
                          Reject
                        </button>
                      </div>
                    </li>
                  ))}
                  {!pending.length && (
                    <li className="px-5 py-8 text-center text-sm text-slate-400">
                      Tidak ada request
                    </li>
                  )}
                </ul>
              </div>

              <div className="rounded-2xl border border-brand-100 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-3">
                  <h3 className="font-semibold text-slate-900">
                    Sedang dipinjam ({activeLoans.length})
                  </h3>
                </div>
                <ul className="divide-y divide-slate-50">
                  {activeLoans.map((l) => (
                    <li
                      key={l.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {l.item?.name ?? l.itemId}
                        </p>
                        <p className="text-xs text-slate-400">
                          {l.member?.fullName ?? l.memberId}
                          {l.borrowedAt
                            ? ` · ${new Date(l.borrowedAt).toLocaleDateString("id-ID")}`
                            : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void act(l.id, "return")}
                        className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700"
                      >
                        Catat return
                      </button>
                    </li>
                  ))}
                  {!activeLoans.length && (
                    <li className="px-5 py-8 text-center text-sm text-slate-400">
                      Tidak ada pinjaman aktif
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}
            </>
          )}
    </DashboardShell>
  );
}

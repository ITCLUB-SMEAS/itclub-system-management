export default function LoadingSpinner({
  label = "Memuat...",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-16 text-slate-500 ${className}`}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600"
        aria-hidden
      />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

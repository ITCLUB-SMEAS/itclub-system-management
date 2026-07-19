import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
};

export function PrimaryButton({
  children,
  loading,
  className = "",
  disabled,
  ...rest
}: Props) {
  return (
    <button
      className={`w-full rounded-full bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? "Please wait..." : children}
    </button>
  );
}

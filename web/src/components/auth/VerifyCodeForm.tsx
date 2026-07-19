import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { PrimaryButton } from "./PrimaryButton";
import { authApi } from "../../lib/api";

const LEN = 6;

export default function VerifyCodeForm({ email = "" }: { email?: string }) {
  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(""));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const resolvedEmail =
    email ||
    (typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem("resetEmail") || ""
      : "");

  useEffect(() => {
    const dev = sessionStorage.getItem("devResetCode");
    if (dev && dev.length === LEN) {
      setDigits(dev.split(""));
    }
    inputs.current[0]?.focus();
  }, []);

  function setDigit(i: number, val: string) {
    const v = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < LEN - 1) inputs.current[i + 1]?.focus();
  }

  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LEN);
    if (!text) return;
    const next = Array(LEN).fill("");
    text.split("").forEach((c, i) => {
      next[i] = c;
    });
    setDigits(next);
    inputs.current[Math.min(text.length, LEN - 1)]?.focus();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const code = digits.join("");
    if (code.length < LEN) {
      setError("Masukkan 6 digit kode");
      return;
    }
    if (!resolvedEmail) {
      setError("Email hilang. Ulangi forgot password.");
      return;
    }
    setLoading(true);
    try {
      await authApi.verifyCode(resolvedEmail, code);
      sessionStorage.setItem("resetCode", code);
      sessionStorage.setItem("resetEmail", resolvedEmail);
      window.location.href = `/auth/reset-password?email=${encodeURIComponent(resolvedEmail)}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kode salah");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (!resolvedEmail) return;
    try {
      const res = await authApi.forgotPassword(resolvedEmail);
      if (res.devCode) {
        sessionStorage.setItem("devResetCode", res.devCode);
        setDigits(res.devCode.split(""));
        alert(`Dev code: ${res.devCode}`);
      } else {
        alert("Kode baru dikirim");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal resend");
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <h1 className="text-3xl font-semibold text-slate-900">Verify Code</h1>
      <p className="mt-2 text-sm text-slate-500">
        Please enter the code we just sent to email
      </p>
      {resolvedEmail && (
        <p className="mt-1 text-sm font-medium text-brand-600">{resolvedEmail}</p>
      )}

      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        <div>
          <p className="mb-2 text-sm font-medium text-slate-800">
            Code <span className="text-brand-500">*</span>
          </p>
          <div className="flex gap-2 sm:gap-3" onPaste={onPaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                className="h-12 w-10 sm:h-14 sm:w-12 rounded-full border border-slate-200 text-center text-lg font-semibold text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}

        <PrimaryButton type="submit" loading={loading}>
          Verify
        </PrimaryButton>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500">
        Didn&apos;t receive code?{" "}
        <button
          type="button"
          className="font-semibold text-brand-600 hover:text-brand-700"
          onClick={() => void resend()}
        >
          Resend Code
        </button>
      </p>
    </div>
  );
}

import { useState, type FormEvent } from "react";
import { AuthField } from "./AuthField";
import { PrimaryButton } from "./PrimaryButton";
import { authApi } from "../../lib/api";
import TurnstileWidget, {
  isTurnstileEnabled,
  resetTurnstile,
} from "../common/TurnstileWidget";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [devCode, setDevCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const needCaptcha = isTurnstileEnabled();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (needCaptcha && !turnstileToken) {
      setError("Selesaikan captcha dulu");
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email, turnstileToken || undefined);
      sessionStorage.setItem("resetEmail", email);
      if (res.devCode) {
        setDevCode(res.devCode);
        sessionStorage.setItem("devResetCode", res.devCode);
      }
      setTimeout(() => {
        window.location.href = `/auth/verify-code?email=${encodeURIComponent(email)}`;
      }, res.devCode ? 1500 : 400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal kirim");
      setTurnstileToken("");
      resetTurnstile();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <h1 className="text-3xl font-semibold text-slate-900">Forgot Password?</h1>
      <p className="mt-2 text-sm text-slate-500">
        Don&apos;t worry, We&apos;ll send you reset instructions.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <AuthField
          label="Email"
          name="email"
          type="email"
          required
          placeholder="Enter email here"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TurnstileWidget
          onToken={setTurnstileToken}
          onExpire={() => setTurnstileToken("")}
        />
        {devCode && (
          <div className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700">
            Dev code: <strong>{devCode}</strong>
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}
        <PrimaryButton type="submit" loading={loading}>
          Submit
        </PrimaryButton>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500">
        Remember Password?{" "}
        <a href="/auth/sign-in" className="font-semibold text-brand-600 hover:text-brand-700">
          Sign In
        </a>
      </p>
    </div>
  );
}

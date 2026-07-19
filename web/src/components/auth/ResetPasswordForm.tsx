import { useState, type FormEvent } from "react";
import { PasswordField } from "./PasswordField";
import { PrimaryButton } from "./PrimaryButton";
import { authApi } from "../../lib/api";
import TurnstileWidget, {
  isTurnstileEnabled,
  resetTurnstile,
} from "../common/TurnstileWidget";

export default function ResetPasswordForm({ email = "" }: { email?: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const needCaptcha = isTurnstileEnabled();

  const resolvedEmail =
    email ||
    (typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem("resetEmail") || ""
      : "");
  const code =
    typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem("resetCode") || ""
      : "";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password minimal 8 karakter");
      return;
    }
    if (password !== confirm) {
      setError("Password tidak cocok");
      return;
    }
    if (!resolvedEmail || !code) {
      setError("Sesi reset hilang. Ulangi dari forgot password.");
      return;
    }
    if (needCaptcha && !turnstileToken) {
      setError("Selesaikan captcha dulu");
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword(
        resolvedEmail,
        code,
        password,
        turnstileToken || undefined,
      );
      sessionStorage.removeItem("resetCode");
      sessionStorage.removeItem("resetEmail");
      sessionStorage.removeItem("devResetCode");
      setSuccess(true);
      setTimeout(() => {
        window.location.href = "/auth/sign-in";
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal reset");
      setTurnstileToken("");
      resetTurnstile();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <h1 className="text-3xl font-semibold text-slate-900">Set New Password</h1>
      <p className="mt-2 text-sm text-slate-500">Must be at least 8 characters</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <PasswordField
          label="Password"
          name="password"
          required
          minLength={8}
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordField
          label="Confirm Password"
          name="confirm"
          required
          minLength={8}
          placeholder="Enter password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        <TurnstileWidget
          onToken={setTurnstileToken}
          onExpire={() => setTurnstileToken("")}
        />

        {error && (
          <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}
        {success && (
          <div className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700">
            Password updated. Redirecting...
          </div>
        )}

        <PrimaryButton type="submit" loading={loading}>
          Reset Password
        </PrimaryButton>
      </form>
    </div>
  );
}

import { useState, type FormEvent } from "react";
import { AuthField } from "./AuthField";
import { PasswordField } from "./PasswordField";
import { PrimaryButton } from "./PrimaryButton";
import { authApi } from "../../lib/api";
import TurnstileWidget, {
  isTurnstileEnabled,
  resetTurnstile,
} from "../common/TurnstileWidget";

export default function SignInForm() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [turnstileToken, setTurnstileToken] = useState("");
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
      await authApi.login(identifier, password, turnstileToken || undefined);
      void remember;
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal");
      setTurnstileToken("");
      resetTurnstile();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <h1 className="text-3xl font-semibold text-slate-900">Sign In</h1>
      <p className="mt-2 text-sm text-slate-500">
        Please fill your details to access your account
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <AuthField
          label="Email / Username"
          name="identifier"
          type="text"
          required
          placeholder="Enter email or username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
        <PasswordField
          label="Password"
          name="password"
          required
          placeholder="Enter password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
            />
            Remember me
          </label>
          <a
            href="/auth/forgot-password"
            className="font-medium text-brand-600 hover:text-brand-700"
          >
            Forgot Password?
          </a>
        </div>

        <TurnstileWidget
          onToken={setTurnstileToken}
          onExpire={() => setTurnstileToken("")}
        />

        {error && (
          <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}

        <PrimaryButton type="submit" loading={loading}>
          Sign In
        </PrimaryButton>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500">
        Don&apos;t have an account?{" "}
        <a href="/auth/sign-up" className="font-semibold text-brand-600 hover:text-brand-700">
          Sign Up
        </a>
      </p>
    </div>
  );
}

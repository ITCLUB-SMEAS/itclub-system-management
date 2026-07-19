import { useState, type FormEvent } from "react";
import { AuthField } from "./AuthField";
import { PasswordField } from "./PasswordField";
import { PrimaryButton } from "./PrimaryButton";
import { authApi } from "../../lib/api";
import TurnstileWidget, {
  isTurnstileEnabled,
  resetTurnstile,
} from "../common/TurnstileWidget";

export default function SignUpForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [className, setClassName] = useState("");
  const [agree, setAgree] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const needCaptcha = isTurnstileEnabled();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!agree) {
      setError("Setujui Terms & Privacy dulu");
      return;
    }
    if (needCaptcha && !turnstileToken) {
      setError("Selesaikan captcha dulu");
      return;
    }
    setLoading(true);
    try {
      const fullName = `${firstName} ${lastName}`.trim();
      await authApi.register({
        email,
        username: username || email.split("@")[0],
        password,
        fullName,
        className: className || undefined,
        turnstileToken: turnstileToken || undefined,
      });
      setSuccess("Registrasi terkirim. Menunggu approval pengurus.");
      setTimeout(() => {
        window.location.href = "/auth/sign-in";
      }, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registrasi gagal");
      setTurnstileToken("");
      resetTurnstile();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <h1 className="text-3xl font-semibold text-slate-900">Sign Up</h1>
      <p className="mt-2 text-sm text-slate-500">
        Fill your information below to register as a new member
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <AuthField
            label="First Name"
            name="firstName"
            required
            placeholder="Enter first name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <AuthField
            label="Last Name"
            name="lastName"
            required
            placeholder="Enter last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <AuthField
          label="Email"
          name="email"
          type="email"
          required
          placeholder="Enter email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <AuthField
          label="Username"
          name="username"
          placeholder="Optional username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <AuthField
          label="Class"
          name="className"
          placeholder="e.g. XI RPL 1"
          value={className}
          onChange={(e) => setClassName(e.target.value)}
        />
        <PasswordField
          label="Password"
          name="password"
          required
          minLength={8}
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <label className="flex items-start gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
          />
          <span>
            Agree with{" "}
            <span className="font-medium text-brand-600">Terms & Condition</span> and{" "}
            <span className="font-medium text-brand-600">Privacy Policy</span>
          </span>
        </label>

        <TurnstileWidget
          onToken={setTurnstileToken}
          onExpire={() => setTurnstileToken("")}
        />

        {error && (
          <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}
        {success && (
          <div className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700">
            {success}
          </div>
        )}

        <PrimaryButton type="submit" loading={loading}>
          Sign Up
        </PrimaryButton>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <a href="/auth/sign-in" className="font-semibold text-brand-600 hover:text-brand-700">
          Sign In
        </a>
      </p>
    </div>
  );
}

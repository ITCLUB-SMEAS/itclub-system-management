import { useState, type FormEvent } from "react";
import { AuthField } from "../auth/AuthField";
import { PrimaryButton } from "../auth/PrimaryButton";
import { recruitmentApi } from "../../lib/api";
import TurnstileWidget, {
  isTurnstileEnabled,
  resetTurnstile,
} from "../common/TurnstileWidget";

export default function PublicApplyForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [className, setClassName] = useState("");
  const [interestNotes, setInterestNotes] = useState("");
  const [divisionPreference, setDivisionPreference] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
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
      await recruitmentApi.apply({
        fullName,
        email,
        className: className || undefined,
        interestNotes: interestNotes || undefined,
        divisionPreference: divisionPreference || undefined,
        turnstileToken: turnstileToken || undefined,
      });
      setOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal kirim");
      setTurnstileToken("");
      resetTurnstile();
    } finally {
      setLoading(false);
    }
  }

  if (ok) {
    return (
      <div className="w-full max-w-md mx-auto text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-xl font-bold text-brand-600">
          ✓
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">Pendaftaran terkirim</h1>
        <p className="mt-2 text-sm text-slate-500">
          Tim pengurus akan mereview aplikasi kamu. Cek email untuk update.
        </p>
        <a
          href="/auth/sign-in"
          className="mt-6 inline-block text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          Ke halaman login →
        </a>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <h1 className="text-3xl font-semibold text-slate-900">Daftar</h1>
      <p className="mt-2 text-sm text-slate-500">
        Form rekrutmen anggota baru — isi data di bawah
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <AuthField
          label="Nama lengkap"
          name="fullName"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Nama kamu"
        />
        <AuthField
          label="Email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@sekolah.sch.id"
        />
        <AuthField
          label="Kelas"
          name="className"
          value={className}
          onChange={(e) => setClassName(e.target.value)}
          placeholder="X RPL 1"
        />
        <AuthField
          label="Preferensi divisi"
          name="divisionPreference"
          value={divisionPreference}
          onChange={(e) => setDivisionPreference(e.target.value)}
          placeholder="Web / Mobile / UI-UX / CP"
        />
        <div className="space-y-1.5">
          <label htmlFor="interestNotes" className="block text-sm font-medium text-slate-800">
            Minat / bakat
          </label>
          <textarea
            id="interestNotes"
            value={interestNotes}
            onChange={(e) => setInterestNotes(e.target.value)}
            rows={3}
            placeholder="Web, mobile, UI/UX, competitive programming..."
            className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <TurnstileWidget
          onToken={setTurnstileToken}
          onExpire={() => setTurnstileToken("")}
        />
        {error && (
          <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
            {error}
          </div>
        )}
        <PrimaryButton type="submit" loading={loading}>
          Kirim pendaftaran
        </PrimaryButton>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500">
        Sudah punya akun?{" "}
        <a href="/auth/sign-in" className="font-semibold text-brand-600 hover:text-brand-700">
          Sign In
        </a>
      </p>
    </div>
  );
}

import { useState } from "react";
import type { Dict } from "../i18n";

interface Props {
  t: Dict;
  busy: boolean;
  error: string | null;
  onUnlock: (passphrase: string, remember: boolean) => void;
}

/** Passphrase gate for the encrypted static snapshot (personal pilot data is never published openly). */
export function Unlock({ t, busy, error, onUnlock }: Props) {
  const [value, setValue] = useState("");
  const [remember, setRemember] = useState(true);
  return (
    <section className="unlock" aria-labelledby="unlock-title">
      <h1 id="unlock-title">{t.unlockTitle}</h1>
      <p className="muted">{t.unlockBody}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value) onUnlock(value, remember);
        }}
      >
        <div className="field">
          <label htmlFor="pass">{t.passphrase}</label>
          <input id="pass" type="password" autoComplete="current-password" value={value} onChange={(e) => setValue(e.target.value)} required />
        </div>
        <label className="check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          {t.rememberDevice}
        </label>
        {error && (
          <p className="notice notice--error" role="alert">
            {t.errors[error] ?? t.errors.internal_error}
          </p>
        )}
        <button className="btn btn--primary" type="submit" disabled={busy || !value}>
          {busy ? t.unlocking : t.unlock}
        </button>
      </form>
    </section>
  );
}

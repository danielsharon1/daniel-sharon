import { useEffect, useRef, useState } from "react";
import type { IdentifyResponse } from "@plantfinder/shared";
import type { Dict } from "../i18n";
import { api, ApiError } from "../api";

interface Props {
  open: boolean;
  available: boolean;
  /** Image URL handed over by the extension (?identifyUrl=…); identified once when the dialog opens. */
  initialUrl?: string | null;
  t: Dict;
  onClose: () => void;
  onPick: (query: string) => void;
}

export function PhotoSearch({ open, available, initialUrl, t, onClose, onPick }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IdentifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => () => void (preview?.startsWith("blob:") && URL.revokeObjectURL(preview)), [preview]);

  const [urlDone, setUrlDone] = useState(false);
  useEffect(() => {
    if (!open || !available || !initialUrl || urlDone) return;
    setUrlDone(true);
    setPreview(initialUrl);
    setBusy(true);
    api
      .identifyUrl(initialUrl)
      .then(setResult)
      .catch((e: unknown) => {
        const code = e instanceof ApiError ? e.code : "default";
        setError(code === "identify_unavailable" ? t.photoUnavailable : t.photoErrors[code] ?? t.photoErrors.default!);
      })
      .finally(() => setBusy(false));
  }, [open, available, initialUrl, urlDone, t]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    try {
      setResult(await api.identify(file));
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "default";
      setError(code === "identify_unavailable" ? t.photoUnavailable : t.photoErrors[code] ?? t.photoErrors.default!);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={ref} className="sheet" onClose={onClose} aria-labelledby="photo-title">
      <form method="dialog" className="sheet__head">
        <h2 id="photo-title">{t.photoTitle}</h2>
        <button className="btn btn--quiet" aria-label={t.cancel}>
          ✕
        </button>
      </form>
      <p className="muted">{t.photoBody}</p>
      {!available ? (
        <p className="notice notice--info">{t.photoUnavailable}</p>
      ) : (
        <label className="btn btn--primary file">
          {busy ? t.identifying : t.choosePhoto}
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy} onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
      )}
      {preview && <img className="sheet__preview" src={preview} alt="" />}
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <div aria-live="polite">
          {result.candidates.length === 0 ? (
            <p className="notice notice--info">{t.noMatch}</p>
          ) : (
            <>
              {result.note === "low_confidence" && <p className="notice notice--info">{t.lowConfidence}</p>}
              <h3>{t.candidates}</h3>
              <ul className="candidates">
                {result.candidates.map((c) => (
                  <li key={c.scientificName}>
                    <div>
                      <strong>{c.he ?? c.commonNames[0] ?? c.scientificName}</strong>{" "}
                      <i lang="la" dir="ltr">
                        {c.scientificName}
                      </i>
                      <div className="meter" role="img" aria-label={t.confidence(Math.round(c.score * 100))}>
                        <span style={{ inlineSize: `${Math.round(c.score * 100)}%` }} />
                      </div>
                      <span className="muted">
                        {t.confidence(Math.round(c.score * 100))}
                        {!c.taxonId && `, ${t.notInCatalog}`}
                      </span>
                    </div>
                    <button className="btn" onClick={() => onPick(c.he ?? c.scientificName)}>
                      {t.searchThis}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="muted small">Pl@ntNet</p>
            </>
          )}
        </div>
      )}
    </dialog>
  );
}

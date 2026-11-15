import { useEffect, useRef } from "react";
import type { SourcePublicInfo, SourceRunStatus } from "@plantfinder/shared";
import type { Dict, Lang } from "../i18n";
import { formatDateTime } from "../format";

interface Props {
  open: boolean;
  sources: SourcePublicInfo[];
  runs: SourceRunStatus[];
  t: Dict;
  lang: Lang;
  onClose: () => void;
}

export function SourcesPanel({ open, sources, runs, t, lang, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const active = sources.filter((s) => s.enabled);
  const inactive = sources.filter((s) => !s.enabled);
  const runFor = (id: string) => runs.find((r) => r.sourceId === id);

  return (
    <dialog ref={ref} className="sheet sheet--wide" onClose={onClose} aria-labelledby="sources-title">
      <form method="dialog" className="sheet__head">
        <h2 id="sources-title">{t.sources}</h2>
        <button className="btn btn--quiet" aria-label={t.cancel}>
          ✕
        </button>
      </form>
      <p>{t.sourcesIntro}</p>
      <table className="sources">
        <caption className="sr-only">{t.sourceActive}</caption>
        <thead>
          <tr>
            <th scope="col">{t.field.seller}</th>
            <th scope="col">{t.field.locality}</th>
            <th scope="col">{t.lastRefreshed}</th>
            <th scope="col">{t.terms}</th>
          </tr>
        </thead>
        <tbody>
          {active.map((s) => {
            const run = runFor(s.id);
            const when = run?.retrievedAt ?? s.lastRefreshedAt;
            return (
              <tr key={s.id}>
                <th scope="row">
                  <a href={s.homepage} target="_blank" rel="noopener">
                    {s.name[lang]}
                  </a>
                  <div className="muted small" dir="ltr" lang="en">
                    {s.audit.method}
                  </div>
                  {run && run.status !== "ok" && (
                    <div className="notice notice--error small" dir="ltr" lang="en">
                      {run.message}
                    </div>
                  )}
                </th>
                <td className={s.seller.location ? "" : "unknown"}>{s.seller.location ? s.seller.location.label[lang] : t.unknownLocation}</td>
                <td>{when ? formatDateTime(when, lang) : t.never}</td>
                <td className="small" dir="ltr" lang="en">
                  {s.audit.terms}
                  <div className="muted">{s.audit.permission}</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <h3>{t.sourceInactive}</h3>
      <ul className="inactive">
        {inactive.map((s) => (
          <li key={s.id}>
            <strong>{s.name[lang]}</strong>{" "}
            <span className="muted" dir="ltr" lang="en">
              {s.disabledReason}
            </span>
          </li>
        ))}
      </ul>
    </dialog>
  );
}

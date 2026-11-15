import { useState } from "react";
import type { ResultItem } from "@plantfinder/shared";
import type { Dict, Lang } from "../i18n";
import { formatDateTime, formatPrice } from "../format";

interface Props {
  item: ResultItem;
  t: Dict;
  lang: Lang;
  sourceName: string;
}

function sizeText(item: ResultItem, t: Dict): string {
  const s = item.size;
  const parts: string[] = [];
  if (s.sizeClass) parts.push(t.sizes[s.sizeClass]);
  if (s.potDiameterCm) parts.push(t.potDiameter(s.potDiameterCm));
  if (s.heightCm) parts.push(t.height(s.heightCm.min, s.heightCm.max));
  if (s.potVolumeL) parts.push(t.volume(s.potVolumeL));
  return parts.length ? parts.join(", ") : t.sizeUnknown;
}

const BADGE_FLAGS = ["demo", "stale", "permission_pending", "on_sale"] as const;

export function ListingLabel({ item, t, lang, sourceName }: Props) {
  const c = item.classification;
  const seller = item.seller;
  const name = seller.name[lang];
  const loc = seller.location;
  const pickup = t.pickup[seller.pickup];
  const confidencePct = Math.round(c.confidence * 100);
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <article className={`label label--${item.bucket}`} aria-label={`${item.title}, ${name}`}>
      <div className="label__media">
        {item.imageUrl && !imageFailed ? (
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            width={112}
            height={112}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="label__noimg">{t.noImage}</span>
        )}
      </div>

      <div className="label__head">
        <h3 className="label__title">
          <bdi>{item.title}</bdi>
        </h3>
        {c.scientificName && (
          <p className="label__binomial">
            <bdi lang="la">
              <i>{c.scientificName}</i>
              {c.cultivar && <span className="label__cultivar"> ‘{c.cultivar}’</span>}
            </bdi>
          </p>
        )}
      </div>

      <dl className="label__fields">
          <div>
            <dt>{t.field.determination}</dt>
            <dd>
              <span className={`det det--${c.level}`}>{t.levels[c.level](c.cultivar)}</span>
              <span className="det__pct">{t.confidence(confidencePct)}</span>
            </dd>
          </div>
          <div>
            <dt>{t.field.size}</dt>
            <dd>
              {sizeText(item, t)}
              {item.variant && item.variant.options > 1 && <span className="muted"> ({t.variantOptions(item.variant.options)})</span>}
            </dd>
          </div>
          <div>
            <dt>{t.field.seller}</dt>
            <dd>
              {name}
              {pickup && <span className="muted"> ({pickup})</span>}
            </dd>
          </div>
          <div>
            <dt>{t.field.locality}</dt>
            <dd className={loc ? "" : "unknown"}>
              {loc ? (
                <>
                  {loc.label[lang]} <span className="muted">({loc.precision === "address" ? t.addressPrecision : t.localityPrecision})</span>
                </>
              ) : (
                t.unknownLocation
              )}
            </dd>
          </div>
          {item.distanceKm !== null && (
            <div>
              <dt>{t.field.distance}</dt>
              <dd>{t.kmAway(item.distanceKm)}</dd>
            </div>
          )}
          {!loc && seller.delivery && (
            <div>
              <dt>{t.field.delivery}</dt>
              <dd>{seller.delivery[lang]}</dd>
            </div>
          )}
          <div>
            <dt>{t.field.stock}</dt>
            <dd className={`stock stock--${item.availability}`}>{t.availability[item.availability]}</dd>
          </div>
          <div>
            <dt>{t.field.checked}</dt>
            <dd>
              <time dateTime={item.provenance.retrievedAt}>{formatDateTime(item.provenance.retrievedAt, lang)}</time>
            </dd>
          </div>
      </dl>

      <div className="label__foot">
          <a className="label__link" href={item.url} target="_blank" rel="noopener">
            {t.openListing(sourceName)}
          </a>
          <span className="label__badges">
            {BADGE_FLAGS.filter((f) => item.flags.includes(f)).map((f) => (
              <span key={f} className={`badge badge--${f}`}>
                {t.flags[f]}
              </span>
            ))}
          </span>
      </div>

      <div className={`sticker${item.price.amount === null ? " sticker--none" : ""}`}>
        {item.price.amount === null ? (
          <span className="sticker__amount">{t.priceUnknown}</span>
        ) : (
          <>
            {item.price.kind === "from" && <span className="sticker__from">{t.priceFrom}</span>}
            <span className="sticker__amount">{formatPrice(item.price.amount, lang)}</span>
            {item.price.onSale && item.price.regularAmount !== null && (
              <span className="sticker__was">{t.wasPrice(formatPrice(item.price.regularAmount, lang))}</span>
            )}
          </>
        )}
      </div>
    </article>
  );
}

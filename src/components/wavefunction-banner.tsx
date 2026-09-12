import type { CSSProperties } from "react";

type WavefunctionBannerProps = {
  accent: string;
  compact?: boolean;
  description?: string;
  label: string;
  title?: string;
};

export function WavefunctionBanner({
  accent,
  compact = false,
  description,
  label,
  title,
}: WavefunctionBannerProps) {
  return (
    <div
      className={`waveBanner ${compact ? "waveBanner--compact" : ""}`}
      style={{ "--wave-accent": accent } as CSSProperties}
    >
      <div className="waveBanner__copy">
        <p className="waveBanner__label">{label}</p>
        {title ? (
          compact ? (
            <p className="waveBanner__title">{title}</p>
          ) : (
            <h1 className="waveBanner__title">{title}</h1>
          )
        ) : null}
        {description ? <p className="waveBanner__description">{description}</p> : null}
      </div>

      <svg
        aria-hidden="true"
        className="waveBanner__graphic"
        viewBox="0 0 720 240"
        fill="none"
      >
        <path className="waveBanner__guide" d="M20 120H700" />
        <path
          className="waveBanner__curve waveBanner__curve--ground"
          d="M20 120C60 120 78 34 122 34C166 34 172 206 224 206C276 206 276 52 334 52C392 52 398 188 454 188C510 188 524 94 576 94C628 94 648 120 700 120"
        />
        <path
          className="waveBanner__curve waveBanner__curve--excited"
          d="M20 120C74 120 82 208 136 208C190 208 196 28 250 28C304 28 308 212 364 212C420 212 420 40 480 40C540 40 548 198 606 198C664 198 672 120 700 120"
        />
        <path
          className="waveBanner__curve waveBanner__curve--fine"
          d="M20 120C46 120 56 84 82 84C108 84 118 156 146 156C174 156 186 72 214 72C242 72 250 170 282 170C314 170 320 60 356 60C392 60 398 180 436 180C474 180 482 88 520 88C558 88 564 154 604 154C644 154 654 120 700 120"
        />
        <circle className="waveBanner__node" cx="122" cy="34" r="7" />
        <circle className="waveBanner__node" cx="224" cy="206" r="7" />
        <circle className="waveBanner__node" cx="334" cy="52" r="7" />
        <circle className="waveBanner__node" cx="454" cy="188" r="7" />
        <circle className="waveBanner__node" cx="576" cy="94" r="7" />
      </svg>
    </div>
  );
}

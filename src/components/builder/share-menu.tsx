"use client";

import { useCallback, useId, useRef, useState } from "react";

import { Icon } from "@/components/builder/builder-icons";
import { SHARE_URL_SAFE_LENGTH } from "@/components/builder/share-link";
import { useBubbleDismiss } from "@/components/builder/use-bubble-dismiss";

const SHARE_TITLE = "QUOP setup";

/**
 * Share, beside the QUOP mark: a small popover that sends the setup on as a
 * link carrying it whole. Copy link comes first; the system share sheet where
 * there is one; an email; and the .json file, which no app can cut short.
 */
export function ShareMenu({
  getShareUrl,
  onCopyLink,
  onDownload,
}: {
  /** the page's address with the setup in its hash, as it stands now */
  getShareUrl: () => string;
  onCopyLink: () => void;
  onDownload: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setUrl(null), []);
  const ref = useBubbleDismiss(url !== null, close);
  const noteId = useId();
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  // each item closes the popover and hands focus back to the button
  const done = (run?: () => void) => () => {
    run?.();
    close();
    buttonRef.current?.focus();
  };

  const long = url !== null && url.length > SHARE_URL_SAFE_LENGTH;

  return (
    <div className="builderShare" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        className={`builderIconBtn${url !== null ? " is-active" : ""}`}
        aria-label="Share"
        aria-expanded={url !== null}
        aria-haspopup="dialog"
        title="Share"
        onClick={() => setUrl((current) => (current === null ? getShareUrl() : null))}
        onKeyDown={(event) => {
          if (event.key === "Escape" && url !== null) buttonRef.current?.focus();
        }}
      >
        <Icon name="share" />
      </button>
      {url !== null ? (
        <div
          className="builderMenu__list builderShare__list"
          role="dialog"
          aria-label="Share this setup"
          aria-describedby={long ? noteId : undefined}
          onKeyDown={(event) => {
            if (event.key === "Escape") buttonRef.current?.focus();
          }}
        >
          <button type="button" className="builderShare__primary" autoFocus onClick={done(onCopyLink)}>
            Copy link
          </button>
          {canShare ? (
            <button
              type="button"
              onClick={done(() => {
                // a dismissed share sheet rejects; nothing to say about it
                navigator.share({ title: SHARE_TITLE, url }).catch(() => {});
              })}
            >
              Share…
            </button>
          ) : null}
          <button
            type="button"
            onClick={done(() => {
              window.location.href = `mailto:?subject=${encodeURIComponent(SHARE_TITLE)}&body=${encodeURIComponent(url)}`;
            })}
          >
            Email
          </button>
          <button type="button" onClick={done(onDownload)}>
            Download .json
          </button>
          {long ? (
            <p id={noteId} className="builderShare__note">
              Large setup: link may break in some apps; Download .json is safer.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

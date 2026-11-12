"use client";

import { useCallback, useRef, useState } from "react";

import { Icon } from "@/components/builder/builder-icons";
import { FanBoxes, type CornerFanItem } from "@/components/builder/corner-fan";
import { SHARE_URL_SAFE_LENGTH } from "@/components/builder/share-link";
import { useBubbleDismiss } from "@/components/builder/use-bubble-dismiss";

const SHARE_TITLE = "QUOP setup";

/**
 * Share, top right beside the ?: a column of boxes down the edge that sends
 * the setup on as a link carrying it whole. Copy link comes first; the system
 * share sheet where there is one; an email; and the .json file, which no app
 * can cut short. A setup too large for a safe link says so under the column.
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
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  // a box runs, closes the column and hands focus back to the button
  const closeToButton = () => {
    close();
    buttonRef.current?.focus();
  };

  const long = url !== null && url.length > SHARE_URL_SAFE_LENGTH;
  const items: CornerFanItem[] =
    url === null
      ? []
      : [
          { id: "copy", label: "Copy link", icon: "copy", hint: "Copy a link carrying the setup", run: onCopyLink },
          ...(canShare
            ? [
                {
                  id: "share",
                  label: "Share…",
                  icon: "share" as const,
                  hint: "The system share sheet",
                  run: () => {
                    // a dismissed share sheet rejects; nothing to say about it
                    navigator.share({ title: SHARE_TITLE, url }).catch(() => {});
                  },
                },
              ]
            : []),
          {
            id: "email",
            label: "Email",
            icon: "mail",
            hint: "Send the link in an email",
            run: () => {
              window.location.href = `mailto:?subject=${encodeURIComponent(SHARE_TITLE)}&body=${encodeURIComponent(url)}`;
            },
          },
          { id: "json", label: ".json", icon: "floppy", file: true, hint: "Download the setup file", run: onDownload },
        ];

  return (
    <div className="builderShare" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        className={`builderIconBtn${url !== null ? " is-active" : ""}`}
        aria-label="Share"
        aria-expanded={url !== null}
        aria-haspopup="menu"
        title="Share"
        onClick={() => setUrl((current) => (current === null ? getShareUrl() : null))}
      >
        <Icon name="share" />
      </button>
      {url !== null ? (
        <FanBoxes
          corner="tr"
          label="Share this setup"
          items={items}
          note={long ? "Large setup: the link may break in some apps; .json is safer." : undefined}
          onPick={(item) => {
            item.run();
            closeToButton();
          }}
          onClose={closeToButton}
        />
      ) : null}
    </div>
  );
}

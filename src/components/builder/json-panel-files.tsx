"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";

import { IconButton } from "@/components/builder/builder-icons";

/**
 * Asked once a .json is picked in the JSON panel: replace the table with it
 * (as a draft in the box, for Apply) or add it to the table as it stands.
 * Esc cancels.
 */
function OpenChoiceDialog({
  fileName,
  onChoose,
}: {
  fileName: string;
  onChoose: (choice: "replace" | "add" | null) => void;
}) {
  // capture, as the panels' Esc does; the JSON panel leaves an open dialog's Esc to it
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onChoose(null);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onChoose]);
  return (
    <div className="builderImportChoice__backdrop">
      <section
        className="builderIsland builderImportChoice"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="builderOpenChoiceTitle"
        aria-describedby="builderOpenChoiceText"
      >
        <h2 id="builderOpenChoiceTitle" className="builderAbout__title">
          Open {fileName}
        </h2>
        <p id="builderOpenChoiceText" className="builderAbout__description">
          Replace the table: the file fills the box, and Apply puts it on the table. Add to the table: it joins
          what is there, as a group saved with Export group… does.
        </p>
        <div className="builderBrief__actions">
          <button type="button" className="builderButton builderButton--primary" autoFocus onClick={() => onChoose("replace")}>
            Replace the table
          </button>
          <button type="button" className="builderButton" onClick={() => onChoose("add")}>
            Add to the table
          </button>
          <button type="button" className="builderButton" onClick={() => onChoose(null)}>
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}

/**
 * The JSON panel's icon row, after Apply: copy, paste, save the table as a
 * .json, and open one. An opened file asks whether it replaces the table, as
 * a draft in the box (`onReplace`), or is added to it (`onAdd`, the merge,
 * which asks again about a group already on the table). A file over the size
 * limit goes to either without its text, for the same message as before.
 */
export function JsonPanelFiles({
  onCopy,
  onPaste,
  onSave,
  onReplace,
  onAdd,
}: {
  onCopy: () => void;
  onPaste: () => void;
  onSave: () => void;
  onReplace: (file: File) => void;
  onAdd: (file: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLSpanElement>(null);
  // the file, and where its dialog goes: over the whole workspace, not inside
  // the panel, whose blur would hold the backdrop in
  const [picked, setPicked] = useState<{ file: File; host: Element } | null>(null);

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) setPicked({ file, host: rowRef.current?.closest(".builderWorkspace") ?? document.body });
  };
  const choose = (choice: "replace" | "add" | null) => {
    const file = picked?.file;
    setPicked(null);
    if (!file || !choice) return;
    if (choice === "replace") onReplace(file);
    else onAdd(file);
  };

  return (
    <span className="builderJson__icons" ref={rowRef}>
      <IconButton icon="copy" label="Copy the JSON" onClick={onCopy} />
      <IconButton icon="paste" label="Paste JSON into the box" onClick={onPaste} />
      <IconButton icon="floppy" label="Save as .json" onClick={onSave} />
      <IconButton icon="folder" label="Open a .json…" onClick={() => fileRef.current?.click()} />
      {/* No accept filter: macOS sometimes greys out .json files the first
          time the picker opens; the check turns away anything that isn't one. */}
      <input ref={fileRef} type="file" hidden onChange={pick} />
      {picked ? createPortal(<OpenChoiceDialog fileName={picked.file.name} onChoose={choose} />, picked.host) : null}
    </span>
  );
}

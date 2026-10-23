"use client";

import { useRef, useState, type ChangeEvent } from "react";

// what a CSV plotter takes: any comma- or tab-separated text table
export const TABLE_FILE_ACCEPT =
  ".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain";

/**
 * A plotter's file picker, in place of the browser's "Choose File / No file
 * chosen": one flat outlined box, "Choose file", with "or drop it here"
 * beside it, that names the file it was given. The whole row takes a drop,
 * and is outlined dashed while a file is held over it. A dropped file goes
 * through the same `onChange` as one picked, by handing the dropped files
 * to the input and firing its change event.
 */
export function FileDrop({
  kind,
  accept,
  multiple = false,
  onChange,
}: {
  /** what to give it, as in "Choose a CSV file" */
  kind: string;
  accept: string;
  multiple?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [names, setNames] = useState<string[]>([]);
  const [over, setOver] = useState(false);

  return (
    <div
      className={`fileDrop${over ? " is-over" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        const input = inputRef.current;
        if (!input || event.dataTransfer.files.length === 0) return;
        input.files = event.dataTransfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }}
    >
      <input
        ref={inputRef}
        aria-label={`Choose ${multiple ? `${kind}s` : `a ${kind}`}`}
        className="fileDrop__input"
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(event) => {
          setNames(Array.from(event.target.files ?? [], (file) => file.name));
          onChange(event);
        }}
      />
      <span className="fileDrop__prompt">
        <span className="fileDrop__button">Choose {multiple ? "files" : "file"}</span>
        or drop {multiple ? "them" : "it"} here
      </span>
      {names.length ? <span className="fileDrop__name">{names.join(", ")}</span> : null}
    </div>
  );
}

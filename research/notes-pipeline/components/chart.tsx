"use client";
import { useState } from "react";

// Stand-in for an animated Chart.js chart: proves the client component
// hydrates and receives its props (a data array) from the note.
export function Chart({ data, title }: { data?: number[] | string; title?: string }) {
  const values = typeof data === "string" ? data.split(",").map(Number) : (data ?? []);
  const [step, setStep] = useState(0);
  return (
    <figure data-chart={JSON.stringify(values)}>
      <figcaption>
        {title ?? "chart"}: {values.slice(0, step + 1).join(" ")}
      </figcaption>
      <button onClick={() => setStep((s) => (s + 1) % Math.max(values.length, 1))}>step</button>
    </figure>
  );
}

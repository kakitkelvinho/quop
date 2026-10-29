"use client";

import { useState, type ReactNode } from "react";

import { LinkedFields } from "@/components/calculators/linked-fields";
import {
  editField,
  paceQuantity,
  speedQuantity,
  type LinkedPair,
} from "@/components/calculators/linked-pair";
import { ToolIntro } from "@/components/tool-intro";

/** `children`: the working under the fields, typeset on the server. */
export function PaceCalculator({ children }: { children?: ReactNode }) {
  const [pair, setPair] = useState<LinkedPair>(() => editField(0, "4:30"));

  return (
    <section className="pageSection">
      <ToolIntro href="/calculators/pace" />

      <div className="calculatorSheet">
        <LinkedFields
          pair={pair}
          onEdit={(side, text) => setPair(editField(side, text))}
          fields={[
            // a pace is written m:ss, which a decimal keypad has no colon for
            { label: "Pace", quantity: paceQuantity, unit: "/km", inputMode: "text", decimalNote: false },
            { label: "Speed", quantity: speedQuantity, unit: "km/h" },
          ]}
        />
      </div>

      {children}
    </section>
  );
}

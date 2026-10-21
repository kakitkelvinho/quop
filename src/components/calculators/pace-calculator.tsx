"use client";

import { useState } from "react";

import { LinkedFields } from "@/components/calculators/linked-fields";
import {
  editField,
  paceQuantity,
  speedQuantity,
  type LinkedPair,
} from "@/components/calculators/linked-pair";
import { ToolIntro } from "@/components/tool-intro";

export function PaceCalculator() {
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
    </section>
  );
}

"use client";

import { useState } from "react";

import { LinkedFields } from "@/components/calculators/linked-fields";
import {
  editField,
  energyQuantity,
  wavelengthQuantity,
  type LinkedPair,
} from "@/components/calculators/linked-pair";
import { ToolIntro } from "@/components/tool-intro";

export function EnergyWavelengthCalculator() {
  const [pair, setPair] = useState<LinkedPair>(() => editField(0, "550"));

  return (
    <section className="pageSection">
      <ToolIntro href="/calculators/energy-wavelength-calculator" />

      <div className="calculatorSheet">
        <LinkedFields
          pair={pair}
          onEdit={(side, text) => setPair(editField(side, text))}
          fields={[
            { label: "Wavelength", quantity: wavelengthQuantity, unit: "nm" },
            { label: "Energy", quantity: energyQuantity, unit: "eV" },
          ]}
        />
      </div>
    </section>
  );
}

"use client";

import { useState, type ReactNode } from "react";

import { formatSignificant } from "@/components/calculators/format-quantity";
import { LinkedFields } from "@/components/calculators/linked-fields";
import {
  editField,
  energyQuantity,
  ramanShiftQuantity,
  scatteredWavelengthQuantity,
  wavelengthQuantity,
  wavenumberFromEnergy,
  type LinkedPair,
} from "@/components/calculators/linked-pair";
import { ToolIntro } from "@/components/tool-intro";

/** `children`: the working under the fields, typeset on the server. */
export function EnergyWavelengthCalculator({ children }: { children?: ReactNode }) {
  const [pair, setPair] = useState<LinkedPair>(() => editField(0, "550"));
  const [raman, setRaman] = useState<LinkedPair>(() => editField(0, "1000"));

  // The photon above is the Raman excitation line.
  const photonJoules = [wavelengthQuantity, energyQuantity][pair.source].read(pair.text);
  const excitationWavenumber = photonJoules === null ? null : wavenumberFromEnergy(photonJoules);

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
        <p className="readoutAside">
          <span className="readoutAside__item">
            Wavenumber <span className="readout__formula">1/λ</span>{" "}
            <span className="readoutAside__value">
              {excitationWavenumber === null ? "—" : `${formatSignificant(excitationWavenumber, 6)} cm⁻¹`}
            </span>
          </span>
        </p>

        <div className="calculatorSheet__result">
          <h2 className="calculatorSheet__heading">
            Raman shift
            <span className="calculatorSheet__headingAside">excited at the wavelength above</span>
          </h2>
          <LinkedFields
            pair={raman}
            onEdit={(side, text) => setRaman(editField(side, text))}
            fields={[
              { label: "Raman shift", quantity: ramanShiftQuantity(excitationWavenumber), unit: "cm⁻¹" },
              { label: "Scattered wavelength", quantity: scatteredWavelengthQuantity, unit: "nm" },
            ]}
          />
        </div>
      </div>

      {children}
    </section>
  );
}

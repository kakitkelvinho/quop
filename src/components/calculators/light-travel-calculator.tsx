"use client";

import { useState, type ReactNode } from "react";

import { LinkedFields } from "@/components/calculators/linked-fields";
import {
  changeUnit,
  DISTANCE_UNITS,
  distanceQuantity,
  editField,
  TIME_UNITS,
  timeQuantity,
  unitLabel,
  type DistanceUnit,
  type LinkedPair,
  type TimeUnit,
} from "@/components/calculators/linked-pair";
import { ToolIntro } from "@/components/tool-intro";

const unitOptions = (units: Record<string, number>) =>
  Object.keys(units).map((unit) => ({ value: unit, label: unitLabel(unit) }));

const TIME_OPTIONS = unitOptions(TIME_UNITS);
const DISTANCE_OPTIONS = unitOptions(DISTANCE_UNITS);

/** `children`: the working under the fields, typeset on the server. */
export function LightTravelCalculator({ children }: { children?: ReactNode }) {
  const [pair, setPair] = useState<LinkedPair>(() => editField(0, "30"));
  const [timeUnit, setTimeUnit] = useState<TimeUnit>("fs");
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>("um");

  return (
    <section className="pageSection">
      <ToolIntro href="/calculators/light-travel-calculator" />

      <div className="calculatorSheet">
        <LinkedFields
          pair={pair}
          onEdit={(side, text) => setPair(editField(side, text))}
          fields={[
            {
              label: "Time",
              quantity: timeQuantity(timeUnit),
              unit: unitLabel(timeUnit),
              units: {
                value: timeUnit,
                options: TIME_OPTIONS,
                onChange: (value) => {
                  const next = value as TimeUnit;
                  setPair(changeUnit(pair, 0, timeQuantity(timeUnit), timeQuantity(next)));
                  setTimeUnit(next);
                },
              },
            },
            {
              label: "Distance",
              quantity: distanceQuantity(distanceUnit),
              unit: unitLabel(distanceUnit),
              units: {
                value: distanceUnit,
                options: DISTANCE_OPTIONS,
                onChange: (value) => {
                  const next = value as DistanceUnit;
                  setPair(changeUnit(pair, 1, distanceQuantity(distanceUnit), distanceQuantity(next)));
                  setDistanceUnit(next);
                },
              },
            },
          ]}
        />
      </div>

      {children}
    </section>
  );
}

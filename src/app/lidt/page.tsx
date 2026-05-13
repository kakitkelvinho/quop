"use client";
import Link from "next/link";
import { useState, type Dispatch, type SetStateAction } from "react";

type Laser = {
  power: number;
  repetition: number;
  w0: number;
  wvlen: number;
};

type LaserProp = {
  property: number;
  field: string;
  setter: Dispatch<SetStateAction<Laser>>;
  property_name: string;
  unit: string;
};
function LaserProperty(props: LaserProp) {
  return (
    <p>
      <label>
        {props.field}:{" "}
        <input
          inputMode="decimal"
          value={props.property}
          type="number"
          step="any"
          min="0"
          onChange={(e) => {
            props.setter((prev: Laser) => ({
              ...prev,
              [props.property_name]: parseFloat(e.target.value),
            }));
          }}
        />
        {props.unit}
      </label>
    </p>
  );
}

export default function LIDT() {
  //const [lidt, setLidt] = useState(5); // default: 5 J/cm^2
  const [laser, setLaser] = useState<Laser>({
    power: 1.0, // Watts, average power
    repetition: 1000, // Hz
    w0: 1.1, //cm, 1/e^2 waist
    wvlen: 980, //nm, wavelength
  });

  const energy = laser.power / laser.repetition;
  const density = energy / (Math.PI * (laser.w0 * 1e-2) ** 2);

  return (
    <>
      <h1>Laser Induced Damage Threshold (LIDT)</h1>
      <Link href="/">Home</Link>

      <h2>Pulsed Lasers</h2>

      <p>
        Input the specs for your laser (if you are in Europe please use comma
        for decimals)
      </p>

      <LaserProperty
        field="Average power"
        property={laser.power}
        setter={setLaser}
        property_name="power"
        unit="W"
      />

      <LaserProperty
        field="Repetition rate"
        property={laser.repetition}
        setter={setLaser}
        property_name="repetition"
        unit="Hz"
      />

      <LaserProperty
        field="Beam waist"
        property={laser.w0}
        setter={setLaser}
        property_name="w0"
        unit="cm"
      />

      <LaserProperty
        field="Wavelength"
        property={laser.wvlen}
        setter={setLaser}
        property_name="wvlen"
        unit="nm"
      />
      <p>Energy: {energy} J/pulse</p>
      <p>Energy density: {density} J/cm^2</p>
    </>
  );
}

"use client";
import React, { useState } from "react";

type Laser = {
  power: number;
  repetition: number;
  w0: number;
  wvlen: number;
};

export default function LIDT() {
  //const [lidt, setLidt] = useState(5); // default: 5 J/cm^2
  const [laser, setLaser] = useState<Laser>({
    power: 0.0, // Watts, average power
    repetition: 0.0, // Hz
    w0: 0.0, //cm, 1/e^2 waist
    wvlen: 0.0, //nm, wavelength
  });

  const [inputs, setInputs] = useState<Record<keyof Laser, string>>({
    power: String(laser.power),
    repetition: String(laser.repetition),
    w0: String(laser.w0),
    wvlen: String(laser.wvlen),
  });

  const onChange =
    (key: keyof Laser) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setInputs((prev) => ({ ...prev, [key]: e.target.value }));

  const onBlur = (key: keyof Laser) => {
    const n = parseFloat(inputs[key]);
    const next = Number.isFinite(n) ? n : 0;
    setLaser((prev) => ({ ...prev, [key]: next }));
    setInputs((prev) => ({ ...prev, [key]: String(next) }));
  };

  return (
    <>
      <h1>Laser Induced Damage Threshold (LIDT)</h1>

      <h2>Pulsed Lasers</h2>

      <p>Input the specs for your laser</p>
      <p>
        Average power: <input type="number" value={laser.power} />
      </p>
      <p>
        Repetition:{" "}
        <input
          value={laser.repetition}
          onChange={(e) =>
            setLaser({ ...laser, repetition: Number(e.target.value) })
          }
        />
      </p>
    </>
  );
}

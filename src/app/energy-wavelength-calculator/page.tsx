"use client";
import React, { useState } from "react";

export default function EnergyWavelengthCalculator() {
  const electronVolt = 1.602176634e-19;
  const c = 299792458;
  const planck = 6.62607015e-34;
  const [energy, setEnergy] = useState(0);
  const [wvlen, setWvlen] = useState(0);
  return (
    <>
      <h1>Energy Wavelength Calculator</h1>
      <p>Convert between photon energy in electron volts and wavelength.</p>
    </>
  );
}

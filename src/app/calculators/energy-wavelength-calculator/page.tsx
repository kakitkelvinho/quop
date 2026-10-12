import { EnergyWavelengthCalculator } from "@/components/calculators/energy-wavelength-calculator";
import { toolMetadata } from "@/components/tool-intro";

export const metadata = toolMetadata("/calculators/energy-wavelength-calculator");

export default function EnergyWavelengthCalculatorPage() {
  return <EnergyWavelengthCalculator />;
}

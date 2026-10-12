import { LightTravelCalculator } from "@/components/calculators/light-travel-calculator";
import { toolMetadata } from "@/components/tool-intro";

export const metadata = toolMetadata("/calculators/light-travel-calculator");

export default function LightTravelCalculatorPage() {
  return <LightTravelCalculator />;
}

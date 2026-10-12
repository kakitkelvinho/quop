import { PaceCalculator } from "@/components/calculators/pace-calculator";
import { toolMetadata } from "@/components/tool-intro";

export const metadata = toolMetadata("/calculators/pace");

export default function PaceCalculatorPage() {
  return <PaceCalculator />;
}

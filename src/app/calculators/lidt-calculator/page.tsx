import { LidtCalculator } from "@/components/calculators/lidt-calculator";
import { toolMetadata } from "@/components/tool-intro";

export const metadata = toolMetadata("/calculators/lidt-calculator");

export default function LidtCalculatorPage() {
  return <LidtCalculator />;
}

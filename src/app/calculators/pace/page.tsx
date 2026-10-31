import { FormulaSheet } from "@/components/calculators/formula-sheet";
import { PaceCalculator } from "@/components/calculators/pace-calculator";
import { toolMetadata } from "@/components/tool-intro";

export const metadata = toolMetadata("/calculators/pace");

export default function PaceCalculatorPage() {
  return (
    <PaceCalculator>
      <FormulaSheet href="/calculators/pace" />
    </PaceCalculator>
  );
}

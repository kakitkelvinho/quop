import { FormulaSheet } from "@/components/calculators/formula-sheet";
import { GaussianBeamCalculator } from "@/components/calculators/gaussian-beam-calculator";
import { toolMetadata } from "@/components/tool-intro";

export const metadata = toolMetadata("/calculators/gaussian-beam");

export default function GaussianBeamCalculatorPage() {
  return (
    <GaussianBeamCalculator>
      <FormulaSheet href="/calculators/gaussian-beam" />
    </GaussianBeamCalculator>
  );
}

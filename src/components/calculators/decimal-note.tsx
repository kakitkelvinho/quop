import type { FlexibleDecimal } from "@/components/calculators/parse-flexible-decimal";

/** Says how an ambiguous number was read, under its field. */
export function DecimalNote({ reading }: { reading: FlexibleDecimal | null }) {
  return reading?.note ? <small className="field__note">{reading.note}</small> : null;
}

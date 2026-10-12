import { redirect } from "next/navigation";

// Experiment is now the Builder section, whose one tool is the Tabletop.
export default function LegacyExperimentPage() {
  redirect("/builder/tabletop");
}

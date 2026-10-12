import { redirect } from "next/navigation";

// The builder is now the Tabletop, under the Builder section.
export default function LegacyBuilderPage() {
  redirect("/builder/tabletop");
}

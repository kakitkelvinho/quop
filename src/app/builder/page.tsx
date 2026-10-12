import { redirect } from "next/navigation";

// The Builder section is one tool, so its address opens the tool.
export default function BuilderSectionPage() {
  redirect("/builder/tabletop");
}

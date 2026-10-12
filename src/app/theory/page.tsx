import { redirect } from "next/navigation";

// Theory is now Notes; old links and bookmarks land there.
export default function LegacyTheoryPage() {
  redirect("/notes");
}

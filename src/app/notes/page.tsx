import type { Metadata } from "next";

import { NoteLayoutPrototype } from "./note-layout.prototype";

export const metadata: Metadata = { title: "Notes" };

// PROTOTYPE (#301): the placeholder is swapped for the note-layout variants on this branch.
export default function NotesPage() {
  return <NoteLayoutPrototype />;
}

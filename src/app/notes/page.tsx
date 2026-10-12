import type { Metadata } from "next";

export const metadata: Metadata = { title: "Notes" };

export default function NotesPage() {
  return (
    <section className="pageSection">
      <h1>Notes</h1>
      <p className="lead">
        This section is reserved for conceptual notes, derivations, and
        reference material related to quantum optics.
      </p>
    </section>
  );
}

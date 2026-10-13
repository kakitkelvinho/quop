import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <section className="pageSection">
      <h1>Not found</h1>
      <Link className="buttonLink" href="/">
        Home
      </Link>
    </section>
  );
}

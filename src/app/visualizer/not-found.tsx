import Link from "next/link";

export default function VisualizerNotFound() {
  return (
    <section className="pageSection">
      <span className="eyebrow">Not Found</span>
      <h1>Did you mean Visualizers?</h1>
      <p className="lead">
        The section name is plural because it is a category page that can hold
        multiple visualizer tools, not a single visualizer route.
      </p>
      <div className="infoPanel">
        <p>
          Visit the <Link href="/visualizers">Visualizers section</Link> to
          browse the correct category landing page.
        </p>
      </div>
    </section>
  );
}

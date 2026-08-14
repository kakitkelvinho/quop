export default function ExperimentPage() {
  return (
    <section className="pageSection">
      <span className="eyebrow">Section</span>
      <h1>Experiment</h1>
      <p className="lead">
        Experiment pages collect lab-facing setup notes, measurement workflows,
        and practical implementation details.
      </p>
      <div className="infoPanel">
        <p>
          This top-level route is restored so the sidebar and homepage both
          expose the experiment category again.
        </p>
      </div>
    </section>
  );
}

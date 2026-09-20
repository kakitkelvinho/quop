import BuilderSceneLoader from "@/components/builder/builder-scene-loader";

export default function BuilderPage() {
  return (
    <section className="pageSection">
      <h1>Builder</h1>
      <p className="lead">Build and visualize your experimental setup</p>
      <BuilderSceneLoader />
    </section>
  );
}

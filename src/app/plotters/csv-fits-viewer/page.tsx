import CsvFitsViewer from "@/components/plotters/csv-fits-viewer";

export default function CsvFitsViewerPage() {
  return (
    <section className="pageSection">
      <h1>CSV and FITS Viewer</h1>
      <p className="lead">
        Compare a time-series CSV and a FITS file side by side. Each panel keeps
        its uploader and status controls at the top, with the viewer directly
        underneath.
      </p>
      <CsvFitsViewer />
    </section>
  );
}

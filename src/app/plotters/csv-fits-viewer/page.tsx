import CsvFitsViewer from "@/components/plotters/csv-fits-viewer";
import { ToolTitle } from "@/components/tool-title";

export default function CsvFitsViewerPage() {
  return (
    <section className="pageSection">
      <ToolTitle href="/plotters/csv-fits-viewer">CSV and FITS Viewer</ToolTitle>
      <p className="lead">
        Compare a time-series CSV and a FITS file side by side. Each panel keeps
        its uploader and status controls at the top, with the viewer directly
        underneath.
      </p>
      <CsvFitsViewer />
    </section>
  );
}

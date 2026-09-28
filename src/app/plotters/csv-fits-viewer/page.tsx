import CsvFitsViewer from "@/components/plotters/csv-fits-viewer";
import { ToolIntro } from "@/components/tool-intro";

export default function CsvFitsViewerPage() {
  return (
    <section className="pageSection">
      <ToolIntro href="/plotters/csv-fits-viewer">CSV and FITS Viewer</ToolIntro>
      <CsvFitsViewer />
    </section>
  );
}

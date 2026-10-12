import CsvFitsViewer from "@/components/plotters/csv-fits-viewer";
import { ToolIntro, toolMetadata } from "@/components/tool-intro";

export const metadata = toolMetadata("/plotters/csv-fits-viewer");

export default function CsvFitsViewerPage() {
  return (
    <section className="pageSection">
      <ToolIntro href="/plotters/csv-fits-viewer">CSV and FITS Viewer</ToolIntro>
      <CsvFitsViewer />
    </section>
  );
}

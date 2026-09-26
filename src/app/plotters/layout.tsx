// PROTOTYPE — only here to mount the chart-style toggle variants; drop with them.
import { ChartStylePrototypeChrome } from "@/components/plotters/chart-style-toggle.prototype";

export default function PlottersLayout({ children }: { children: React.ReactNode }) {
  return <ChartStylePrototypeChrome>{children}</ChartStylePrototypeChrome>;
}

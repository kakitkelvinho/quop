"use client";

import { useState, type ReactNode } from "react";

import { SidebarFold } from "@/components/sidebar-fold";

/**
 * A plotter page: the "Data" sidebar, which folds away, beside the plot card.
 * `sidebar` goes under the sidebar's heading; `children` fill the plot card.
 */
export function PlotterShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div
      className={`visualizerLayout${sidebarCollapsed ? " visualizerLayout--sidebarCollapsed" : ""}`}
    >
      <div className="visualizerSidebar">
        <SidebarFold
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
        />
        <div className="inputCard fieldStack">
          <h2>Data</h2>
          {sidebar}
        </div>
      </div>

      <div className="sectionCard visualizerChartCard">{children}</div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";

import { Icon } from "@/components/builder/builder-icons";
import { CornerFan, type CornerFanItem } from "@/components/builder/corner-fan";

/** The islands in the top-left corner: the QUOP and + fans both clear both, so they lie on one ring. */
export const TOP_LEFT_ISLANDS = ".builderHud__file, .builderHud__add";

/**
 * The QUOP mark, top left, is the file menu, as a logo menu is: a quarter fan
 * from the workspace's corner with Home (the site, through the router so the
 * base path holds), .json (the Setup JSON panel, which saves, opens and
 * imports), .png (export the view), Example and Clear.
 */
export function FileFan({
  onShowJson,
  onExportPng,
  onResetExample,
  onClear,
}: {
  onShowJson: () => void;
  onExportPng: () => void;
  onResetExample: () => void;
  onClear: () => void;
}) {
  const router = useRouter();
  const items: CornerFanItem[] = [
    { id: "home", label: "Home", hint: "Back to the QUOP site", icon: "back", run: () => router.push("/") },
    { id: "json", label: ".json", hint: "Save, load, edit", icon: "braces", file: true, run: onShowJson },
    { id: "png", label: ".png", hint: "Export the view", icon: "image", file: true, run: onExportPng },
    { id: "example", label: "Example", hint: "Load the example", icon: "example", run: onResetExample },
    { id: "clear", label: "Clear", hint: "Empty the table", icon: "trash", danger: true, run: onClear },
  ];

  return (
    <CornerFan
      corner="tl"
      clearOf={TOP_LEFT_ISLANDS}
      label="QUOP"
      title="QUOP: home and file"
      items={items}
      className="builderMenu__trigger builderBrand"
      guide="file"
    >
      <span className="builderBrand__mark">QUOP</span>
      <Icon name="chevron" size={14} />
    </CornerFan>
  );
}

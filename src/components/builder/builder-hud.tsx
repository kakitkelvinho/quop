"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

import type { CameraView } from "@/components/builder/builder-canvas";
import { Icon, IconButton } from "@/components/builder/builder-icons";
import PartsPanel from "@/components/builder/builder-parts-panel";
import {
  BeamDraftInspector,
  BeamInspector,
  ComponentInspector,
} from "@/components/builder/builder-inspector";
import {
  COMPONENT_SPECS,
  beamDisplayName,
  beamLengthMm,
  mirrorAngleBeam,
  type Beam,
  type BuilderComponent,
  type ComponentType,
} from "@/components/builder/types";

export type BuilderHudProps = {
  components: BuilderComponent[];
  beams: Beam[];
  selected: BuilderComponent | null;
  selectedBeam: Beam | null;
  placingType: ComponentType | null;
  trayOpen: boolean;
  beamMode: boolean;
  beamDraft: string[];
  beamColor: string;
  showLabels: boolean;
  showGrid: boolean;
  showPosts: boolean;
  view: CameraView;
  canUndo: boolean;
  canRedo: boolean;
  status: string | null;
  onToggleTray: () => void;
  onPickType: (type: ComponentType) => void;
  onCloseTray: () => void;
  onSelectTool: () => void;
  onDeselect: () => void;
  onUpdateSelected: (patch: Partial<Omit<BuilderComponent, "id" | "type">>, record?: boolean) => void;
  onRotateSelected: (direction: 1 | -1) => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onStartBeam: () => void;
  onFinishBeam: () => void;
  onCancelBeam: () => void;
  onUndoBeamStep: () => void;
  onBeamColorChange: (color: string) => void;
  onSelectBeam: (id: string) => void;
  onUpdateBeam: (id: string, patch: Partial<Omit<Beam, "id">>, record?: boolean) => void;
  /** snapshot the scene before a run of unrecorded edits (a slider drag) */
  onCheckpoint: () => void;
  onDeleteBeam: (id: string) => void;
  onToggleLabels: () => void;
  onToggleGrid: () => void;
  onTogglePosts: () => void;
  onViewChange: (view: CameraView) => void;
  onFit: () => void;
  onToggleTheme: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onLoad: (event: ChangeEvent<HTMLInputElement>) => void;
  onExportPng: () => void;
  onResetExample: () => void;
  onClear: () => void;
};

type Hint = [key: string, action: string];

/** Key hints appear only inside a mode — the rest of the time the canvas stays quiet. */
function modeHints(props: BuilderHudProps): { label: string; hints: Hint[] } | null {
  if (props.beamMode)
    return {
      label: "Drawing a beam",
      hints: [
        ["Click", "add stop"],
        ["Enter", "finish"],
        ["Esc", "cancel"],
      ],
    };
  if (props.placingType)
    return {
      label: `Placing ${COMPONENT_SPECS[props.placingType].label.toLowerCase()}`,
      hints: [
        ["Click", "place"],
        ["Esc", "cancel"],
      ],
    };
  return null;
}

function FileMenu({
  onSave,
  onLoad,
  onExportPng,
  onResetExample,
  onClear,
}: Pick<BuilderHudProps, "onSave" | "onLoad" | "onExportPng" | "onResetExample" | "onClear">) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const run = (action: () => void) => () => {
    action();
    setOpen(false);
  };

  return (
    <div className="builderMenu" ref={ref}>
      <button
        type="button"
        className="builderMenu__trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="builderMenu__title">Experiment builder</span>
        <Icon name="chevron" size={14} />
      </button>
      {open ? (
        <div className="builderMenu__list" role="menu">
          <button type="button" role="menuitem" onClick={run(onSave)}>
            Save as JSON
          </button>
          <label role="menuitem">
            Open JSON…
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                onLoad(event);
                setOpen(false);
              }}
            />
          </label>
          <button type="button" role="menuitem" onClick={run(onExportPng)}>
            Export view as PNG
          </button>
          <hr />
          <button type="button" role="menuitem" onClick={run(onResetExample)}>
            Load example
          </button>
          <button type="button" role="menuitem" onClick={run(onClear)}>
            Clear table
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function BuilderHud(props: BuilderHudProps) {
  const {
    components,
    beams,
    selected,
    selectedBeam,
    placingType,
    trayOpen,
    beamMode,
    view,
  } = props;
  const mode = modeHints(props);
  const selecting = !beamMode && !placingType && !trayOpen;

  let inspector = null;
  if (beamMode) {
    inspector = (
      <BeamDraftInspector
        draft={props.beamDraft}
        color={props.beamColor}
        components={components}
        onColorChange={props.onBeamColorChange}
        onFinish={props.onFinishBeam}
        onUndoStep={props.onUndoBeamStep}
        onCancel={props.onCancelBeam}
      />
    );
  } else if (selected) {
    inspector = (
      <ComponentInspector
        component={selected}
        components={components}
        angleBeam={mirrorAngleBeam(beams, selected)}
        onUpdate={props.onUpdateSelected}
        onCheckpoint={props.onCheckpoint}
        onRotate={props.onRotateSelected}
        onDuplicate={props.onDuplicateSelected}
        onDelete={props.onDeleteSelected}
      />
    );
  } else if (selectedBeam) {
    inspector = (
      <BeamInspector
        beam={selectedBeam}
        components={components}
        onUpdate={(patch, record) => props.onUpdateBeam(selectedBeam.id, patch, record)}
        onCheckpoint={props.onCheckpoint}
        onDelete={() => props.onDeleteBeam(selectedBeam.id)}
      />
    );
  }
  // Remount (and replay the entrance) when the inspected thing changes.
  const inspectorKey = beamMode ? "beam-draft" : (selected?.id ?? selectedBeam?.id);

  return (
    <>
      <div className="builderIsland builderHud__file">
        <Link href="/experiment" className="builderBack" aria-label="Back to the QUOP site">
          <Icon name="back" size={16} />
          QUOP
        </Link>
        <span className="builderIsland__sep" />
        <FileMenu
          onSave={props.onSave}
          onLoad={props.onLoad}
          onExportPng={props.onExportPng}
          onResetExample={props.onResetExample}
          onClear={props.onClear}
        />
      </div>

      <div className="builderIsland builderHud__add">
        <IconButton
          icon="add"
          label="Add a part"
          active={trayOpen}
          onClick={props.onToggleTray}
        />
        <IconButton
          icon="beam"
          label="Draw a beam"
          active={beamMode}
          onClick={beamMode ? props.onCancelBeam : props.onStartBeam}
          disabled={components.length < 2}
        />
      </div>

      <div className="builderHud__center">
        <div className="builderIsland" role="toolbar" aria-label="Tools">
          <IconButton icon="select" label="Select and move" active={selecting} onClick={props.onSelectTool} />
          <IconButton icon="posts" label="Posts" active={props.showPosts} onClick={props.onTogglePosts} />
          <IconButton icon="grid" label="Grid" active={props.showGrid} onClick={props.onToggleGrid} />
          <span className="builderIsland__sep" />
          <IconButton icon="undo" label="Undo (⌘Z)" onClick={props.onUndo} disabled={!props.canUndo} />
          <IconButton icon="redo" label="Redo (⇧⌘Z)" onClick={props.onRedo} disabled={!props.canRedo} />
        </div>


        {mode ? (
          <p className="builderModeBadge">
            {mode.label}
            <span className="builderModeBadge__hints">
              {mode.hints.map(([key, action]) => (
                <span key={key}>
                  <kbd>{key}</kbd> {action}
                </span>
              ))}
            </span>
          </p>
        ) : null}
      </div>

      {/* always on and faint: the Shift orbit is the one nobody finds alone.
          It sits above the inspector, which opens below it on the right. */}
      <p className="builderControlsHint" aria-label="Camera controls">
        <span>
          <kbd>⇧</kbd> drag rotate · drag pan · scroll zoom
        </span>
        <span className="builderControlsHint__alt">or middle / right drag to rotate</span>
      </p>

      {trayOpen ? (
        <PartsPanel
          placingType={placingType}
          onPick={props.onPickType}
          onClose={props.onCloseTray}
        />
      ) : null}

      {inspector ? (
        <aside className="builderIsland builderHud__inspector" key={inspectorKey} aria-label="Inspector">
          {inspector}
          <button
            type="button"
            className="builderHud__close"
            aria-label={beamMode ? "Cancel beam" : "Deselect (Esc)"}
            title={beamMode ? "Cancel beam (Esc)" : "Deselect (Esc)"}
            onClick={beamMode ? props.onCancelBeam : props.onDeselect}
          >
            <Icon name="close" size={16} />
          </button>
        </aside>
      ) : null}

      {beams.length ? (
        <div className="builderHud__beams" aria-label="Beams">
          {beams.map((beam) => (
            <button
              key={beam.id}
              type="button"
              className={`builderBeamChip${selectedBeam?.id === beam.id ? " is-selected" : ""}`}
              aria-pressed={selectedBeam?.id === beam.id}
              onClick={() => props.onSelectBeam(beam.id)}
            >
              <span className="builderBeamChip__dot" style={{ background: beam.color }} />
              <span className="builderBeamChip__name">{beamDisplayName(beam)}</span>
              <span className="builderReadout">{Math.round(beamLengthMm(components, beam))} mm</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="builderIsland builderHud__view" role="toolbar" aria-label="View">
        <span className="builderSegment">
          <IconButton icon="iso" label="Isometric view" active={view === "iso"} onClick={() => props.onViewChange("iso")} />
          <IconButton icon="top" label="Top-down view" active={view === "top"} onClick={() => props.onViewChange("top")} />
        </span>
        <IconButton icon="fit" label="Fit the layout" onClick={props.onFit} />
        <span className="builderIsland__sep" />
        <IconButton icon="labels" label="Labels" active={props.showLabels} onClick={props.onToggleLabels} />
        <IconButton icon="theme" label="Day / night" onClick={props.onToggleTheme} />
      </div>

      <p className="builderStatus" role="status" aria-live="polite">
        {props.status}
      </p>
    </>
  );
}

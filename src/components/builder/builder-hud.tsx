"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";

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
  derivedAngleBeam,
  moveBeam,
  type Beam,
  type BuilderComponent,
  type ComponentType,
} from "@/components/builder/types";
import { findTool } from "@/components/navigation";
import { ReportLine } from "@/components/report-link";
import { BetaMark } from "@/components/beta-badge";

export type BuilderHudProps = {
  components: BuilderComponent[];
  beams: Beam[];
  selected: BuilderComponent | null;
  selectedBeam: Beam | null;
  placingType: ComponentType | null;
  trayOpen: boolean;
  beamMode: boolean;
  /** "Add stops" is on for the selected beam */
  addingStops: boolean;
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
  onToggleAddStops: () => void;
  onUpdateBeam: (id: string, patch: Partial<Omit<Beam, "id">>, record?: boolean) => void;
  /** snapshot the scene before a run of unrecorded edits (a slider drag) */
  onCheckpoint: () => void;
  onDeleteBeam: (id: string) => void;
  /** one step up (-1) or down (1) the beam list */
  onMoveBeam: (id: string, direction: 1 | -1) => void;
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
  if (props.addingStops)
    return {
      label: "Adding stops",
      hints: [
        ["Click", "add to end"],
        ["Enter", "done"],
        ["Esc", "done"],
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

/**
 * The beams box: one row per beam, in list order. A row selects its beam, moves
 * it up or down the list, or deletes it. A move that isn't possible is
 * disabled, and its label says why. Keyboard focus follows the edit: a moved
 * beam keeps the button that moved it (or the opposite one when that is now
 * disabled), and a deleted beam's row hands focus to the beam that took its place.
 */
function BeamList({
  components,
  beams,
  selectedId,
  besideParts,
  onSelect,
  onMove,
  onDelete,
}: {
  components: BuilderComponent[];
  beams: Beam[];
  selectedId: string | null;
  besideParts: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, direction: 1 | -1) => void;
  onDelete: (id: string) => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  // a row's buttons, in order: select, up, down, delete; the first enabled one wanted gets focus
  const focusAfter = useRef<{ row: number; wanted: number[] } | null>(null);
  useEffect(() => {
    const target = focusAfter.current;
    focusAfter.current = null;
    const rows = listRef.current?.children;
    if (!target || !rows?.length) return;
    const buttons = Array.from(rows[Math.min(target.row, rows.length - 1)].querySelectorAll("button"));
    target.wanted.map((at) => buttons[at]).find((button) => button && !button.disabled)?.focus();
  }, [beams]);

  return (
    <ol
      ref={listRef}
      role="list"
      aria-label="Beams"
      className={`builderIsland builderHud__beams${besideParts ? " is-besideParts" : ""}`}
    >
      {beams.map((beam, index) => {
        const name = beamDisplayName(beam);
        const selected = selectedId === beam.id;
        const up = moveBeam(beams, beam.id, -1);
        const down = moveBeam(beams, beam.id, 1);
        return (
          <li key={beam.id} className={`builderBeamRow${selected ? " is-selected" : ""}`}>
            <button
              type="button"
              className="builderBeamRow__select"
              aria-pressed={selected}
              onClick={() => onSelect(beam.id)}
            >
              <span className="builderBeamRow__dot" style={{ background: beam.color }} />
              <span className="builderBeamRow__name">{name}</span>
              <span className="builderReadout">{Math.round(beamLengthMm(components, beam))} mm</span>
            </button>
            <span className="builderBeamRow__actions">
              <IconButton
                icon="up"
                label={up.ok ? `Move ${name} up` : `Can't move ${name} up: ${up.reason}`}
                disabled={!up.ok}
                onClick={() => {
                  focusAfter.current = { row: index - 1, wanted: [1, 2] };
                  onMove(beam.id, -1);
                }}
              />
              <IconButton
                icon="down"
                label={down.ok ? `Move ${name} down` : `Can't move ${name} down: ${down.reason}`}
                disabled={!down.ok}
                onClick={() => {
                  focusAfter.current = { row: index + 1, wanted: [2, 1] };
                  onMove(beam.id, 1);
                }}
              />
              <IconButton
                icon="trash"
                label={`Delete ${name}`}
                onClick={() => {
                  focusAfter.current = { row: index, wanted: [0] };
                  onDelete(beam.id);
                }}
              />
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** What the builder leaves to the author: it is a notebook, not a simulator (BUILDER.md). */
const LIMITATIONS = [
  "A beam can pass through any component. Nothing checks that the light could really take that path.",
  "Components can overlap; there is no collision check.",
  "Marking a beam line, by tinting its mounts the beam’s colour, is up to you. Nothing enforces it.",
  "There are no ruler or dimension annotations yet.",
];

/** What the builder is for, from the navigation registry, then what it leaves to the author. */
function AboutPanel({ onClose }: { onClose: () => void }) {
  const tool = findTool("/experiment/builder");
  // Capture, and stop, so this Esc closes only the panel: the scene's Esc
  // chain peels one layer per press and would otherwise also deselect.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  return (
    <aside className="builderIsland builderAbout" aria-labelledby="builder-about-title">
      <h2 id="builder-about-title" className="builderAbout__title">
        About the builder
        <BetaMark tool={tool} />
      </h2>
      {tool ? <p className="builderAbout__description">{tool.description}</p> : null}
      <h3 className="builderAbout__subtitle">Known limitations</h3>
      <p className="builderAbout__lead">
        The builder records the setup you intend. It doesn’t simulate it.
      </p>
      <ul className="builderAbout__list">
        {LIMITATIONS.map((limitation) => (
          <li key={limitation}>{limitation}</li>
        ))}
      </ul>
      <ReportLine tool={tool?.label} className="builderAbout__report" showVersion />
      <button
        type="button"
        className="builderHud__close"
        aria-label="Close panel"
        title="Close (Esc)"
        onClick={onClose}
      >
        <Icon name="close" size={16} />
      </button>
    </aside>
  );
}

function FileMenu({
  onSave,
  onLoad,
  onExportPng,
  onResetExample,
  onClear,
  onShowAbout,
}: Pick<BuilderHudProps, "onSave" | "onLoad" | "onExportPng" | "onResetExample" | "onClear"> & {
  onShowAbout: () => void;
}) {
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
        <BetaMark tool={findTool("/experiment/builder")} />
        <Icon name="chevron" size={14} />
      </button>
      {open ? (
        <div className="builderMenu__list" role="menu">
          <button type="button" role="menuitem" onClick={run(onSave)}>
            Save as JSON
          </button>
          <label role="menuitem">
            Open JSON…
            {/* No accept filter: macOS sometimes greys out .json files the
                first time the picker opens. handleLoad rejects non-setups. */}
            <input
              type="file"
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
          <hr />
          <button type="button" role="menuitem" onClick={run(onShowAbout)}>
            About the builder
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
  // the about panel shares the parts panel's spot, so opening either closes the other
  const [aboutOpen, setAboutOpen] = useState(false);
  const closeAbout = useCallback(() => setAboutOpen(false), []);
  const { onCloseTray } = props;
  const showAbout = useCallback(() => {
    onCloseTray();
    setAboutOpen(true);
  }, [onCloseTray]);

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
        angleBeam={derivedAngleBeam(beams, selected)}
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
        addingStops={props.addingStops}
        onToggleAddStops={props.onToggleAddStops}
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
          onShowAbout={showAbout}
        />
      </div>

      {aboutOpen && !trayOpen ? <AboutPanel onClose={closeAbout} /> : null}

      <div className="builderIsland builderHud__add">
        <IconButton
          icon="add"
          label="Add a part"
          active={trayOpen}
          onClick={() => {
            setAboutOpen(false);
            props.onToggleTray();
          }}
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
        <BeamList
          components={components}
          beams={beams}
          selectedId={selectedBeam?.id ?? null}
          besideParts={trayOpen}
          onSelect={props.onSelectBeam}
          onMove={props.onMoveBeam}
          onDelete={props.onDeleteBeam}
        />
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

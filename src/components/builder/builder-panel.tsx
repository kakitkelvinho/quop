"use client";

import type { ChangeEvent } from "react";

import type { CameraView } from "@/components/builder/builder-canvas";
import {
  BEAM_COLORS,
  COMPONENT_GROUPS,
  COMPONENT_SPECS,
  DEFAULT_MOUNT_COLOR,
  beamLengthMm,
  lengthToPicoseconds,
  type Beam,
  type BuilderComponent,
  type ComponentType,
} from "@/components/builder/types";

export type BuilderPanelProps = {
  components: BuilderComponent[];
  beams: Beam[];
  selected: BuilderComponent | null;
  placingType: ComponentType | null;
  beamMode: boolean;
  beamDraft: string[];
  beamColor: string;
  showLabels: boolean;
  showGrid: boolean;
  view: CameraView;
  canUndo: boolean;
  canRedo: boolean;
  onPickType: (type: ComponentType | null) => void;
  onUpdateSelected: (patch: Partial<Omit<BuilderComponent, "id" | "type">>) => void;
  onRotateSelected: (direction: 1 | -1) => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onStartBeam: () => void;
  onFinishBeam: () => void;
  onCancelBeam: () => void;
  onUndoBeamStep: () => void;
  onBeamColorChange: (color: string) => void;
  onSelectBeam: (beam: Beam) => void;
  onDeleteBeam: (id: string) => void;
  onToggleLabels: () => void;
  onToggleGrid: () => void;
  onViewChange: (view: CameraView) => void;
  onFit: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onLoad: (event: ChangeEvent<HTMLInputElement>) => void;
  onExportPng: () => void;
  onResetExample: () => void;
  onClear: () => void;
};

function formatMm(value: number): string {
  return `${value >= 0 ? "" : "−"}${Math.abs(Math.round(value))}`;
}

export default function BuilderPanel({
  components,
  beams,
  selected,
  placingType,
  beamMode,
  beamDraft,
  beamColor,
  showLabels,
  showGrid,
  view,
  canUndo,
  canRedo,
  onPickType,
  onUpdateSelected,
  onRotateSelected,
  onDuplicateSelected,
  onDeleteSelected,
  onStartBeam,
  onFinishBeam,
  onCancelBeam,
  onUndoBeamStep,
  onBeamColorChange,
  onSelectBeam,
  onDeleteBeam,
  onToggleLabels,
  onToggleGrid,
  onViewChange,
  onFit,
  onUndo,
  onRedo,
  onSave,
  onLoad,
  onExportPng,
  onResetExample,
  onClear,
}: BuilderPanelProps) {
  return (
    <aside className="builderPanel">
      <section className="builderGroup">
        <p className="sectionCard__kicker">Add a component</p>
        {COMPONENT_GROUPS.map((group) => (
          <div key={group.name} className="builderSubgroup">
            <p className="builderSubgroup__label">{group.name}</p>
            <div className="builderPalette">
              {group.types.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`builderPaletteButton${placingType === type ? " is-active" : ""}`}
                  onClick={() => onPickType(placingType === type ? null : type)}
                  title={COMPONENT_SPECS[type].hint}
                >
                  {COMPONENT_SPECS[type].label}
                </button>
              ))}
            </div>
          </div>
        ))}
        {placingType ? (
          <p className="builderHint builderHint--active">
            Click the table to place the {COMPONENT_SPECS[placingType].label.toLowerCase()}.{" "}
            <button type="button" className="builderInlineButton" onClick={() => onPickType(null)}>
              Cancel
            </button>
          </p>
        ) : (
          <p className="builderHint">Drag a part to move it. Positions snap to 25 mm; hold Shift for 5 mm.</p>
        )}
      </section>

      <section className="builderGroup">
        <p className="sectionCard__kicker">Selection</p>
        {selected ? (
          <div className="builderInspector">
            <p className="builderInspector__type">{COMPONENT_SPECS[selected.type].label}</p>
            <label className="field">
              <span>Label</span>
              <span className="field__control">
                <input
                  type="text"
                  value={selected.label ?? ""}
                  placeholder={COMPONENT_SPECS[selected.type].tag}
                  onChange={(event) => onUpdateSelected({ label: event.target.value })}
                />
              </span>
            </label>
            <div className="builderFieldRow">
              <label className="field">
                <span>x</span>
                <span className="field__control">
                  <input
                    type="number"
                    step={5}
                    value={Math.round(selected.position[0])}
                    onChange={(event) =>
                      onUpdateSelected({
                        position: [Number(event.target.value) || 0, 0, selected.position[2]],
                      })
                    }
                  />
                  <span>mm</span>
                </span>
              </label>
              <label className="field">
                <span>z</span>
                <span className="field__control">
                  <input
                    type="number"
                    step={5}
                    value={Math.round(selected.position[2])}
                    onChange={(event) =>
                      onUpdateSelected({
                        position: [selected.position[0], 0, Number(event.target.value) || 0],
                      })
                    }
                  />
                  <span>mm</span>
                </span>
              </label>
            </div>
            <div className="builderFieldRow">
              <label className="field">
                <span>Yaw</span>
                <span className="field__control">
                  <input
                    type="number"
                    step={15}
                    value={Math.round(selected.rotation)}
                    onChange={(event) =>
                      onUpdateSelected({ rotation: ((Number(event.target.value) || 0) + 360) % 360 })
                    }
                  />
                  <span>°</span>
                </span>
              </label>
              <div className="builderRotateRow">
                <button type="button" className="buttonLink buttonLink--ghost" onClick={() => onRotateSelected(-1)}>
                  −15°
                </button>
                <button type="button" className="buttonLink buttonLink--ghost" onClick={() => onRotateSelected(1)}>
                  +15°
                </button>
              </div>
            </div>
            {selected.type === "mirror-mount" ? (
              <label className="builderColorField">
                <span>Mount colour — marks the beam line</span>
                <input
                  type="color"
                  value={selected.color ?? DEFAULT_MOUNT_COLOR}
                  onChange={(event) => onUpdateSelected({ color: event.target.value })}
                />
              </label>
            ) : null}
            <p className="builderHint">{COMPONENT_SPECS[selected.type].hint}</p>
            <div className="buttonRow">
              <button type="button" className="buttonLink buttonLink--ghost" onClick={onDuplicateSelected}>
                Duplicate
              </button>
              <button type="button" className="buttonLink buttonLink--ghost" onClick={onDeleteSelected}>
                Delete
              </button>
            </div>
          </div>
        ) : (
          <p className="builderHint">
            Nothing selected. Click a part on the table to inspect and move it.
          </p>
        )}
      </section>

      <section className="builderGroup">
        <p className="sectionCard__kicker">Beams</p>
        {beamMode ? (
          <div className="builderBeamDraft">
            <p className="builderHint builderHint--active">
              Click the parts this beam passes through, in order.{" "}
              <strong>{beamDraft.length} picked.</strong>
            </p>
            <div className="builderSwatchRow">
              {BEAM_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Beam colour ${color}`}
                  className={`builderSwatch${beamColor === color ? " is-active" : ""}`}
                  style={{ background: color }}
                  onClick={() => onBeamColorChange(color)}
                />
              ))}
              <input
                type="color"
                aria-label="Custom beam colour"
                className="builderSwatchPicker"
                value={beamColor}
                onChange={(event) => onBeamColorChange(event.target.value)}
              />
            </div>
            <div className="buttonRow">
              <button
                type="button"
                className="buttonLink"
                onClick={onFinishBeam}
                disabled={beamDraft.length < 2}
              >
                Finish beam
              </button>
              <button
                type="button"
                className="buttonLink buttonLink--ghost"
                onClick={onUndoBeamStep}
                disabled={beamDraft.length === 0}
              >
                Undo step
              </button>
              <button type="button" className="buttonLink buttonLink--ghost" onClick={onCancelBeam}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="buttonLink"
            onClick={onStartBeam}
            disabled={components.length < 2}
          >
            Draw a beam path
          </button>
        )}

        {beams.length > 0 ? (
          <ul className="builderBeamList">
            {beams.map((beam) => {
              const length = beamLengthMm(components, beam);
              return (
                <li key={beam.id} className="builderBeamItem">
                  <button
                    type="button"
                    className="builderBeamItem__main"
                    onClick={() => onSelectBeam(beam)}
                  >
                    <span className="builderBeamItem__dot" style={{ background: beam.color }} />
                    <span className="builderBeamItem__text">
                      <span className="builderBeamItem__name">
                        {beam.label ?? `${beam.path.length}-stop beam`}
                      </span>
                      <span className="builderReadout">
                        {Math.round(length)} mm · {lengthToPicoseconds(length).toFixed(1)} ps
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="builderIconButton"
                    aria-label="Delete beam"
                    onClick={() => onDeleteBeam(beam.id)}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="builderHint">No beams yet — a beam records the route light takes, in order.</p>
        )}
      </section>

      <section className="builderGroup">
        <p className="sectionCard__kicker">Table</p>
        <div className="builderToggleRow">
          <button
            type="button"
            className={`builderChip${view === "iso" ? " is-active" : ""}`}
            onClick={() => onViewChange("iso")}
          >
            Isometric
          </button>
          <button
            type="button"
            className={`builderChip${view === "top" ? " is-active" : ""}`}
            onClick={() => onViewChange("top")}
          >
            Top-down
          </button>
          <button type="button" className="builderChip" onClick={onFit}>
            Fit
          </button>
        </div>
        <div className="builderToggleRow">
          <button
            type="button"
            className={`builderChip${showLabels ? " is-active" : ""}`}
            onClick={onToggleLabels}
            aria-pressed={showLabels}
          >
            Labels
          </button>
          <button
            type="button"
            className={`builderChip${showGrid ? " is-active" : ""}`}
            onClick={onToggleGrid}
            aria-pressed={showGrid}
          >
            Grid
          </button>
          <button type="button" className="builderChip" onClick={onUndo} disabled={!canUndo}>
            Undo
          </button>
          <button type="button" className="builderChip" onClick={onRedo} disabled={!canRedo}>
            Redo
          </button>
        </div>
        <div className="buttonRow">
          <button type="button" className="buttonLink" onClick={onSave}>
            Save JSON
          </button>
          <label className="buttonLink buttonLink--ghost builderFileLabel">
            Load JSON
            <input type="file" accept="application/json,.json" onChange={onLoad} />
          </label>
          <button type="button" className="buttonLink buttonLink--ghost" onClick={onExportPng}>
            Export PNG
          </button>
        </div>
        <div className="buttonRow">
          <button type="button" className="buttonLink buttonLink--ghost" onClick={onResetExample}>
            Load example
          </button>
          <button type="button" className="buttonLink buttonLink--ghost" onClick={onClear}>
            Clear table
          </button>
        </div>
        <p className="builderHint">
          Your table autosaves in this browser — {components.length}{" "}
          {components.length === 1 ? "part" : "parts"} on the board.
        </p>
      </section>

      <section className="builderGroup">
        <p className="sectionCard__kicker">Shortcuts</p>
        <dl className="builderShortcuts">
          <div>
            <dt>R / Shift R</dt>
            <dd>Rotate ±15°</dd>
          </div>
          <div>
            <dt>Arrows</dt>
            <dd>Nudge 25 mm (Shift: 5 mm)</dd>
          </div>
          <div>
            <dt>D</dt>
            <dd>Duplicate</dd>
          </div>
          <div>
            <dt>Delete</dt>
            <dd>Remove part</dd>
          </div>
          <div>
            <dt>Esc</dt>
            <dd>Cancel / deselect</dd>
          </div>
          <div>
            <dt>⌘Z / ⌃Z</dt>
            <dd>Undo, Shift to redo</dd>
          </div>
        </dl>
      </section>
    </aside>
  );
}

export { formatMm };

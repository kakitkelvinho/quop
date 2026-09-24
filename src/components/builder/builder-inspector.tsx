"use client";

import { useState } from "react";

import { IconButton } from "@/components/builder/builder-icons";
import {
  BEAM_COLORS,
  COMPONENT_SPECS,
  DEFAULT_CAVITY_LENGTH_MM,
  DEFAULT_FOCAL_LENGTH_MM,
  DEFAULT_MOUNT_COLOR,
  clampHeight,
  heightRange,
  beamLengthMm,
  componentById,
  componentDisplayName,
  componentTag,
  lengthToPicoseconds,
  type Beam,
  type BuilderComponent,
  type LensShape,
} from "@/components/builder/types";

const LENS_SHAPES: { value: LensShape; label: string }[] = [
  { value: "plano-convex", label: "Plano-convex" },
  { value: "biconvex", label: "Biconvex" },
];

type ComponentPatch = Partial<Omit<BuilderComponent, "id" | "type">>;

function NumberField({
  label,
  unit,
  value,
  step,
  disabled,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  step: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="builderField">
      <span className="builderField__label">{label}</span>
      <span className="builderField__control">
        <input
          type="number"
          step={step}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value) || 0)}
        />
        <span className="builderField__unit">{unit}</span>
      </span>
    </label>
  );
}

/**
 * Height is clamped to what the part allows, so it commits on blur or Enter
 * rather than per keystroke — typing "1" on the way to "150" must not snap the
 * part to its lowest height first.
 */
function HeightField({
  component,
  onChange,
}: {
  component: BuilderComponent;
  onChange: (height: number) => void;
}) {
  const height = Math.round(component.position[1]);
  const [min, max] = heightRange(component.type);
  const fixed = min === max;
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const next = Number(draft);
    setDraft(null);
    if (draft.trim() !== "" && Number.isFinite(next)) onChange(clampHeight(component.type, next));
  };

  return (
    <label
      className="builderField"
      title={fixed ? "Fixed by the instrument" : `Optical centre above the breadboard, ${min}–${max} mm`}
    >
      <span className="builderField__label">Height</span>
      <span className="builderField__control">
        <input
          type="number"
          step={5}
          min={min}
          max={max}
          value={draft ?? height}
          disabled={fixed || Boolean(component.host)}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            if (event.key === "Escape") setDraft(null);
          }}
        />
        <span className="builderField__unit">mm</span>
      </span>
    </label>
  );
}

function StopList({ components, path }: { components: BuilderComponent[]; path: string[] }) {
  return (
    <ol className="builderStops">
      {path.map((id, index) => {
        const component = componentById(components, id);
        return <li key={`${id}-${index}`}>{component ? componentDisplayName(component) : "—"}</li>;
      })}
    </ol>
  );
}

export function BeamSwatches({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="builderSwatches">
      {BEAM_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`Beam colour ${color}`}
          aria-pressed={value === color}
          className={`builderSwatch${value === color ? " is-active" : ""}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
        />
      ))}
      <input
        type="color"
        aria-label="Custom beam colour"
        className="builderSwatch builderSwatch--custom"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function ComponentInspector({
  component,
  components,
  onUpdate,
  onRotate,
  onDuplicate,
  onDelete,
}: {
  component: BuilderComponent;
  components: BuilderComponent[];
  onUpdate: (patch: ComponentPatch) => void;
  onRotate: (direction: 1 | -1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const spec = COMPONENT_SPECS[component.type];
  const [x, y, z] = component.position;
  const host = component.host ? componentById(components, component.host) : undefined;

  return (
    <div className="builderInspector">
      <div className="builderInspector__head">
        <h2>{spec.label}</h2>
        <IconButton icon="duplicate" label="Duplicate (D)" onClick={onDuplicate} />
        <IconButton icon="trash" label="Delete (Delete)" onClick={onDelete} />
      </div>
      <label className="builderField">
        <span className="builderField__label">Label</span>
        <span className="builderField__control">
          <input
            type="text"
            value={component.label ?? ""}
            placeholder={componentTag(component)}
            onChange={(event) => onUpdate({ label: event.target.value })}
          />
        </span>
      </label>
      <div className="builderFieldRow">
        <NumberField label="x" unit="mm" step={5} value={Math.round(x)} disabled={Boolean(host)} onChange={(next) => onUpdate({ position: [next, y, z] })} />
        <NumberField label="z" unit="mm" step={5} value={Math.round(z)} disabled={Boolean(host)} onChange={(next) => onUpdate({ position: [x, y, next] })} />
      </div>
      <HeightField
        key={component.id}
        component={component}
        onChange={(height) => onUpdate({ position: [x, height, z] })}
      />
      {host ? (
        <div className="builderInspector__host">
          <span>
            Inside <strong>{componentDisplayName(host)}</strong>
          </span>
          <button type="button" className="builderButton" onClick={() => onUpdate({ host: undefined })}>
            Take out
          </button>
        </div>
      ) : null}
      <div className="builderFieldRow">
        <NumberField
          label="Yaw"
          unit="°"
          step={15}
          value={Math.round(component.rotation)}
          onChange={(yaw) => onUpdate({ rotation: ((yaw % 360) + 360) % 360 })}
        />
        <span className="builderInspector__rotate">
          <IconButton icon="rotateLeft" label="Rotate −15° (Shift R)" onClick={() => onRotate(-1)} />
          <IconButton icon="rotateRight" label="Rotate +15° (R)" onClick={() => onRotate(1)} />
        </span>
      </div>
      {component.type === "lens" ? (
        <>
          <div className="builderChoice" role="group" aria-label="Lens shape">
            {LENS_SHAPES.map((shape) => (
              <button
                key={shape.value}
                type="button"
                className="builderButton"
                aria-pressed={(component.lensShape ?? "plano-convex") === shape.value}
                onClick={() => onUpdate({ lensShape: shape.value })}
              >
                {shape.label}
              </button>
            ))}
          </div>
          <NumberField
            label="Focal length"
            unit="mm"
            step={5}
            value={Math.round(component.focalLength ?? DEFAULT_FOCAL_LENGTH_MM)}
            onChange={(next) => onUpdate({ focalLength: next })}
          />
        </>
      ) : null}
      {component.type === "cavity" ? (
        <NumberField
          label="Length"
          unit="mm"
          step={5}
          value={Math.round(component.cavityLength ?? DEFAULT_CAVITY_LENGTH_MM)}
          onChange={(next) => onUpdate({ cavityLength: next })}
        />
      ) : null}
      {component.type === "mirror-mount" ? (
        <label className="builderField" title="Tint the mount the colour of the beam it serves">
          <span className="builderField__label">Mount colour</span>
          <span className="builderField__control builderField__control--color">
            <input
              type="color"
              value={component.color ?? DEFAULT_MOUNT_COLOR}
              onChange={(event) => onUpdate({ color: event.target.value })}
            />
            <span className="builderReadout">{component.color ?? DEFAULT_MOUNT_COLOR}</span>
          </span>
        </label>
      ) : null}
      <p className="builderInspector__hint">{spec.hint}</p>
    </div>
  );
}

export function BeamInspector({
  beam,
  components,
  onUpdate,
  onDelete,
}: {
  beam: Beam;
  components: BuilderComponent[];
  onUpdate: (patch: Partial<Omit<Beam, "id">>) => void;
  onDelete: () => void;
}) {
  const length = beamLengthMm(components, beam);

  return (
    <div className="builderInspector">
      <div className="builderInspector__head">
        <h2>Beam</h2>
        <IconButton icon="trash" label="Delete beam" onClick={onDelete} />
      </div>
      <label className="builderField">
        <span className="builderField__label">Name</span>
        <span className="builderField__control">
          <input
            type="text"
            value={beam.label ?? ""}
            placeholder={`${beam.path.length}-stop beam`}
            onChange={(event) => onUpdate({ label: event.target.value })}
          />
        </span>
      </label>
      <BeamSwatches value={beam.color} onChange={(color) => onUpdate({ color })} />
      <dl className="builderMetrics">
        <div>
          <dt>Path length</dt>
          <dd>{Math.round(length)} mm</dd>
        </div>
        <div>
          <dt>Time of flight</dt>
          <dd>{lengthToPicoseconds(length).toFixed(1)} ps</dd>
        </div>
      </dl>
      <StopList components={components} path={beam.path} />
    </div>
  );
}

export function BeamDraftInspector({
  draft,
  color,
  components,
  onColorChange,
  onFinish,
  onUndoStep,
  onCancel,
}: {
  draft: string[];
  color: string;
  components: BuilderComponent[];
  onColorChange: (color: string) => void;
  onFinish: () => void;
  onUndoStep: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="builderInspector">
      <div className="builderInspector__head">
        <h2>New beam</h2>
        <span className="builderReadout">
          {draft.length} {draft.length === 1 ? "stop" : "stops"}
        </span>
      </div>
      <BeamSwatches value={color} onChange={onColorChange} />
      {draft.length ? (
        <StopList components={components} path={draft} />
      ) : (
        <p className="builderInspector__hint">Click parts in the order the light visits them.</p>
      )}
      <div className="builderInspector__actions">
        <button type="button" className="builderButton builderButton--primary" onClick={onFinish} disabled={draft.length < 2}>
          Finish
        </button>
        <button type="button" className="builderButton" onClick={onUndoStep} disabled={!draft.length}>
          Undo stop
        </button>
        <button type="button" className="builderButton" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

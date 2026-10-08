"use client";

import { useEffect, useRef } from "react";

import { IconButton, type IconName } from "@/components/builder/builder-icons";
import { useNumberDraft } from "@/components/use-number-draft";
import {
  BEAM_COLORS,
  BEAM_OPACITY_RANGE,
  BEAM_WIDTH_MM,
  BEAM_WIDTH_RANGE_MM,
  BLOCK_SIZE_MM,
  BLOCK_SIZE_RANGE_MM,
  COMPONENT_SPECS,
  DEFAULT_BLOCK_COLOR,
  DEFAULT_OBJECTIVE_COLOR,
  DEFAULT_PARTICLE_COLOR,
  DEFAULT_PHOTODIODE_COLOR,
  PARTICLE_RADIUS_MM,
  PARTICLE_RADIUS_RANGE_MM,
  clamp,
  type Vec3,
  DEFAULT_CAVITY_LENGTH_MM,
  DEFAULT_FOCAL_LENGTH_MM,
  DEFAULT_MOUNT_COLOR,
  DEFAULT_SAMPLE_COLOR,
  MOUNTED_TYPES,
  SAMPLE_OPACITY,
  SAMPLE_OPACITY_RANGE,
  clampHeight,
  heightRange,
  beamDisplayName,
  beamLengthMm,
  componentById,
  componentDisplayName,
  componentTag,
  lengthToPicoseconds,
  moveStop,
  removeStop,
  type Beam,
  type BuilderComponent,
  type LensShape,
  type PathEdit,
} from "@/components/builder/types";

const LENS_SHAPES: { value: LensShape; label: string }[] = [
  { value: "plano-convex", label: "Plano-convex" },
  { value: "biconvex", label: "Biconvex" },
];

type ComponentPatch = Partial<Omit<BuilderComponent, "id" | "type">>;

/**
 * What is typed stays a draft until it is a number, and applies on Enter or
 * leaving the field (or at once for a step). A lone "-" or an empty field is
 * not a number: it reverts instead of snapping the part to 0, and typing "1"
 * on the way to "150" never moves the part to 1 first. The shown value is
 * rounded to a tenth so a typed -12.5 still reads -12.5.
 */
function NumberField({
  label,
  unit,
  value,
  step,
  min,
  max,
  title,
  disabled,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  title?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const field = useNumberDraft(Math.round(value * 10) / 10, onChange);
  return (
    <label className="builderField" title={title}>
      <span className="builderField__label">{label}</span>
      <span className="builderField__control">
        <input type="number" step={step} min={min} max={max} disabled={disabled} {...field} />
        <span className="builderField__unit">{unit}</span>
      </span>
    </label>
  );
}

/** Height is clamped to what the part allows, and shows the range it may take. */
function HeightField({
  component,
  onChange,
}: {
  component: BuilderComponent;
  onChange: (height: number) => void;
}) {
  const [min, max] = heightRange(component.type);
  const fixed = min === max;
  return (
    <NumberField
      label="Height"
      unit="mm"
      step={5}
      min={min}
      max={max}
      title={fixed ? "Fixed by the instrument" : `Optical centre above the breadboard, ${min}–${max} mm`}
      value={component.position[1]}
      disabled={fixed || Boolean(component.host)}
      onChange={(height) => onChange(clampHeight(component.type, height))}
    />
  );
}

/**
 * A slider that previews as it moves and records one undo step per gesture:
 * the first change of a drag (or a run of arrow keys) takes the snapshot.
 */
function SliderField({
  label,
  value,
  display,
  range,
  step,
  onBegin,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  range: [number, number];
  step: number;
  onBegin: () => void;
  onChange: (value: number) => void;
}) {
  const editing = useRef(false);
  const end = () => {
    editing.current = false;
  };
  return (
    <label className="builderField">
      <span className="builderField__label">
        {label}
        <span className="builderReadout">{display}</span>
      </span>
      <input
        className="builderSlider"
        type="range"
        min={range[0]}
        max={range[1]}
        step={step}
        value={value}
        onChange={(event) => {
          if (!editing.current) {
            editing.current = true;
            onBegin();
          }
          onChange(Number(event.target.value));
        }}
        onPointerUp={end}
        onKeyUp={end}
        onBlur={end}
      />
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

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * A saved beam's stops, editable: each row moves up or down or goes away.
 * A button is disabled when its edit isn't allowed, and its label says why.
 */
function EditableStopList({
  components,
  path,
  onChange,
}: {
  components: BuilderComponent[];
  path: string[];
  onChange: (path: string[]) => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  // Keyboard focus follows a moved stop, and stays on the row that closes the
  // gap after a remove; a button the edit disabled hands focus to its row's next.
  const focusAfter = useRef<{ row: number; button: number } | null>(null);
  useEffect(() => {
    const target = focusAfter.current;
    focusAfter.current = null;
    const rows = listRef.current?.children;
    if (!target || !rows?.length) return;
    const buttons = Array.from(rows[Math.min(target.row, rows.length - 1)].querySelectorAll("button"));
    const wanted = buttons[target.button];
    (wanted && !wanted.disabled ? wanted : buttons.find((button) => !button.disabled))?.focus();
  }, [path]);

  return (
    <ol ref={listRef} className="builderStops builderStops--editable">
      {path.map((id, index) => {
        const component = componentById(components, id);
        const name = component ? componentDisplayName(component) : "—";
        // [icon, action, edit, the row the stop ends up on]
        const edits: [IconName, string, PathEdit, number][] = [
          ["up", `move ${name} earlier`, moveStop(path, index, -1), index - 1],
          ["down", `move ${name} later`, moveStop(path, index, 1), index + 1],
          ["close", `remove ${name}`, removeStop(path, index), index],
        ];
        return (
          // keyed by position: rows stay mounted, and focus is moved by hand above
          <li key={index}>
            <span className="builderStops__name">{name}</span>
            <span className="builderStops__actions">
              {edits.map(([icon, action, edit, row], button) => (
                <IconButton
                  key={icon}
                  icon={icon}
                  label={edit.ok ? capitalise(action) : `Can't ${action}: ${edit.reason}`}
                  disabled={!edit.ok}
                  onClick={() => {
                    if (!edit.ok) return;
                    focusAfter.current = { row, button };
                    onChange(edit.path);
                  }}
                />
              ))}
            </span>
          </li>
        );
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
  angleBeam,
  onUpdate,
  onCheckpoint,
  onRotate,
  onDuplicate,
  onDelete,
}: {
  component: BuilderComponent;
  components: BuilderComponent[];
  /** set when a beam turns this part; its yaw is then read-only */
  angleBeam?: Beam;
  onUpdate: (patch: ComponentPatch, record?: boolean) => void;
  onCheckpoint: () => void;
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
        <NumberField label="x" unit="mm" step={5} value={x} disabled={Boolean(host)} onChange={(next) => onUpdate({ position: [next, y, z] })} />
        <NumberField label="z" unit="mm" step={5} value={z} disabled={Boolean(host)} onChange={(next) => onUpdate({ position: [x, y, next] })} />
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
          value={component.rotation}
          disabled={Boolean(angleBeam)}
          onChange={(yaw) => onUpdate({ rotation: ((yaw % 360) + 360) % 360 })}
        />
        <span className="builderInspector__rotate">
          <IconButton icon="rotateLeft" label="Rotate −15° (Shift R)" disabled={Boolean(angleBeam)} onClick={() => onRotate(-1)} />
          <IconButton icon="rotateRight" label="Rotate +15° (R)" disabled={Boolean(angleBeam)} onClick={() => onRotate(1)} />
        </span>
      </div>
      {angleBeam ? (
        <p className="builderInspector__hint">
          Angle set by <strong>{beamDisplayName(angleBeam)}</strong>
        </p>
      ) : null}
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
            value={component.focalLength ?? DEFAULT_FOCAL_LENGTH_MM}
            onChange={(next) => onUpdate({ focalLength: next })}
          />
        </>
      ) : null}
      {component.type === "cavity" ? (
        <NumberField
          label="Length"
          unit="mm"
          step={5}
          value={component.cavityLength ?? DEFAULT_CAVITY_LENGTH_MM}
          onChange={(next) => onUpdate({ cavityLength: next })}
        />
      ) : null}
      {MOUNTED_TYPES.has(component.type) ? (
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
      {component.type === "sample" ? (
        <>
          <label className="builderField">
            <span className="builderField__label">Colour</span>
            <span className="builderField__control builderField__control--color">
              <input
                type="color"
                value={component.color ?? DEFAULT_SAMPLE_COLOR}
                onChange={(event) => onUpdate({ color: event.target.value })}
              />
              <span className="builderReadout">{component.color ?? DEFAULT_SAMPLE_COLOR}</span>
            </span>
          </label>
          <SliderField
            label="Opacity"
            value={component.opacity ?? SAMPLE_OPACITY}
            display={`${Math.round((component.opacity ?? SAMPLE_OPACITY) * 100)}%`}
            range={SAMPLE_OPACITY_RANGE}
            step={0.05}
            onBegin={onCheckpoint}
            onChange={(next) => onUpdate({ opacity: next }, false)}
          />
        </>
      ) : null}
      {component.type === "particle" ? (
        <>
          <ColorField
            label="Colour"
            value={component.color ?? DEFAULT_PARTICLE_COLOR}
            onChange={(color) => onUpdate({ color })}
          />
          <SliderField
            label="Radius"
            value={component.particleRadius ?? PARTICLE_RADIUS_MM}
            display={`${(component.particleRadius ?? PARTICLE_RADIUS_MM).toFixed(1)} mm`}
            range={PARTICLE_RADIUS_RANGE_MM}
            step={0.5}
            onBegin={onCheckpoint}
            onChange={(next) => onUpdate({ particleRadius: next }, false)}
          />
        </>
      ) : null}
      {component.type === "block" ? (
        <>
          <div className="builderFieldRow">
            {(["Length", "Height", "Width"] as const).map((name, axisIndex) => {
              const size = component.size ?? BLOCK_SIZE_MM;
              return (
                <NumberField
                  key={name}
                  label={name}
                  unit="mm"
                  step={1}
                  value={size[axisIndex]}
                  onChange={(next) => {
                    const nextSize = [...size] as Vec3;
                    nextSize[axisIndex] = clamp(next, BLOCK_SIZE_RANGE_MM);
                    onUpdate({ size: nextSize });
                  }}
                />
              );
            })}
          </div>
          <ColorField
            label="Colour"
            value={component.color ?? DEFAULT_BLOCK_COLOR}
            onChange={(color) => onUpdate({ color })}
          />
        </>
      ) : null}
      {component.type === "objective" ? (
        <ColorField
          label="Barrel colour"
          value={component.color ?? DEFAULT_OBJECTIVE_COLOR}
          onChange={(color) => onUpdate({ color })}
        />
      ) : null}
      {component.type === "photodiode" ? (
        <ColorField
          label="Dome colour"
          value={component.color ?? DEFAULT_PHOTODIODE_COLOR}
          onChange={(color) => onUpdate({ color })}
        />
      ) : null}
      <p className="builderInspector__hint">{spec.hint}</p>
    </div>
  );
}

/**
 * Several parts at once. They turn, copy and delete together, and share the
 * fields that mean the same for each: height while they all stand at one
 * (and none sits in a host, which sets its particle's), and the mount colour
 * of those held in a mount.
 */
export function GroupInspector({
  selected,
  onRotate,
  onDuplicate,
  onDelete,
  onSetHeight,
  onSetMountColor,
}: {
  selected: BuilderComponent[];
  onRotate: (direction: 1 | -1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSetHeight: (height: number) => void;
  onSetMountColor: (color: string) => void;
}) {
  const height = selected[0].position[1];
  const sharedHeight = selected.every((component) => component.position[1] === height && !component.host);
  const ranges = selected.map((component) => heightRange(component.type));
  const min = Math.min(...ranges.map(([low]) => low));
  const max = Math.max(...ranges.map(([, high]) => high));
  const mounted = selected.filter((component) => MOUNTED_TYPES.has(component.type));
  const mountColors = new Set(mounted.map((component) => component.color ?? DEFAULT_MOUNT_COLOR));

  return (
    <div className="builderInspector">
      <div className="builderInspector__head">
        <h2>{selected.length} parts selected</h2>
        <IconButton icon="duplicate" label="Duplicate (D)" onClick={onDuplicate} />
        <IconButton icon="trash" label="Delete (Delete)" onClick={onDelete} />
      </div>
      <div className="builderInspector__turn">
        <span>Rotate about their centre</span>
        <span className="builderInspector__rotate">
          <IconButton icon="rotateLeft" label="Rotate −15° (Shift R)" onClick={() => onRotate(-1)} />
          <IconButton icon="rotateRight" label="Rotate +15° (R)" onClick={() => onRotate(1)} />
        </span>
      </div>
      {sharedHeight ? (
        <NumberField
          key={selected.map((component) => component.id).join()}
          label="Height"
          unit="mm"
          step={5}
          min={min}
          max={max}
          title={`Optical centre above the breadboard, ${min}–${max} mm; each part stops at its own limits`}
          value={height}
          onChange={onSetHeight}
        />
      ) : null}
      {mounted.length ? (
        <ColorField
          label={mounted.length === selected.length ? "Mount colour" : `Mount colour (${mounted.length} of ${selected.length})`}
          title="Tint the mounts the colour of the beam they serve"
          value={mounted[0].color ?? DEFAULT_MOUNT_COLOR}
          readout={mountColors.size > 1 ? "mixed" : undefined}
          onChange={onSetMountColor}
        />
      ) : null}
      <p className="builderInspector__hint">Drag any one of them to move them all; they keep their spacing.</p>
    </div>
  );
}

function ColorField({
  label,
  value,
  title,
  readout = value,
  onChange,
}: {
  label: string;
  value: string;
  title?: string;
  /** what the field reads, when that isn't the value */
  readout?: string;
  onChange: (color: string) => void;
}) {
  return (
    <label className="builderField" title={title}>
      <span className="builderField__label">{label}</span>
      <span className="builderField__control builderField__control--color">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
        <span className="builderReadout">{readout}</span>
      </span>
    </label>
  );
}

export function BeamInspector({
  beam,
  components,
  onUpdate,
  onCheckpoint,
  onDelete,
  addingStops,
  onToggleAddStops,
}: {
  beam: Beam;
  components: BuilderComponent[];
  onUpdate: (patch: Partial<Omit<Beam, "id">>, record?: boolean) => void;
  onCheckpoint: () => void;
  onDelete: () => void;
  /** clicking parts on the canvas inserts them into the beam */
  addingStops: boolean;
  onToggleAddStops: () => void;
}) {
  const length = beamLengthMm(components, beam);
  const width = beam.width ?? BEAM_WIDTH_MM;
  const opacity = beam.opacity ?? 1;

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
      <SliderField
        label="Width"
        value={width}
        display={`${width.toFixed(1)} mm`}
        range={BEAM_WIDTH_RANGE_MM}
        step={0.5}
        onBegin={onCheckpoint}
        onChange={(next) => onUpdate({ width: next }, false)}
      />
      <SliderField
        label="Opacity"
        value={opacity}
        display={`${Math.round(opacity * 100)}%`}
        range={BEAM_OPACITY_RANGE}
        step={0.05}
        onBegin={onCheckpoint}
        onChange={(next) => onUpdate({ opacity: next }, false)}
      />
      <div className="builderChoice" role="group" aria-label="Direction arrows">
        <button
          type="button"
          className="builderButton"
          aria-pressed={beam.arrows !== false}
          onClick={() => onUpdate({ arrows: undefined })}
        >
          Arrow
        </button>
        <button
          type="button"
          className="builderButton"
          aria-pressed={beam.arrows === false}
          onClick={() => onUpdate({ arrows: false })}
        >
          No arrow
        </button>
      </div>
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
      <EditableStopList components={components} path={beam.path} onChange={(path) => onUpdate({ path })} />
      <button
        type="button"
        className="builderButton"
        aria-pressed={addingStops}
        onClick={onToggleAddStops}
      >
        {addingStops ? "Done adding stops" : "Add stops"}
      </button>
      {addingStops ? (
        <p className="builderInspector__hint">Click parts to add them to the end, in order. Move a stop up or down to reorder.</p>
      ) : null}
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

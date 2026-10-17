"use client";

// PROTOTYPE: throwaway. Question: should the lightbulb's lighting settings
// (brightness, shadows, light graphics) fold into the eye's Show wheel?
// Variants switch with ?variant= on /builder (⌥←/→). Not for main.

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { Icon, type IconName } from "@/components/builder/builder-icons";
import { ShowWheel, type WheelItem } from "@/components/builder/show-wheel";
import { BRIGHTNESS_RANGE, type Lighting } from "@/components/builder/scene-theme";
import { LABEL_SCALE_RANGE } from "@/components/builder/types";

export const EYE_LIGHTING_VARIANTS = [
  { key: "current", name: "Eye + separate bulb (today)" },
  { key: "six", name: "Six wedges, brightness in card" },
  { key: "card", name: "Four wedges, lighting card" },
  { key: "rim", name: "Six wedges, brightness rim dial" },
  { key: "rims", name: "Brightness rim out, label size rim in" },
  { key: "split", name: "One rim: label size left, brightness right" },
] as const;

// the roomier ring for six wedges, and one with space for a dial round the hole
const ROOMY = { outer: 184, inner: 50 };
const ROOMY_HOLED = { outer: 192, inner: 84 };
const GAP = 0.06;

type Props = {
  variant: string;
  posts: boolean;
  grid: boolean;
  labels: boolean;
  distances: boolean;
  onTogglePosts: () => void;
  onToggleGrid: () => void;
  onToggleLabels: () => void;
  onToggleDistances: () => void;
  scale: number;
  onBegin: () => void;
  onScaleChange: (scale: number) => void;
  lighting: Lighting;
  onLightingChange: (patch: Partial<Lighting>) => void;
  lightGraphics: boolean;
  onToggleQuality: () => void;
};

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);
  return ref;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** The eye, with the lighting folded in as the variant says. Replaces both ShowMenu and LightingMenu. */
export function EyeLightingPrototype(props: Props) {
  const { variant, lighting, onLightingChange } = props;
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const editing = useRef(false);
  const end = () => {
    editing.current = false;
  };

  const showItems: WheelItem[] = [
    { id: "posts", label: "Posts", description: "Posts under the parts", icon: "posts", on: props.posts, onToggle: props.onTogglePosts },
    { id: "grid", label: "Grid", description: "The grid on the table", icon: "grid", on: props.grid, onToggle: props.onToggleGrid },
    {
      id: "labels",
      label: "Labels",
      description: "Part names on the table",
      icon: "labels",
      iconOff: "labelsOff",
      on: props.labels,
      onToggle: props.onToggleLabels,
    },
    {
      id: "distances",
      label: "Beam distances",
      description: "Lengths along each beam",
      icon: "ruler",
      on: props.distances,
      onToggle: props.onToggleDistances,
    },
  ];
  const lightItems: WheelItem[] = [
    {
      id: "shadows",
      label: "Shadows",
      description: "Shadows cast by the key light",
      icon: "shadow",
      on: lighting.shadows,
      onToggle: () => onLightingChange({ shadows: !lighting.shadows }),
    },
    {
      id: "light",
      label: "Light graphics",
      description: "Simpler drawing, for a slow computer",
      icon: "gauge",
      on: props.lightGraphics,
      onToggle: props.onToggleQuality,
    },
  ];

  const labelSize = (
    <label className="builderField">
      <span className="builderField__label">
        Label size
        <span className="builderReadout">{pct(props.scale)}</span>
      </span>
      <input
        className="builderSlider"
        type="range"
        min={LABEL_SCALE_RANGE[0]}
        max={LABEL_SCALE_RANGE[1]}
        step={0.05}
        value={props.scale}
        disabled={!props.labels}
        onChange={(event) => {
          if (!editing.current) {
            editing.current = true;
            props.onBegin();
          }
          props.onScaleChange(Number(event.target.value));
        }}
        onPointerUp={end}
        onKeyUp={end}
        onBlur={end}
      />
    </label>
  );
  const brightness = (
    <label className="builderField">
      <span className="builderField__label">
        Brightness
        <span className="builderReadout">{pct(lighting.brightness)}</span>
      </span>
      <input
        className="builderSlider"
        type="range"
        min={BRIGHTNESS_RANGE[0]}
        max={BRIGHTNESS_RANGE[1]}
        step={0.05}
        value={lighting.brightness}
        onChange={(event) => onLightingChange({ brightness: Number(event.target.value) })}
      />
    </label>
  );

  const wheel = (() => {
    const onClose = () => {
      setOpen(false);
      buttonRef.current?.focus();
    };
    if (variant === "six")
      return (
        <ShowWheel
          items={[...showItems, ...lightItems]}
          onClose={onClose}
          {...ROOMY}
          footer={
            <div className="protoEyeCard">
              {labelSize}
              {brightness}
            </div>
          }
        />
      );
    if (variant === "card")
      return (
        <ShowWheel
          items={showItems}
          onClose={onClose}
          footer={
            <div className="protoEyeCard">
              {labelSize}
              <div className="protoEyeCard__head">
                <Icon name="light" size={14} /> Lighting
              </div>
              {brightness}
              <label className="builderLighting__toggle">
                Shadows
                <input
                  type="checkbox"
                  role="switch"
                  checked={lighting.shadows}
                  onChange={(event) => onLightingChange({ shadows: event.target.checked })}
                />
              </label>
              <label className="builderLighting__toggle" title="Simpler drawing, for a slow computer">
                Light graphics
                <input type="checkbox" role="switch" checked={props.lightGraphics} onChange={props.onToggleQuality} />
              </label>
            </div>
          }
        />
      );
    const brightnessDial = (r: number, from: number, to: number) => (
      <Dial
        label="Brightness"
        r={r}
        from={from}
        to={to}
        range={BRIGHTNESS_RANGE}
        value={lighting.brightness}
        onChange={(b) => onLightingChange({ brightness: b })}
      />
    );
    const labelDial = (r: number, from: number, to: number, side: 1 | -1) => (
      <Dial
        label="Label size"
        icon="labels"
        r={r}
        from={from}
        to={to}
        side={side}
        range={LABEL_SCALE_RANGE}
        value={props.scale}
        disabled={!props.labels}
        onStart={props.onBegin}
        onChange={props.onScaleChange}
      />
    );
    const items = [...showItems, ...lightItems];
    if (variant === "rims")
      return (
        <ShowWheel
          items={items}
          onClose={onClose}
          {...ROOMY_HOLED}
          rim={(outer, inner) => (
            <>
              {brightnessDial(outer + 14, Math.PI, 0)}
              {labelDial(inner - 18, Math.PI, 0, -1)}
            </>
          )}
        />
      );
    if (variant === "split")
      return (
        <ShowWheel
          items={items}
          onClose={onClose}
          {...ROOMY}
          rim={(outer) => (
            <>
              {labelDial(outer + 14, Math.PI, Math.PI / 2 + GAP, 1)}
              {brightnessDial(outer + 14, Math.PI / 2 - GAP, 0)}
            </>
          )}
        />
      );
    // rim
    return (
      <ShowWheel
        items={items}
        onClose={onClose}
        footer={labelSize}
        {...ROOMY}
        rim={(outer) => brightnessDial(outer + 14, Math.PI, 0)}
      />
    );
  })();

  return (
    <div className="builderLighting" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        className={`builderIconBtn${open ? " is-active" : ""}`}
        aria-label="Show"
        aria-expanded={open}
        aria-haspopup="menu"
        title="Show"
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name="eye" />
      </button>
      {open ? wheel : null}
    </div>
  );
}

/**
 * A dial on an arc of the ring, from angle `from` (its low end, on the left)
 * round the bottom to `to` (its high end): drag the knob, or arrow keys when
 * focused. The readout rides by the knob, outside the arc (`side` 1) or inside (-1).
 */
function Dial({
  label,
  icon = "light",
  r,
  from,
  to,
  side = 1,
  range,
  value,
  disabled,
  onStart,
  onChange,
}: {
  label: string;
  icon?: IconName;
  r: number;
  from: number;
  to: number;
  side?: 1 | -1;
  range: [number, number];
  value: number;
  disabled?: boolean;
  onStart?: () => void;
  onChange: (value: number) => void;
}) {
  const [lo, hi] = range;
  const t = (value - lo) / (hi - lo);
  const angle = from - t * (from - to);
  const at = (a: number, radius = r) => [radius * Math.cos(a), radius * Math.sin(a)] as const;
  const [hx, hy] = at(angle);
  const [sx, sy] = at(from);
  const [ex, ey] = at(to);
  const [tx, ty] = at(angle, r + side * 20);
  const dragging = useRef(false);
  const snap = (v: number) => Math.min(hi, Math.max(lo, Math.round(v * 20) / 20));

  const fromPointer = (event: PointerEvent<SVGElement>) => {
    const svg = (event.currentTarget as SVGElement).ownerSVGElement;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(m.inverse());
    const a = Math.min(from, Math.max(to, Math.atan2(Math.max(p.y, 0), p.x)));
    onChange(snap(lo + ((from - a) / (from - to)) * (hi - lo)));
  };

  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    const step = { ArrowRight: 0.05, ArrowUp: 0.05, ArrowLeft: -0.05, ArrowDown: -0.05 }[event.key];
    if (step === undefined || disabled) return;
    event.preventDefault();
    event.stopPropagation();
    onStart?.();
    onChange(snap(value + step));
  };

  const track = `M${sx} ${sy}A${r} ${r} 0 0 0 ${ex} ${ey}`;
  return (
    <g
      className={`protoRim${disabled ? " is-disabled" : ""}`}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled}
      aria-valuemin={lo}
      aria-valuemax={hi}
      aria-valuenow={value}
      aria-valuetext={pct(value)}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        if (disabled) return;
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        onStart?.();
        fromPointer(event);
      }}
      onPointerMove={(event) => dragging.current && fromPointer(event)}
      onPointerUp={() => {
        dragging.current = false;
      }}
    >
      <title>{disabled ? `${label}: turn labels on first` : `${label}: drag round the rim`}</title>
      <path className="protoRim__hit" d={track} />
      <path className="protoRim__track" d={track} />
      <path className="protoRim__fill" d={`M${sx} ${sy}A${r} ${r} 0 0 0 ${hx} ${hy}`} />
      <circle className="protoRim__knob" cx={hx} cy={hy} r={9} />
      <g transform={`translate(${hx - 6} ${hy - 6})`} style={{ pointerEvents: "none" }}>
        <Icon name={icon} size={12} />
      </g>
      <text className="protoRim__readout" x={tx} y={ty} textAnchor="middle" dominantBaseline="central">
        {pct(value)}
      </text>
    </g>
  );
}

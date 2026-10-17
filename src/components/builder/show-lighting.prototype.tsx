"use client";

// PROTOTYPE: throwaway. Question: should the lightbulb's lighting settings
// (brightness, shadows, light graphics) fold into the eye's Show wheel?
// Variants switch with ?variant= on /builder (⌥←/→). Not for main.

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { Icon } from "@/components/builder/builder-icons";
import { ShowWheel, type WheelItem } from "@/components/builder/show-wheel";
import { BRIGHTNESS_RANGE, type Lighting } from "@/components/builder/scene-theme";
import { LABEL_SCALE_RANGE } from "@/components/builder/types";

export const EYE_LIGHTING_VARIANTS = [
  { key: "current", name: "Eye + separate bulb (today)" },
  { key: "six", name: "Six wedges, brightness in card" },
  { key: "card", name: "Four wedges, lighting card" },
  { key: "rim", name: "Six wedges, brightness rim dial" },
] as const;

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
    // rim
    return (
      <ShowWheel
        items={[...showItems, ...lightItems]}
        onClose={onClose}
        footer={labelSize}
        rim={(outer) => (
          <BrightnessRim outer={outer} value={lighting.brightness} onChange={(b) => onLightingChange({ brightness: b })} />
        )}
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

/** A half-circle track round the ring: drag the sun along it, dim at the left, bright at the right. */
function BrightnessRim({ outer, value, onChange }: { outer: number; value: number; onChange: (b: number) => void }) {
  const r = outer + 14;
  const [lo, hi] = BRIGHTNESS_RANGE;
  const t = (value - lo) / (hi - lo);
  // left end is π, right end is 0 (y down: the lower half)
  const angle = Math.PI * (1 - t);
  const at = (a: number) => [r * Math.cos(a), r * Math.sin(a)] as const;
  const [hx, hy] = at(angle);
  const [lx, ly] = at(Math.PI);
  const dragging = useRef(false);

  const fromPointer = (event: PointerEvent<SVGElement>) => {
    const svg = (event.currentTarget as SVGElement).ownerSVGElement;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(m.inverse());
    let a = Math.atan2(Math.max(p.y, 0), p.x);
    a = Math.min(Math.PI, Math.max(0, a));
    const next = lo + (1 - a / Math.PI) * (hi - lo);
    onChange(Math.round(next * 20) / 20);
  };

  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    const step = { ArrowRight: 0.05, ArrowUp: 0.05, ArrowLeft: -0.05, ArrowDown: -0.05 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    onChange(Math.min(hi, Math.max(lo, Math.round((value + step) * 20) / 20)));
  };

  return (
    <g
      className="protoRim"
      role="slider"
      tabIndex={0}
      aria-label="Brightness"
      aria-valuemin={lo}
      aria-valuemax={hi}
      aria-valuenow={value}
      aria-valuetext={pct(value)}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        fromPointer(event);
      }}
      onPointerMove={(event) => dragging.current && fromPointer(event)}
      onPointerUp={() => {
        dragging.current = false;
      }}
    >
      <title>Brightness: drag round the rim</title>
      <path className="protoRim__hit" d={`M${-r} 0A${r} ${r} 0 0 0 ${r} 0`} />
      <path className="protoRim__track" d={`M${-r} 0A${r} ${r} 0 0 0 ${r} 0`} />
      <path className="protoRim__fill" d={`M${lx} ${ly}A${r} ${r} 0 0 0 ${hx} ${hy}`} />
      <circle className="protoRim__knob" cx={hx} cy={hy} r={8} />
      <g transform={`translate(${hx - 6} ${hy - 6})`} style={{ pointerEvents: "none" }}>
        <Icon name="light" size={12} />
      </g>
      <text className="protoRim__readout" x={0} y={r + 16} textAnchor="middle">
        Brightness {pct(value)}
      </text>
    </g>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ChangeEvent, type RefObject } from "react";
import { createPortal } from "react-dom";

import type { CameraView } from "@/components/builder/builder-canvas";
import { Icon, IconButton } from "@/components/builder/builder-icons";
import { CheatSheet, CoachMarks } from "@/components/builder/builder-guide";
import PartsPanel from "@/components/builder/builder-parts-panel";
import { SCENE_TEXT_MAX_BYTES, checkSceneText } from "@/components/builder/scene-text";
import { setupBrief } from "@/components/builder/setup-brief";
import { useRowDrag } from "@/components/builder/use-row-drag";
import { PanelsPrototypeBar, ProtoPanel } from "@/components/builder/panels-prototype";
import {
  BeamDraftInspector,
  BeamInspector,
  ComponentInspector,
  ConnectionDraftInspector,
  ConnectionInspector,
  FrameInspector,
  GroupInspector,
  GroupsField,
} from "@/components/builder/builder-inspector";
import { BRIGHTNESS_RANGE, type Lighting } from "@/components/builder/scene-theme";
import type { GraphicsQuality } from "@/components/builder/graphics-quality";
import {
  COMPONENT_SPECS,
  CONNECTION_KINDS,
  LABEL_MAX_LENGTH,
  LABEL_SCALE_RANGE,
  beamDisplayName,
  beamLengthMm,
  componentDisplayName,
  derivedAngleBeam,
  frameDisplayName,
  periscopePartner,
  type Beam,
  type BuilderComponent,
  type ComponentType,
  type Connection,
  type ConnectionKind,
  type Frame,
  type Group,
  type BuilderSceneData,
} from "@/components/builder/types";

/** The beam that turns a periscope's top mirror, when the lower one is the part shown. */
function partnerAngleBeam(components: BuilderComponent[], beams: Beam[], component: BuilderComponent): Beam | undefined {
  const partner = component.type === "periscope" ? periscopePartner(components, component) : undefined;
  return partner && derivedAngleBeam(beams, partner);
}

/** Connect mode: the kind being drawn, and the part clicked first once there is one. */
export type ConnectDraft = { kind: ConnectionKind; from: string | null };
import { findTool } from "@/components/navigation";
import { BetaMark } from "@/components/beta-badge";

export type BuilderHudProps = {
  components: BuilderComponent[];
  beams: Beam[];
  frames: Frame[];
  /** the selected parts, in the order they were picked */
  selected: BuilderComponent[];
  selectedBeam: Beam | null;
  selectedConnection: Connection | null;
  selectedFrame: Frame | null;
  /** set while the Connect tool is on */
  connectDraft: ConnectDraft | null;
  placingType: ComponentType | null;
  trayOpen: boolean;
  beamMode: boolean;
  /** "Add a frame" is drawing one */
  drawingFrame: boolean;
  /** how many corners the frame being drawn has so far */
  frameCorners: number;
  /** "Add stops" is on for the selected beam */
  addingStops: boolean;
  beamDraft: string[];
  beamColor: string;
  showLabels: boolean;
  showDistances: boolean;
  showGrid: boolean;
  showPosts: boolean;
  lighting: Lighting;
  /** the setup's label size, 1 being the standard */
  labelScale: number;
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
  /** any one part by id: a periscope mirror's inspector edits its other mirror too */
  onUpdateComponent: (id: string, patch: Partial<Omit<BuilderComponent, "id" | "type">>, record?: boolean) => void;
  onRotateSelected: (direction: 1 | -1) => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  /** several parts: one height for all, or one mount colour for those with a mount */
  onSetSelectedHeight: (height: number) => void;
  onSetSelectedMountColor: (color: string) => void;
  onStartBeam: () => void;
  onFinishBeam: () => void;
  onCancelBeam: () => void;
  onUndoBeamStep: () => void;
  onBeamColorChange: (color: string) => void;
  onStartConnect: () => void;
  onCancelConnect: () => void;
  onConnectKindChange: (kind: ConnectionKind) => void;
  onUpdateConnection: (id: string, patch: Partial<Omit<Connection, "id">>) => void;
  onDeleteConnection: (id: string) => void;
  onSelectBeam: (id: string) => void;
  onToggleAddStops: () => void;
  onUpdateBeam: (id: string, patch: Partial<Omit<Beam, "id">>, record?: boolean) => void;
  /** snapshot the scene before a run of unrecorded edits (a slider drag) */
  onCheckpoint: () => void;
  onDeleteBeam: (id: string) => void;
  /** drop a beam at index `to` of the list; true when it moved */
  onMoveBeam: (id: string, to: number, how: "drag" | "keyboard") => boolean;
  onSetBeamHidden: (id: string, hidden: boolean) => void;
  onStartFrame: () => void;
  onCancelFrame: () => void;
  /** the selected frame was just drawn: its label field takes focus */
  focusFrameLabel: boolean;
  onFrameLabelFocused: () => void;
  onSelectFrame: (id: string) => void;
  onUpdateFrame: (id: string, patch: Partial<Omit<Frame, "id">>, record?: boolean) => void;
  onDeleteFrame: (id: string) => void;
  onMoveFrame: (id: string, to: number, how: "drag" | "keyboard") => boolean;
  onSetFrameHidden: (id: string, hidden: boolean) => void;
  groups: Group[];
  /** the group whose name is being edited in its row, if any */
  renamingGroupId: string | null;
  onSelectGroup: (id: string) => void;
  /** the row under the pointer, whose members the table outlines */
  onHoverGroup: (id: string | null) => void;
  onRenameGroupStart: (id: string) => void;
  /** null ends the edit and keeps the old name */
  onRenameGroup: (id: string, name: string | null) => void;
  /** unrecorded: a colour pick is made one undo step by onCheckpoint at its start */
  onSetGroupColor: (id: string, color: string) => void;
  onSetGroupHidden: (id: string, hidden: boolean) => void;
  onDeleteGroup: (id: string) => void;
  /** download a group as its own setup file, `<name>.json` */
  onExportGroup: (id: string) => void;
  /** a setup file's text to merge into the table; null when the file was too big to read */
  onImport: (text: string | null, fileName: string) => void;
  /** set while an import waits on what to do with a group the table already has */
  importChoice: { names: string[] } | null;
  onImportChoice: (choice: "replace" | "copy" | null) => void;
  onSetGroupMembership: (groupId: string, id: string, isMember: boolean) => void;
  onToggleLabels: () => void;
  onToggleDistances: () => void;
  onToggleGrid: () => void;
  onTogglePosts: () => void;
  onLightingChange: (patch: Partial<Lighting>) => void;
  /** unrecorded: a drag is made one undo step by onCheckpoint at its start */
  onLabelScaleChange: (scale: number) => void;
  onViewChange: (view: CameraView) => void;
  onFit: () => void;
  onToggleTheme: () => void;
  quality: GraphicsQuality;
  onToggleQuality: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  /** the setup as it stands, for the JSON panel to open on */
  sceneJson: () => string;
  /** replace the table with a setup the JSON panel checked: one undo step */
  onApplyScene: (scene: BuilderSceneData, summary: string) => void;
  onExportPng: () => void;
  /** the setup brief: to the clipboard, or saved as a .md file */
  onCopyBrief: () => void;
  onDownloadBrief: () => void;
  onResetExample: () => void;
  onClear: () => void;
};

type Hint = [key: string, action: string];

/** Key hints appear only inside a mode — the rest of the time the canvas stays quiet. */
function modeHints(props: BuilderHudProps): { label: string; hints: Hint[] } | null {
  if (props.beamMode)
    return {
      label: "Beam",
      hints: [
        ["Click", "stop"],
        ["Enter", "done"],
        ["Esc", "cancel"],
      ],
    };
  // a drag makes a rectangle only before the first corner; after it, it pans
  if (props.drawingFrame)
    return {
      label: "Frame",
      hints:
        props.frameCorners === 0
          ? [
              ["Drag", "rectangle"],
              ["Click", "corner"],
              ["Esc", "cancel"],
            ]
          : [
              ["Click", "corner"],
              ["Enter", "done"],
              ["⌫", "undo"],
              ["Esc", "cancel"],
            ],
    };
  if (props.connectDraft)
    return {
      label: CONNECTION_KINDS[props.connectDraft.kind].label,
      hints: [
        ["Click", props.connectDraft.from ? "to" : "from"],
        ["Esc", "cancel"],
      ],
    };
  if (props.addingStops)
    return {
      label: "Stops",
      hints: [
        ["Click", "add"],
        ["Enter", "done"],
      ],
    };
  if (props.placingType)
    return {
      label: COMPONENT_SPECS[props.placingType].label,
      hints: [
        ["Click", "place"],
        ["Esc", "cancel"],
      ],
    };
  return null;
}

/**
 * The beams box: one row per beam, in list order. Press a row to select its
 * beam, or drag it to a new place in the list (Alt+↑ / Alt+↓ moves a focused
 * row one place); its buttons hide or show it on the table, or delete it. A
 * hidden beam's row stays, dimmed. Keyboard focus follows the edit: a moved
 * beam's row keeps focus on its select button, and a deleted beam's row hands
 * focus to the beam that took its place.
 */
function BeamList({
  components,
  beams,
  selectedId,
  besideParts,
  onSelect,
  onMove,
  onSetHidden,
  onDelete,
}: {
  components: BuilderComponent[];
  beams: Beam[];
  selectedId: string | null;
  besideParts: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, to: number, how: "drag" | "keyboard") => boolean;
  onSetHidden: (id: string, hidden: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  // a row's buttons, in order: select, hide, delete; the first enabled one wanted gets focus
  const focusAfter = useRef<{ row: number; wanted: number[] } | null>(null);
  useEffect(() => {
    const target = focusAfter.current;
    focusAfter.current = null;
    const rows = listRef.current?.children;
    if (!target || !rows?.length) return;
    const buttons = Array.from(rows[Math.min(target.row, rows.length - 1)].querySelectorAll("button"));
    target.wanted.map((at) => buttons[at]).find((button) => button && !button.disabled)?.focus();
  }, [beams]);

  const { listClass, rowProps } = useRowDrag({
    listRef,
    count: beams.length,
    onMove: (from, to, how) => {
      if (how === "keyboard") focusAfter.current = { row: to, wanted: [0] };
      return onMove(beams[from].id, to, how);
    },
  });

  return (
    <ol
      ref={listRef}
      role="list"
      aria-label="Beams"
      data-guide="beams"
      className={`builderIsland builderHud__beams${besideParts ? " is-besideParts" : ""} ${listClass}`}
    >
      {beams.map((beam, index) => {
        const name = beamDisplayName(beam);
        const selected = selectedId === beam.id;
        const drag = rowProps(index);
        return (
          <li
            key={beam.id}
            {...drag}
            className={`builderBeamRow${selected ? " is-selected" : ""}${beam.hidden ? " is-hidden" : ""} ${drag.className}`}
          >
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
            <span className="builderBeamRow__actions" data-no-drag>
              <IconButton
                icon={beam.hidden ? "eyeOff" : "eye"}
                // a toggle: the label stays put and aria-pressed carries the state
                label={`Hide ${name}`}
                active={Boolean(beam.hidden)}
                onClick={() => onSetHidden(beam.id, !beam.hidden)}
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

/**
 * The frames section, under the beams box: one row per frame, to select it,
 * drag it to a new place in the list (Alt+↑ / Alt+↓ moves a focused row), hide
 * or show it, or delete it. Focus follows the edit as in the beams box.
 */
function FrameList({
  frames,
  selectedId,
  onSelect,
  onMove,
  onSetHidden,
  onDelete,
}: {
  frames: Frame[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, to: number, how: "drag" | "keyboard") => boolean;
  onSetHidden: (id: string, hidden: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  // a moved frame's row keeps focus, and a deleted frame's row hands it to the one that took its place
  const focusRow = useRef<number | null>(null);
  useEffect(() => {
    const row = focusRow.current;
    focusRow.current = null;
    const rows = listRef.current?.children;
    if (row === null || !rows?.length) return;
    rows[Math.min(row, rows.length - 1)].querySelector("button")?.focus();
  }, [frames]);

  const { listClass, rowProps } = useRowDrag({
    listRef,
    count: frames.length,
    onMove: (from, to, how) => {
      if (how === "keyboard") focusRow.current = to;
      return onMove(frames[from].id, to, how);
    },
  });

  return (
    <section className="builderIsland builderHud__frames" aria-labelledby="builderFramesTitle" data-guide="frames">
      <h2 id="builderFramesTitle" className="builderHud__listTitle">
        Frames
      </h2>
      <ul ref={listRef} role="list" className={`builderHud__frameRows ${listClass}`}>
        {frames.map((frame, index) => {
          const name = frameDisplayName(frame);
          const selected = selectedId === frame.id;
          const drag = rowProps(index);
          return (
            <li
              key={frame.id}
              {...drag}
              className={`builderBeamRow${selected ? " is-selected" : ""}${frame.hidden ? " is-hidden" : ""} ${drag.className}`}
            >
              <button type="button" className="builderBeamRow__select" aria-pressed={selected} onClick={() => onSelect(frame.id)}>
                <span className="builderBeamRow__dot builderBeamRow__dot--square" style={{ background: frame.color }} />
                <span className="builderBeamRow__name">{name}</span>
              </button>
              <span className="builderBeamRow__actions" data-no-drag>
                <IconButton
                  icon={frame.hidden ? "eyeOff" : "eye"}
                  // a toggle: the label stays put and aria-pressed carries the state
                  label={`Hide ${name}`}
                  active={Boolean(frame.hidden)}
                  onClick={() => onSetHidden(frame.id, !frame.hidden)}
                />
                <IconButton
                  icon="trash"
                  label={`Delete ${name}`}
                  onClick={() => {
                    focusRow.current = index;
                    onDelete(frame.id);
                  }}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * A group row's ⋯ menu: rename, save it as its own file, ungroup. Closes on a
 * pick, a click outside or Esc.
 */
function GroupRowMenu({
  name,
  onRename,
  onExport,
  onDelete,
}: {
  name: string;
  onRename: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  // the list is fixed to the viewport, opening up from the button: the box it
  // sits in scrolls, and would clip it
  const [place, setPlace] = useState<{ left: number; bottom: number } | null>(null);
  const open = place !== null;
  const listRef = useRef<HTMLSpanElement>(null);
  const ref = useBubbleDismiss<HTMLSpanElement>(open, useCallback(() => setPlace(null), []), listRef);
  const run = (action: () => void) => () => {
    setPlace(null);
    action();
  };
  return (
    <span className="builderMenu builderGroupMenu" ref={ref}>
      <button
        type="button"
        className={`builderIconBtn${open ? " is-active" : ""}`}
        aria-label={`More for ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title="More"
        onClick={(event) => {
          if (open) return setPlace(null);
          const box = event.currentTarget.getBoundingClientRect();
          setPlace({ left: box.left, bottom: window.innerHeight - box.top + 4 });
        }}
      >
        <Icon name="more" />
      </button>
      {place
        ? createPortal(
            <span ref={listRef} className="builderMenu__list builderGroupMenu__list" role="menu" style={place}>
              <button type="button" role="menuitem" onClick={run(onRename)}>
                Rename
              </button>
              <button type="button" role="menuitem" onClick={run(onExport)}>
                Export group…
              </button>
              <button type="button" role="menuitem" onClick={run(onDelete)}>
                Delete group
              </button>
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}

/** A group's name, edited in place: Enter or leaving the field keeps it, Esc puts the old one back. */
function GroupNameInput({
  name,
  onDone,
}: {
  name: string;
  onDone: (name: string | null) => void;
}) {
  const [draft, setDraft] = useState(name);
  const done = useRef(false);
  const finish = (value: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(value);
  };
  return (
    <input
      className="builderGroupRow__nameInput"
      aria-label="Group name"
      value={draft}
      maxLength={LABEL_MAX_LENGTH}
      autoFocus
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") finish(draft);
        else if (event.key === "Escape") {
          event.stopPropagation();
          finish(null);
        }
      }}
      onBlur={() => finish(draft)}
    />
  );
}

/**
 * The Groups box, under the frames: one row per group, with its colour (click
 * to change), its name (double-click or ⋯ → Rename to edit it in place), how
 * many members it has, an eye to hide or show it, and a ⋯ menu. Press a row to
 * select its parts; hover it to outline its members on the table.
 */
function GroupList({
  groups,
  renamingId,
  onSelect,
  onHover,
  onRename,
  onRenameStart,
  onSetColor,
  onCheckpoint,
  onSetHidden,
  onExport,
  onDelete,
}: {
  groups: Group[];
  /** the group whose name is being edited, if any */
  renamingId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  /** null leaves the name as it was */
  onRename: (id: string, name: string | null) => void;
  onRenameStart: (id: string) => void;
  /** unrecorded: a picker's drag is one undo step by onCheckpoint at its start */
  onSetColor: (id: string, color: string) => void;
  onCheckpoint: () => void;
  onSetHidden: (id: string, hidden: boolean) => void;
  /** download the group as its own setup file */
  onExport: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const picking = useRef<string | null>(null);
  return (
    <section className="builderIsland builderHud__frames" aria-labelledby="builderGroupsTitle" data-guide="groups">
      <h2 id="builderGroupsTitle" className="builderHud__listTitle">
        Groups
      </h2>
      <ul role="list" className="builderHud__frameRows" onPointerLeave={() => onHover(null)}>
        {groups.map((group) => (
          <li
            key={group.id}
            className={`builderBeamRow builderGroupRow${group.hidden ? " is-hidden" : ""}`}
            onPointerEnter={() => onHover(group.id)}
            onFocus={() => onHover(group.id)}
            onBlur={() => onHover(null)}
          >
            <label className="builderGroupRow__swatch" title="Colour" style={{ background: group.color }}>
              <input
                type="color"
                aria-label={`${group.name} colour`}
                value={group.color}
                onChange={(event) => {
                  if (picking.current !== group.id) {
                    picking.current = group.id;
                    onCheckpoint();
                  }
                  onSetColor(group.id, event.target.value);
                }}
                onBlur={() => {
                  picking.current = null;
                }}
              />
            </label>
            {renamingId === group.id ? (
              <GroupNameInput name={group.name} onDone={(name) => onRename(group.id, name)} />
            ) : (
              <button
                type="button"
                className="builderBeamRow__select"
                title="Select its parts · double-click to rename"
                onClick={() => onSelect(group.id)}
                onDoubleClick={() => onRenameStart(group.id)}
              >
                <span className="builderBeamRow__name">{group.name}</span>
                <span className="builderReadout">{group.members.length}</span>
              </button>
            )}
            <span className="builderBeamRow__actions">
              <IconButton
                icon={group.hidden ? "eyeOff" : "eye"}
                // a toggle: the label stays put and aria-pressed carries the state
                label={`Hide ${group.name}`}
                active={Boolean(group.hidden)}
                onClick={() => onSetHidden(group.id, !group.hidden)}
              />
              <GroupRowMenu
                name={group.name}
                onRename={() => onRenameStart(group.id)}
                onExport={() => onExport(group.id)}
                onDelete={() => onDelete(group.id)}
              />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Asked when an imported file brings a group the table already has: replace
 * it with the file's, add the file's as a copy, or cancel. Esc cancels.
 */
function ImportChoiceDialog({
  names,
  onChoose,
}: {
  names: string[];
  onChoose: (choice: "replace" | "copy" | null) => void;
}) {
  useEscapeCloses(useCallback(() => onChoose(null), [onChoose]));
  const which = names.length === 1 ? names[0] : `${names.length} groups`;
  return (
    <div className="builderImportChoice__backdrop">
      <section
        className="builderIsland builderImportChoice"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="builderImportChoiceTitle"
        aria-describedby="builderImportChoiceText"
      >
        <h2 id="builderImportChoiceTitle" className="builderAbout__title">
          {names.length === 1 ? `${names[0]} is already on the table` : "These groups are already on the table"}
        </h2>
        <p id="builderImportChoiceText" className="builderAbout__description">
          {names.length === 1
            ? "Replace it with the file's, or add the file's beside it as a copy."
            : `${names.join(", ")}. Replace them with the file's, or add the file's beside them as copies.`}
        </p>
        <div className="builderBrief__actions">
          <button type="button" className="builderButton builderButton--primary" autoFocus onClick={() => onChoose("replace")}>
            Replace {which}
          </button>
          <button type="button" className="builderButton" onClick={() => onChoose("copy")}>
            Add as a copy
          </button>
          <button type="button" className="builderButton" onClick={() => onChoose(null)}>
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}

/**
 * Esc closes the panel. Capture, and stop, so this Esc closes only the panel:
 * the scene's Esc chain peels one layer per press and would otherwise also deselect.
 */
function useEscapeCloses(onClose: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);
}

/** The setup brief, to copy into an AI assistant or save; it opens where the about panel does. */
function BriefPanel({
  onCopy,
  onDownload,
  onClose,
}: {
  onCopy: () => void;
  onDownload: () => void;
  onClose: () => void;
}) {
  const brief = useMemo(() => setupBrief(), []);
  useEscapeCloses(onClose);

  return (
    <aside className="builderIsland builderAbout builderBrief" aria-labelledby="builder-brief-title">
      <h2 id="builder-brief-title" className="builderAbout__title">
        Setup brief
      </h2>
      <p className="builderAbout__description">
        For an AI assistant. Open its reply with Open JSON….
      </p>
      <div className="builderBrief__actions">
        <button type="button" className="builderButton builderButton--primary" onClick={onCopy}>
          Copy
        </button>
        <button type="button" className="builderButton" onClick={onDownload}>
          Download .md
        </button>
      </div>
      <pre className="builderBrief__text" tabIndex={0} aria-label="The setup brief, in Markdown">
        {brief}
      </pre>
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

/**
 * The setup as JSON, to read, tweak, copy, paste over or fill from a file,
 * in the parts panel's place. Nothing reaches the table until Apply, and
 * Apply only takes text checkSceneText passed: within its size, valid JSON,
 * a setup's shape and counts, colours and labels made safe by parseScene.
 */
function JsonPanel({
  initial,
  onApply,
  onClose,
}: {
  initial: () => string;
  onApply: (scene: BuilderSceneData, summary: string) => void;
  onClose: () => void;
}) {
  const [opened] = useState(initial);
  const [text, setText] = useState(opened);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // a large paste is checked once typing settles, not on every keystroke
  const settled = useDeferredValue(text);
  const check = useMemo(() => checkSceneText(settled), [settled]);
  const changed = text !== opened;
  useEscapeCloses(onClose);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setNote("Copied.");
    } catch {
      setNote("Copy blocked: use ⌘C.");
    }
  };
  const paste = async () => {
    try {
      const pasted = await navigator.clipboard.readText();
      if (pasted.length > SCENE_TEXT_MAX_BYTES) setNote("Too long.");
      else {
        setText(pasted);
        setNote("Pasted.");
      }
    } catch {
      setNote("Paste blocked: use ⌘V.");
    }
  };
  const openFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > SCENE_TEXT_MAX_BYTES) {
      setNote(`${file.name} is over ${SCENE_TEXT_MAX_BYTES / 1_000_000} MB.`);
      return;
    }
    setText(await file.text());
    setNote(`Read ${file.name}.`);
  };

  return (
    <aside className="builderIsland builderAbout builderBrief builderJson" aria-labelledby="builder-json-title">
      <h2 id="builder-json-title" className="builderAbout__title">
        Setup JSON
      </h2>
      <p className="builderAbout__description">
        Apply replaces the table. ⌘Z undoes it.
      </p>
      <div className="builderBrief__actions">
        <button
          type="button"
          className="builderButton builderButton--primary"
          disabled={!check.ok || !changed || settled !== text}
          onClick={() => {
            if (check.ok) onApply(check.scene, check.summary);
          }}
        >
          Apply
        </button>
        <button type="button" className="builderButton" onClick={() => void copy()}>
          Copy
        </button>
        <button type="button" className="builderButton" onClick={() => void paste()}>
          Paste
        </button>
        <button type="button" className="builderButton" onClick={() => fileRef.current?.click()}>
          Open file…
        </button>
        {/* No accept filter: macOS sometimes greys out .json files the first
            time the picker opens; the check turns away anything that isn't one. */}
        <input ref={fileRef} type="file" hidden onChange={(event) => void openFile(event)} />
      </div>
      <textarea
        className="builderBrief__text builderJson__text"
        value={text}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        aria-label="The setup, as JSON"
        aria-describedby="builder-json-check"
        aria-invalid={!check.ok}
        onChange={(event) => {
          setText(event.target.value);
          setNote(null);
        }}
      />
      <p id="builder-json-check" className={`builderJson__check${check.ok ? "" : " is-error"}`} role="status">
        {check.ok
          ? `${changed ? "Ready" : "Current"}: ${check.summary}.${check.skipped ? ` ${check.skipped} skipped.` : ""}`
          : check.error}
      </p>
      {note ? <p className="builderJson__note">{note}</p> : null}
      {changed ? (
        <button type="button" className="builderJson__revert" onClick={() => setText(opened)}>
          Revert
        </button>
      ) : null}
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
  onShowJson,
  onImport,
  onExportPng,
  onResetExample,
  onClear,
}: Pick<BuilderHudProps, "onSave" | "onImport" | "onExportPng" | "onResetExample" | "onClear"> & {
  onShowJson: () => void;
}) {
  const importRef = useRef<HTMLInputElement>(null);
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > SCENE_TEXT_MAX_BYTES) {
      onImport(null, file.name);
      return;
    }
    onImport(await file.text(), file.name);
  };
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
        data-guide="file"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="builderMenu__title">Tabletop</span>
        <BetaMark tool={findTool("/builder/tabletop")} />
        <Icon name="chevron" size={14} />
      </button>
      {open ? (
        <div className="builderMenu__list" role="menu">
          <button type="button" role="menuitem" onClick={run(onSave)}>
            Save as JSON
          </button>
          <button type="button" role="menuitem" onClick={run(onShowJson)}>
            Open JSON…
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              importRef.current?.click();
            }}
          >
            Import into this table…
          </button>
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
      {/* kept out of the list, which unmounts as the picker opens; no accept
          filter, as in the JSON panel: the check turns away anything else */}
      <input ref={importRef} type="file" hidden onChange={(event) => void importFile(event)} />
    </div>
  );
}

/**
 * Close a toolbar bubble on a pointer-down outside it, or on Esc. A part of it
 * drawn elsewhere (in a portal) counts as inside when its element is in `also`.
 */
function useBubbleDismiss<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  close: () => void,
  also?: RefObject<HTMLElement | null>,
) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !also?.current?.contains(target)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close, also]);
  return ref;
}

/** The lightbulb: a bubble of lighting settings under the tool pill. */
function LightingMenu({ lighting, onChange }: { lighting: Lighting; onChange: (patch: Partial<Lighting>) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useBubbleDismiss(open, useCallback(() => setOpen(false), []));

  return (
    <div className="builderLighting" ref={ref}>
      <button
        type="button"
        className={`builderIconBtn${open ? " is-active" : ""}`}
        aria-label="Lighting"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Lighting"
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name="light" />
      </button>
      {open ? (
        <div className="builderLighting__bubble" role="dialog" aria-label="Lighting">
          <label className="builderField">
            <span className="builderField__label">
              Brightness
              <span className="builderReadout">{Math.round(lighting.brightness * 100)}%</span>
            </span>
            <input
              className="builderSlider"
              type="range"
              min={BRIGHTNESS_RANGE[0]}
              max={BRIGHTNESS_RANGE[1]}
              step={0.05}
              value={lighting.brightness}
              onChange={(event) => onChange({ brightness: Number(event.target.value) })}
            />
          </label>
          <label className="builderLighting__toggle">
            Shadows
            <input
              type="checkbox"
              role="switch"
              checked={lighting.shadows}
              onChange={(event) => onChange({ shadows: event.target.checked })}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Label size: a bubble with the labels' size, saved with the setup. A drag
 * previews as it moves and is one undo step: its first change takes the snapshot.
 */
function LabelMenu({
  scale,
  onBegin,
  onChange,
}: {
  scale: number;
  onBegin: () => void;
  onChange: (scale: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useBubbleDismiss(open, useCallback(() => setOpen(false), []));
  const editing = useRef(false);
  const end = () => {
    editing.current = false;
  };

  return (
    <div className="builderLighting" ref={ref}>
      <button
        type="button"
        className={`builderIconBtn${open ? " is-active" : ""}`}
        aria-label="Label size"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Label size"
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name="labelSize" />
      </button>
      {open ? (
        <div className="builderLighting__bubble" role="dialog" aria-label="Label size">
          <label className="builderField">
            <span className="builderField__label">
              Label size
              <span className="builderReadout">{Math.round(scale * 100)}%</span>
            </span>
            <input
              className="builderSlider"
              type="range"
              min={LABEL_SCALE_RANGE[0]}
              max={LABEL_SCALE_RANGE[1]}
              step={0.05}
              value={scale}
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
    drawingFrame,
    connectDraft,
    view,
  } = props;
  const mode = modeHints(props);
  const selecting = !beamMode && !drawingFrame && !connectDraft && !placingType && !trayOpen;
  // the brief and the JSON panel share the parts panel's spot, so opening one closes the others
  const [briefOpen, setBriefOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeCoach = useCallback(() => setCoachOpen(false), []);
  const showSheet = useCallback(() => setSheetOpen(true), []);
  const closeBrief = useCallback(() => setBriefOpen(false), []);
  const closeJson = useCallback(() => setJsonOpen(false), []);
  const { onCloseTray } = props;
  // the brief and the JSON panel take the parts panel's place and size, so the boxes step aside for them
  const besideParts = trayOpen || briefOpen || jsonOpen;
  // PROTOTYPE (#224): what a minimised Inspector's title shows
  const inspectorSubtitle =
    selected.length > 1
      ? `${selected.length} parts`
      : selected[0]
        ? componentDisplayName(selected[0])
        : selectedBeam
          ? beamDisplayName(selectedBeam)
          : props.selectedFrame
            ? frameDisplayName(props.selectedFrame)
            : props.selectedConnection
              ? (props.selectedConnection.label?.trim() || "Connection")
              : undefined;
  const toggleBrief = useCallback(() => {
    onCloseTray();
    setJsonOpen(false);
    setBriefOpen((open) => !open);
  }, [onCloseTray]);
  const showJson = useCallback(() => {
    onCloseTray();
    setBriefOpen(false);
    setJsonOpen(true);
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
  } else if (connectDraft) {
    inspector = (
      <ConnectionDraftInspector
        kind={connectDraft.kind}
        from={connectDraft.from}
        components={components}
        onKindChange={props.onConnectKindChange}
        onCancel={props.onCancelConnect}
      />
    );
  } else if (selected.length > 1) {
    inspector = (
      <GroupInspector
        selected={selected}
        onRotate={props.onRotateSelected}
        onDuplicate={props.onDuplicateSelected}
        onDelete={props.onDeleteSelected}
        onSetHeight={props.onSetSelectedHeight}
        onSetMountColor={props.onSetSelectedMountColor}
      />
    );
  } else if (selected.length === 1) {
    inspector = (
      <ComponentInspector
        component={selected[0]}
        components={components}
        angleBeam={derivedAngleBeam(beams, selected[0])}
        partnerAngleBeam={partnerAngleBeam(components, beams, selected[0])}
        onUpdate={props.onUpdateSelected}
        onUpdateOther={props.onUpdateComponent}
        onCheckpoint={props.onCheckpoint}
        onRotate={props.onRotateSelected}
        onDuplicate={props.onDuplicateSelected}
        onDelete={props.onDeleteSelected}
        groupsField={
          <GroupsField
            groups={props.groups}
            memberId={selected[0].id}
            onChange={(groupId, isMember) => props.onSetGroupMembership(groupId, selected[0].id, isMember)}
          />
        }
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
  } else if (props.selectedFrame) {
    const frame = props.selectedFrame;
    inspector = (
      <FrameInspector
        frame={frame}
        onUpdate={(patch, record) => props.onUpdateFrame(frame.id, patch, record)}
        onCheckpoint={props.onCheckpoint}
        onDelete={() => props.onDeleteFrame(frame.id)}
        focusLabel={props.focusFrameLabel}
        onLabelFocused={props.onFrameLabelFocused}
        groupsField={
          <GroupsField
            groups={props.groups}
            memberId={frame.id}
            onChange={(groupId, isMember) => props.onSetGroupMembership(groupId, frame.id, isMember)}
          />
        }
      />
    );
  } else if (props.selectedConnection) {
    const connection = props.selectedConnection;
    inspector = (
      <ConnectionInspector
        connection={connection}
        components={components}
        onUpdate={(patch) => props.onUpdateConnection(connection.id, patch)}
        onDelete={() => props.onDeleteConnection(connection.id)}
      />
    );
  }
  // Remount (and replay the entrance) when the inspected thing changes.
  // A group keeps one inspector as parts join or leave it.
  const inspectorKey = beamMode
    ? "beam-draft"
    : connectDraft
      ? "connect-draft"
      : selected.length > 1
        ? "group"
        : (selected[0]?.id ?? selectedBeam?.id ?? props.selectedFrame?.id ?? props.selectedConnection?.id);
  // the inspector's close button cancels a draft, or else deselects
  const cancelDraft = beamMode
    ? { label: "Cancel beam", run: props.onCancelBeam }
    : connectDraft
      ? { label: "Cancel connection", run: props.onCancelConnect }
      : null;

  return (
    <>
      <div className="builderIsland builderHud__file">
        <Link href="/" className="builderBack" aria-label="Back to the QUOP site">
          <Icon name="back" size={16} />
          QUOP
        </Link>
        <span className="builderIsland__sep" />
        <FileMenu
          onSave={props.onSave}
          onShowJson={showJson}
          onImport={props.onImport}
          onExportPng={props.onExportPng}
          onResetExample={props.onResetExample}
          onClear={props.onClear}
        />
      </div>

      {briefOpen && !trayOpen ? (
        <ProtoPanel id="brief" title="Brief" onClose={closeBrief}>
          <BriefPanel onCopy={props.onCopyBrief} onDownload={props.onDownloadBrief} onClose={closeBrief} />
        </ProtoPanel>
      ) : null}
      {jsonOpen && !trayOpen ? (
        <ProtoPanel id="json" title="JSON" onClose={closeJson}>
          <JsonPanel initial={props.sceneJson} onApply={props.onApplyScene} onClose={closeJson} />
        </ProtoPanel>
      ) : null}

      <div className="builderIsland builderHud__add">
        <IconButton
          icon="add"
          label="Add part"
          guide="add"
          active={trayOpen}
          onClick={() => {
            setBriefOpen(false);
            setJsonOpen(false);
            props.onToggleTray();
          }}
        />
        <IconButton
          icon="beam"
          label="Beam"
          guide="beam"
          active={beamMode}
          onClick={beamMode ? props.onCancelBeam : props.onStartBeam}
          disabled={components.length < 2}
        />
        <IconButton
          icon="frame"
          label="Frame"
          guide="frame"
          active={drawingFrame}
          onClick={drawingFrame ? props.onCancelFrame : props.onStartFrame}
        />
        <IconButton
          icon="connect"
          label="Fibre or cable"
          guide="connect"
          active={Boolean(connectDraft)}
          onClick={connectDraft ? props.onCancelConnect : props.onStartConnect}
          disabled={components.length < 2}
        />
      </div>

      <div className="builderHud__center">
        <div className="builderHud__toolRow">
          <button
            type="button"
            className="builderGuideButton"
            aria-haspopup="dialog"
            aria-expanded={coachOpen}
            title="Guide"
            // one size of the guide at a time: the coach marks would tag through the sheet
            onClick={() => {
              setSheetOpen(false);
              setCoachOpen(true);
            }}
          >
            <Icon name="info" size={16} />
            Guide
          </button>
          <div className="builderHud__tools" data-guide="tools">
            <div className="builderIsland" role="toolbar" aria-label="Tools">
              <IconButton icon="select" label="Select and move" active={selecting} onClick={props.onSelectTool} />
              <IconButton icon="posts" label="Posts" active={props.showPosts} onClick={props.onTogglePosts} />
              <IconButton icon="grid" label="Grid" active={props.showGrid} onClick={props.onToggleGrid} />
              <LightingMenu lighting={props.lighting} onChange={props.onLightingChange} />
              <LabelMenu scale={props.labelScale} onBegin={props.onCheckpoint} onChange={props.onLabelScaleChange} />
              <span className="builderIsland__sep" />
              <IconButton icon="undo" label="Undo (⌘Z)" onClick={props.onUndo} disabled={!props.canUndo} />
              <IconButton icon="redo" label="Redo (⇧⌘Z)" onClick={props.onRedo} disabled={!props.canRedo} />
            </div>
            <button
              type="button"
              className="builderSheetTab"
              aria-expanded={sheetOpen}
              aria-controls="builder-cheat-sheet"
              onClick={() => setSheetOpen((open) => !open)}
            >
              Cheat sheet
              <Icon name="chevron" size={12} />
            </button>
          </div>
          {/* the brief is neither a tool nor a guide: its own island, across the tools from the Guide pill */}
          <div className="builderIsland builderHud__brief">
            <button
              type="button"
              className={`builderIconBtn builderBriefButton${briefOpen ? " is-active" : ""}`}
              aria-label="AI brief"
              aria-pressed={briefOpen}
              title="AI brief"
              data-guide="brief"
              onClick={toggleBrief}
            >
              .md
            </button>
          </div>
        </div>

        {sheetOpen ? <CheatSheet id="builder-cheat-sheet" onClose={() => setSheetOpen(false)} /> : null}

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
      <p className="builderControlsHint" aria-label="Mouse controls">
        <span>
          <kbd>⇧</kbd> drag orbit · drag pan · scroll zoom
        </span>
      </p>

      {trayOpen ? (
        <ProtoPanel id="parts" title="Parts">
          <PartsPanel
            placingType={placingType}
            onPick={props.onPickType}
            onClose={props.onCloseTray}
          />
        </ProtoPanel>
      ) : null}

      {inspector ? (
        <ProtoPanel id="inspector" title="Inspector" subtitle={inspectorSubtitle}>
        <aside
          className="builderIsland builderHud__inspector"
          key={inspectorKey}
          aria-label="Inspector"
          data-guide="inspector"
        >
          {inspector}
          <button
            type="button"
            className="builderHud__close"
            aria-label={cancelDraft ? cancelDraft.label : "Deselect (Esc)"}
            title={cancelDraft ? `${cancelDraft.label} (Esc)` : "Deselect (Esc)"}
            onClick={cancelDraft ? cancelDraft.run : props.onDeselect}
          >
            <Icon name="close" size={16} />
          </button>
        </aside>
        </ProtoPanel>
      ) : null}

      {beams.length || props.frames.length || props.groups.length ? (
        <div className={`builderHud__lists${besideParts ? " is-besideParts" : ""}`}>
      {beams.length ? (
        <ProtoPanel id="beams" title="Beams">
        <BeamList
          components={components}
          beams={beams}
          selectedId={selectedBeam?.id ?? null}
          besideParts={besideParts}
          onSelect={props.onSelectBeam}
          onMove={props.onMoveBeam}
          onSetHidden={props.onSetBeamHidden}
          onDelete={props.onDeleteBeam}
        />
        </ProtoPanel>
      ) : null}
      {props.frames.length ? (
        <ProtoPanel id="frames" title="Frames">
        <FrameList
          frames={props.frames}
          selectedId={props.selectedFrame?.id ?? null}
          onSelect={props.onSelectFrame}
          onMove={props.onMoveFrame}
          onSetHidden={props.onSetFrameHidden}
          onDelete={props.onDeleteFrame}
        />
        </ProtoPanel>
      ) : null}
      {props.groups.length ? (
        <ProtoPanel id="groups" title="Groups">
        <GroupList
          groups={props.groups}
          renamingId={props.renamingGroupId}
          onSelect={props.onSelectGroup}
          onHover={props.onHoverGroup}
          onRename={props.onRenameGroup}
          onRenameStart={props.onRenameGroupStart}
          onSetColor={props.onSetGroupColor}
          onCheckpoint={props.onCheckpoint}
          onSetHidden={props.onSetGroupHidden}
          onExport={props.onExportGroup}
          onDelete={props.onDeleteGroup}
        />
        </ProtoPanel>
      ) : null}
        </div>
      ) : null}

      <PanelsPrototypeBar />

      {props.importChoice ? (
        <ImportChoiceDialog names={props.importChoice.names} onChoose={props.onImportChoice} />
      ) : null}

      <div className="builderIsland builderHud__view" role="toolbar" aria-label="View" data-guide="view">
        <span className="builderSegment">
          <IconButton icon="iso" label="Isometric view" active={view === "iso"} onClick={() => props.onViewChange("iso")} />
          <IconButton icon="top" label="Top view" active={view === "top"} onClick={() => props.onViewChange("top")} />
        </span>
        <IconButton icon="fit" label="Fit" onClick={props.onFit} />
        <span className="builderIsland__sep" />
        <IconButton icon="labels" label="Labels" active={props.showLabels} onClick={props.onToggleLabels} />
        <IconButton
          icon="ruler"
          label="Beam distances"
          active={props.showDistances}
          onClick={props.onToggleDistances}
        />
        <IconButton icon="theme" label="Day / night" onClick={props.onToggleTheme} />
        <IconButton
          icon="bolt"
          label="Light graphics (faster)"
          active={props.quality === "light"}
          onClick={props.onToggleQuality}
        />
      </div>
      {coachOpen ? <CoachMarks onClose={closeCoach} onShowCheatSheet={showSheet} /> : null}

      <p className="builderStatus" role="status" aria-live="polite">
        {props.status}
      </p>
    </>
  );
}

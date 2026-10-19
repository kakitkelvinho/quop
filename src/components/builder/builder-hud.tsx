"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

import type { CameraView } from "@/components/builder/builder-canvas";
import { Icon, IconButton } from "@/components/builder/builder-icons";
import { CheatSheet, CoachMarks } from "@/components/builder/builder-guide";
import PartsPanel from "@/components/builder/builder-parts-panel";
import { SCENE_TEXT_MAX_BYTES, checkSceneText } from "@/components/builder/scene-text";
import { selectedGroup } from "@/components/builder/groups";
import { setupBrief } from "@/components/builder/setup-brief";
import { useRowDrag } from "@/components/builder/use-row-drag";
import { PanelBar, PanelResize } from "@/components/builder/panel-frame";
import { PANEL_LAYER_CLASS, usePanel, usePanelsMove, useRememberedPanels } from "@/components/builder/use-panel-drag";
import { keepPanelsInside } from "@/components/builder/panel-store";
import { MinimisedColumn, PanelsMenu, useInspectorReopens } from "@/components/builder/minimised-column";
import { minimisedIn, partsSpotShowing, restorePanel, selectionKey, tabletopPanels } from "@/components/builder/minimised-panels";
import { RING, ShowWheel, type WheelItem } from "@/components/builder/show-wheel";
import { FileFan } from "@/components/builder/file-fan";
import { HudStylePrototype, PanelRail, ProtoFan, useHudVariant } from "@/components/builder/hud-style.prototype";
import { JsonPanelFiles } from "@/components/builder/json-panel-files";
import { ShowWheelDial } from "@/components/builder/show-wheel-dial";
import {
  BeamDraftInspector,
  BeamInspector,
  ComponentInspector,
  ConnectionDraftInspector,
  ConnectionInspector,
  FrameInspector,
  GroupInspector,
  GroupsMenu,
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
  serializeScene,
} from "@/components/builder/types";
import { editJson, jsonPanelView, type JsonDraft } from "@/components/builder/json-panel-text";

/** The beam that turns a periscope's top mirror, when the lower one is the part shown. */
function partnerAngleBeam(components: BuilderComponent[], beams: Beam[], component: BuilderComponent): Beam | undefined {
  const partner = component.type === "periscope" ? periscopePartner(components, component) : undefined;
  return partner && derivedAngleBeam(beams, partner);
}

/** Connect mode: the kind being drawn, and the part clicked first once there is one. */
export type ConnectDraft = { kind: ConnectionKind; from: string | null };

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
  /** goes up on each plain click on empty table */
  emptyClicks: number;
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
  /** ⌘G: the selection as a new group */
  onGroupSelected: () => void;
  /** download a group as its own setup file, `<name>.json` */
  onExportGroup: (id: string) => void;
  /** a setup file's text to merge into the table; null when the file was too big to read */
  onImport: (text: string | null, fileName: string) => void;
  /** set while an import waits on what to do with a group the table already has */
  importChoice: { names: string[] } | null;
  onImportChoice: (choice: "replace" | "copy" | null) => void;
  /** several ids join or leave as one undo step */
  onSetGroupMembership: (groupId: string, ids: string[], isMember: boolean) => void;
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
  /** every panel back where it starts (⌥0) */
  onResetPanels: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  /** the setup as it stands, for the JSON panel to follow */
  scene: BuilderSceneData;
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
  const panel = usePanel("beams", { fitWidth: true });

  const list = (
    <ol
      ref={listRef}
      role="list"
      aria-label={panel.moves ? undefined : "Beams"}
      data-guide={panel.moves ? undefined : "beams"}
      className={`${panel.moves ? "" : "builderIsland "}builderHud__beams${besideParts ? " is-besideParts" : ""} ${listClass}`}
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
  // a list holds only rows, so with a title bar the island is a section around it
  if (!panel.moves) return list;
  return (
    <section
      {...panel.frame}
      className={`builderIsland builderHud__frames builderHud__beamsPanel${panel.className}`}
      aria-labelledby="builderBeamsTitle"
      data-guide="beams"
    >
      <PanelBar title="Beams" titleId="builderBeamsTitle" {...panel.bar} />
      {list}
      {panel.resize ? <PanelResize {...panel.resize} /> : null}
    </section>
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
  const panel = usePanel("frames", { fitWidth: true });

  return (
    <section
      {...panel.frame}
      className={`builderIsland builderHud__frames${panel.className}`}
      aria-labelledby="builderFramesTitle"
      data-guide="frames"
    >
      {panel.moves ? (
        <PanelBar title="Frames" titleId="builderFramesTitle" {...panel.bar} />
      ) : (
        <h2 id="builderFramesTitle" className="builderHud__listTitle">
          Frames
        </h2>
      )}
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
      {panel.resize ? <PanelResize {...panel.resize} /> : null}
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
  const panel = usePanel("groups", { fitWidth: true });
  return (
    <section
      {...panel.frame}
      className={`builderIsland builderHud__frames${panel.className}`}
      aria-labelledby="builderGroupsTitle"
      data-guide="groups"
    >
      {panel.moves ? (
        <PanelBar title="Groups" titleId="builderGroupsTitle" {...panel.bar} />
      ) : (
        <h2 id="builderGroupsTitle" className="builderHud__listTitle">
          Groups
        </h2>
      )}
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
      {panel.resize ? <PanelResize {...panel.resize} /> : null}
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
  const panel = usePanel("brief", { keepHeight: true, opensRestored: true });

  return (
    <aside
      {...panel.frame}
      className={`builderIsland builderAbout builderBrief${panel.className}`}
      aria-labelledby="builder-brief-title"
    >
      {panel.moves ? (
        <PanelBar title="Setup brief" titleId="builder-brief-title" onClose={onClose} {...panel.bar} />
      ) : (
        <h2 id="builder-brief-title" className="builderAbout__title">
          Setup brief
        </h2>
      )}
      <p className="builderAbout__description">
        For an AI assistant. Open its reply in the Setup JSON panel: Tabletop ▾, then .json.
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
      {panel.moves ? null : (
        <button
          type="button"
          className="builderHud__close"
          aria-label="Close panel"
          title="Close (Esc)"
          onClick={onClose}
        >
          <Icon name="close" size={16} />
        </button>
      )}
      {panel.resize ? <PanelResize {...panel.resize} /> : null}
    </aside>
  );
}

/** How long the table must be still before the JSON panel writes it out again, ms. */
const JSON_SETTLE_MS = 120;

/**
 * The setup as JSON, to read, tweak, copy, paste over or fill from a file,
 * in the parts panel's place. The box follows the table until the author
 * edits it; then it holds their draft (see json-panel-text). Nothing reaches
 * the table until Apply, and Apply only takes text checkSceneText passed:
 * within its size, valid JSON, a setup's shape and counts, colours and labels
 * made safe by parseScene.
 */
function JsonPanel({
  scene,
  emptyClicks,
  onApply,
  onClose,
  onSave,
  onImport,
}: {
  scene: BuilderSceneData;
  emptyClicks: number;
  onApply: (scene: BuilderSceneData, summary: string) => void;
  onClose: () => void;
  onSave: () => void;
  onImport: BuilderHudProps["onImport"];
}) {
  // A drag previews a new scene on every pointer move, so the box writes the
  // table out once it has been still for a moment, not on every frame.
  const [live, setLive] = useState(() => serializeScene(scene));
  useEffect(() => {
    const timer = window.setTimeout(() => setLive(serializeScene(scene)), JSON_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [scene]);
  const [draft, setDraft] = useState<JsonDraft | null>(null);
  const view = jsonPanelView(live, draft);
  const { text, edited } = view;
  const [note, setNote] = useState<string | null>(null);
  // a large paste is checked once typing settles, not on every keystroke
  const settled = useDeferredValue(text);
  const check = useMemo(() => checkSceneText(settled), [settled]);
  const edit = (next: string) => setDraft(editJson(live, draft, next));
  // an open dialog (open a .json, or a group already on the table) takes its own Esc
  useEscapeCloses(
    useCallback(() => {
      if (!document.querySelector('[role="alertdialog"]')) onClose();
    }, [onClose]),
  );
  // a click on empty table closes the panel, unless it holds edits not yet applied
  const seenClicks = useRef(emptyClicks);
  useEffect(() => {
    if (emptyClicks === seenClicks.current) return;
    seenClicks.current = emptyClicks;
    if (!edited) onClose();
  }, [emptyClicks, edited, onClose]);

  const copy = async () => {
    try {
      // the table as it is this moment, even mid-settle, unless there's a draft
      await navigator.clipboard.writeText(draft ? draft.text : serializeScene(scene));
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
        edit(pasted);
        setNote("Pasted.");
      }
    } catch {
      setNote("Paste blocked: use ⌘V.");
    }
  };
  // the folder's Replace: the file fills the box as a draft, for Apply
  const replaceFrom = async (file: File) => {
    if (file.size > SCENE_TEXT_MAX_BYTES) {
      setNote(`${file.name} is over ${SCENE_TEXT_MAX_BYTES / 1_000_000} MB.`);
      return;
    }
    edit(await file.text());
    setNote(`Read ${file.name}.`);
  };
  // the folder's Add: merged into the table as it stands (merge-setup)
  const addFrom = async (file: File) => {
    if (file.size > SCENE_TEXT_MAX_BYTES) {
      onImport(null, file.name);
      return;
    }
    onImport(await file.text(), file.name);
  };
  const panel = usePanel("json", { keepHeight: true, opensRestored: true });

  return (
    <aside
      {...panel.frame}
      className={`builderIsland builderAbout builderBrief builderJson${panel.className}`}
      aria-labelledby="builder-json-title"
    >
      {panel.moves ? (
        <PanelBar title="Setup JSON" titleId="builder-json-title" onClose={onClose} {...panel.bar} />
      ) : (
        <h2 id="builder-json-title" className="builderAbout__title">
          Setup JSON
        </h2>
      )}
      <div className="builderBrief__actions">
        <button
          type="button"
          className="builderButton builderButton--primary"
          disabled={!check.ok || !edited || settled !== text}
          onClick={() => {
            if (!check.ok) return;
            onApply(check.scene, check.summary);
            // follow the table again, from the setup just applied rather than
            // the one it replaced
            setLive(serializeScene(check.scene));
            setDraft(null);
          }}
        >
          Apply
        </button>
        <JsonPanelFiles
          onCopy={() => void copy()}
          onPaste={() => void paste()}
          onSave={onSave}
          onReplace={(file) => void replaceFrom(file)}
          onAdd={(file) => void addFrom(file)}
        />
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
          edit(event.target.value);
          setNote(null);
        }}
      />
      <p id="builder-json-check" className={`builderJson__check${check.ok ? "" : " is-error"}`} role="status">
        {check.ok
          ? `${edited ? "Edited, not on the table yet" : "Live"}: ${check.summary}.${check.skipped ? ` ${check.skipped} skipped.` : ""}`
          : check.error}
      </p>
      {view.behind ? (
        <p className="builderJson__note">The table has changed since you began editing; Revert shows it as it is now.</p>
      ) : null}
      {note ? <p className="builderJson__note">{note}</p> : null}
      {edited ? (
        <button type="button" className="builderJson__revert" onClick={() => setDraft(null)}>
          Revert
        </button>
      ) : null}
      {panel.moves ? null : (
        <button
          type="button"
          className="builderHud__close"
          aria-label="Close panel"
          title="Close (Esc)"
          onClick={onClose}
        >
          <Icon name="close" size={16} />
        </button>
      )}
      {panel.resize ? <PanelResize {...panel.resize} /> : null}
    </aside>
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

/**
 * Show: a half ring that drops out of the eye with one wedge for each thing
 * drawn on the table besides the setup, and for how it is drawn: posts, grid,
 * labels, beam distances, shadows and light graphics. Two rim dials hug the
 * ring. Round its outside, the label size, which is saved with the setup: a
 * drag previews as it moves and is one undo step (its first change takes the
 * snapshot), and it rests while labels are off. Round the eye inside it, the
 * brightness, which is neither saved nor undone.
 */
function ShowMenu({
  posts,
  grid,
  labels,
  distances,
  onTogglePosts,
  onToggleGrid,
  onToggleLabels,
  onToggleDistances,
  scale,
  onBegin,
  onChange,
  lighting,
  onLightingChange,
  lightGraphics,
  onToggleQuality,
  extra = [],
}: {
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
  onChange: (scale: number) => void;
  lighting: Lighting;
  onLightingChange: (patch: Partial<Lighting>) => void;
  lightGraphics: boolean;
  onToggleQuality: () => void;
  extra?: WheelItem[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useBubbleDismiss(open, useCallback(() => setOpen(false), []));
  const buttonRef = useRef<HTMLButtonElement>(null);
  const items: WheelItem[] = [
    {
      id: "posts",
      label: "Posts",
      description: "Posts under the parts",
      icon: "posts",
      on: posts,
      onToggle: onTogglePosts,
    },
    { id: "grid", label: "Grid", description: "The grid on the table", icon: "grid", on: grid, onToggle: onToggleGrid },
    {
      id: "labels",
      label: "Labels",
      description: "Part names on the table",
      icon: "labels",
      iconOff: "labelsOff",
      on: labels,
      onToggle: onToggleLabels,
    },
    {
      id: "distances",
      label: "Beam distances",
      description: "Lengths along each beam",
      icon: "ruler",
      on: distances,
      onToggle: onToggleDistances,
    },
    {
      id: "shadows",
      label: "Shadows",
      description: "Shadows cast by the key light",
      icon: "shadow",
      on: lighting.shadows,
      onToggle: () => onLightingChange({ shadows: !lighting.shadows }),
    },
    {
      id: "light-graphics",
      label: "Light graphics",
      description: "Simpler drawing, for a slow computer",
      icon: "gauge",
      on: lightGraphics,
      onToggle: onToggleQuality,
    },
    ...extra,
  ];

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
      {open ? (
        <ShowWheel
          items={items}
          onClose={() => {
            setOpen(false);
            buttonRef.current?.focus();
          }}
          rims={
            <>
              <ShowWheelDial
                label="Label size"
                icon="labels"
                arc={{ r: RING.outer + 14, from: Math.PI, to: 0 }}
                side={1}
                range={LABEL_SCALE_RANGE}
                value={scale}
                disabled={!labels}
                disabledHint="turn labels on first"
                onBegin={onBegin}
                onChange={onChange}
              />
              <ShowWheelDial
                label="Brightness"
                icon="light"
                arc={{ r: RING.inner - 18, from: Math.PI, to: 0 }}
                side={-1}
                range={BRIGHTNESS_RANGE}
                value={lighting.brightness}
                onChange={(brightness) => onLightingChange({ brightness })}
              />
            </>
          }
        />
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
  const mode0 = modeHints(props);
  // PROTOTYPE (D): the minimal layout, and which lists the rail has put away
  const protoD = useHudVariant() === "D";
  const router = useRouter();
  const [railHidden, setRailHidden] = useState<Record<string, boolean>>({});
  // PROTOTYPE (D): the empty Groups slot starts a mode, as Frames does: pick parts, Enter groups them
  const [groupPicking, setGroupPicking] = useState(false);
  const picked = props.selected.length;
  const { onGroupSelected } = props;
  useEffect(() => {
    if (!groupPicking) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGroupPicking(false);
      if (event.key === "Enter" && picked > 1) {
        event.preventDefault();
        onGroupSelected();
        setGroupPicking(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [groupPicking, picked, onGroupSelected]);
  const groupMode = groupPicking
    ? {
        label: "Group",
        hints: [
          ["⌘ click", "pick"],
          ["⌘ drag", "box"],
          ["Enter", picked > 1 ? `group ${picked}` : "group"],
          ["Esc", "cancel"],
        ] as Hint[],
      }
    : null;
  const mode = groupMode ?? mode0;
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
  const panelsMove = usePanelsMove();
  const inspectorPanel = usePanel("inspector");
  useRememberedPanels();
  // when the workspace shrinks, moved panels slide back in so their bars can be grabbed
  const panelLayerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const layer = panelLayerRef.current;
    if (!panelsMove || !layer) return;
    const observer = new ResizeObserver(() =>
      keepPanelsInside({ width: layer.clientWidth, height: layer.clientHeight }),
    );
    observer.observe(layer);
    return () => observer.disconnect();
  }, [panelsMove]);
  // the brief and the JSON panel take the parts panel's place and size, so the boxes step aside for
  // them, or for the parts panel, while one is showing: a minimised one is hidden and leaves no gap
  const isMinimised = minimisedIn(panelsMove);
  const besideParts = partsSpotShowing({ partsOpen: trayOpen, briefOpen, jsonOpen }, isMinimised);
  const toggleBrief = useCallback(() => {
    onCloseTray();
    setJsonOpen(false);
    setBriefOpen((open) => !open);
  }, [onCloseTray]);
  const showJson = useCallback(() => {
    onCloseTray();
    setBriefOpen(false);
    setJsonOpen(true);
    restorePanel("json");
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
        group={selectedGroup({ components, groups: props.groups }, selected.map((component) => component.id))}
        canGroup={!drawingFrame && !placingType}
        onGroup={props.onGroupSelected}
        onUngroup={props.onDeleteGroup}
        onSetGroupColor={props.onSetGroupColor}
        onCheckpoint={props.onCheckpoint}
        groupsMenu={
          <GroupsMenu
            groups={props.groups}
            memberIds={selected.map((component) => component.id)}
            onChange={(groupId, isMember) =>
              props.onSetGroupMembership(groupId, selected.map((component) => component.id), isMember)
            }
          />
        }
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
          <GroupsMenu
            groups={props.groups}
            memberIds={[selected[0].id]}
            onChange={(groupId, isMember) => props.onSetGroupMembership(groupId, [selected[0].id], isMember)}
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
          <GroupsMenu
            groups={props.groups}
            memberIds={[frame.id]}
            onChange={(groupId, isMember) => props.onSetGroupMembership(groupId, [frame.id], isMember)}
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
  // what a minimised inspector holds, as the minimised column says
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
              ? props.selectedConnection.label?.trim() || CONNECTION_KINDS[props.selectedConnection.kind].label
              : undefined;
  // the inspector's close button cancels a draft, or else deselects
  const cancelDraft = beamMode
    ? { label: "Cancel beam", run: props.onCancelBeam }
    : connectDraft
      ? { label: "Cancel connection", run: props.onCancelConnect }
      : null;
  // a minimised Inspector opens again on a new selection; a minimised panel waits in the column
  useInspectorReopens(
    selectionKey({
      beamDraft: beamMode,
      connectDraft: Boolean(connectDraft),
      parts: selected.map((component) => component.id),
      beam: selectedBeam?.id,
      frame: props.selectedFrame?.id,
      connection: props.selectedConnection?.id,
    }),
    panelsMove,
  );
  const panelList = tabletopPanels({
    inspector: inspector ? { subtitle: inspectorSubtitle } : null,
    beams: beams.length,
    frames: props.frames.length,
    groups: props.groups.length,
    partsOpen: trayOpen,
    briefOpen,
    jsonOpen,
  });
  const columnShows = panelList.some((panel) => panel.mounted && isMinimised(panel.id));

  const aboutPanels = (
    <>
      {briefOpen && !trayOpen ? (
        <BriefPanel onCopy={props.onCopyBrief} onDownload={props.onDownloadBrief} onClose={closeBrief} />
      ) : null}
      {jsonOpen && !trayOpen ? (
        <JsonPanel
          scene={props.scene}
          emptyClicks={props.emptyClicks}
          onApply={props.onApplyScene}
          onClose={closeJson}
          onSave={props.onSave}
          onImport={props.onImport}
        />
      ) : null}
    </>
  );

  const showMenu = (
    <ShowMenu
      posts={props.showPosts}
      grid={props.showGrid}
      labels={props.showLabels}
      distances={props.showDistances}
      onTogglePosts={props.onTogglePosts}
      onToggleGrid={props.onToggleGrid}
      onToggleLabels={props.onToggleLabels}
      onToggleDistances={props.onToggleDistances}
      scale={props.labelScale}
      onBegin={props.onCheckpoint}
      onChange={props.onLabelScaleChange}
      lighting={props.lighting}
      onLightingChange={props.onLightingChange}
      lightGraphics={props.quality === "light"}
      onToggleQuality={props.onToggleQuality}
    />
  );
  const liveMode = trayOpen || beamMode || drawingFrame || Boolean(connectDraft);
  const cancelLive = () => {
    if (beamMode) props.onCancelBeam();
    else if (drawingFrame) props.onCancelFrame();
    else if (connectDraft) props.onCancelConnect();
    else if (trayOpen) props.onCloseTray();
    else return false;
    return true;
  };
  const listShown = (id: string) => !protoD || !railHidden[id];
  const railToggle = (id: string) => () => {
    if (isMinimised(id)) {
      restorePanel(id);
      setRailHidden((hidden) => ({ ...hidden, [id]: false }));
    } else setRailHidden((hidden) => ({ ...hidden, [id]: !hidden[id] }));
  };

  return (
    <>
      <div className="builderIsland builderHud__file">
        {protoD ? null : (
          <>
            <Link href="/" className="builderBack" aria-label="Back to the QUOP site">
              <Icon name="back" size={16} />
              QUOP
            </Link>
            <span className="builderIsland__sep" />
          </>
        )}
        <FileFan
          onShowJson={showJson}
          onExportPng={props.onExportPng}
          onResetExample={props.onResetExample}
          onClear={props.onClear}
          brand={protoD}
          onSite={protoD ? () => router.push("/") : undefined}
        />
      </div>

      {panelsMove ? null : aboutPanels}

      {protoD ? (
        <div className="builderIsland builderHud__add">
          <ProtoFan
            icon="add"
            label="Add"
            corner="tl"
            clearOf=".builderHud__file, .builderHud__add"
            active={liveMode}
            onTrigger={cancelLive}
            items={[
              {
                id: "part",
                label: "Part",
                icon: "add",
                run: () => {
                  setBriefOpen(false);
                  setJsonOpen(false);
                  props.onToggleTray();
                },
              },
              { id: "beam", label: "Beam", icon: "beam", run: props.onStartBeam, disabled: components.length < 2 },
              { id: "frame", label: "Frame", icon: "frame", run: props.onStartFrame },
              { id: "connect", label: "Cable", icon: "connect", run: props.onStartConnect, disabled: components.length < 2 },
            ]}
          />
        </div>
      ) : (
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
      )}
      {protoD ? (
        <div className="builderIsland protoHelp">
          <ProtoFan
            icon="info"
            label="Help"
            corner="tr"
            clearOf=".protoHelp"
            items={[
              {
                id: "guide",
                label: "Guide",
                icon: "info",
                run: () => {
                  setSheetOpen(false);
                  setCoachOpen(true);
                },
              },
              { id: "sheet", label: "Keys", icon: "more", run: () => setSheetOpen((open) => !open) },
              { id: "brief", label: "AI brief", icon: "copy", run: toggleBrief, active: briefOpen },
            ]}
          />
        </div>
      ) : null}

      <div className="builderHud__center">
        {protoD ? (
          <div className="builderIsland protoDock" role="toolbar" aria-label="Tools">
            <IconButton icon="undo" label="Undo (⌘Z)" onClick={props.onUndo} disabled={!props.canUndo} />
            {showMenu}
            <IconButton icon="redo" label="Redo (⇧⌘Z)" onClick={props.onRedo} disabled={!props.canRedo} />
          </div>
        ) : (
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
              {showMenu}
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
        )}

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
      {protoD ? null : (
      <p className="builderControlsHint" aria-label="Mouse controls">
        <span>
          <kbd>⇧</kbd> drag orbit · drag pan · scroll zoom
        </span>
      </p>
      )}

      {/* Every panel, in one layer under the toolbars. Where panels stay put
          the layer is no box at all, and the brief and JSON panels keep their
          old place in the page, so the stacking is today's. */}
      <div ref={panelLayerRef} className={`${PANEL_LAYER_CLASS}${panelsMove ? " is-on" : ""}`}>
      {panelsMove ? aboutPanels : null}
      {trayOpen ? (
        <PartsPanel
          placingType={placingType}
          onPick={props.onPickType}
          onClose={props.onCloseTray}
        />
      ) : null}

      {inspector ? (
        <aside
          {...inspectorPanel.frame}
          className={`builderIsland builderHud__inspector${inspectorPanel.className}`}
          key={inspectorKey}
          aria-label="Inspector"
          data-guide="inspector"
        >
          {panelsMove ? <PanelBar title="Inspector" subtitle={inspectorSubtitle} {...inspectorPanel.bar} /> : null}
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
          {inspectorPanel.resize ? <PanelResize {...inspectorPanel.resize} /> : null}
        </aside>
      ) : null}

      {beams.length || props.frames.length || props.groups.length ? (
        <div className={`builderHud__lists${besideParts ? " is-besideParts" : ""}${columnShows ? " is-besideColumn" : ""}`}>
      {beams.length && listShown("beams") ? (
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
      ) : null}
      {props.frames.length && listShown("frames") ? (
        <FrameList
          frames={props.frames}
          selectedId={props.selectedFrame?.id ?? null}
          onSelect={props.onSelectFrame}
          onMove={props.onMoveFrame}
          onSetHidden={props.onSetFrameHidden}
          onDelete={props.onDeleteFrame}
        />
      ) : null}
      {props.groups.length && listShown("groups") ? (
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
      ) : null}
        </div>
      ) : null}
      </div>

      {props.importChoice ? (
        <ImportChoiceDialog names={props.importChoice.names} onChoose={props.onImportChoice} />
      ) : null}

      {protoD ? (
        <>
          <div className="protoViewRow">
          <div className="builderIsland builderHud__view" role="toolbar" aria-label="View" data-guide="view">
            <ProtoFan
              icon={view === "top" ? "top" : "iso"}
              label="Camera"
              corner="br"
              clearOf=".protoViewRow"
              items={[
                { id: "fit", label: "Fit", icon: "fit", run: props.onFit },
                { id: "top", label: "Top", icon: "top", run: () => props.onViewChange("top"), active: view === "top" },
                { id: "iso", label: "Iso", icon: "iso", run: () => props.onViewChange("iso"), active: view === "iso" },
              ]}
            />
          </div>
          <button
            type="button"
            className="builderIconBtn protoTheme"
            aria-label="Day / night"
            title="Day / night"
            onClick={props.onToggleTheme}
          >
            <Icon name="theme" />
          </button>
          </div>
          <PanelRail
            slots={[
              {
                id: "beams",
                label: "Beams",
                icon: "beams",
                count: beams.length,
                shown: listShown("beams") && !isMinimised("beams"),
                onToggle: railToggle("beams"),
                create: {
                  label: beamMode ? "Stop drawing the beam" : "Draw a beam",
                  run: props.onStartBeam,
                  cancel: props.onCancelBeam,
                  can: components.length >= 2,
                  live: beamMode,
                },
              },
              {
                id: "frames",
                label: "Frames",
                icon: "frame",
                count: props.frames.length,
                shown: listShown("frames") && !isMinimised("frames"),
                onToggle: railToggle("frames"),
                create: {
                  label: drawingFrame ? "Stop drawing the frame" : "Draw a frame",
                  run: props.onStartFrame,
                  cancel: props.onCancelFrame,
                  can: true,
                  live: drawingFrame,
                },
              },
              {
                id: "groups",
                label: "Groups",
                icon: "groups",
                count: props.groups.length,
                shown: listShown("groups") && !isMinimised("groups"),
                onToggle: railToggle("groups"),
                create: {
                  label: groupPicking
                    ? picked > 1
                      ? `Group the ${picked} picked parts`
                      : "Stop grouping"
                    : "Group parts",
                  run: () => setGroupPicking(true),
                  cancel: () => {
                    if (picked > 1) props.onGroupSelected();
                    setGroupPicking(false);
                  },
                  can: components.length > 1,
                  live: groupPicking,
                },
              },
            ]}
          />
        </>
      ) : (
        <>
      <div className="builderIsland builderHud__view" role="toolbar" aria-label="View" data-guide="view">
        <span className="builderSegment">
          <IconButton icon="iso" label="Isometric view" active={view === "iso"} onClick={() => props.onViewChange("iso")} />
          <IconButton icon="top" label="Top view" active={view === "top"} onClick={() => props.onViewChange("top")} />
        </span>
        <IconButton icon="fit" label="Fit" onClick={props.onFit} />
        <span className="builderIsland__sep" />
        <IconButton icon="theme" label="Day / night" onClick={props.onToggleTheme} />
        {panelsMove ? <PanelsMenu panels={panelList} onReset={props.onResetPanels} /> : null}
      </div>
      {panelsMove ? <MinimisedColumn panels={panelList} besideParts={besideParts} /> : null}
        </>
      )}
      {coachOpen ? <CoachMarks onClose={closeCoach} onShowCheatSheet={showSheet} /> : null}

      <p className="builderStatus" role="status" aria-live="polite">
        {props.status}
      </p>
      <HudStylePrototype />
    </>
  );
}

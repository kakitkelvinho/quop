"use client";

import { Icon, type IconName } from "@/components/builder/builder-icons";
import { railSlotAction, railSlotLabel, railSlotLook, type RailSlotState } from "@/components/builder/rail-slots";

export type RailSlot = RailSlotState & {
  id: string;
  title: string;
  icon: IconName;
  /** show or hide its list (a minimised one comes back) */
  onToggle: () => void;
  /** what an empty slot starts, and what it does pressed again while that is live */
  create: { start: string; stop: string; run: () => void; cancel: () => void };
};

/**
 * The panel rail, bottom left: Beams, Frames and Groups, always there, each
 * with its count in the corner. The lists stack up from it like windows over
 * a taskbar (rail-slots.ts has what a press does).
 */
export function PanelRail({ slots }: { slots: RailSlot[] }) {
  return (
    <div className="builderIsland builderRail" role="toolbar" aria-label="Lists" data-guide="rail">
      {slots.map((slot) => {
        const look = railSlotLook(slot);
        const name = railSlotLabel(slot.title, slot, slot.create);
        const action = railSlotAction(slot);
        return (
          <button
            key={slot.id}
            type="button"
            className={`builderIconBtn builderRail__slot${look.empty ? " is-empty" : ""}${look.active ? " is-active" : ""}${look.shown ? " is-shown" : ""}`}
            aria-label={name}
            aria-pressed={look.empty ? undefined : slot.shown}
            title={name}
            disabled={look.disabled}
            data-slot={slot.id}
            onClick={() => {
              if (action === "toggle") slot.onToggle();
              else if (action === "create") slot.create.run();
              else if (action === "stop") slot.create.cancel();
            }}
          >
            <Icon name={slot.icon} />
            <span className="builderRail__count" aria-hidden="true">
              {look.badge}
            </span>
          </button>
        );
      })}
    </div>
  );
}

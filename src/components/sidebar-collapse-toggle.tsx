import { SignIcon } from "@/components/sign-icon";

type SidebarCollapseToggleProps = {
  collapsed: boolean;
  onToggle: () => void;
  label?: string;
};

export default function SidebarCollapseToggle({
  collapsed,
  onToggle,
  label = "panel",
}: SidebarCollapseToggleProps) {
  return (
    <button
      aria-expanded={!collapsed}
      aria-label={collapsed ? `Show ${label}` : `Hide ${label}`}
      className={`sidebarCollapseToggle ${collapsed ? "is-collapsed" : ""}`}
      onClick={onToggle}
      title={collapsed ? `Show ${label}` : `Hide ${label}`}
      type="button"
    >
      <SignIcon>
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M15 5 8 12l7 7" />
        </svg>
      </SignIcon>
    </button>
  );
}

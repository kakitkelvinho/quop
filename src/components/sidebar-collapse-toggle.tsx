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
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path
          d="M14 6 8 12l6 6"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    </button>
  );
}

/**
 * A panel's name as a station sign: a blue plate heading the panel. Given
 * `onToggle`, the plate's orange arrow, in its lower right corner where every
 * sign keeps it, folds the panel away and back. Folded, the plate is all
 * that is left of the panel, a strip with the arrow pointing back out.
 */
export function PanelSign({
  title,
  collapsed = false,
  onToggle,
}: {
  title: string;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const action = `${collapsed ? "Show" : "Hide"} the ${title.toLowerCase()} panel`;

  return (
    <div className={`panelSign${collapsed ? " is-collapsed" : ""}`}>
      <h2 className="panelSign__title">{title}</h2>
      {onToggle ? (
        <button
          aria-expanded={!collapsed}
          aria-label={action}
          className="panelSign__toggle"
          onClick={onToggle}
          title={action}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M20 12H4M11 5l-7 7 7 7" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

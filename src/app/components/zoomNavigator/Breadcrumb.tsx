// Generic breadcrumb used across Zoom Navigator levels (§7 of
// `dev-plan/interaction-design-framework/03-zoom-navigation.md`). The
// component is intentionally stateless so each call site can inject its
// own click handlers -- e.g. NavigationMap header injects `goToMap`,
// StateBoardShell injects `replaceVariant` on the variant segment.

import type { ReactNode } from "react";

export interface BreadcrumbItem {
  key: string;
  label: string;
  onClick?: () => void;
  title?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  /** Separator rendered between adjacent items. Defaults to a forward slash. */
  separator?: ReactNode;
  className?: string;
}

const BASE_TEXT =
  "font-mono text-sm text-neutral-300 hover:text-neutral-100 transition-colors";
const INACTIVE_TEXT = "font-mono text-sm text-neutral-500";
const BUTTON_EXTRAS =
  "cursor-pointer bg-transparent border-none p-0 m-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 rounded-sm";
const SEPARATOR_CLASS = "mx-2 select-none text-neutral-600";

/**
 * Breadcrumb renderer. Items carrying an `onClick` become real buttons so
 * keyboard + screen-reader users get activation semantics for free; other
 * items render as plain spans.
 */
export function Breadcrumb(props: BreadcrumbProps): JSX.Element {
  const { items, separator = "/", className } = props;
  const rootClass = [
    "sc-breadcrumb flex items-center",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <nav aria-label="Breadcrumb" className={rootClass}>
      <ol className="flex items-center">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.key} className="flex items-center">
              {renderItem(item, isLast)}
              {!isLast ? (
                <span aria-hidden="true" className={SEPARATOR_CLASS}>
                  {separator}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function renderItem(item: BreadcrumbItem, isLast: boolean): ReactNode {
  const { label, onClick, title } = item;
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        className={`${BASE_TEXT} ${BUTTON_EXTRAS}`}
        aria-current={isLast ? "page" : undefined}
      >
        {label}
      </button>
    );
  }
  return (
    <span
      title={title}
      className={isLast ? INACTIVE_TEXT : BASE_TEXT}
      aria-current={isLast ? "page" : undefined}
    >
      {label}
    </span>
  );
}

import { X } from "lucide-react";
import { Breadcrumb, type BreadcrumbItem } from "../zoomNavigator/Breadcrumb";

export interface StateBoardHeaderProps {
  items: BreadcrumbItem[];
  onClose(): void;
}

export function StateBoardHeader({
  items,
  onClose,
}: StateBoardHeaderProps): JSX.Element {
  return (
    <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900 px-3 py-2">
      <Breadcrumb items={items} />
      <button
        type="button"
        onClick={onClose}
        className="rounded p-1.5 text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100"
        title="Back to Navigation Map"
        aria-label="Back to Navigation Map"
      >
        <X size={16} />
      </button>
    </header>
  );
}

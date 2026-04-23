import { useMemo, useRef, useState } from "react";
import { Star } from "lucide-react";
import type { ProjectSnapshotV2 } from "../../backend/types/projectV2";
import type { StateBoard } from "../../backend/types/stateBoard";
import type { Variant } from "../../backend/types/variant";
import type { VariantAction } from "../../backend/reducer/variantActions";

interface StateBoardSurfaceProps {
  project: ProjectSnapshotV2;
  board: StateBoard;
  activeVariantId: string;
  onSelectVariant(variantId: string): void;
  onVariantAction(action: VariantAction): void;
}

export function StateBoardSurface({
  project,
  board,
  activeVariantId,
  onSelectVariant,
  onVariantAction,
}: StateBoardSurfaceProps): JSX.Element {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ variantId: string; dx: number; dy: number } | null>(null);
  const variants = useMemo(
    () => board.variantIds.map((id) => project.variantsById[id]).filter((item): item is Variant => Boolean(item)),
    [board.variantIds, project.variantsById],
  );

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag || !surfaceRef.current) return;
    const rect = surfaceRef.current.getBoundingClientRect();
    onVariantAction({
      type: "moveVariantScreen",
      variantId: drag.variantId,
      position: {
        x: Math.round(event.clientX - rect.left - drag.dx),
        y: Math.round(event.clientY - rect.top - drag.dy),
      },
    });
  };

  return (
    <div
      ref={surfaceRef}
      className="relative h-full w-full overflow-auto bg-neutral-900"
      onPointerMove={onPointerMove}
      onPointerUp={() => setDrag(null)}
      onPointerCancel={() => setDrag(null)}
    >
      <div className="relative min-h-[1200px] min-w-[1600px] bg-[linear-gradient(var(--color-neutral-800)_1px,transparent_1px),linear-gradient(90deg,var(--color-neutral-800)_1px,transparent_1px)] bg-[size:48px_48px]">
        {variants.map((variant) => {
          const root = project.widgetsById[variant.rootWidgetId];
          if (!root) return null;
          const isCanonical = board.canonicalVariantId === variant.id;
          const isActive = activeVariantId === variant.id;
          return (
            <section
              key={variant.id}
              className={`absolute rounded border bg-neutral-950 shadow-xl ${
                isActive ? "border-highlight-500 ring-2 ring-highlight-500/40" : "border-neutral-700"
              }`}
              style={{ left: root.x, top: root.y, width: root.width, height: root.height }}
              onPointerDown={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                event.currentTarget.setPointerCapture(event.pointerId);
                onSelectVariant(variant.id);
                setDrag({ variantId: variant.id, dx: event.clientX - rect.left, dy: event.clientY - rect.top });
              }}
            >
              <div className="absolute -top-7 left-0 flex items-center gap-2 text-xs text-neutral-200">
                <span className="font-semibold">{variant.name}</span>
                {isCanonical ? (
                  <span className="inline-flex items-center gap-1 rounded bg-highlight-500/20 px-2 py-0.5 text-[11px] text-highlight-200">
                    <Star size={11} /> Canonical
                  </span>
                ) : null}
              </div>
              <div className="pointer-events-none flex h-full items-center justify-center text-xs text-neutral-500">
                {root.width} × {root.height}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

import { useState } from "react";
import type { ProjectSnapshotV2 } from "../../backend/types/projectV2";
import type { VariantAction } from "../../backend/reducer/variantActions";
import { resolveBoardView } from "../../backend/stateBoard/boardResolver";
import { CanvasViewport } from "../CanvasViewport";
import { VariantCompareOverlay } from "../variantPanel/VariantCompareOverlay";
import { VariantListPanel } from "../variantPanel/VariantListPanel";
import { StateBoardEmpty } from "./StateBoardEmpty";
import { StateBoardHeader } from "./StateBoardHeader";
import { VariantTabs } from "./VariantTabs";

export interface StateBoardShellProps {
  project: ProjectSnapshotV2;
  stateNodeId: string;
  variantId: string;
  projectName: string;
  onGoToMap(): void;
  onReplaceVariant(variantId: string): void;
  onVariantAction(action: VariantAction): void;
}

export function StateBoardShell({
  project,
  stateNodeId,
  variantId,
  projectName,
  onGoToMap,
  onReplaceVariant,
  onVariantAction,
}: StateBoardShellProps): JSX.Element {
  const [compareOpen, setCompareOpen] = useState(false);
  const resolved = resolveBoardView(project, stateNodeId, variantId);
  if (!resolved) {
    const stateName = project.navigationMap.stateNodes[stateNodeId]?.name;
    return <StateBoardEmpty stateName={stateName} />;
  }

  const variants = resolved.board.variantIds
    .map((id) => project.variantsById[id])
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const breadcrumbItems = [
    { key: "project", label: projectName, onClick: onGoToMap },
    { key: "state", label: resolved.stateNode.name },
    { key: "variant", label: resolved.variant.name },
  ];

  return (
    <section className="flex h-full w-full flex-col bg-neutral-900">
      <StateBoardHeader items={breadcrumbItems} onClose={onGoToMap} />
      <div className="relative min-h-0 flex-1">
        <CanvasViewport
          variantId={resolved.variant.id}
          boardMeta={resolved.meta}
        />
        <div className="pointer-events-auto absolute left-3 bottom-3 z-30 w-72">
          <VariantListPanel
            board={resolved.board}
            variants={variants}
            activeVariantId={resolved.variant.id}
            onSelect={onReplaceVariant}
            onSetCanonical={(id) =>
              onVariantAction({ type: "setCanonicalVariant", boardId: resolved.board.id, variantId: id })
            }
            onArchive={(id) => onVariantAction({ type: "setVariantStatus", variantId: id, status: "archived" })}
            onDelete={(id) => onVariantAction({ type: "deleteVariant", variantId: id })}
          />
        </div>
        <div className="pointer-events-auto absolute bottom-3 right-3 z-30">
          <VariantTabs
            variants={variants}
            activeVariantId={resolved.variant.id}
            canonicalVariantId={resolved.board.canonicalVariantId}
            onSelect={onReplaceVariant}
            onCreateBlank={() =>
              onVariantAction({ type: "createVariant", boardId: resolved.board.id, mode: "blank", name: "Blank Variant" })
            }
            onCreateCopy={() =>
              onVariantAction({ type: "createVariant", boardId: resolved.board.id, mode: "copy_current", name: `${resolved.variant.name} Copy` })
            }
            onRename={(id, name) => onVariantAction({ type: "renameVariant", variantId: id, name })}
            onDuplicate={(id) => onVariantAction({ type: "duplicateVariant", variantId: id })}
            onSetCanonical={(id) =>
              onVariantAction({ type: "setCanonicalVariant", boardId: resolved.board.id, variantId: id })
            }
            onArchive={(id) => onVariantAction({ type: "setVariantStatus", variantId: id, status: "archived" })}
            onDelete={(id) => onVariantAction({ type: "deleteVariant", variantId: id })}
            onCompare={() => setCompareOpen(true)}
          />
        </div>
        {compareOpen ? (
          <VariantCompareOverlay
            project={project}
            board={resolved.board}
            initialLeftVariantId={resolved.variant.id}
            initialRightVariantId={variants.find((item) => item.id !== resolved.variant.id)?.id ?? resolved.variant.id}
            onClose={() => setCompareOpen(false)}
          />
        ) : null}
      </div>
    </section>
  );
}

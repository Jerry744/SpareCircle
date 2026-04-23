import type { ProjectSnapshotV2 } from "../../backend/types/projectV2";
import { resolveBoardView } from "../../backend/stateBoard/boardResolver";
import { CanvasViewport } from "../CanvasViewport";
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
}

export function StateBoardShell({
  project,
  stateNodeId,
  variantId,
  projectName,
  onGoToMap,
  onReplaceVariant,
}: StateBoardShellProps): JSX.Element {
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
        <div className="pointer-events-auto absolute bottom-3 right-3 z-30">
          <VariantTabs
            variants={variants}
            activeVariantId={resolved.variant.id}
            canonicalVariantId={resolved.board.canonicalVariantId}
            onSelect={onReplaceVariant}
          />
        </div>
      </div>
    </section>
  );
}

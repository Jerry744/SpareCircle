import type { ProjectSnapshotV2 } from "../../backend/types/projectV2";
import type { VariantAction } from "../../backend/reducer/variantActions";
import { resolveBoardView } from "../../backend/stateBoard/boardResolver";
import { StateBoardEmpty } from "./StateBoardEmpty";
import { StateBoardHeader } from "./StateBoardHeader";
import { StateBoardSurface } from "./StateBoardSurface";
import type { StateBoardSelection } from "./stateBoardSelection";

export type { StateBoardSelection } from "./stateBoardSelection";

export interface StateBoardShellProps {
  project: ProjectSnapshotV2;
  stateNodeId: string;
  variantId: string;
  projectName: string;
  selection: StateBoardSelection;
  onGoToMap(): void;
  onSelectionChange(selection: StateBoardSelection): void;
  onReplaceVariant(variantId: string): void;
  onVariantAction(action: VariantAction): void;
  onEndContinuousChange?(): void;
}

export function StateBoardShell({
  project,
  stateNodeId,
  variantId,
  projectName,
  selection,
  onGoToMap,
  onSelectionChange,
  onReplaceVariant,
  onVariantAction,
  onEndContinuousChange,
}: StateBoardShellProps): JSX.Element {
  const resolved = resolveBoardView(project, stateNodeId, variantId);
  if (!resolved) {
    const stateName = project.navigationMap.stateNodes[stateNodeId]?.name;
    return <StateBoardEmpty stateName={stateName} />;
  }

  const breadcrumbItems = [
    { key: "project", label: projectName, onClick: onGoToMap },
    { key: "state", label: resolved.stateNode.name },
    { key: "variant", label: resolved.variant.name },
  ];

  return (
    <section className="flex h-full w-full flex-col bg-neutral-900">
      <StateBoardHeader items={breadcrumbItems} onClose={onGoToMap} />
      <div className="relative min-h-0 flex-1">
        <StateBoardSurface
          project={project}
          board={resolved.board}
          activeVariantId={resolved.variant.id}
          selection={selection}
          onSelectionChange={onSelectionChange}
          onSelectVariant={onReplaceVariant}
          onVariantAction={onVariantAction}
          onEndContinuousChange={onEndContinuousChange}
        />
      </div>
    </section>
  );
}

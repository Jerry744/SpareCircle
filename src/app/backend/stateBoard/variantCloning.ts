import type { ProjectSnapshotV2 } from "../types/projectV2";
import type { Variant } from "../types/variant";
import type { WidgetNode } from "../types/widget";
import { ID_PREFIX, makeId } from "../types/idPrefixes";

export interface CloneVariantResult {
  newVariant: Variant;
  newWidgets: Record<string, WidgetNode>;
  warnings: string[];
}

function collectSubtreeIds(widgetsById: Record<string, WidgetNode>, rootId: string): string[] {
  const result: string[] = [];
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    const widget = widgetsById[id];
    if (!widget || result.includes(id)) continue;
    result.push(id);
    for (let index = widget.childrenIds.length - 1; index >= 0; index -= 1) {
      stack.push(widget.childrenIds[index]);
    }
  }
  return result;
}

function makeWidgetCloneId(idPrefix: string | undefined, oldId: string): string {
  const suffix = oldId.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(-24);
  return `${idPrefix ?? makeId(ID_PREFIX.variant)}_node_${suffix || "widget"}`;
}

function rewriteBindings(
  widget: WidgetNode,
  idMap: Map<string, string>,
  warnings: string[],
): WidgetNode {
  if (!widget.eventBindings) return widget;
  const eventBindings: WidgetNode["eventBindings"] = {};
  for (const [event, binding] of Object.entries(widget.eventBindings)) {
    if (!binding) continue;
    if (binding.action.type === "toggle_visibility") {
      const targetWidgetId = idMap.get(binding.action.targetWidgetId);
      if (!targetWidgetId) {
        warnings.push(`Binding on ${widget.id} points outside the cloned Variant`);
        continue;
      }
      eventBindings[event as keyof typeof eventBindings] = {
        ...binding,
        action: { ...binding.action, targetWidgetId },
      };
    } else {
      warnings.push(`Deprecated switch_screen binding on ${widget.id} was dropped during Variant clone`);
    }
  }
  return Object.keys(eventBindings).length > 0 ? { ...widget, eventBindings } : { ...widget, eventBindings: undefined };
}

export function cloneVariant(params: {
  project: ProjectSnapshotV2;
  sourceVariantId: string;
  newVariantName: string;
  newVariantId?: string;
  now?: string;
  idPrefix?: string;
}): CloneVariantResult {
  const source = params.project.variantsById[params.sourceVariantId];
  if (!source) throw new Error(`Unknown Variant "${params.sourceVariantId}"`);
  const sourceRoot = params.project.widgetsById[source.rootWidgetId];
  if (!sourceRoot) throw new Error(`Variant "${source.id}" has no root widget`);

  const newVariantId = params.newVariantId ?? makeId(ID_PREFIX.variant);
  const createdAt = params.now ?? new Date().toISOString();
  const subtreeIds = collectSubtreeIds(params.project.widgetsById, source.rootWidgetId);
  const idMap = new Map<string, string>();
  for (const oldId of subtreeIds) {
    const nextId = oldId === source.rootWidgetId
      ? (params.idPrefix ?? `${newVariantId}_root`)
      : makeWidgetCloneId(params.idPrefix ?? newVariantId, oldId);
    idMap.set(oldId, nextId);
  }

  const warnings: string[] = [];
  const newWidgets: Record<string, WidgetNode> = {};
  for (const oldId of subtreeIds) {
    const widget = params.project.widgetsById[oldId];
    const newId = idMap.get(oldId) as string;
    const cloned: WidgetNode = {
      ...widget,
      id: newId,
      parentId: widget.parentId ? idMap.get(widget.parentId) ?? null : null,
      childrenIds: widget.childrenIds.map((id) => idMap.get(id)).filter((id): id is string => Boolean(id)),
    };
    newWidgets[newId] = rewriteBindings(cloned, idMap, warnings);
  }

  return {
    newVariant: {
      ...source,
      id: newVariantId,
      name: params.newVariantName.trim() || "Variant",
      status: "draft",
      rootWidgetId: idMap.get(source.rootWidgetId) as string,
      createdAt,
      updatedAt: createdAt,
    },
    newWidgets,
    warnings,
  };
}

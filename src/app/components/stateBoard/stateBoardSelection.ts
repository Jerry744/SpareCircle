export type StateBoardSelection =
  | { kind: "screen"; variantIds: string[] }
  | { kind: "widget"; variantId: string; widgetIds: string[] }
  | { kind: "mixed"; variantIds: string[]; widgetIdsByVariant: Record<string, string[]> };

export function getSelectedVariantIds(selection: StateBoardSelection): string[] {
  if (selection.kind === "screen") return selection.variantIds;
  if (selection.kind === "widget") return [];
  return selection.variantIds;
}

export function getSelectedWidgetIdsByVariant(selection: StateBoardSelection): Record<string, string[]> {
  if (selection.kind === "screen") return {};
  if (selection.kind === "widget") {
    return selection.widgetIds.length > 0 ? { [selection.variantId]: selection.widgetIds } : {};
  }
  return selection.widgetIdsByVariant;
}

export function getSelectedWidgetIds(selection: StateBoardSelection): string[] {
  return Object.values(getSelectedWidgetIdsByVariant(selection)).flat();
}

export function getSelectedWidgetIdsForVariant(selection: StateBoardSelection, variantId: string): string[] {
  return getSelectedWidgetIdsByVariant(selection)[variantId] ?? [];
}

export function normalizeStateBoardSelection(params: {
  variantIds?: string[];
  widgetIdsByVariant?: Record<string, string[]>;
}): StateBoardSelection {
  const variantIds = Array.from(new Set((params.variantIds ?? []).filter(Boolean)));
  const widgetIdsByVariant = Object.fromEntries(
    Object.entries(params.widgetIdsByVariant ?? {})
      .map(([variantId, widgetIds]) => [variantId, Array.from(new Set(widgetIds.filter(Boolean)))])
      .filter(([, widgetIds]) => widgetIds.length > 0),
  );
  const widgetVariantIds = Object.keys(widgetIdsByVariant);

  if (variantIds.length === 0 && widgetVariantIds.length === 0) {
    return { kind: "screen", variantIds: [] };
  }
  if (variantIds.length > 0 && widgetVariantIds.length === 0) {
    return { kind: "screen", variantIds };
  }
  if (variantIds.length === 0 && widgetVariantIds.length === 1) {
    const [variantId] = widgetVariantIds;
    return { kind: "widget", variantId, widgetIds: widgetIdsByVariant[variantId] ?? [] };
  }
  return { kind: "mixed", variantIds, widgetIdsByVariant };
}

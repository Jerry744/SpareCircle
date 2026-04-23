import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createEmptyProjectV2 } from "../../backend/validation";
import { StateBoardInspector } from "../stateBoard/StateBoardInspector";
import type { ProjectSnapshotV2 } from "../../backend/types/projectV2";
import type { WidgetNode } from "../../backend/types/widget";

function makeProject(): ProjectSnapshotV2 {
  const project = createEmptyProjectV2({
    stateNodeId: "state-node-alpha",
    variantId: "variant-root",
    rootWidgetId: "screen-root",
    now: () => "2026-04-24T00:00:00.000Z",
  });
  return {
    ...project,
    widgetsById: {
      ...project.widgetsById,
      "screen-root": {
        ...project.widgetsById["screen-root"],
        childrenIds: ["button-a"],
      },
      "button-a": {
        id: "button-a",
        name: "Button A",
        type: "Button",
        parentId: "screen-root",
        childrenIds: [],
        x: 12,
        y: 18,
        width: 96,
        height: 40,
        text: "Open",
        visible: true,
      } satisfies WidgetNode,
    },
  };
}

describe("StateBoardInspector", () => {
  it("shows widget metadata when the shared V2 selection points at a widget", () => {
    const project = makeProject();
    const onVariantAction = vi.fn();

    render(
      <StateBoardInspector
        project={project}
        board={project.stateBoardsById["board-alpha"]}
        selectedVariantId="variant-root"
        selection={{ kind: "widget", variantId: "variant-root", widgetIds: ["button-a"] }}
        onVariantAction={onVariantAction}
      />,
    );

    expect(screen.getByText("SELECTED WIDGET")).toBeInTheDocument();
    expect(screen.getByText("Button A")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hide Widget" }));
    expect(onVariantAction).toHaveBeenCalledWith({
      type: "setVariantWidgetVisibility",
      widgetId: "button-a",
      visible: false,
    });
  });

  it("falls back to screen inspector controls for screen selection", () => {
    const project = makeProject();

    render(
      <StateBoardInspector
        project={project}
        board={project.stateBoardsById["board-alpha"]}
        selectedVariantId="variant-root"
        selection={{ kind: "screen", variantIds: ["variant-root"] }}
        onVariantAction={vi.fn()}
      />,
    );

    expect(screen.getByText("SELECTED SCREEN")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set as Canonical" })).toBeDisabled();
  });
});

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditorBackendProvider, useEditorBackend } from "../../backend/editorStore";
import { HierarchyPanel } from "../HierarchyPanel";
import { ContextMenu, ContextMenuTrigger } from "../ui/context-menu";
import { CanvasContextMenuContent } from "../CanvasContextMenu";
import { createInitialProject } from "../../backend/validation";

function TestHarness({ children }: { children: React.ReactNode }) {
  return <EditorBackendProvider>{children}</EditorBackendProvider>;
}

function SelectionReadout() {
  const { state: { selectedWidgetIds } } = useEditorBackend();
  return <div data-testid="selection">{selectedWidgetIds.join(",")}</div>;
}

describe("HierarchyPanel multi-select", () => {
  it("Ctrl click toggles individual items in and out of selection", () => {
    render(
      <TestHarness>
        <HierarchyPanel />
        <SelectionReadout />
      </TestHarness>,
    );

    // Widget names in initial project: Panel1 name="Panel1", Button1 name="Button1"
    const panelRow = screen.getAllByText("Panel1")[0].closest("[tabindex]")!;
    const buttonRow = screen.getAllByText("Button1")[0].closest("[tabindex]")!;

    // Plain click → select Panel1
    fireEvent.click(panelRow);
    expect(screen.getByTestId("selection").textContent).toContain("Panel1");

    // Ctrl click → add Button1
    fireEvent.click(buttonRow, { ctrlKey: true });
    expect(screen.getByTestId("selection").textContent).toContain("Panel1");
    expect(screen.getByTestId("selection").textContent).toContain("Button1");

    // Ctrl click again → remove Button1
    fireEvent.click(buttonRow, { ctrlKey: true });
    expect(screen.getByTestId("selection").textContent).not.toContain("Button1");
    expect(screen.getByTestId("selection").textContent).toContain("Panel1");
  });

  it("Shift click selects a range from the anchor to the clicked item", () => {
    render(
      <TestHarness>
        <HierarchyPanel />
        <SelectionReadout />
      </TestHarness>,
    );

    // TempLabel widget has name "Temperature", Button1 has name "Button1"
    // Click Temperature as anchor then Shift-click Button1
    const tempRow = screen.getAllByText("Temperature")[0].closest("[tabindex]")!;
    const button1Row = screen.getAllByText("Button1")[0].closest("[tabindex]")!;

    fireEvent.click(tempRow);
    expect(screen.getByTestId("selection").textContent).toContain("TempLabel");

    fireEvent.click(button1Row, { shiftKey: true });
    const selection = screen.getByTestId("selection").textContent ?? "";
    expect(selection).toContain("TempLabel");
    expect(selection).toContain("Button1");
  });

  it("plain click replaces selection with single item", () => {
    render(
      <TestHarness>
        <HierarchyPanel />
        <SelectionReadout />
      </TestHarness>,
    );

    const panelRow = screen.getAllByText("Panel1")[0].closest("[tabindex]")!;
    const buttonRow = screen.getAllByText("Button1")[0].closest("[tabindex]")!;

    fireEvent.click(panelRow);
    fireEvent.click(buttonRow, { ctrlKey: true });
    const both = screen.getByTestId("selection").textContent ?? "";
    expect(both).toContain("Panel1");
    expect(both).toContain("Button1");

    // Plain click → only Button1
    fireEvent.click(buttonRow);
    const single = screen.getByTestId("selection").textContent ?? "";
    expect(single).toBe("Button1");
  });
});

describe("HierarchyPanel duplicate actions", () => {
  it("duplicateToTarget action is available and hierarchy panel renders without error", () => {
    let capturedActions: ReturnType<typeof useEditorBackend>["actions"] | null = null;

    function ActionCapture() {
      const { actions } = useEditorBackend();
      capturedActions = actions;
      return null;
    }

    render(
      <TestHarness>
        <HierarchyPanel />
        <SelectionReadout />
        <ActionCapture />
      </TestHarness>,
    );

    expect(capturedActions).not.toBeNull();
    expect(typeof capturedActions!.duplicateToTarget).toBe("function");
    // Hierarchy panel renders widget rows
    expect(screen.getAllByText("Button1").length).toBeGreaterThan(0);
  });
});

describe("CanvasContextMenuContent", () => {
  it("shows insert options when no widget is targeted (blank canvas)", () => {
    const project = createInitialProject();
    const rootNodeId = project.screens[0].rootNodeId;

    render(
      <ContextMenu>
        <ContextMenuTrigger>canvas-area</ContextMenuTrigger>
        <CanvasContextMenuContent
          data={{ targetId: null, dropParentId: rootNodeId, dropLocalX: 50, dropLocalY: 50 }}
          project={project}
          selectedWidgetIds={[]}
          onAddWidget={vi.fn()}
          onDelete={vi.fn()}
          onCopy={vi.fn()}
          onUpdateVisible={vi.fn()}
          onMoveWidget={vi.fn()}
        />
      </ContextMenu>,
    );

    fireEvent.contextMenu(screen.getByText("canvas-area"));

    expect(screen.getByText("New Button")).toBeInTheDocument();
    expect(screen.getByText("New Label")).toBeInTheDocument();
    expect(screen.getByText("New Container")).toBeInTheDocument();
  });

  it("shows widget operations when a selected widget is targeted", () => {
    const project = createInitialProject();

    render(
      <ContextMenu>
        <ContextMenuTrigger>canvas-area</ContextMenuTrigger>
        <CanvasContextMenuContent
          data={{ targetId: "Button1", dropParentId: "Panel1", dropLocalX: 0, dropLocalY: 0 }}
          project={project}
          selectedWidgetIds={["Button1"]}
          onAddWidget={vi.fn()}
          onDelete={vi.fn()}
          onCopy={vi.fn()}
          onUpdateVisible={vi.fn()}
          onMoveWidget={vi.fn()}
        />
      </ContextMenu>,
    );

    fireEvent.contextMenu(screen.getByText("canvas-area"));

    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.getByText("Bring to Front")).toBeInTheDocument();
    expect(screen.getByText("Send to Back")).toBeInTheDocument();
  });

  it("calls onAddWidget with correct args when 'New Button' is clicked", () => {
    const project = createInitialProject();
    const rootNodeId = project.screens[0].rootNodeId;
    const onAddWidget = vi.fn();

    render(
      <ContextMenu>
        <ContextMenuTrigger>canvas-area</ContextMenuTrigger>
        <CanvasContextMenuContent
          data={{ targetId: null, dropParentId: rootNodeId, dropLocalX: 30, dropLocalY: 40 }}
          project={project}
          selectedWidgetIds={[]}
          onAddWidget={onAddWidget}
          onDelete={vi.fn()}
          onCopy={vi.fn()}
          onUpdateVisible={vi.fn()}
          onMoveWidget={vi.fn()}
        />
      </ContextMenu>,
    );

    fireEvent.contextMenu(screen.getByText("canvas-area"));
    fireEvent.click(screen.getByText("New Button"));

    expect(onAddWidget).toHaveBeenCalledWith(rootNodeId, "Button", 30, 40);
  });
});

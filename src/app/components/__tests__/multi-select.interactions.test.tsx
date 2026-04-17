import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EditorBackendProvider, useEditorBackend } from "../../backend/editorStore";
import { HierarchyPanel } from "../HierarchyPanel";

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

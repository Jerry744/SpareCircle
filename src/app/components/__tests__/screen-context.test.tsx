import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EditorBackendProvider, useEditorBackend } from "../../backend/editorStore";
import { HierarchyPanel } from "../HierarchyPanel";
import { InspectorPanel } from "../InspectorPanel";

function TestActions() {
  const {
    state: { project },
    actions: { addWidget, createScreen, setActiveScreen, setSelection },
  } = useEditorBackend();

  return (
    <div>
      <button onClick={() => addWidget("Panel1", "Checkbox", 10, 10)}>add-checkbox</button>
      <button onClick={() => addWidget("Panel1", "Radio", 10, 10)}>add-radio</button>
      <button onClick={() => setSelection(["TempLabel", "Button1"])}>select-temp-button</button>
      <button onClick={() => setSelection(["Label1", "Panel1"])}>select-label-panel</button>
      <button onClick={() => createScreen()}>create-screen</button>
      <button
        onClick={() => {
          if (project.screens.length > 1) {
            setActiveScreen(project.screens[1].id);
          }
        }}
      >
        switch-to-screen-2
      </button>
    </div>
  );
}

function PositionReadout() {
  const {
    state: { project },
  } = useEditorBackend();

  return (
    <div>
      <div data-testid="label1-x">{project.widgetsById.Label1.x}</div>
      <div data-testid="panel1-x">{project.widgetsById.Panel1.x}</div>
      <div data-testid="temp-x">{project.widgetsById.TempLabel.x}</div>
      <div data-testid="button1-x">{project.widgetsById.Button1.x}</div>
    </div>
  );
}

describe("screen context isolation", () => {
  it("switching screen scopes hierarchy and clears inspector selection context", () => {
    render(
      <EditorBackendProvider>
        <TestActions />
        <HierarchyPanel />
        <InspectorPanel />
      </EditorBackendProvider>,
    );

    fireEvent.click(screen.getByText("Button1"));
    expect(screen.getByText("SELECTED WIDGET")).toBeInTheDocument();
    expect(screen.queryByText("Select a widget to view properties")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("create-screen"));
    fireEvent.click(screen.getByText("switch-to-screen-2"));

    expect(screen.getByText("Select a widget to view properties")).toBeInTheDocument();
    expect(screen.queryByText("Button1")).not.toBeInTheDocument();
  });

  it("toggles the inspector initially-checked state for Checkbox widgets", () => {
    render(
      <EditorBackendProvider>
        <TestActions />
        <HierarchyPanel />
        <InspectorPanel />
      </EditorBackendProvider>,
    );

    fireEvent.click(screen.getByText("add-checkbox"));

    const checkedInput = screen.getByLabelText("Initially Checked");
    expect(checkedInput).not.toBeChecked();

    fireEvent.click(checkedInput);

    expect(screen.getByLabelText("Initially Checked")).toBeChecked();
  });

  it("shows options table for Radio widgets in Content section", () => {
    render(
      <EditorBackendProvider>
        <TestActions />
        <HierarchyPanel />
        <InspectorPanel />
      </EditorBackendProvider>,
    );

    fireEvent.click(screen.getByText("add-radio"));

    // Radio content section shows an options list
    expect(screen.getByText("Options")).toBeInTheDocument();
    expect(screen.getByText("+ Add")).toBeInTheDocument();
  });

  it("uses the latest selection when triggering multi-select alignment from inspector", () => {
    render(
      <EditorBackendProvider>
        <TestActions />
        <InspectorPanel />
        <PositionReadout />
      </EditorBackendProvider>,
    );

    fireEvent.click(screen.getByText("select-temp-button"));
    fireEvent.click(screen.getByRole("button", { name: "Left" }));

    expect(screen.getByTestId("temp-x").textContent).toBe("36");
    expect(screen.getByTestId("button1-x").textContent).toBe("36");

    fireEvent.click(screen.getByText("select-label-panel"));
    fireEvent.click(screen.getByRole("button", { name: "Left" }));

    expect(screen.getByTestId("label1-x").textContent).toBe("20");
    expect(screen.getByTestId("panel1-x").textContent).toBe("20");
    expect(screen.getByTestId("button1-x").textContent).toBe("36");
  });
});

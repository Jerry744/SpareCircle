import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EditorBackendProvider, useEditorBackend } from "../../backend/editorStore";
import { HierarchyPanel } from "../HierarchyPanel";
import { InspectorPanel } from "../InspectorPanel";

function TestActions() {
  const {
    state: { project },
    actions: { addWidget, createScreen, setActiveScreen },
  } = useEditorBackend();

  return (
    <div>
      <button onClick={() => addWidget("Panel1", "Checkbox", 10, 10)}>add-checkbox</button>
      <button onClick={() => addWidget("Panel1", "Radio", 10, 10)}>add-radio</button>
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
});

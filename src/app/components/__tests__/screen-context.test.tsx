import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EditorBackendProvider, useEditorBackend } from "../../backend/editorStore";
import { HierarchyPanel } from "../HierarchyPanel";
import { InspectorPanel } from "../InspectorPanel";

function TestActions() {
  const {
    state: { project },
    actions: { createScreen, setActiveScreen },
  } = useEditorBackend();

  return (
    <div>
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
});

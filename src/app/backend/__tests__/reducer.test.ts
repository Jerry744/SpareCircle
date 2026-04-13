import { describe, expect, it } from "vitest";
import { editorReducer } from "../reducer";
import { createInitialProject } from "../validation";
import type { EditorState } from "../types";

function createState(): EditorState {
  return {
    project: createInitialProject(),
    selectedWidgetIds: [],
    history: {
      past: [],
      future: [],
    },
    interaction: null,
  };
}

describe("editorReducer screen lifecycle", () => {
  it("creates and auto-selects a new screen", () => {
    const state = createState();
    const next = editorReducer(state, { type: "createScreen" });

    expect(next.project.screens).toHaveLength(2);
    expect(next.project.activeScreenId).toBe(next.project.screens[1].id);
    expect(next.selectedWidgetIds).toEqual([]);
  });

  it("deletes active screen and falls back to another screen deterministically", () => {
    let state = createState();
    state = editorReducer(state, { type: "createScreen" });
    const createdId = state.project.activeScreenId;

    const next = editorReducer(state, { type: "deleteScreen", screenId: createdId });

    expect(next.project.screens).toHaveLength(1);
    expect(next.project.activeScreenId).toBe(next.project.screens[0].id);
  });

  it("duplicates a screen and regenerates node ids", () => {
    const state = createState();
    const sourceScreen = state.project.screens[0];
    const sourceRootId = sourceScreen.rootNodeId;
    const sourceNodeIds = new Set(
      Object.values(state.project.widgetsById)
        .filter((node) => node.id === sourceRootId || node.parentId === sourceRootId || node.parentId === "Container1" || node.parentId === "Panel1")
        .map((node) => node.id),
    );

    const next = editorReducer(state, { type: "duplicateScreen", screenId: sourceScreen.id });

    expect(next.project.screens).toHaveLength(2);
    const duplicatedScreen = next.project.screens[1];
    expect(duplicatedScreen.id).not.toBe(sourceScreen.id);
    expect(duplicatedScreen.rootNodeId).not.toBe(sourceRootId);

    const duplicatedRoot = next.project.widgetsById[duplicatedScreen.rootNodeId];
    expect(duplicatedRoot).toBeDefined();

    const duplicatedChildIds = new Set<string>();
    const stack = [duplicatedScreen.rootNodeId];
    while (stack.length > 0) {
      const id = stack.pop() as string;
      duplicatedChildIds.add(id);
      for (const childId of next.project.widgetsById[id]?.childrenIds ?? []) {
        stack.push(childId);
      }
    }

    for (const duplicatedId of duplicatedChildIds) {
      expect(sourceNodeIds.has(duplicatedId)).toBe(false);
    }
  });

  it("clears selection when switching active screen", () => {
    let state = createState();
    state = { ...state, selectedWidgetIds: ["Button1"] };
    state = editorReducer(state, { type: "createScreen" });

    const targetScreenId = state.project.screens[0].id;
    const next = editorReducer(state, { type: "setActiveScreen", screenId: targetScreenId });

    expect(next.selectedWidgetIds).toEqual([]);
    expect(next.project.activeScreenId).toBe(targetScreenId);
  });
});

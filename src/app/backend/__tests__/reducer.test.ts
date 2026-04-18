import { describe, expect, it } from "vitest";
import { editorReducer } from "../reducer";
import { createInitialProject } from "../validation";
import { packClipboard } from "../clipboard";
import type { AlignmentOperation, EditorState, WidgetNode } from "../types";

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

function createWidget(overrides: Partial<WidgetNode> & Pick<WidgetNode, "id" | "name">): WidgetNode {
  return {
    id: overrides.id,
    name: overrides.name,
    type: "Label",
    parentId: "Panel1",
    childrenIds: [],
    x: 0,
    y: 0,
    width: 20,
    height: 20,
    text: overrides.name,
    ...overrides,
  };
}

function createAlignmentState(): EditorState {
  const project = createInitialProject();
  const widgetsById = {
    ...project.widgetsById,
    alignA: createWidget({ id: "alignA", name: "Align A", x: 10, y: 20, width: 50, height: 20 }),
    alignB: createWidget({ id: "alignB", name: "Align B", x: 70, y: 40, width: 30, height: 40 }),
    alignC: createWidget({ id: "alignC", name: "Align C", x: 130, y: 10, width: 20, height: 30 }),
    alignD: createWidget({ id: "alignD", name: "Align D", x: 0, y: 120, width: 20, height: 20 }),
  };

  widgetsById.Panel1 = {
    ...widgetsById.Panel1,
    childrenIds: [...widgetsById.Panel1.childrenIds, "alignA", "alignB", "alignC", "alignD"],
  };

  return {
    project: {
      ...project,
      widgetsById,
    },
    selectedWidgetIds: ["alignA", "alignB", "alignC"],
    history: {
      past: [],
      future: [],
    },
    interaction: null,
  };
}

function reduceAlignment(state: EditorState, operation: AlignmentOperation, widgetIds = state.selectedWidgetIds): EditorState {
  return editorReducer(state, {
    type: "applyAlignmentOperation",
    operation,
    widgetIds,
  });
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

  it("assigns style token to widget and keeps local override optional", () => {
    const state = createState();
    const tokenId = state.project.styleTokens[0]?.id;
    expect(tokenId).toBeDefined();

    const assigned = editorReducer(state, {
      type: "assignWidgetStyleToken",
      widgetId: "Button1",
      propertyName: "fill",
      tokenId,
    });

    expect(assigned.project.widgetsById.Button1.fillTokenId).toBe(tokenId);
    expect(assigned.project.widgetsById.Button1.fill).toBeUndefined();

    const overridden = editorReducer(assigned, {
      type: "updateWidgetProperty",
      widgetId: "Button1",
      propertyName: "fill",
      value: "#112233",
    });
    expect(overridden.project.widgetsById.Button1.fill).toBe("#112233");
    expect(overridden.project.widgetsById.Button1.fillTokenId).toBe(tokenId);
  });

  it("clears local color override without removing token binding", () => {
    const state = createState();
    const tokenId = state.project.styleTokens[0]?.id;
    const assigned = editorReducer(state, {
      type: "assignWidgetStyleToken",
      widgetId: "Button1",
      propertyName: "fill",
      tokenId,
    });
    const overridden = editorReducer(assigned, {
      type: "updateWidgetProperty",
      widgetId: "Button1",
      propertyName: "fill",
      value: "#223344",
    });

    const cleared = editorReducer(overridden, {
      type: "clearWidgetProperty",
      widgetId: "Button1",
      propertyName: "fill",
    });

    expect(cleared.project.widgetsById.Button1.fill).toBeUndefined();
    expect(cleared.project.widgetsById.Button1.fillTokenId).toBe(tokenId);
  });

  it("deletes style token and removes widget token references", () => {
    const state = createState();
    const tokenId = state.project.styleTokens[0]?.id;
    const withRefs = editorReducer(
      editorReducer(state, {
        type: "assignWidgetStyleToken",
        widgetId: "Button1",
        propertyName: "fill",
        tokenId,
      }),
      {
        type: "assignWidgetStyleToken",
        widgetId: "TempLabel",
        propertyName: "textColor",
        tokenId,
      },
    );

    const deleted = editorReducer(withRefs, {
      type: "deleteStyleToken",
      tokenId,
    });

    expect(deleted.project.styleTokens.some((token) => token.id === tokenId)).toBe(false);
    expect(deleted.project.widgetsById.Button1.fillTokenId).toBeUndefined();
    expect(deleted.project.widgetsById.TempLabel.textColorTokenId).toBeUndefined();
  });

  it("upserts and removes widget event bindings", () => {
    const state = createState();

    const bound = editorReducer(state, {
      type: "upsertWidgetEventBinding",
      widgetId: "Button1",
      binding: {
        event: "clicked",
        action: {
          type: "switch_screen",
          targetScreenId: "screen-1",
        },
      },
    });

    expect(bound.project.widgetsById.Button1.eventBindings?.clicked?.action.type).toBe("switch_screen");

    const removed = editorReducer(bound, {
      type: "removeWidgetEventBinding",
      widgetId: "Button1",
      event: "clicked",
    });

    expect(removed.project.widgetsById.Button1.eventBindings?.clicked).toBeUndefined();
  });

  it("imports image assets and assigns one to image widget", () => {
    const state = createState();
    const withImage = editorReducer(state, {
      type: "addWidget",
      parentId: "Panel1",
      widgetType: "Image",
      x: 12,
      y: 12,
    });
    const imageId = withImage.selectedWidgetIds[0];

    const imported = editorReducer(withImage, {
      type: "importAssets",
      assets: [
        {
          id: "asset-sample-1",
          name: "sample.gif",
          mimeType: "image/gif",
          dataUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
        },
      ],
    });

    const assigned = editorReducer(imported, {
      type: "assignWidgetAsset",
      widgetId: imageId,
      assetId: "asset-sample-1",
    });

    expect(assigned.project.assets["asset-sample-1"]).toBeDefined();
    expect(assigned.project.widgetsById[imageId].assetId).toBe("asset-sample-1");
  });

  it("deleting asset clears asset references from image widgets", () => {
    const state = createState();
    const withImage = editorReducer(state, {
      type: "addWidget",
      parentId: "Panel1",
      widgetType: "Image",
      x: 20,
      y: 20,
    });
    const imageId = withImage.selectedWidgetIds[0];

    const imported = editorReducer(withImage, {
      type: "importAssets",
      assets: [
        {
          id: "asset-delete-1",
          name: "delete.gif",
          mimeType: "image/gif",
          dataUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
        },
      ],
    });
    const assigned = editorReducer(imported, {
      type: "assignWidgetAsset",
      widgetId: imageId,
      assetId: "asset-delete-1",
    });

    const deleted = editorReducer(assigned, {
      type: "deleteAsset",
      assetId: "asset-delete-1",
    });

    expect(deleted.project.assets["asset-delete-1"]).toBeUndefined();
    expect(deleted.project.widgetsById[imageId].assetId).toBeUndefined();
  });

  it("adds a Slider widget with correct defaults", () => {
    const state = createState();
    const next = editorReducer(state, {
      type: "addWidget",
      parentId: "Panel1",
      widgetType: "Slider",
      x: 10,
      y: 10,
    });

    const sliderId = next.selectedWidgetIds[0];
    expect(sliderId).toBeDefined();
    const slider = next.project.widgetsById[sliderId];
    expect(slider.type).toBe("Slider");
    expect(slider.fill).toBe("#3b82f6");
    expect(slider.width).toBe(200);
    expect(slider.height).toBe(32);
    expect(next.project.widgetsById.Panel1.childrenIds).toContain(sliderId);
  });

  it("updates Slider fill property", () => {
    const state = createState();
    const withSlider = editorReducer(state, {
      type: "addWidget",
      parentId: "Panel1",
      widgetType: "Slider",
      x: 10,
      y: 10,
    });
    const sliderId = withSlider.selectedWidgetIds[0];

    const updated = editorReducer(withSlider, {
      type: "updateWidgetProperty",
      widgetId: sliderId,
      propertyName: "fill",
      value: "#ef4444",
    });

    expect(updated.project.widgetsById[sliderId].fill).toBe("#ef4444");
  });

  it("Slider supports undo after add", () => {
    const state = createState();
    const withSlider = editorReducer(state, {
      type: "addWidget",
      parentId: "Panel1",
      widgetType: "Slider",
      x: 10,
      y: 10,
    });
    const sliderId = withSlider.selectedWidgetIds[0];
    expect(withSlider.project.widgetsById[sliderId]).toBeDefined();
    expect(withSlider.project.widgetsById.Panel1.childrenIds).toContain(sliderId);

    const undone = editorReducer(withSlider, { type: "undo" });
    expect(undone.project.widgetsById[sliderId]).toBeUndefined();
    expect(undone.project.widgetsById.Panel1.childrenIds).not.toContain(sliderId);
  });

  it("binds value_changed event on Slider", () => {
    const state = createState();
    const withScreen = editorReducer(state, { type: "createScreen" });
    const withSlider = editorReducer(withScreen, {
      type: "addWidget",
      parentId: "Panel1",
      widgetType: "Slider",
      x: 10,
      y: 10,
    });
    const sliderId = withSlider.selectedWidgetIds[0];

    const bound = editorReducer(withSlider, {
      type: "upsertWidgetEventBinding",
      widgetId: sliderId,
      binding: {
        event: "value_changed",
        action: {
          type: "switch_screen",
          targetScreenId: withScreen.project.activeScreenId,
        },
      },
    });

    expect(bound.project.widgetsById[sliderId].eventBindings?.value_changed?.event).toBe("value_changed");
  });

  it("adds a Switch widget with correct defaults", () => {
    const state = createState();
    const next = editorReducer(state, {
      type: "addWidget",
      parentId: "Panel1",
      widgetType: "Switch",
      x: 10,
      y: 10,
    });

    const switchId = next.selectedWidgetIds[0];
    expect(switchId).toBeDefined();
    const sw = next.project.widgetsById[switchId];
    expect(sw.type).toBe("Switch");
    expect(sw.fill).toBe("#22c55e");
    expect(sw.width).toBe(60);
    expect(sw.height).toBe(32);
    expect(next.project.widgetsById.Panel1.childrenIds).toContain(switchId);
  });

  it("Switch supports undo after add", () => {
    const state = createState();
    const withSwitch = editorReducer(state, {
      type: "addWidget",
      parentId: "Panel1",
      widgetType: "Switch",
      x: 10,
      y: 10,
    });
    const switchId = withSwitch.selectedWidgetIds[0];

    const undone = editorReducer(withSwitch, { type: "undo" });
    expect(undone.project.widgetsById[switchId]).toBeUndefined();
    expect(undone.project.widgetsById.Panel1.childrenIds).not.toContain(switchId);
  });

  it("binds value_changed event on Switch", () => {
    const state = createState();
    const withScreen = editorReducer(state, { type: "createScreen" });
    const withSwitch = editorReducer(withScreen, {
      type: "addWidget",
      parentId: "Panel1",
      widgetType: "Switch",
      x: 10,
      y: 10,
    });
    const switchId = withSwitch.selectedWidgetIds[0];

    const bound = editorReducer(withSwitch, {
      type: "upsertWidgetEventBinding",
      widgetId: switchId,
      binding: {
        event: "value_changed",
        action: {
          type: "switch_screen",
          targetScreenId: withScreen.project.activeScreenId,
        },
      },
    });

    expect(bound.project.widgetsById[switchId].eventBindings?.value_changed?.event).toBe("value_changed");
  });

  it("adds Checkbox with correct defaults and supports undo", () => {
    const state = createState();
    const next = editorReducer(state, { type: "addWidget", parentId: "Panel1", widgetType: "Checkbox", x: 10, y: 10 });
    const id = next.selectedWidgetIds[0];
    const widget = next.project.widgetsById[id];
    expect(widget.type).toBe("Checkbox");
    expect(widget.text).toBe("Option");
    expect(widget.fill).toBe("#3b82f6");
    expect(widget.width).toBe(160);
    expect(widget.height).toBe(32);
    const undone = editorReducer(next, { type: "undo" });
    expect(undone.project.widgetsById[id]).toBeUndefined();
  });

  it("adds Radio with correct defaults and supports setWidgetOptions", () => {
    const state = createState();
    const next = editorReducer(state, { type: "addWidget", parentId: "Panel1", widgetType: "Radio", x: 10, y: 10 });
    const id = next.selectedWidgetIds[0];
    expect(next.project.widgetsById[id].type).toBe("Radio");
    expect(next.project.widgetsById[id].options).toEqual(["Option 1", "Option 2"]);
    expect(next.project.widgetsById[id].selectedOptionIndex).toBe(0);

    const withOptions = editorReducer(next, { type: "setWidgetOptions", widgetId: id, options: ["A", "B", "C"] });
    expect(withOptions.project.widgetsById[id].options).toEqual(["A", "B", "C"]);

    const withSelected = editorReducer(withOptions, { type: "setWidgetSelectedOption", widgetId: id, index: 2 });
    expect(withSelected.project.widgetsById[id].selectedOptionIndex).toBe(2);
  });

  it("adds Dropdown with options array and supports setWidgetOptions", () => {
    const state = createState();
    const next = editorReducer(state, { type: "addWidget", parentId: "Panel1", widgetType: "Dropdown", x: 10, y: 10 });
    const id = next.selectedWidgetIds[0];
    expect(next.project.widgetsById[id].type).toBe("Dropdown");
    expect(next.project.widgetsById[id].options).toEqual(["Option 1", "Option 2", "Option 3"]);
    expect(next.project.widgetsById[id].width).toBe(160);
    expect(next.project.widgetsById[id].height).toBe(40);

    const updated = editorReducer(next, { type: "setWidgetOptions", widgetId: id, options: ["A", "B", "C"] });
    expect(updated.project.widgetsById[id].options).toEqual(["A", "B", "C"]);
  });

  it("deletes currently selected widgets", () => {
    const state = createState();
    const selected = { ...state, selectedWidgetIds: ["Button1"] };

    const next = editorReducer(selected, { type: "deleteSelectedWidgets" });

    expect(next.project.widgetsById.Button1).toBeUndefined();
    expect(next.project.widgetsById.Panel1.childrenIds).not.toContain("Button1");
    expect(next.selectedWidgetIds).toEqual([]);
  });

  it("ignores deleting active screen root widget", () => {
    const state = createState();
    const selected = { ...state, selectedWidgetIds: [state.project.screens[0].rootNodeId] };

    const next = editorReducer(selected, { type: "deleteSelectedWidgets" });

    expect(next).toBe(selected);
    expect(next.project.widgetsById[state.project.screens[0].rootNodeId]).toBeDefined();
  });

  it("deletes parent only once when parent and child are both selected", () => {
    const state = createState();
    const selected = { ...state, selectedWidgetIds: ["Container1", "Panel1"] };

    const next = editorReducer(selected, { type: "deleteSelectedWidgets" });

    expect(next.project.widgetsById.Container1).toBeUndefined();
    expect(next.project.widgetsById.Panel1).toBeUndefined();
    expect(next.project.widgetsById.Button1).toBeUndefined();
  });

  it("rejects invalid event binding targets and prunes deleted references", () => {
    const state = createState();

    const rejected = editorReducer(state, {
      type: "upsertWidgetEventBinding",
      widgetId: "Button1",
      binding: {
        event: "clicked",
        action: {
          type: "switch_screen",
          targetScreenId: "missing-screen",
        },
      },
    });

    expect(rejected).toBe(state);

    const withScreen = editorReducer(state, { type: "createScreen" });
    const withBinding = editorReducer(withScreen, {
      type: "upsertWidgetEventBinding",
      widgetId: "Button1",
      binding: {
        event: "clicked",
        action: {
          type: "switch_screen",
          targetScreenId: withScreen.project.activeScreenId,
        },
      },
    });

    const deletedScreen = editorReducer(withBinding, {
      type: "deleteScreen",
      screenId: withScreen.project.activeScreenId,
    });

    expect(deletedScreen.project.widgetsById.Button1.eventBindings?.clicked).toBeUndefined();
  });
});

describe("editorReducer alignment operations", () => {
  it("aligns widgets to the left edge of the selection bounds", () => {
    const next = reduceAlignment(createAlignmentState(), "align_left");

    expect(next.project.widgetsById.alignA.x).toBe(10);
    expect(next.project.widgetsById.alignB.x).toBe(10);
    expect(next.project.widgetsById.alignC.x).toBe(10);
  });

  it("aligns widgets to the right edge of the selection bounds", () => {
    const next = reduceAlignment(createAlignmentState(), "align_right");

    expect(next.project.widgetsById.alignA.x).toBe(100);
    expect(next.project.widgetsById.alignB.x).toBe(120);
    expect(next.project.widgetsById.alignC.x).toBe(130);
  });

  it("aligns widgets to the top edge of the selection bounds", () => {
    const next = reduceAlignment(createAlignmentState(), "align_top");

    expect(next.project.widgetsById.alignA.y).toBe(10);
    expect(next.project.widgetsById.alignB.y).toBe(10);
    expect(next.project.widgetsById.alignC.y).toBe(10);
  });

  it("aligns widgets to the bottom edge of the selection bounds", () => {
    const next = reduceAlignment(createAlignmentState(), "align_bottom");

    expect(next.project.widgetsById.alignA.y).toBe(60);
    expect(next.project.widgetsById.alignB.y).toBe(40);
    expect(next.project.widgetsById.alignC.y).toBe(50);
  });

  it("aligns widgets to the horizontal center of the selection bounds", () => {
    const next = reduceAlignment(createAlignmentState(), "align_h_center");

    expect(next.project.widgetsById.alignA.x).toBe(55);
    expect(next.project.widgetsById.alignB.x).toBe(65);
    expect(next.project.widgetsById.alignC.x).toBe(70);
  });

  it("aligns widgets to the vertical center of the selection bounds", () => {
    const next = reduceAlignment(createAlignmentState(), "align_v_center");

    expect(next.project.widgetsById.alignA.y).toBe(35);
    expect(next.project.widgetsById.alignB.y).toBe(25);
    expect(next.project.widgetsById.alignC.y).toBe(30);
  });

  it("distributes widgets horizontally while keeping endpoints fixed", () => {
    const state = createAlignmentState();
    const adjusted = {
      ...state,
      selectedWidgetIds: ["alignD", "alignA", "alignB", "alignC"],
      project: {
        ...state.project,
        widgetsById: {
          ...state.project.widgetsById,
          alignD: { ...state.project.widgetsById.alignD, x: 0, y: 0, width: 20, height: 20 },
          alignA: { ...state.project.widgetsById.alignA, x: 35, y: 0, width: 20, height: 20 },
          alignB: { ...state.project.widgetsById.alignB, x: 90, y: 0, width: 20, height: 20 },
          alignC: { ...state.project.widgetsById.alignC, x: 120, y: 0, width: 20, height: 20 },
        },
      },
    };

    const next = reduceAlignment(adjusted, "distribute_h");

    expect(next.project.widgetsById.alignD.x).toBe(0);
    expect(next.project.widgetsById.alignA.x).toBe(40);
    expect(next.project.widgetsById.alignB.x).toBe(80);
    expect(next.project.widgetsById.alignC.x).toBe(120);
  });

  it("keeps horizontal distribution stable across repeated operations", () => {
    const state = createAlignmentState();
    const adjusted = {
      ...state,
      selectedWidgetIds: ["alignD", "alignA", "alignB", "alignC"],
      project: {
        ...state.project,
        widgetsById: {
          ...state.project.widgetsById,
          alignD: { ...state.project.widgetsById.alignD, x: 0, y: 0, width: 20, height: 20 },
          alignA: { ...state.project.widgetsById.alignA, x: 35, y: 0, width: 20, height: 20 },
          alignB: { ...state.project.widgetsById.alignB, x: 90, y: 0, width: 20, height: 20 },
          alignC: { ...state.project.widgetsById.alignC, x: 120, y: 0, width: 20, height: 20 },
        },
      },
    };

    const once = reduceAlignment(adjusted, "distribute_h");
    const twice = reduceAlignment(once, "distribute_h");

    expect(twice.project.widgetsById.alignD.x).toBe(0);
    expect(twice.project.widgetsById.alignA.x).toBe(40);
    expect(twice.project.widgetsById.alignB.x).toBe(80);
    expect(twice.project.widgetsById.alignC.x).toBe(120);
  });

  it("distributes widgets vertically while keeping endpoints fixed", () => {
    const state = createAlignmentState();
    const adjusted = {
      ...state,
      selectedWidgetIds: ["alignD", "alignA", "alignB", "alignC"],
      project: {
        ...state.project,
        widgetsById: {
          ...state.project.widgetsById,
          alignD: { ...state.project.widgetsById.alignD, x: 0, y: 0, width: 20, height: 20 },
          alignA: { ...state.project.widgetsById.alignA, x: 0, y: 35, width: 20, height: 20 },
          alignB: { ...state.project.widgetsById.alignB, x: 0, y: 90, width: 20, height: 20 },
          alignC: { ...state.project.widgetsById.alignC, x: 0, y: 120, width: 20, height: 20 },
        },
      },
    };

    const next = reduceAlignment(adjusted, "distribute_v");

    expect(next.project.widgetsById.alignD.y).toBe(0);
    expect(next.project.widgetsById.alignA.y).toBe(40);
    expect(next.project.widgetsById.alignB.y).toBe(80);
    expect(next.project.widgetsById.alignC.y).toBe(120);
  });

  it("does not distribute when fewer than three widgets are selected", () => {
    const state = {
      ...createAlignmentState(),
      selectedWidgetIds: ["alignA", "alignB"],
    };

    const next = reduceAlignment(state, "distribute_h");

    expect(next).toBe(state);
  });

  it("writes alignment changes to history and supports undo/redo", () => {
    const aligned = reduceAlignment(createAlignmentState(), "align_left");

    expect(aligned.history.past).toHaveLength(1);
    expect(aligned.project.widgetsById.alignB.x).toBe(10);

    const undone = editorReducer(aligned, { type: "undo" });
    expect(undone.project.widgetsById.alignB.x).toBe(70);

    const redone = editorReducer(undone, { type: "redo" });
    expect(redone.project.widgetsById.alignB.x).toBe(10);
  });

  it("distributes across different parents using absolute coordinates", () => {
    const state = createAlignmentState();
    const crossParentState: EditorState = {
      ...state,
      selectedWidgetIds: ["alignD", "TempLabel", "Button1"],
      project: {
        ...state.project,
        widgetsById: {
          ...state.project.widgetsById,
          alignD: { ...state.project.widgetsById.alignD, parentId: "Container1", x: 0, y: 0, width: 20, height: 20 },
          Container1: {
            ...state.project.widgetsById.Container1,
            childrenIds: [...state.project.widgetsById.Container1.childrenIds, "alignD"],
          },
          TempLabel: { ...state.project.widgetsById.TempLabel, x: 36, y: 34, width: 20, height: 20 },
          Button1: { ...state.project.widgetsById.Button1, x: 250, y: 88, width: 20, height: 20 },
        },
      },
    };

    const next = reduceAlignment(crossParentState, "distribute_h");

    const alignDAbsX = 24 + next.project.widgetsById.alignD.x;
    const tempAbsX = 24 + 20 + next.project.widgetsById.TempLabel.x;
    const buttonAbsX = 24 + 20 + next.project.widgetsById.Button1.x;

    expect(alignDAbsX).toBe(24);
    expect(tempAbsX).toBe(159);
    expect(buttonAbsX).toBe(294);
  });

  it("ignores nested descendants when parent and child are selected together", () => {
    const state = createAlignmentState();
    const next = reduceAlignment(
      {
        ...state,
        selectedWidgetIds: ["Panel1", "Button1", "TempLabel"],
      },
      "align_left",
    );

    expect(next.project.widgetsById.Panel1.x).toBe(20);
    expect(next.project.widgetsById.Button1.x).toBe(250);
    expect(next.project.widgetsById.TempLabel.x).toBe(36);
  });
});

describe("batch multi-select operations", () => {
  it("batchUpdateWidgetProperty updates eligible widgets in one history step", () => {
    let state = createState();
    // Add a second button
    state = editorReducer(state, { type: "addWidget", parentId: "Panel1", widgetType: "Button", x: 10, y: 10 });
    const btn2Id = state.selectedWidgetIds[0];

    const before = state.history.past.length;
    const next = editorReducer(state, {
      type: "batchUpdateWidgetProperty",
      widgetIds: ["Button1", btn2Id],
      propertyName: "fill",
      value: "#ff0000",
    });

    expect(next.project.widgetsById.Button1.fill).toBe("#ff0000");
    expect(next.project.widgetsById[btn2Id].fill).toBe("#ff0000");
    // Exactly one history entry added
    expect(next.history.past.length).toBe(before + 1);
  });

  it("batchUpdateWidgetProperty skips widgets that don't support the property", () => {
    let state = createState();
    state = editorReducer(state, { type: "addWidget", parentId: "Panel1", widgetType: "Image", x: 10, y: 10 });
    const imageId = state.selectedWidgetIds[0];

    // Image does not support textColor
    const next = editorReducer(state, {
      type: "batchUpdateWidgetProperty",
      widgetIds: ["Button1", imageId],
      propertyName: "textColor",
      value: "#00ff00",
    });

    expect(next.project.widgetsById.Button1.textColor).toBe("#00ff00");
    expect(next.project.widgetsById[imageId].textColor).toBeUndefined();
  });

  it("batchUpdateWidgetProperty with empty widgetIds returns state unchanged", () => {
    const state = createState();
    const next = editorReducer(state, {
      type: "batchUpdateWidgetProperty",
      widgetIds: [],
      propertyName: "fill",
      value: "#ff0000",
    });
    expect(next).toBe(state);
  });

  it("batchUpsertWidgetEventBinding applies to all widgets in one history step", () => {
    let state = createState();
    state = editorReducer(state, { type: "addWidget", parentId: "Panel1", widgetType: "Button", x: 0, y: 0 });
    const btn2Id = state.selectedWidgetIds[0];

    const before = state.history.past.length;
    const binding = { event: "clicked" as const, action: { type: "switch_screen" as const, targetScreenId: "screen-1" } };
    const next = editorReducer(state, {
      type: "batchUpsertWidgetEventBinding",
      widgetIds: ["Button1", btn2Id],
      binding,
    });

    expect(next.project.widgetsById.Button1.eventBindings?.clicked?.action.type).toBe("switch_screen");
    expect(next.project.widgetsById[btn2Id].eventBindings?.clicked?.action.type).toBe("switch_screen");
    expect(next.history.past.length).toBe(before + 1);
  });

  it("batchRemoveWidgetEventBinding removes from all widgets in one history step", () => {
    let state = createState();
    state = editorReducer(state, { type: "addWidget", parentId: "Panel1", widgetType: "Button", x: 0, y: 0 });
    const btn2Id = state.selectedWidgetIds[0];

    const binding = { event: "clicked" as const, action: { type: "switch_screen" as const, targetScreenId: "screen-1" } };
    state = editorReducer(state, { type: "batchUpsertWidgetEventBinding", widgetIds: ["Button1", btn2Id], binding });

    const before = state.history.past.length;
    const next = editorReducer(state, {
      type: "batchRemoveWidgetEventBinding",
      widgetIds: ["Button1", btn2Id],
      event: "clicked",
    });

    expect(next.project.widgetsById.Button1.eventBindings?.clicked).toBeUndefined();
    expect(next.project.widgetsById[btn2Id].eventBindings?.clicked).toBeUndefined();
    expect(next.history.past.length).toBe(before + 1);
  });

  it("setSelection replaces selectedWidgetIds without creating history", () => {
    const state = createState();
    const before = state.history.past.length;
    const next = editorReducer(state, { type: "setSelection", widgetIds: ["Button1", "Panel1"] });
    expect(next.selectedWidgetIds).toEqual(["Button1", "Panel1"]);
    expect(next.history.past.length).toBe(before);
  });
});

describe("canvas snap settings", () => {
  it("setCanvasSnapSettings updates pixelSnapEnabled and writes to history", () => {
    const state = createState();
    const before = state.history.past.length;
    const next = editorReducer(state, { type: "setCanvasSnapSettings", settings: { pixelSnapEnabled: true } });
    expect(next.project.canvasSnap?.pixelSnapEnabled).toBe(true);
    expect(next.project.canvasSnap?.magnetSnapEnabled).toBe(state.project.canvasSnap?.magnetSnapEnabled);
    expect(next.history.past.length).toBe(before + 1);
  });

  it("setCanvasSnapSettings updates magnetSnapEnabled and writes to history", () => {
    const state = createState();
    const before = state.history.past.length;
    const next = editorReducer(state, { type: "setCanvasSnapSettings", settings: { magnetSnapEnabled: false } });
    expect(next.project.canvasSnap?.magnetSnapEnabled).toBe(false);
    expect(next.history.past.length).toBe(before + 1);
  });

  it("setCanvasSnapSettings allows undo/redo", () => {
    const state = createState();
    const toggled = editorReducer(state, { type: "setCanvasSnapSettings", settings: { pixelSnapEnabled: true } });
    expect(toggled.project.canvasSnap?.pixelSnapEnabled).toBe(true);

    const undone = editorReducer(toggled, { type: "undo" });
    expect(undone.project.canvasSnap?.pixelSnapEnabled).toBe(false);

    const redone = editorReducer(undone, { type: "redo" });
    expect(redone.project.canvasSnap?.pixelSnapEnabled).toBe(true);
  });

  it("setCanvasSnapSettings preserves unset fields from current snap state", () => {
    const state = createState();
    const next = editorReducer(state, { type: "setCanvasSnapSettings", settings: { snapThresholdPx: 10 } });
    expect(next.project.canvasSnap?.snapThresholdPx).toBe(10);
    expect(next.project.canvasSnap?.pixelSnapEnabled).toBe(state.project.canvasSnap?.pixelSnapEnabled);
    expect(next.project.canvasSnap?.magnetSnapEnabled).toBe(state.project.canvasSnap?.magnetSnapEnabled);
  });
});

describe("pasteClipboardSubtrees", () => {
  it("pastes a single node preserving style fields and dimensions without ID conflict", () => {
    const state = createState();
    const btn = state.project.widgetsById.Button1;
    expect(btn).toBeDefined();

    const payload = packClipboard(state.project, ["Button1"]);
    expect(payload).not.toBeNull();

    const next = editorReducer(state, {
      type: "pasteClipboardSubtrees",
      payload: payload!,
      targetParentId: state.project.screens[0].rootNodeId,
    });

    const pastedId = next.selectedWidgetIds[0];
    expect(pastedId).toBeDefined();
    expect(pastedId).not.toBe("Button1");
    expect(Object.keys(next.project.widgetsById)).not.toContain("Button1" === pastedId ? "conflict" : "no-conflict");

    const pasted = next.project.widgetsById[pastedId];
    expect(pasted.type).toBe(btn.type);
    expect(pasted.width).toBe(btn.width);
    expect(pasted.height).toBe(btn.height);
    expect(pasted.fill).toBe(btn.fill);
    expect(pasted.text).toBe(btn.text);
    expect(next.project.widgetsById.Button1).toBeDefined();
  });

  it("pastes a container subtree preserving parent/children relationships", () => {
    const state = createState();
    const container = state.project.widgetsById.Container1;
    expect(container).toBeDefined();
    expect(container.childrenIds.length).toBeGreaterThan(0);

    const subtreeIds = ["Container1", ...container.childrenIds];
    const payload = packClipboard(state.project, subtreeIds);
    expect(payload).not.toBeNull();

    const next = editorReducer(state, {
      type: "pasteClipboardSubtrees",
      payload: payload!,
      targetParentId: state.project.screens[0].rootNodeId,
    });

    const pastedRootId = next.selectedWidgetIds[0];
    const pastedRoot = next.project.widgetsById[pastedRootId];
    expect(pastedRoot).toBeDefined();
    expect(pastedRoot.type).toBe("Container");
    expect(pastedRoot.childrenIds.length).toBe(container.childrenIds.length);

    for (const childId of pastedRoot.childrenIds) {
      const child = next.project.widgetsById[childId];
      expect(child).toBeDefined();
      expect(child.parentId).toBe(pastedRootId);
    }

    expect(next.project.widgetsById.Container1).toBeDefined();
  });

  it("consecutive pastes place each copy at the original absolute coordinates without offset", () => {
    const state = createState();
    const payload = packClipboard(state.project, ["Button1"]);
    expect(payload).not.toBeNull();

    const after1 = editorReducer(state, {
      type: "pasteClipboardSubtrees",
      payload: payload!,
      targetParentId: state.project.screens[0].rootNodeId,
    });
    const id1 = after1.selectedWidgetIds[0];

    const after2 = editorReducer(after1, {
      type: "pasteClipboardSubtrees",
      payload: payload!,
      targetParentId: state.project.screens[0].rootNodeId,
    });
    const id2 = after2.selectedWidgetIds[0];

    expect(id1).not.toBe(id2);
    const copy1 = after1.project.widgetsById[id1];
    const copy2 = after2.project.widgetsById[id2];
    expect(copy1.x).toBe(copy2.x);
    expect(copy1.y).toBe(copy2.y);
  });

  it("cross-screen paste: root node coordinates match original absolute coords from source screen", () => {
    let state = createState();
    const sourceScreen = state.project.screens[0];

    const btn = state.project.widgetsById.Button1;
    const payload = packClipboard(state.project, ["Button1"]);
    expect(payload).not.toBeNull();
    const sourceRoot = payload!.roots[0];
    const sourceAbsX = sourceRoot.absX;
    const sourceAbsY = sourceRoot.absY;

    state = editorReducer(state, { type: "createScreen" });
    const targetScreenId = state.project.activeScreenId;
    expect(targetScreenId).not.toBe(sourceScreen.id);

    const targetRootId = state.project.screens.find((s) => s.id === targetScreenId)!.rootNodeId;
    const next = editorReducer(state, {
      type: "pasteClipboardSubtrees",
      payload: payload!,
      targetParentId: targetRootId,
    });

    const pastedId = next.selectedWidgetIds[0];
    const pasted = next.project.widgetsById[pastedId];
    expect(pasted).toBeDefined();
    expect(pasted.parentId).toBe(targetRootId);
    expect(pasted.x).toBe(sourceAbsX);
    expect(pasted.y).toBe(sourceAbsY);
    expect(pasted.type).toBe(btn.type);
  });

  it("paste writes to history and supports undo", () => {
    const state = createState();
    const payload = packClipboard(state.project, ["Button1"]);
    expect(payload).not.toBeNull();

    const pasted = editorReducer(state, {
      type: "pasteClipboardSubtrees",
      payload: payload!,
      targetParentId: state.project.screens[0].rootNodeId,
    });

    const pastedId = pasted.selectedWidgetIds[0];
    expect(pasted.history.past.length).toBe(state.history.past.length + 1);
    expect(pasted.project.widgetsById[pastedId]).toBeDefined();

    const undone = editorReducer(pasted, { type: "undo" });
    expect(undone.project.widgetsById[pastedId]).toBeUndefined();
  });
});

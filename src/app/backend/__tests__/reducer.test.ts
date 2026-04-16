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

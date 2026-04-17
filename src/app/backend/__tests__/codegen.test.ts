import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { createInitialProject } from "../validation";
import { generateLvglFiles, generateLvglZip } from "../codegen/generator";
import { projectToLvglIR } from "../codegen/ir";
import { generateAssetCSource } from "../codegen/imageEncoder";

describe("Demo5 LVGL codegen", () => {
  it("generates deterministic IR for same project", () => {
    const project = createInitialProject();
    const first = projectToLvglIR(project);
    const second = projectToLvglIR(project);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("generates ui.c using LVGL v9 APIs", () => {
    const project = createInitialProject();
    project.assets["asset-logo"] = {
      id: "asset-logo",
      name: "logo.gif",
      mimeType: "image/gif",
      dataUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
    };
    project.widgetsById.Panel1.childrenIds.push("Image1");
    project.widgetsById.Image1 = {
      id: "Image1",
      name: "Image1",
      type: "Image",
      parentId: "Panel1",
      childrenIds: [],
      x: 24,
      y: 24,
      width: 32,
      height: 32,
      assetId: "asset-logo",
      visible: true,
    };

    const files = generateLvglFiles(project);

    expect(files["ui.c"]).toContain("lv_button_create(");
    expect(files["ui.c"]).toContain("lv_image_create(");
    expect(files["ui.c"]).toContain("lv_image_set_src(");
    expect(files["ui.c"]).toContain("UI_ASSET_LOGO");
    expect(files["ui.c"]).toContain("lv_screen_load(");
    expect(files["ui.h"]).toContain("#define UI_ASSET_LOGO");
    expect(files["assets/manifest.c"]).toContain("logo.gif");
    expect(files["assets/manifest.c"]).toContain("asset_logo.c");

    // ui.h must not hardcode LV_COLOR_DEPTH or include lvgl.h directly
    expect(files["ui.h"]).not.toContain("LV_COLOR_DEPTH");
    expect(files["ui.h"]).not.toContain('#include "lvgl.h"');
    expect(files["ui.h"]).toContain('#include "ui_port.h"');

    // lv_image_set_size_mode must not appear in default output
    expect(files["ui.c"]).not.toContain("lv_image_set_size_mode(");

    expect(files["ui.c"]).not.toContain("lv_btn_create(");
    expect(files["ui.c"]).not.toContain("lv_img_create(");
    expect(files["ui.c"]).not.toContain("lv_scr_load(");
  });

  it("packages ui files into zip archive", async () => {
    const project = createInitialProject();
    project.assets["asset-demo"] = {
      id: "asset-demo",
      name: "demo.gif",
      mimeType: "image/gif",
      dataUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
    };
    const blob = await generateLvglZip(project);
    const zip = await JSZip.loadAsync(blob);

    expect(Object.keys(zip.files)).toEqual(
      expect.arrayContaining([
        "ui_port.h",
        "ui.h",
        "ui.c",
        "ui_events.c",
        "assets/manifest.c",
        "assets/demo.gif",
        "assets/asset_demo.c",  // generated C pixel array
      ]),
    );
  });

  it("emits token macros and references them in generated C", () => {
    const project = createInitialProject();
    const tokenId = project.styleTokens[0].id;
    project.widgetsById.Button1.fillTokenId = tokenId;
    project.widgetsById.Button1.fill = undefined;

    const files = generateLvglFiles(project);

    expect(files["ui.h"]).toContain("#define SC_TOKEN_PRIMARY");
    expect(files["ui.c"]).toContain("lv_obj_set_style_bg_color");
    expect(files["ui.c"]).toContain("SC_TOKEN_PRIMARY");
  });

  it("emits lv_slider_create and LV_PART_INDICATOR for Slider widget", () => {
    const project = createInitialProject();
    project.widgetsById.Panel1.childrenIds.push("Slider1");
    project.widgetsById.Slider1 = {
      id: "Slider1",
      name: "Slider1",
      type: "Slider",
      parentId: "Panel1",
      childrenIds: [],
      x: 20,
      y: 100,
      width: 200,
      height: 32,
      fill: "#3b82f6",
      visible: true,
    };

    const files = generateLvglFiles(project);

    expect(files["ui.c"]).toContain("lv_slider_create(");
    expect(files["ui.c"]).toContain("lv_slider_set_value(");
    expect(files["ui.c"]).toContain("LV_PART_INDICATOR");
    expect(files["ui.h"]).toContain("lv_obj_t *");
  });

  it("emits value_changed event registration for Slider", () => {
    const project = createInitialProject();
    const secondScreen = project.screens[0];
    project.widgetsById.Panel1.childrenIds.push("Slider2");
    project.widgetsById.Slider2 = {
      id: "Slider2",
      name: "Slider2",
      type: "Slider",
      parentId: "Panel1",
      childrenIds: [],
      x: 20,
      y: 100,
      width: 200,
      height: 32,
      fill: "#3b82f6",
      visible: true,
      eventBindings: {
        value_changed: {
          event: "value_changed",
          action: {
            type: "switch_screen",
            targetScreenId: secondScreen.id,
          },
        },
      },
    };

    const files = generateLvglFiles(project);

    expect(files["ui_events.c"]).toContain("LV_EVENT_VALUE_CHANGED");
    expect(files["ui_events.c"]).toContain("lv_obj_add_event_cb(");
  });

  it("emits lv_switch_create and LV_STATE_CHECKED for Switch widget", () => {
    const project = createInitialProject();
    project.widgetsById.Panel1.childrenIds.push("Switch1");
    project.widgetsById.Switch1 = {
      id: "Switch1",
      name: "Switch1",
      type: "Switch",
      parentId: "Panel1",
      childrenIds: [],
      x: 20,
      y: 110,
      width: 60,
      height: 32,
      fill: "#22c55e",
      visible: true,
    };

    const files = generateLvglFiles(project);

    expect(files["ui.c"]).toContain("lv_switch_create(");
    expect(files["ui.c"]).toContain("LV_STATE_CHECKED");
    expect(files["ui.c"]).toContain("LV_PART_INDICATOR");
    expect(files["ui.h"]).toContain("lv_obj_t *");
  });

  it("emits value_changed event registration for Switch", () => {
    const project = createInitialProject();
    const screen = project.screens[0];
    project.widgetsById.Panel1.childrenIds.push("Switch2");
    project.widgetsById.Switch2 = {
      id: "Switch2",
      name: "Switch2",
      type: "Switch",
      parentId: "Panel1",
      childrenIds: [],
      x: 20,
      y: 110,
      width: 60,
      height: 32,
      fill: "#22c55e",
      visible: true,
      eventBindings: {
        value_changed: {
          event: "value_changed",
          action: {
            type: "switch_screen",
            targetScreenId: screen.id,
          },
        },
      },
    };

    const files = generateLvglFiles(project);

    expect(files["ui_events.c"]).toContain("LV_EVENT_VALUE_CHANGED");
    expect(files["ui_events.c"]).toContain("lv_obj_add_event_cb(");
  });

  it("emits lv_checkbox_create and LV_PART_INDICATOR for Checkbox", () => {
    const project = createInitialProject();
    project.widgetsById.Panel1.childrenIds.push("Cb1");
    project.widgetsById.Cb1 = {
      id: "Cb1", name: "Cb1", type: "Checkbox", parentId: "Panel1", childrenIds: [],
      x: 10, y: 10, width: 160, height: 32, text: "Agree", fill: "#3b82f6", checked: true, visible: true,
    };
    const files = generateLvglFiles(project);
    expect(files["ui.c"]).toContain("lv_checkbox_create(");
    expect(files["ui.c"]).toContain('lv_checkbox_set_text(');
    expect(files["ui.c"]).toContain("LV_PART_INDICATOR | LV_STATE_CHECKED");
    expect(files["ui.c"]).toContain("lv_obj_add_state(");
  });

  it("emits lv_checkbox_create with LV_RADIUS_CIRCLE for Radio", () => {
    const project = createInitialProject();
    project.widgetsById.Panel1.childrenIds.push("Rb1");
    project.widgetsById.Rb1 = {
      id: "Rb1", name: "Rb1", type: "Radio", parentId: "Panel1", childrenIds: [],
      x: 10, y: 10, width: 160, height: 32, text: "Choice A", fill: "#3b82f6", visible: true,
    };
    const files = generateLvglFiles(project);
    expect(files["ui.c"]).toContain("lv_checkbox_create(");
    expect(files["ui.c"]).toContain("LV_RADIUS_CIRCLE");
  });

  it("emits lv_dropdown_create and lv_dropdown_set_options for Dropdown", () => {
    const project = createInitialProject();
    project.widgetsById.Panel1.childrenIds.push("Dd1");
    project.widgetsById.Dd1 = {
      id: "Dd1", name: "Dd1", type: "Dropdown", parentId: "Panel1", childrenIds: [],
      x: 10, y: 10, width: 160, height: 40,
      text: "Option 1\nOption 2\nOption 3", fill: "#374151", visible: true,
    };
    const files = generateLvglFiles(project);
    expect(files["ui.c"]).toContain("lv_dropdown_create(");
    expect(files["ui.c"]).toContain("lv_dropdown_set_options(");
    expect(files["ui.c"]).toContain("Option 1");
  });

  it("emits callback stubs and event registrations for bindings", () => {
    const project = createInitialProject();
    project.widgetsById.Button1.eventBindings = {
      clicked: {
        event: "clicked",
        action: {
          type: "switch_screen",
          targetScreenId: "screen-1",
        },
      },
      pressed: {
        event: "pressed",
        action: {
          type: "toggle_visibility",
          targetWidgetId: "TempLabel",
        },
      },
    };

    const ir = projectToLvglIR(project);
    const targetWidget = ir.screens
      .flatMap((screen) => screen.widgets)
      .find((widget) => widget.id === "TempLabel");

    const files = generateLvglFiles(project);

    expect(files["ui_events.c"]).toContain("void ui_events_init(void)");
    expect(files["ui_events.c"]).toContain("sc_event_cb_");
    expect(files["ui_events.c"]).toContain("LV_EVENT_CLICKED");
    expect(files["ui_events.c"]).toContain("LV_EVENT_PRESSED");
    expect(files["ui_events.c"]).toContain("lv_screen_load");
    expect(files["ui_events.c"]).toContain("LV_OBJ_FLAG_HIDDEN");
    expect(targetWidget).toBeDefined();
    expect(files["ui_events.c"]).toContain(`.target_widget = &${targetWidget?.cName},`);
    expect(files["ui_events.c"]).not.toContain(".target_widget = &TempLabel,");
    expect(files["ui.c"]).toContain("ui_events_init();");
  });

  it("emits explicit pos/size for non-square image widget and omits lv_image_set_size_mode", () => {
    const project = createInitialProject();
    project.assets["asset-banner"] = {
      id: "asset-banner",
      name: "banner.png",
      mimeType: "image/png",
      dataUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
    };
    project.widgetsById.Panel1.childrenIds.push("Banner1");
    project.widgetsById.Banner1 = {
      id: "Banner1",
      name: "Banner1",
      type: "Image",
      parentId: "Panel1",
      childrenIds: [],
      x: 10,
      y: 20,
      width: 200,   // deliberately non-square …
      height: 60,   // … to verify stretch is explicit, not implicit
      assetId: "asset-banner",
      visible: true,
    };

    const files = generateLvglFiles(project);
    const ir = projectToLvglIR(project);

    // Asset IR should carry target dimensions matching the widget
    const assetIR = ir.assets.find((a) => a.id === "asset-banner");
    expect(assetIR?.targetWidth).toBe(200);
    expect(assetIR?.targetHeight).toBe(60);

    // Generated code must set position and exact size …
    expect(files["ui.c"]).toContain("lv_obj_set_pos(");
    expect(files["ui.c"]).toContain("lv_obj_set_size(");
    // … and must NOT inject lv_image_set_size_mode (incompatible with some LVGL 9 host versions)
    expect(files["ui.c"]).not.toContain("lv_image_set_size_mode(");
    // Explicit numeric dimensions must appear in the output
    expect(files["ui.c"]).toContain("200");
    expect(files["ui.c"]).toContain("60");
  });

  it("generateAssetCSource emits compilable stub when canvas unavailable", async () => {
    const asset = {
      id:         "asset-logo",
      name:       "logo.gif",
      mimeType:   "image/gif",
      symbolName: "asset_logo",
      macroName:  "UI_ASSET_LOGO",
      dataUrl:    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
    };

    const src = await generateAssetCSource(asset, "rgb888");

    // Must be valid C that at minimum declares the descriptor
    expect(src).toContain(`const lv_image_dsc_t ${asset.symbolName}`);
    expect(src).toContain(`${asset.symbolName}_map`);
    expect(src).toContain("LV_COLOR_FORMAT_RGB888");
    // Asset files must not directly include lvgl.h — ui.h (via ui_port.h) covers it
    expect(src).not.toContain(`#include "lvgl.h"`);
    expect(src).toContain(`#include "ui.h"`);
  });

  it("generateAssetCSource emits monochrome stub with I1 format", async () => {
    const asset = {
      id:         "asset-icon",
      name:       "icon.png",
      mimeType:   "image/png",
      symbolName: "asset_icon",
      macroName:  "UI_ASSET_ICON",
      dataUrl:    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
    };

    const src = await generateAssetCSource(asset, "monochrome");
    expect(src).toContain("LV_COLOR_FORMAT_I1");
    expect(src).toContain(`const lv_image_dsc_t ${asset.symbolName}`);
  });
});

import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { createInitialProject } from "../validation";
import { generateLvglFiles, generateLvglZip } from "../codegen/generator";
import { projectToLvglIR } from "../codegen/ir";

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

    expect(Object.keys(zip.files)).toEqual(expect.arrayContaining(["ui.h", "ui.c", "ui_events.c", "assets/manifest.c", "assets/demo.gif"]));
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
});

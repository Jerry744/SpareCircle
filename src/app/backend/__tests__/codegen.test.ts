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
      visible: true,
    };

    const files = generateLvglFiles(project);

    expect(files["ui.c"]).toContain("lv_button_create(");
    expect(files["ui.c"]).toContain("lv_image_create(");
    expect(files["ui.c"]).toContain("lv_screen_load(");

    expect(files["ui.c"]).not.toContain("lv_btn_create(");
    expect(files["ui.c"]).not.toContain("lv_img_create(");
    expect(files["ui.c"]).not.toContain("lv_scr_load(");
  });

  it("packages ui files into zip archive", async () => {
    const project = createInitialProject();
    const blob = await generateLvglZip(project);
    const zip = await JSZip.loadAsync(blob);

    expect(Object.keys(zip.files)).toEqual(expect.arrayContaining(["ui.h", "ui.c", "ui_events.c"]));
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
});

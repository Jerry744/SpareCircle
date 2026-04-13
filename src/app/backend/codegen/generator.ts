import JSZip from "jszip";
import type { ProjectSnapshot } from "../types";
import { projectToLvglIR, type LvglProjectIR } from "./ir";
import { emitWidget } from "./emitters";

function sanitizeScreenComment(name: string): string {
  return name.replace(/[\r\n]+/g, " ").trim() || "Screen";
}

export function generateUiHeader(ir: LvglProjectIR): string {
  const lines: string[] = [
    "#ifndef UI_H",
    "#define UI_H",
    "",
    "#ifdef __cplusplus",
    "extern \"C\" {",
    "#endif",
    "",
    "#include \"lvgl.h\"",
    "",
  ];

  for (const tokenMacro of ir.styleTokenMacros) {
    lines.push(`#define ${tokenMacro.name} ${tokenMacro.expression}`);
  }

  if (ir.styleTokenMacros.length > 0) {
    lines.push("");
  }

  for (const screen of ir.screens) {
    lines.push(`extern lv_obj_t *${screen.cName};`);
    for (const widget of screen.widgets) {
      lines.push(`extern lv_obj_t *${widget.cName};`);
    }
    lines.push("");
  }

  lines.push("void ui_init(void);");
  lines.push("");
  lines.push("#ifdef __cplusplus");
  lines.push("}");
  lines.push("#endif");
  lines.push("");
  lines.push("#endif /* UI_H */");

  return lines.join("\n");
}

export function generateUiSource(ir: LvglProjectIR): string {
  const lines: string[] = [
    "#include \"ui.h\"",
    "",
  ];

  for (const screen of ir.screens) {
    lines.push(`lv_obj_t *${screen.cName};`);
    for (const widget of screen.widgets) {
      lines.push(`lv_obj_t *${widget.cName};`);
    }
    lines.push("");
  }

  for (const screen of ir.screens) {
    lines.push(`static void ${screen.cName}_init(void) {`);
    lines.push("  // Create screen root object");
    lines.push(`  ${screen.cName} = lv_obj_create(NULL);`);
    lines.push(`  lv_obj_set_size(${screen.cName}, ${screen.width}, ${screen.height});`);
    lines.push(`  lv_obj_clear_flag(${screen.cName}, LV_OBJ_FLAG_SCROLLABLE);`);
    if (screen.fill) {
      lines.push(`  lv_obj_set_style_bg_color(${screen.cName}, lv_color_hex(0x${screen.fill.slice(1)}), LV_PART_MAIN);`);
      lines.push(`  lv_obj_set_style_bg_opa(${screen.cName}, LV_OPA_COVER, LV_PART_MAIN);`);
    }

    for (const widget of screen.widgets) {
      lines.push("");
      lines.push(`  // ${sanitizeScreenComment(widget.id)} (${widget.kind})`);
      lines.push(emitWidget(widget));
    }

    lines.push("}");
    lines.push("");
  }

  lines.push("void ui_init(void) {");
  for (const screen of ir.screens) {
    lines.push(`  ${screen.cName}_init();`);
  }

  if (ir.screens.length > 0) {
    lines.push(`  lv_screen_load(${ir.activeScreenCName});`);
  }

  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

export function generateUiEventsSource(): string {
  return [
    "#include \"ui.h\"",
    "",
    "// Demo5 minimal export: event stubs are intentionally left empty.",
    "",
  ].join("\n");
}

export function generateLvglFiles(project: ProjectSnapshot): Record<string, string> {
  const ir = projectToLvglIR(project);

  return {
    "ui.h": generateUiHeader(ir),
    "ui.c": generateUiSource(ir),
    "ui_events.c": generateUiEventsSource(),
  };
}

export async function generateLvglZip(project: ProjectSnapshot): Promise<Blob> {
  const files = generateLvglFiles(project);
  const zip = new JSZip();

  for (const [filename, content] of Object.entries(files)) {
    zip.file(filename, content);
  }

  return zip.generateAsync({ type: "blob" });
}

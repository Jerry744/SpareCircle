import JSZip from "jszip";
import type { ColorFormat, ProjectSnapshot } from "../types";
import { hexToColorExpression, projectToLvglIR, type LvglProjectIR } from "./ir";
import { emitWidget } from "./emitters";

function sanitizeScreenComment(name: string): string {
  return name.replace(/[\r\n]+/g, " ").trim() || "Screen";
}

function colorDepthValue(format: ColorFormat): number {
  switch (format) {
    case "monochrome": return 1;
    case "grayscale8": return 8;
    case "rgb565": return 16;
    case "rgb888": return 24;
    case "argb8888": return 32;
  }
}

function assetExtensionFromMimeType(mimeType: string): string {
  if (mimeType === "image/png") {
    return "png";
  }
  if (mimeType === "image/jpeg") {
    return "jpg";
  }
  if (mimeType === "image/gif") {
    return "gif";
  }
  return "bin";
}

function decodeDataUrl(dataUrl: string): Uint8Array {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) {
    return new Uint8Array();
  }

  const base64 = dataUrl.slice(commaIndex + 1);
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }

  return bytes;
}

export function generateAssetManifestSource(ir: LvglProjectIR): string {
  const lines: string[] = [
    "#include \"lvgl.h\"",
    "#include \"ui.h\"",
    "",
  ];

  if (ir.assets.length === 0) {
    lines.push("// No image assets were exported.");
    lines.push("");
    return lines.join("\n");
  }

  for (const asset of ir.assets) {
    lines.push(`// ${asset.name} (${asset.mimeType})`);
    lines.push(`const lv_image_dsc_t ${asset.symbolName} = {0};`);
    lines.push("");
  }

  return lines.join("\n");
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
    `/* Color depth: ${colorDepthValue(ir.colorFormat)}-bit (${ir.colorFormat}) */`,
    `#define LV_COLOR_DEPTH ${colorDepthValue(ir.colorFormat)}`,
    "",
    "#include \"lvgl.h\"",
    "",
  ];

  for (const tokenMacro of ir.styleTokenMacros) {
    lines.push(`#define ${tokenMacro.name} ${tokenMacro.expression}`);
  }

  for (const asset of ir.assets) {
    lines.push(`extern const lv_image_dsc_t ${asset.symbolName};`);
    lines.push(`#define ${asset.macroName} (&${asset.symbolName})`);
  }

  if (ir.styleTokenMacros.length > 0 || ir.assets.length > 0) {
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
  lines.push("void ui_events_init(void);");
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
    "void ui_events_init(void);",
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
      lines.push(`  lv_obj_set_style_bg_color(${screen.cName}, ${hexToColorExpression(screen.fill, ir.colorFormat)}, LV_PART_MAIN);`);
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

  lines.push("  ui_events_init();");

  if (ir.screens.length > 0) {
    lines.push(`  lv_screen_load(${ir.activeScreenCName});`);
  }

  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

function mapEventToLvglMacro(event: string): string {
  switch (event) {
    case "clicked":
      return "LV_EVENT_CLICKED";
    case "pressed":
      return "LV_EVENT_PRESSED";
    case "value_changed":
      return "LV_EVENT_VALUE_CHANGED";
    default:
      return "LV_EVENT_ALL";
  }
}

export function generateUiEventsSource(ir: LvglProjectIR): string {
  const lines: string[] = [
    "#include \"ui.h\"",
    "",
    "typedef enum {",
    "  SC_EVENT_ACTION_NONE = 0,",
    "  SC_EVENT_ACTION_SWITCH_SCREEN,",
    "  SC_EVENT_ACTION_TOGGLE_VISIBILITY,",
    "} sc_event_action_type_t;",
    "",
    "typedef struct {",
    "  sc_event_action_type_t type;",
    "  lv_obj_t **target_widget;",
    "  lv_obj_t **target_screen;",
    "} sc_event_action_t;",
    "",
    "static void sc_apply_event_action(const sc_event_action_t *action) {",
    "  if (action == NULL) {",
    "    return;",
    "  }",
    "",
    "  switch (action->type) {",
    "    case SC_EVENT_ACTION_SWITCH_SCREEN:",
    "      if (action->target_screen != NULL && *action->target_screen != NULL) {",
    "        lv_screen_load(*action->target_screen);",
    "      }",
    "      break;",
    "    case SC_EVENT_ACTION_TOGGLE_VISIBILITY:",
    "      if (action->target_widget != NULL && *action->target_widget != NULL) {",
    "        if (lv_obj_has_flag(*action->target_widget, LV_OBJ_FLAG_HIDDEN)) {",
    "          lv_obj_clear_flag(*action->target_widget, LV_OBJ_FLAG_HIDDEN);",
    "        } else {",
    "          lv_obj_add_flag(*action->target_widget, LV_OBJ_FLAG_HIDDEN);",
    "        }",
    "      }",
    "      break;",
    "    default:",
    "      break;",
    "  }",
    "}",
    "",
    "static void sc_event_cb(lv_event_t *event) {",
    "  const sc_event_action_t *action = (const sc_event_action_t *)lv_event_get_user_data(event);",
    "  sc_apply_event_action(action);",
    "}",
    "",
  ];

  const actionObjects: string[] = [];
  const registrationLines: string[] = ["void ui_events_init(void) {"];
  const widgetCNameById = new Map<string, string>();

  for (const screen of ir.screens) {
    for (const widget of screen.widgets) {
      widgetCNameById.set(widget.id, widget.cName);
    }
  }

  for (const screen of ir.screens) {
    for (const widget of screen.widgets) {
      const bindings = widget.eventBindings;
      if (!bindings) {
        continue;
      }

      for (const event of Object.keys(bindings)) {
        const binding = bindings[event as keyof typeof bindings];
        if (!binding) {
          continue;
        }

        const actionName = `sc_action_${screen.cName}_${widget.cName}_${event}`;
        const callbackName = `sc_event_cb_${screen.cName}_${widget.cName}_${event}`;
        if (binding.action.type === "switch_screen") {
          const targetScreenId = binding.action.targetScreenId;
          const targetScreen = ir.screens.find((candidate) => candidate.id === targetScreenId);
          const targetName = targetScreen?.cName ?? ir.activeScreenCName;
          actionObjects.push(`static const sc_event_action_t ${actionName} = {`);
          actionObjects.push(`  .type = SC_EVENT_ACTION_SWITCH_SCREEN,`);
          actionObjects.push(`  .target_screen = &${targetName},`);
          actionObjects.push("};");
        } else {
          const targetWidgetId = binding.action.targetWidgetId;
          const targetWidgetCName = widgetCNameById.get(targetWidgetId);
          actionObjects.push(`static const sc_event_action_t ${actionName} = {`);
          actionObjects.push(`  .type = SC_EVENT_ACTION_TOGGLE_VISIBILITY,`);
          actionObjects.push(`  .target_widget = ${targetWidgetCName ? `&${targetWidgetCName}` : "NULL"},`);
          actionObjects.push("};");
        }

        actionObjects.push(`static void ${callbackName}(lv_event_t *event) { sc_event_cb(event); }`);
        registrationLines.push(`  lv_obj_add_event_cb(${widget.cName}, ${callbackName}, ${mapEventToLvglMacro(event)}, (void *)&${actionName});`);
      }
    }
  }

  if (actionObjects.length > 0) {
    lines.push(...actionObjects, "");
  }

  registrationLines.push("}", "");
  lines.push(...registrationLines);

  if (actionObjects.length === 0) {
    return [
      "#include \"ui.h\"",
      "",
      "void ui_events_init(void) {",
      "  // No event bindings were exported for this project.",
      "}",
      "",
    ].join("\n");
  }

  return lines.join("\n");
}

export function generateLvglFiles(project: ProjectSnapshot): Record<string, string> {
  const ir = projectToLvglIR(project);

  return {
    "ui.h": generateUiHeader(ir),
    "ui.c": generateUiSource(ir),
    "ui_events.c": generateUiEventsSource(ir),
    "assets/manifest.c": generateAssetManifestSource(ir),
  };
}

export async function generateLvglZip(project: ProjectSnapshot): Promise<Blob> {
  const files = generateLvglFiles(project);
  const zip = new JSZip();

  for (const [filename, content] of Object.entries(files)) {
    zip.file(filename, content);
  }

  for (const asset of Object.values(project.assets)) {
    const extension = assetExtensionFromMimeType(asset.mimeType);
    const fileStem = asset.name.replace(/\.[^.]+$/, "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_") || "asset";
    zip.file(`assets/${fileStem}.${extension}`, decodeDataUrl(asset.dataUrl));
  }

  return zip.generateAsync({ type: "blob" });
}

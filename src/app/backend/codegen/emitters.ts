import type { LvglWidgetIR } from "./ir";

function emitCommonWidgetSetup(widget: LvglWidgetIR): string[] {
  const lines = [
    `  lv_obj_set_pos(${widget.cName}, ${widget.x}, ${widget.y});`,
    `  lv_obj_set_size(${widget.cName}, ${widget.width}, ${widget.height});`,
  ];

  if (widget.fillExpression) {
    lines.push(`  lv_obj_set_style_bg_color(${widget.cName}, ${widget.fillExpression}, LV_PART_MAIN);`);
    lines.push(`  lv_obj_set_style_bg_opa(${widget.cName}, LV_OPA_COVER, LV_PART_MAIN);`);
  }

  if (!widget.visible) {
    lines.push(`  lv_obj_add_flag(${widget.cName}, LV_OBJ_FLAG_HIDDEN);`);
  }

  return lines;
}

function escapeCString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\"/g, '\\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

export function emitContainer(widget: LvglWidgetIR): string {
  const lines = [
    `  ${widget.cName} = lv_obj_create(${widget.parentCName});`,
    "  lv_obj_clear_flag(" + widget.cName + ", LV_OBJ_FLAG_SCROLLABLE);",
    ...emitCommonWidgetSetup(widget),
  ];

  return lines.join("\n");
}

export function emitLabel(widget: LvglWidgetIR): string {
  const lines = [
    `  ${widget.cName} = lv_label_create(${widget.parentCName});`,
    `  lv_label_set_text(${widget.cName}, \"${escapeCString(widget.text || "Label")}\");`,
    ...emitCommonWidgetSetup(widget),
  ];

  if (widget.textColorExpression) {
    lines.push(`  lv_obj_set_style_text_color(${widget.cName}, ${widget.textColorExpression}, LV_PART_MAIN);`);
  }

  return lines.join("\n");
}

export function emitButton(widget: LvglWidgetIR): string {
  const labelName = `${widget.cName}_label`;
  const lines = [
    `  ${widget.cName} = lv_button_create(${widget.parentCName});`,
    "  lv_obj_clear_flag(" + widget.cName + ", LV_OBJ_FLAG_SCROLLABLE);",
    ...emitCommonWidgetSetup(widget),
    `  lv_obj_t *${labelName} = lv_label_create(${widget.cName});`,
    `  lv_label_set_text(${labelName}, \"${escapeCString(widget.text || "Button")}\");`,
    `  lv_obj_center(${labelName});`,
  ];

  if (widget.textColorExpression) {
    lines.push(`  lv_obj_set_style_text_color(${labelName}, ${widget.textColorExpression}, LV_PART_MAIN);`);
  }

  return lines.join("\n");
}

export function emitImage(widget: LvglWidgetIR): string {
  const lines = [
    `  ${widget.cName} = lv_image_create(${widget.parentCName});`,
    `  lv_image_set_src(${widget.cName}, ${widget.assetMacro ?? '""'});`,
    ...emitCommonWidgetSetup(widget),
  ];

  return lines.join("\n");
}

export function emitWidget(widget: LvglWidgetIR): string {
  switch (widget.kind) {
    case "container":
      return emitContainer(widget);
    case "label":
      return emitLabel(widget);
    case "button":
      return emitButton(widget);
    case "image":
      return emitImage(widget);
    default:
      return "";
  }
}

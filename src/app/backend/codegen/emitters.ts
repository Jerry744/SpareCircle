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
  ];

  if (widget.checked !== undefined) {
    lines.push(`  lv_obj_add_flag(${widget.cName}, LV_OBJ_FLAG_CHECKABLE);`);
    if (widget.checked === true) {
      lines.push(`  lv_obj_add_state(${widget.cName}, LV_STATE_CHECKED);`);
    }
  }

  lines.push(...emitCommonWidgetSetup(widget));
  lines.push(`  lv_obj_t *${labelName} = lv_label_create(${widget.cName});`);
  lines.push(`  lv_label_set_text(${labelName}, \"${escapeCString(widget.text || "Button")}\");`);
  lines.push(`  lv_obj_center(${labelName});`);

  if (widget.textColorExpression) {
    lines.push(`  lv_obj_set_style_text_color(${labelName}, ${widget.textColorExpression}, LV_PART_MAIN);`);
  }

  return lines.join("\n");
}

export function emitSlider(widget: LvglWidgetIR): string {
  const lines = [
    `  ${widget.cName} = lv_slider_create(${widget.parentCName});`,
    `  lv_slider_set_value(${widget.cName}, ${widget.value ?? 0}, LV_ANIM_OFF);`,
    `  lv_obj_set_pos(${widget.cName}, ${widget.x}, ${widget.y});`,
    `  lv_obj_set_size(${widget.cName}, ${widget.width}, ${widget.height});`,
  ];

  if (widget.fillExpression) {
    lines.push(`  lv_obj_set_style_bg_color(${widget.cName}, ${widget.fillExpression}, LV_PART_INDICATOR);`);
    lines.push(`  lv_obj_set_style_bg_opa(${widget.cName}, LV_OPA_COVER, LV_PART_INDICATOR);`);
  }

  if (!widget.visible) {
    lines.push(`  lv_obj_add_flag(${widget.cName}, LV_OBJ_FLAG_HIDDEN);`);
  }

  return lines.join("\n");
}

export function emitSwitch(widget: LvglWidgetIR): string {
  const lines = [
    `  ${widget.cName} = lv_switch_create(${widget.parentCName});`,
    ...(widget.checked === true ? [`  lv_obj_add_state(${widget.cName}, LV_STATE_CHECKED);`] : []),
    `  lv_obj_set_pos(${widget.cName}, ${widget.x}, ${widget.y});`,
    `  lv_obj_set_size(${widget.cName}, ${widget.width}, ${widget.height});`,
  ];

  if (widget.fillExpression) {
    lines.push(`  lv_obj_set_style_bg_color(${widget.cName}, ${widget.fillExpression}, LV_PART_INDICATOR | LV_STATE_CHECKED);`);
    lines.push(`  lv_obj_set_style_bg_opa(${widget.cName}, LV_OPA_COVER, LV_PART_INDICATOR | LV_STATE_CHECKED);`);
  }

  if (!widget.visible) {
    lines.push(`  lv_obj_add_flag(${widget.cName}, LV_OBJ_FLAG_HIDDEN);`);
  }

  return lines.join("\n");
}

export function emitCheckbox(widget: LvglWidgetIR): string {
  const lines = [
    `  ${widget.cName} = lv_checkbox_create(${widget.parentCName});`,
    `  lv_checkbox_set_text(${widget.cName}, "${escapeCString(widget.text || "Option")}");`,
    `  lv_obj_set_pos(${widget.cName}, ${widget.x}, ${widget.y});`,
    `  lv_obj_set_size(${widget.cName}, ${widget.width}, ${widget.height});`,
  ];

  if (widget.fillExpression) {
    lines.push(`  lv_obj_set_style_bg_color(${widget.cName}, ${widget.fillExpression}, LV_PART_INDICATOR | LV_STATE_CHECKED);`);
    lines.push(`  lv_obj_set_style_bg_opa(${widget.cName}, LV_OPA_COVER, LV_PART_INDICATOR | LV_STATE_CHECKED);`);
  }

  if (widget.checked === true) {
    lines.push(`  lv_obj_add_state(${widget.cName}, LV_STATE_CHECKED);`);
  }

  if (widget.textColorExpression) {
    lines.push(`  lv_obj_set_style_text_color(${widget.cName}, ${widget.textColorExpression}, LV_PART_MAIN);`);
  }

  if (!widget.visible) {
    lines.push(`  lv_obj_add_flag(${widget.cName}, LV_OBJ_FLAG_HIDDEN);`);
  }

  return lines.join("\n");
}

export function emitRadio(widget: LvglWidgetIR): string {
  const lines = [
    `  ${widget.cName} = lv_checkbox_create(${widget.parentCName});`,
    `  lv_checkbox_set_text(${widget.cName}, "${escapeCString(widget.text || "Option")}");`,
    `  lv_obj_set_pos(${widget.cName}, ${widget.x}, ${widget.y});`,
    `  lv_obj_set_size(${widget.cName}, ${widget.width}, ${widget.height});`,
    `  lv_obj_set_style_radius(${widget.cName}, LV_RADIUS_CIRCLE, LV_PART_INDICATOR);`,
    `  lv_obj_set_style_radius(${widget.cName}, LV_RADIUS_CIRCLE, LV_PART_INDICATOR | LV_STATE_CHECKED);`,
  ];

  if (widget.fillExpression) {
    lines.push(`  lv_obj_set_style_bg_color(${widget.cName}, ${widget.fillExpression}, LV_PART_INDICATOR | LV_STATE_CHECKED);`);
    lines.push(`  lv_obj_set_style_bg_opa(${widget.cName}, LV_OPA_COVER, LV_PART_INDICATOR | LV_STATE_CHECKED);`);
  }

  if (widget.checked === true) {
    lines.push(`  lv_obj_add_state(${widget.cName}, LV_STATE_CHECKED);`);
  }

  if (widget.textColorExpression) {
    lines.push(`  lv_obj_set_style_text_color(${widget.cName}, ${widget.textColorExpression}, LV_PART_MAIN);`);
  }

  if (!widget.visible) {
    lines.push(`  lv_obj_add_flag(${widget.cName}, LV_OBJ_FLAG_HIDDEN);`);
  }

  return lines.join("\n");
}

export function emitDropdown(widget: LvglWidgetIR): string {
  const optionsText = widget.options?.length
    ? widget.options.join("\\n")
    : (widget.text || "Option 1\\nOption 2\\nOption 3");
  const lines = [
    `  ${widget.cName} = lv_dropdown_create(${widget.parentCName});`,
    `  lv_dropdown_set_options(${widget.cName}, "${escapeCString(optionsText)}");`,
    `  lv_obj_set_pos(${widget.cName}, ${widget.x}, ${widget.y});`,
    `  lv_obj_set_size(${widget.cName}, ${widget.width}, ${widget.height});`,
  ];

  if (widget.selectedOptionIndex !== undefined && widget.selectedOptionIndex > 0) {
    lines.push(`  lv_dropdown_set_selected(${widget.cName}, ${widget.selectedOptionIndex});`);
  }

  if (widget.fillExpression) {
    lines.push(`  lv_obj_set_style_bg_color(${widget.cName}, ${widget.fillExpression}, LV_PART_MAIN);`);
    lines.push(`  lv_obj_set_style_bg_opa(${widget.cName}, LV_OPA_COVER, LV_PART_MAIN);`);
  }

  if (widget.textColorExpression) {
    lines.push(`  lv_obj_set_style_text_color(${widget.cName}, ${widget.textColorExpression}, LV_PART_MAIN);`);
  }

  if (!widget.visible) {
    lines.push(`  lv_obj_add_flag(${widget.cName}, LV_OBJ_FLAG_HIDDEN);`);
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
    case "slider":
      return emitSlider(widget);
    case "switch":
      return emitSwitch(widget);
    case "checkbox":
      return emitCheckbox(widget);
    case "radio":
      return emitRadio(widget);
    case "dropdown":
      return emitDropdown(widget);
    case "image":
      return emitImage(widget);
    default:
      return "";
  }
}

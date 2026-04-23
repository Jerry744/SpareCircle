export type StyleTokenType = "color";

export type ColorFormat = "monochrome" | "grayscale8" | "rgb565" | "rgb888" | "argb8888";

export interface StyleToken {
  id: string;
  name: string;
  type: StyleTokenType;
  value: string;
}

export type AlignmentOperation =
  | "align_left"
  | "align_right"
  | "align_top"
  | "align_bottom"
  | "align_h_center"
  | "align_v_center"
  | "distribute_h"
  | "distribute_v";

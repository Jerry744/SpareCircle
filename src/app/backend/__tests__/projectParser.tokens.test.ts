import { describe, expect, it } from "vitest";
import { createInitialProject } from "../validation";
import { createDefaultUserStyleTokens } from "../../constants/styleTokenPresets";
import { DESIGN_TOKENS, THEME_CONFIG } from "../../constants/designTokens";

describe("project token initialization", () => {
  it("initializes user style tokens from the user preset module", () => {
    const project = createInitialProject();

    expect(project.styleTokens).toEqual(createDefaultUserStyleTokens());
    expect(project.styleTokens).toHaveLength(8);
  });

  it("keeps platform theme tokens separate from persisted project tokens", () => {
    const project = createInitialProject();

    expect(project.styleTokens.some((token) => token.value === THEME_CONFIG.dark.accent)).toBe(false);
    expect(project.styleTokens.some((token) => token.value === DESIGN_TOKENS.neutral[900])).toBe(false);
    expect(project.styleTokens).not.toBe((DESIGN_TOKENS as unknown) as typeof project.styleTokens);
  });
});

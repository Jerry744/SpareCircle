import { describe, expect, it } from "vitest";
import {
  collectSnapGuides,
  snapMoveDelta,
  snapResizeDelta,
  applyPixelSnap,
  applyInteraction,
} from "../interaction";
import { createInitialProject } from "../validation";
import type { InteractionState, ProjectSnapshot } from "../types";

function makeProject(overrides?: Partial<ProjectSnapshot>): ProjectSnapshot {
  return {
    ...createInitialProject(),
    canvasSnap: { pixelSnapEnabled: false, magnetSnapEnabled: true, snapThresholdPx: 6 },
    ...overrides,
  };
}

// Project with a single sibling widget at known absolute position for guide testing
function makeSimpleProject(): ProjectSnapshot {
  const base = makeProject();
  // Button1 is inside Panel1 which is inside Container1 on screen-1-root
  // Panel1.x=20, Panel1.y=72 inside Container1 (x=24,y=24) inside screen root (x=0,y=0)
  // Button1 is at local (250, 88) inside Panel1
  // Absolute: 0+24+20+250 = 294, 0+24+72+88 = 184
  return base;
}

describe("collectSnapGuides", () => {
  it("includes canvas boundary and center guides", () => {
    const project = makeProject();
    const screen = project.screens[0];
    const { xGuides, yGuides } = collectSnapGuides(project, new Set(), screen.meta);

    expect(xGuides).toContain(0);
    expect(xGuides).toContain(screen.meta.width);
    expect(xGuides).toContain(screen.meta.width / 2);
    expect(yGuides).toContain(0);
    expect(yGuides).toContain(screen.meta.height);
    expect(yGuides).toContain(screen.meta.height / 2);
  });

  it("excludes dragged widgets from guides", () => {
    const project = makeProject();
    const { xGuides } = collectSnapGuides(project, new Set(["Button1"]), project.screens[0].meta);
    // Button1 absolute x is 294 (see comment above), shouldn't be in guides
    // We just check that excluding works (guides from excluded widget not present)
    // Exclude all non-screen widgets to get only canvas guides
    const allIds = new Set(Object.keys(project.widgetsById));
    const { xGuides: onlyCanvas } = collectSnapGuides(project, allIds, project.screens[0].meta);
    expect(onlyCanvas).toContain(0);
    expect(onlyCanvas).toContain(project.screens[0].meta.width);
    expect(xGuides.length).toBeGreaterThan(onlyCanvas.length);
  });

  it("includes widget left/center/right as x guides", () => {
    const project = makeProject();
    // Container1: absX=24, width=432 -> left=24, center=24+216=240, right=24+432=456
    const { xGuides } = collectSnapGuides(project, new Set(), project.screens[0].meta);
    expect(xGuides).toContain(24);
    expect(xGuides).toContain(24 + 432);
  });
});

describe("snapMoveDelta", () => {
  const xGuides = [0, 50, 100, 200, 240, 480];
  const yGuides = [0, 50, 100, 160, 320];
  const threshold = 6;

  it("snaps left edge when within threshold", () => {
    // Widget at x=5, moving by dx=0 -> left edge is at 5, guide is 0 (distance=5 < 6)
    const boxes = [{ x: 5, y: 10, width: 40, height: 20 }];
    const { dx } = snapMoveDelta(0, 0, boxes, xGuides, yGuides, threshold);
    // left edge = 5+0=5, nearest guide = 0, dist=5, adjusted dx = 0 + (0-5) = -5
    expect(dx).toBe(-5);
  });

  it("snaps right edge when within threshold", () => {
    // Widget at x=150, width=55, right=205. Left=150 (nearest 200 dist=50), center=177 (nearest 200 dist=23), right=205 (nearest 200 dist=5 < 6).
    const guides = [0, 50, 200, 480];
    const boxes = [{ x: 150, y: 10, width: 55, height: 20 }];
    const { dx } = snapMoveDelta(0, 0, boxes, guides, yGuides, threshold);
    // right=205, guide=200, dist=5 < 6, adjusted dx = 0 + (200-205) = -5
    expect(dx).toBe(-5);
  });

  it("snaps center when within threshold", () => {
    // Widget at x=20, width=60, center = 50, guide = 50 (dist=0)
    const boxes = [{ x: 20, y: 10, width: 60, height: 20 }];
    const { dx } = snapMoveDelta(0, 0, boxes, xGuides, yGuides, threshold);
    // center = 20+30=50, guide=50, dist=0, adjusted dx = 0 + (50-50) = 0
    expect(dx).toBe(0);
  });

  it("does not snap when farther than threshold", () => {
    // Widget at x=60, moving +0. Left=60, center=80, right=120. Nearest guides: 50(dist10), 100(dist20), 100(dist20)
    const boxes = [{ x: 60, y: 10, width: 60, height: 20 }];
    const { dx } = snapMoveDelta(0, 0, boxes, xGuides, yGuides, threshold);
    expect(dx).toBe(0); // no snap, original delta
  });

  it("snaps to canvas center on y axis", () => {
    // Widget at y=2, height=20, top=2. Guide=0 (dist=2 < 6).
    const boxes = [{ x: 10, y: 2, width: 40, height: 20 }];
    const { dy } = snapMoveDelta(0, 0, boxes, xGuides, yGuides, threshold);
    expect(dy).toBe(-2); // snap top to 0
  });

  it("returns original delta when no boxes provided", () => {
    const { dx, dy } = snapMoveDelta(10, 20, [], xGuides, yGuides, threshold);
    expect(dx).toBe(10);
    expect(dy).toBe(20);
  });

  it("applies dx before checking snap (moving widget)", () => {
    // Widget at x=90, width=20, right=110. With dx=15, right becomes 125. Nearest guide=100(dist25)>6. No snap.
    // But left+dx=105, nearest guide=100(dist5)<6. Snap! dx adjusted = 15 + (100-105) = 10.
    const boxes = [{ x: 90, y: 10, width: 20, height: 10 }];
    const { dx } = snapMoveDelta(15, 0, boxes, xGuides, yGuides, threshold);
    // left = 90+15=105, guide=100, dist=5 < 6, dx = 15 + (100-105) = 10
    expect(dx).toBe(10);
  });
});

describe("snapResizeDelta", () => {
  const xGuides = [0, 100, 200, 480];
  const yGuides = [0, 100, 200, 320];
  const threshold = 6;

  it("snaps right edge to x guide when within threshold", () => {
    // Widget at absX=50, width=55 => right edge = 105. Guide=100 (dist=5 < 6).
    const { dx } = snapResizeDelta(0, 0, { x: 50, y: 10, width: 55, height: 40 }, xGuides, yGuides, threshold);
    // right = 50+55=105, guide=100, dist=5, adjusted dx = 0 + (100-105) = -5
    expect(dx).toBe(-5);
  });

  it("snaps bottom edge to y guide when within threshold", () => {
    // Widget at absY=55, height=50 => bottom = 105. Guide=100 (dist=5 < 6).
    const { dy } = snapResizeDelta(0, 0, { x: 10, y: 55, width: 40, height: 50 }, xGuides, yGuides, threshold);
    expect(dy).toBe(-5);
  });

  it("respects minimum size constraint", () => {
    // Widget at x=50, width=24. dx=-5 -> new width=19 < minWidth=24. Use minWidth, right=50+24=74.
    // Guide nearest to 74: 100 (dist=26) > threshold. No snap.
    const { dx } = snapResizeDelta(-5, 0, { x: 50, y: 10, width: 24, height: 40 }, xGuides, yGuides, threshold);
    expect(dx).toBe(-5); // delta unchanged since no snap within threshold at minimum size
  });

  it("does not snap when farther than threshold", () => {
    // Widget at x=50, width=40 => right=90. Guide=100 (dist=10 > 6). No snap.
    const { dx } = snapResizeDelta(0, 0, { x: 50, y: 10, width: 40, height: 40 }, xGuides, yGuides, threshold);
    expect(dx).toBe(0);
  });
});

describe("applyPixelSnap", () => {
  it("rounds to nearest integer", () => {
    expect(applyPixelSnap(10.3)).toBe(10);
    expect(applyPixelSnap(10.7)).toBe(11);
    expect(applyPixelSnap(10)).toBe(10);
  });
});

describe("applyInteraction - magnet snap", () => {
  it("does not snap when magnetSnapEnabled is false", () => {
    const project = makeProject({ canvasSnap: { pixelSnapEnabled: false, magnetSnapEnabled: false, snapThresholdPx: 6 } });
    // Put widget at x=3 (near canvas edge 0), but magnet off
    const widgetId = "Button1";
    const widgetBefore = project.widgetsById[widgetId];
    const interaction: InteractionState = {
      kind: "move",
      widgetIds: [widgetId],
      pointerStart: { x: 0, y: 0 },
      startProject: project,
    };
    const result = applyInteraction(project, interaction, { x: 0, y: 0 });
    // No movement, positions unchanged
    expect(result.widgetsById[widgetId].x).toBe(widgetBefore.x);
  });

  it("snaps to canvas center line when moving near it with magnet on", () => {
    // Move Button1 so its absolute x gets very close to canvas center (240)
    const project = makeProject();
    // Button1 absolute position: screen-root(0)+Container1(24)+Panel1(20)+Button1(250) = 294 in x
    // screen-root(0)+Container1(24)+Panel1(72)+Button1(88) = 184 in y
    // Canvas width = 480, center = 240
    // We want to move it so its left edge is at 240: dx_needed = 240-294 = -54
    // With snap threshold 6, if we apply dx=-58, left would be 294-58=236, which is 4 away from 240 -> snaps
    const widgetId = "Button1";
    const widgetBefore = project.widgetsById[widgetId];
    const interaction: InteractionState = {
      kind: "move",
      widgetIds: [widgetId],
      pointerStart: { x: 0, y: 0 },
      startProject: project,
    };
    // dx=-58 means left edge would be at 236, which is 4px away from guide 240 -> snaps to 240 -> dx adjusted to -54
    const result = applyInteraction(project, interaction, { x: -58, y: 0 });
    // After snap, left absolute = 240, so local x = 240 - (0+24+20) = 196
    expect(result.widgetsById[widgetId].x).toBe(widgetBefore.x - 54);
  });
});

describe("applyInteraction - pixel snap", () => {
  it("rounds widget position to integers when pixelSnapEnabled", () => {
    const project = makeProject({ canvasSnap: { pixelSnapEnabled: true, magnetSnapEnabled: false, snapThresholdPx: 6 } });
    const widgetId = "Button1";
    const interaction: InteractionState = {
      kind: "move",
      widgetIds: [widgetId],
      pointerStart: { x: 0, y: 0 },
      startProject: project,
    };
    const result = applyInteraction(project, interaction, { x: 0.7, y: 0.3 });
    expect(Number.isInteger(result.widgetsById[widgetId].x)).toBe(true);
    expect(Number.isInteger(result.widgetsById[widgetId].y)).toBe(true);
  });

  it("rounds resize dimensions to integers when pixelSnapEnabled", () => {
    const project = makeProject({ canvasSnap: { pixelSnapEnabled: true, magnetSnapEnabled: false, snapThresholdPx: 6 } });
    const widgetId = "Button1";
    const interaction: InteractionState = {
      kind: "resize",
      widgetIds: [widgetId],
      pointerStart: { x: 0, y: 0 },
      startProject: project,
      handle: "se",
    };
    const result = applyInteraction(project, interaction, { x: 0.7, y: 0.3 });
    expect(Number.isInteger(result.widgetsById[widgetId].width)).toBe(true);
    expect(Number.isInteger(result.widgetsById[widgetId].height)).toBe(true);
  });

  it("keeps fractional positions when pixelSnapEnabled is false", () => {
    const project = makeProject({ canvasSnap: { pixelSnapEnabled: false, magnetSnapEnabled: false, snapThresholdPx: 6 } });
    const widgetId = "Button1";
    const startX = project.widgetsById[widgetId].x;
    const interaction: InteractionState = {
      kind: "move",
      widgetIds: [widgetId],
      pointerStart: { x: 0, y: 0 },
      startProject: project,
    };
    const result = applyInteraction(project, interaction, { x: 0.7, y: 0.3 });
    expect(result.widgetsById[widgetId].x).toBeCloseTo(startX + 0.7);
  });
});

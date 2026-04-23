import { describe, expect, it } from "vitest";
import type { ZoomContext } from "../../components/zoomNavigator/contextStack";
import {
  EMPTY_ZOOM_STACK,
  isBoardLevel,
  isMapLevel,
  peekContext,
  popContext,
  pushContext,
  replaceTopContext,
} from "../../components/zoomNavigator/contextStack";

function mapCtx(nodeId = "state-node-alpha"): ZoomContext {
  return {
    level: { level: "map" },
    navCamera: { x: 0, y: 0, zoom: 1 },
    navSelection: { kind: "node", nodeIds: [nodeId], transitionIds: [] },
  };
}

function boardCtx(variantId = "variant-root"): ZoomContext {
  return {
    level: { level: "board", stateNodeId: "state-node-alpha", variantId },
    boardCamera: { x: 0, y: 0, zoom: 1 },
  };
}

describe("pushContext / popContext / peekContext", () => {
  it("pushContext appends a new entry without mutating the input", () => {
    const input: ZoomContext[] = [];
    const next = pushContext(input, mapCtx());
    expect(next).not.toBe(input);
    expect(input).toHaveLength(0);
    expect(next).toHaveLength(1);
  });

  it("popContext on an empty stack returns { ctx: null, next: [] }", () => {
    const input: ZoomContext[] = [];
    const { ctx, next } = popContext(input);
    expect(ctx).toBeNull();
    expect(next).toEqual([]);
    expect(input).toHaveLength(0);
  });

  it("popContext returns the top element and the rest without mutating the input", () => {
    const a = mapCtx("state-node-a");
    const b = boardCtx("variant-b");
    const input: ZoomContext[] = [a, b];
    const { ctx, next } = popContext(input);
    expect(ctx).toBe(b);
    expect(next).toEqual([a]);
    expect(input).toHaveLength(2);
  });

  it("peekContext returns null on empty and the last entry otherwise", () => {
    expect(peekContext([])).toBeNull();
    const a = mapCtx();
    const b = boardCtx();
    expect(peekContext([a, b])).toBe(b);
  });
});

describe("replaceTopContext", () => {
  it("applies the updater to the last element", () => {
    const a = mapCtx("state-node-a");
    const b = boardCtx("variant-b");
    const next = replaceTopContext([a, b], (top) => ({
      ...top,
      selectedWidgetIds: ["widget-1"],
    }));
    expect(next).toHaveLength(2);
    expect(next[0]).toBe(a);
    expect(next[1].selectedWidgetIds).toEqual(["widget-1"]);
  });

  it("returns an empty stack unchanged", () => {
    expect(replaceTopContext([], (top) => top)).toEqual([]);
  });
});

describe("isMapLevel / isBoardLevel", () => {
  it("discriminate the two zoom levels correctly", () => {
    expect(isMapLevel({ level: "map" })).toBe(true);
    expect(isBoardLevel({ level: "map" })).toBe(false);
    expect(isBoardLevel({ level: "board", stateNodeId: "s", variantId: "v" })).toBe(true);
    expect(isMapLevel({ level: "board", stateNodeId: "s", variantId: "v" })).toBe(false);
  });
});

describe("EMPTY_ZOOM_STACK", () => {
  it("is frozen and rejects mutations in strict mode", () => {
    expect(Object.isFrozen(EMPTY_ZOOM_STACK)).toBe(true);
    // Vitest runs as ES modules (strict mode), so mutating a frozen array
    // throws. Fall back to the frozen assertion above if a runtime ever
    // silently tolerates the push.
    expect(() => {
      (EMPTY_ZOOM_STACK as ZoomContext[]).push(mapCtx());
    }).toThrow();
  });
});

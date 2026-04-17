import { describe, it, expect } from "vitest";
import { convertPixels } from "../codegen/imageEncoder";

// LVGL I1 palette: 2 entries × 4 bytes (BGRA) = 8 bytes.
// Entry 0 = black (B=0, G=0, R=0, A=255), entry 1 = white (B=255, G=255, R=255, A=255).
const EXPECTED_PALETTE = new Uint8Array([
  0x00, 0x00, 0x00, 0xFF, // black
  0xFF, 0xFF, 0xFF, 0xFF, // white
]);
const PALETTE_SIZE = 8;

describe("convertPixels — monochrome (LVGL I1)", () => {
  it("output starts with the correct 8-byte palette (black then white)", () => {
    const rgba = new Uint8ClampedArray([255, 255, 255, 255]); // 1×1 white
    const { data } = convertPixels(rgba, 1, 1, "monochrome");

    expect(data.length).toBe(PALETTE_SIZE + 1); // palette + 1 payload byte
    expect(Array.from(data.slice(0, PALETTE_SIZE))).toEqual(Array.from(EXPECTED_PALETTE));
  });

  it("opaque white pixel encodes as bit=1 (MSB of payload byte)", () => {
    const rgba = new Uint8ClampedArray([255, 255, 255, 255]);
    const { data, stride } = convertPixels(rgba, 1, 1, "monochrome");

    expect(stride).toBe(1);
    expect(data[PALETTE_SIZE]).toBe(0x80); // 0b10000000 — bit 7 set
  });

  it("opaque black pixel encodes as bit=0", () => {
    const rgba = new Uint8ClampedArray([0, 0, 0, 255]);
    const { data } = convertPixels(rgba, 1, 1, "monochrome");

    expect(data[PALETTE_SIZE]).toBe(0x00);
  });

  it("fully transparent pixel composites to white (not black)", () => {
    // Old code treated transparent as black; new code composites onto white background.
    const rgba = new Uint8ClampedArray([0, 0, 0, 0]); // transparent black
    const { data } = convertPixels(rgba, 1, 1, "monochrome");

    expect(data[PALETTE_SIZE]).toBe(0x80); // white (transparent → white composite)
  });

  it("nearly-transparent pixel composites to near-white", () => {
    // alpha=1 → composite ≈ 255 white → still encodes as white
    const rgba = new Uint8ClampedArray([0, 0, 0, 1]);
    const { data } = convertPixels(rgba, 1, 1, "monochrome");

    expect(data[PALETTE_SIZE]).toBe(0x80);
  });

  it("2-pixel row [black, white] produces correct bit pattern", () => {
    // black=bit0 (MSB), white=bit1 → byte = 0b01000000 = 0x40
    const rgba = new Uint8ClampedArray([
      0,   0,   0,   255, // pixel 0: black
      255, 255, 255, 255, // pixel 1: white
    ]);
    const { data, stride } = convertPixels(rgba, 2, 1, "monochrome");

    expect(stride).toBe(1);
    expect(data[PALETTE_SIZE]).toBe(0x40);
  });

  it("4-pixel row [W,B,W,B] produces 0b10100000 = 0xA0", () => {
    const rgba = new Uint8ClampedArray([
      255, 255, 255, 255,
      0,   0,   0,   255,
      255, 255, 255, 255,
      0,   0,   0,   255,
    ]);
    const { data } = convertPixels(rgba, 4, 1, "monochrome");

    expect(data[PALETTE_SIZE]).toBe(0xA0); // 0b10100000
  });

  it("row with width=9 pads to 2 bytes (stride=2)", () => {
    const rgba = new Uint8ClampedArray(9 * 4).fill(0); // 9 opaque black pixels
    const { data, stride } = convertPixels(rgba, 9, 1, "monochrome");

    expect(stride).toBe(2); // ceil(9/8) = 2
    expect(data.length).toBe(PALETTE_SIZE + 2);
  });

  it("2-row image has correct total payload length", () => {
    // 8-wide × 2-high: stride=1, payload=2 bytes
    const rgba = new Uint8ClampedArray(8 * 2 * 4).fill(255);
    const { data, stride } = convertPixels(rgba, 8, 2, "monochrome");

    expect(stride).toBe(1);
    expect(data.length).toBe(PALETTE_SIZE + 2);
    // All white → every payload bit set
    expect(data[PALETTE_SIZE]).toBe(0xFF);
    expect(data[PALETTE_SIZE + 1]).toBe(0xFF);
  });

  it("payload is not all-zero for a white image (regression: transparent≠black)", () => {
    // 4×4 fully transparent PNG equivalent: old code produced all-zero payload
    const rgba = new Uint8ClampedArray(4 * 4 * 4).fill(0); // RGBA=(0,0,0,0) × 16
    const { data } = convertPixels(rgba, 4, 4, "monochrome");

    const payload = data.slice(PALETTE_SIZE);
    const allZero = Array.from(payload).every((b) => b === 0);
    expect(allZero).toBe(false); // transparent should composite to white, not black
  });

  it("does not affect rgb888 output (monochrome changes must be isolated)", () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255]); // red pixel
    const { data, stride } = convertPixels(rgba, 1, 1, "rgb888");

    expect(stride).toBe(3);
    expect(data[0]).toBe(255); // R
    expect(data[1]).toBe(0);   // G
    expect(data[2]).toBe(0);   // B
  });
});

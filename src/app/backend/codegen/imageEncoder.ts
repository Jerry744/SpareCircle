import type { ColorFormat } from "../types";
import type { LvglAssetIR } from "./ir";

// ---------------------------------------------------------------------------
// LVGL v9 color format macros
// ---------------------------------------------------------------------------

function colorFormatToLvglMacro(format: ColorFormat): string {
  switch (format) {
    case "argb8888":  return "LV_COLOR_FORMAT_ARGB8888";
    case "rgb888":    return "LV_COLOR_FORMAT_RGB888";
    case "rgb565":    return "LV_COLOR_FORMAT_RGB565";
    case "grayscale8": return "LV_COLOR_FORMAT_L8";
    case "monochrome": return "LV_COLOR_FORMAT_I1";
  }
}

// ---------------------------------------------------------------------------
// Image decoding via browser Canvas API
// ---------------------------------------------------------------------------

interface RawImage {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
}

/** Milliseconds to wait for an image to load before giving up (allows test environments to fall back to the stub quickly). */
const IMAGE_LOAD_TIMEOUT_MS = 200;

async function decodeImageRGBA(dataUrl: string): Promise<RawImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    const timer = setTimeout(
      () => reject(new Error("Image load timed out — canvas API may be unavailable")),
      IMAGE_LOAD_TIMEOUT_MS,
    );

    img.onload = () => {
      clearTimeout(timer);
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      if (w === 0 || h === 0) {
        reject(new Error("Image decoded with zero dimensions"));
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not acquire 2D canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, w, h);
      resolve({ width: w, height: h, rgba: imageData.data });
    };

    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Image failed to load"));
    };

    img.src = dataUrl;
  });
}

// ---------------------------------------------------------------------------
// Pixel format conversion
// ---------------------------------------------------------------------------

interface ConvertResult {
  data: Uint8Array;
  stride: number; // bytes per row
}

/** @internal Exported for unit-testing; not part of the public API. */
export function convertPixels(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  format: ColorFormat,
): ConvertResult {
  const n = width * height;

  switch (format) {
    case "rgb888": {
      const stride = width * 3;
      const out = new Uint8Array(height * stride);
      for (let i = 0; i < n; i++) {
        out[i * 3]     = rgba[i * 4];       // R
        out[i * 3 + 1] = rgba[i * 4 + 1];   // G
        out[i * 3 + 2] = rgba[i * 4 + 2];   // B
      }
      return { data: out, stride };
    }

    case "argb8888": {
      const stride = width * 4;
      const out = new Uint8Array(height * stride);
      for (let i = 0; i < n; i++) {
        // LVGL ARGB8888 in-memory layout: B, G, R, A (little-endian)
        out[i * 4]     = rgba[i * 4 + 2];   // B
        out[i * 4 + 1] = rgba[i * 4 + 1];   // G
        out[i * 4 + 2] = rgba[i * 4];       // R
        out[i * 4 + 3] = rgba[i * 4 + 3];   // A
      }
      return { data: out, stride };
    }

    case "rgb565": {
      // Little-endian packed: low byte first
      const stride = width * 2;
      const out = new Uint8Array(height * stride);
      for (let i = 0; i < n; i++) {
        const r = (rgba[i * 4]     >> 3) & 0x1F;
        const g = (rgba[i * 4 + 1] >> 2) & 0x3F;
        const b = (rgba[i * 4 + 2] >> 3) & 0x1F;
        const packed = (r << 11) | (g << 5) | b;
        out[i * 2]     = packed & 0xFF;
        out[i * 2 + 1] = (packed >> 8) & 0xFF;
      }
      return { data: out, stride };
    }

    case "grayscale8": {
      const stride = width;
      const out = new Uint8Array(height * stride);
      for (let i = 0; i < n; i++) {
        out[i] = Math.round(
          0.299 * rgba[i * 4] +
          0.587 * rgba[i * 4 + 1] +
          0.114 * rgba[i * 4 + 2],
        );
      }
      return { data: out, stride };
    }

    case "monochrome": {
      // LVGL I1 format: 8-byte palette (2×BGRA entries) followed by 1-bit pixel data.
      // Entry 0 = black (bit=0), entry 1 = white (bit=1).
      // MSB of each byte is the leftmost pixel; rows are padded to a byte boundary.
      const PALETTE_BYTES = 8;
      const palette = new Uint8Array([
        0x00, 0x00, 0x00, 0xFF, // entry 0: black  (B=0, G=0, R=0, A=255)
        0xFF, 0xFF, 0xFF, 0xFF, // entry 1: white  (B=255, G=255, R=255, A=255)
      ]);

      const bytesPerRow = Math.ceil(width / 8);
      const out = new Uint8Array(PALETTE_BYTES + height * bytesPerRow);
      out.set(palette, 0);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const pi = (y * width + x) * 4;
          const r = rgba[pi];
          const g = rgba[pi + 1];
          const b = rgba[pi + 2];
          const a = rgba[pi + 3];

          // Composite onto a white background before thresholding so that
          // transparent pixels become white rather than black.
          const alpha = a / 255;
          const cr = Math.round(r * alpha + 255 * (1 - alpha));
          const cg = Math.round(g * alpha + 255 * (1 - alpha));
          const cb = Math.round(b * alpha + 255 * (1 - alpha));

          const lum = 0.299 * cr + 0.587 * cg + 0.114 * cb;
          if (lum >= 128) { // >= 128 → white → bit = 1
            const byteIdx = PALETTE_BYTES + y * bytesPerRow + Math.floor(x / 8);
            out[byteIdx] |= 1 << (7 - (x & 7));
          }
        }
      }

      return { data: out, stride: bytesPerRow };
    }
  }
}

// ---------------------------------------------------------------------------
// Hex array formatting
// ---------------------------------------------------------------------------

const BYTES_PER_ROW = 16;

function formatByteArray(data: Uint8Array): string {
  if (data.length === 0) return "    0x00";
  const rows: string[] = [];
  for (let i = 0; i < data.length; i += BYTES_PER_ROW) {
    const chunk = data.subarray(i, Math.min(i + BYTES_PER_ROW, data.length));
    const hex = Array.from(chunk).map((b) => `0x${b.toString(16).padStart(2, "0").toUpperCase()}`);
    const isLast = i + BYTES_PER_ROW >= data.length;
    rows.push("    " + hex.join(", ") + (isLast ? "" : ","));
  }
  return rows.join("\n");
}

// ---------------------------------------------------------------------------
// Image resizing via browser Canvas API
// ---------------------------------------------------------------------------

/**
 * Resize RGBA pixel data to the given target dimensions using the browser's
 * built-in bilinear/bicubic resampling (whatever the platform provides).
 *
 * Returns the original `raw` unchanged when the dimensions already match.
 */
async function resizeImage(raw: RawImage, targetWidth: number, targetHeight: number): Promise<RawImage> {
  if (raw.width === targetWidth && raw.height === targetHeight) {
    return raw;
  }

  // Paint the source pixels into an off-screen canvas …
  const src = document.createElement("canvas");
  src.width  = raw.width;
  src.height = raw.height;
  const srcCtx = src.getContext("2d");
  if (!srcCtx) {
    throw new Error("Could not acquire 2D canvas context for resize");
  }
  const imgData = srcCtx.createImageData(raw.width, raw.height);
  imgData.data.set(raw.rgba);
  srcCtx.putImageData(imgData, 0, 0);

  // … then draw it scaled into a second canvas of the target dimensions.
  const dst = document.createElement("canvas");
  dst.width  = targetWidth;
  dst.height = targetHeight;
  const dstCtx = dst.getContext("2d");
  if (!dstCtx) {
    throw new Error("Could not acquire 2D canvas context for resize output");
  }
  dstCtx.drawImage(src, 0, 0, targetWidth, targetHeight);
  const resized = dstCtx.getImageData(0, 0, targetWidth, targetHeight);

  return { width: targetWidth, height: targetHeight, rgba: resized.data };
}

// ---------------------------------------------------------------------------
// Stub for when image decoding is unavailable (e.g. test environment)
// ---------------------------------------------------------------------------

function generateStubAssetC(asset: LvglAssetIR, colorFormat: ColorFormat): string {
  const cf = colorFormatToLvglMacro(colorFormat);
  return [
    `#include "ui.h"`,
    ``,
    `/* ${asset.name} — pixel data placeholder (image could not be decoded at export time) */`,
    `/* Replace the map array with actual pixel data for your target color format. */`,
    `static const uint8_t ${asset.symbolName}_map[] = { 0x00 };`,
    ``,
    `const lv_image_dsc_t ${asset.symbolName} = {`,
    `    .header = {`,
    `        .cf     = ${cf},`,
    `        .w      = 1,`,
    `        .h      = 1,`,
    `        .stride = 1,`,
    `    },`,
    `    .data_size = sizeof(${asset.symbolName}_map),`,
    `    .data      = ${asset.symbolName}_map,`,
    `};`,
    ``,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Decode the asset image and emit a self-contained LVGL C source file with the
 * pixel array and `lv_image_dsc_t` descriptor.
 *
 * Falls back to a compilable stub if the Canvas API is unavailable (e.g. in
 * test environments) or if the image fails to load.
 */
export async function generateAssetCSource(
  asset: LvglAssetIR,
  colorFormat: ColorFormat,
): Promise<string> {
  let raw: RawImage;
  try {
    raw = await decodeImageRGBA(asset.dataUrl);
  } catch {
    return generateStubAssetC(asset, colorFormat);
  }

  // Pre-resize to widget target dimensions so the exported pixel data already
  // matches the canvas preview's stretch-to-fill behaviour.  If the canvas API
  // is unavailable (test stubs, etc.) the resize throws and we fall through to
  // the original decoded dimensions, which is still a valid LVGL asset.
  if (asset.targetWidth !== undefined && asset.targetHeight !== undefined) {
    try {
      raw = await resizeImage(raw, asset.targetWidth, asset.targetHeight);
    } catch {
      // Resize failed (e.g. second canvas unavailable) — use natural dimensions.
    }
  }

  const { data, stride } = convertPixels(raw.rgba, raw.width, raw.height, colorFormat);
  const cf = colorFormatToLvglMacro(colorFormat);

  return [
    `#include "ui.h"`,
    ``,
    `/* ${asset.name} — ${raw.width}x${raw.height} px, ${colorFormat} */`,
    `static const uint8_t ${asset.symbolName}_map[] = {`,
    formatByteArray(data),
    `};`,
    ``,
    `const lv_image_dsc_t ${asset.symbolName} = {`,
    `    .header = {`,
    `        .cf     = ${cf},`,
    `        .w      = ${raw.width},`,
    `        .h      = ${raw.height},`,
    `        .stride = ${stride},`,
    `    },`,
    `    .data_size = sizeof(${asset.symbolName}_map),`,
    `    .data      = ${asset.symbolName}_map,`,
    `};`,
    ``,
  ].join("\n");
}

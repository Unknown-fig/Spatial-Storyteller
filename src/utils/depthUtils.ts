// ============================================================
//  Depth utilities — median, resize, row flip, Sobel normal map
// ============================================================

/** Compute median depth (0-255) for depth pixels inside [x1,y1,x2,y2] bbox.
 *  Clamps bbox to image bounds. Returns 0 if box is degenerate. */
export function medianDepthInBox(
  depth: Uint8Array,
  depthW: number,
  depthH: number,
  imgW: number,
  imgH: number,
  box: [number, number, number, number]
): number {
  if (depth.length === 0 || depthW === 0 || depthH === 0 || imgW === 0 || imgH === 0) return 0;
  const scaleX = depthW / imgW;
  const scaleY = depthH / imgH;
  const x1 = Math.max(0, Math.min(depthW - 1, Math.floor(box[0] * scaleX)));
  const y1 = Math.max(0, Math.min(depthH - 1, Math.floor(box[1] * scaleY)));
  const x2 = Math.max(0, Math.min(depthW - 1, Math.ceil(box[2] * scaleX)));
  const y2 = Math.max(0, Math.min(depthH - 1, Math.ceil(box[3] * scaleY)));

  if (x2 <= x1 || y2 <= y1) return 0;

  const vals: number[] = [];
  for (let y = y1; y <= y2; y++) {
    const rowOffset = y * depthW;
    for (let x = x1; x <= x2; x++) {
      vals.push(depth[rowOffset + x] ?? 0);
    }
  }
  if (vals.length === 0) return 0;
  vals.sort((a, b) => a - b);
  const mid = Math.floor(vals.length / 2);
  return vals[mid] ?? 0;
}

/** Nearest-neighbour resize of a 1-channel Uint8Array to target dimensions */
export function resizeDepth(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Uint8Array {
  if (srcW === dstW && srcH === dstH) return src;
  const dst = new Uint8Array(dstW * dstH);
  const xScale = srcW / dstW;
  const yScale = srcH / dstH;
  for (let y = 0; y < dstH; y++) {
    const sy = Math.min(srcH - 1, Math.floor(y * yScale));
    const srcRow = sy * srcW;
    const dstRow = y * dstW;
    for (let x = 0; x < dstW; x++) {
      const sx = Math.min(srcW - 1, Math.floor(x * xScale));
      dst[dstRow + x] = src[srcRow + sx] ?? 0;
    }
  }
  return dst;
}

/** Vertically flips rows in a 1-channel Uint8Array image buffer.
 *  Needed so DataTexture matches WebGL UV origin (bottom-left) when flipY is required. */
export function flipYUint8(data: Uint8Array, width: number, height: number): Uint8Array {
  const flipped = new Uint8Array(data.length);
  for (let y = 0; y < height; y++) {
    const srcRow = y * width;
    const dstRow = (height - 1 - y) * width;
    flipped.set(data.subarray(srcRow, srcRow + width), dstRow);
  }
  return flipped;
}

/** Generate a tangent-space RGBA normal map from a 1-channel grayscale depth map
 *  using a 3x3 Sobel filter. Strength scales the slope response. */
export function generateSobelNormalMap(
  depth: Uint8Array,
  width: number,
  height: number,
  strength = 3.5
): Uint8Array {
  const normalData = new Uint8Array(width * height * 4);

  const getD = (x: number, y: number): number => {
    const cx = Math.max(0, Math.min(width - 1, x));
    const cy = Math.max(0, Math.min(height - 1, y));
    return (depth[cy * width + cx] ?? 0) / 255.0;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // 3x3 Sobel kernel samples
      const tl = getD(x - 1, y - 1);
      const t  = getD(x,     y - 1);
      const tr = getD(x + 1, y - 1);
      const l  = getD(x - 1, y);
      const r  = getD(x + 1, y);
      const bl = getD(x - 1, y + 1);
      const b  = getD(x,     y + 1);
      const br = getD(x + 1, y + 1);

      // Gradient in X and Y
      const dx = (tr + 2.0 * r + br) - (tl + 2.0 * l + bl);
      const dy = (bl + 2.0 * b + br) - (tl + 2.0 * t + tr);

      // Tangent space normal vector
      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1.0;

      // Normalize vector
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1.0;
      nx /= len;
      ny /= len;
      nz /= len;

      const idx = (y * width + x) * 4;
      normalData[idx]     = Math.floor((nx * 0.5 + 0.5) * 255);
      normalData[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
      normalData[idx + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
      normalData[idx + 3] = 255;
    }
  }

  return normalData;
}

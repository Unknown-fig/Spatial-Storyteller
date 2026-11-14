// ============================================================
//  Depth utilities — median inside bbox, resize, row flip
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

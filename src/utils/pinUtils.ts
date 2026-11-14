// ============================================================
//  Pin coordinate math
//  Maps 2D image coords + depth → 3D plane world coords
// ============================================================

export interface PinCoords {
  x: number; // world X
  y: number; // world Y
  z: number; // world Z (displacement)
  u: number; // UV u [0-1]
  v: number; // UV v [0-1]
  depthNorm: number; // 0-1
}

export function computePinCoords(
  cx: number,  // pixel center X in processed image
  cy: number,  // pixel center Y
  imgW: number,
  imgH: number,
  depthNorm: number,       // 0-1 (median depth / 255)
  displacementScale: number,
  planeW: number,
  planeH: number
): PinCoords {
  const u = cx / imgW;
  const v = cy / imgH;
  const x = (u - 0.5) * planeW;
  const y = (0.5 - v) * planeH;
  const z = depthNorm * displacementScale;
  return { x, y, z, u, v, depthNorm };
}

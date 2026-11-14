// ============================================================
//  Image utilities — downscale, canvas helpers
// ============================================================

export const MAX_SIDE = 1024;

/** Draw an image/blob onto a new canvas, downscaling so longest side <= MAX_SIDE */
export async function prepareCanvas(
  source: File | Blob | HTMLCanvasElement
): Promise<HTMLCanvasElement> {
  let img: HTMLImageElement | HTMLCanvasElement;

  if (source instanceof HTMLCanvasElement) {
    img = source;
  } else {
    const url = URL.createObjectURL(source);
    img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => { URL.revokeObjectURL(url); resolve(el); };
      el.onerror = reject;
      el.src = url;
    });
  }

  const srcW = 'naturalWidth' in img ? img.naturalWidth : img.width;
  const srcH = 'naturalHeight' in img ? img.naturalHeight : img.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(srcW, srcH));
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(img as CanvasImageSource, 0, 0, w, h);
  return canvas;
}

/** Create a transferable ImageBitmap from a canvas (canvas becomes source-of-truth) */
export async function canvasToBitmap(canvas: HTMLCanvasElement): Promise<ImageBitmap> {
  return createImageBitmap(canvas);
}

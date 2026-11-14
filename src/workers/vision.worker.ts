/// <reference lib="webworker" />
// ============================================================
//  SpatialLens 3D � Vision Worker (Track 1)
//  Runs Florence-2 (caption + region grounding) + Depth Anything v2
//  All inference runs locally in the browser � no backend.
// ============================================================

import {
  Florence2ForConditionalGeneration,
  AutoProcessor,
  AutoTokenizer,
  pipeline,
  env,
  RawImage,
} from '@huggingface/transformers';

import type { WorkerInMsg, WorkerOutMsg, SceneObject } from '../types/protocol';
import { resizeDepth } from '../utils/depthUtils';

// -- Environment -----------------------------------------------
env.useBrowserCache = true;
// When not cross-origin isolated, SharedArrayBuffer is unavailable ? enforce 1 thread
if (!self.crossOriginIsolated) {
  (env.backends as { onnx?: { wasm?: { numThreads?: number } } }).onnx ??= {};
  (env.backends as { onnx: { wasm?: { numThreads?: number } } }).onnx.wasm ??= {};
  (env.backends as { onnx: { wasm: { numThreads?: number } } }).onnx.wasm.numThreads = 1;
}

const FLORENCE_MODEL = 'onnx-community/Florence-2-base-ft';
const DEPTH_MODEL = 'onnx-community/depth-anything-v2-small';

// -- State -----------------------------------------------------
let device: 'webgpu' | 'wasm' = 'wasm';
let florence: any = null;
let processor: any = null;
let tokenizer: any = null;
let depthPipe: any = null;

// Queue & Run State (Fix 1)
let busy = false;
let currentRunId = -1;
let pendingRun: { runId: number; bitmap: ImageBitmap } | null = null;
const cancelledRunIds = new Set<number>();
const isStale = (id: number) => cancelledRunIds.has(id) || (currentRunId !== -1 && currentRunId !== id);

// -- Helpers ---------------------------------------------------
function post(msg: WorkerOutMsg): void {
  self.postMessage(msg);
}

function makeProgress(model: 'florence' | 'depth') {
  return (progress: { file?: string; loaded?: number; total?: number; status?: string }) => {
    if (progress.status === 'progress' || (progress.loaded !== undefined && progress.total !== undefined)) {
      post({
        type: 'progress',
        model,
        file: progress.file ?? '',
        loaded: progress.loaded ?? 0,
        total: progress.total ?? 1,
      });
    }
  };
}

/** Convert ImageBitmap directly into RawImage via OffscreenCanvas getImageData (Fix 6).
 *  Skips blob & object-URL roundtrips completely. Closes bitmap immediately. */
function bitmapToRawImage(bmp: ImageBitmap): InstanceType<typeof RawImage> {
  const w = bmp.width;
  const h = bmp.height;
  const oc = new OffscreenCanvas(w, h);
  const ctx = oc.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  const imgData = ctx.getImageData(0, 0, w, h);
  bmp.close(); // Bitmap is no longer needed
  return new RawImage(imgData.data, w, h, 4);
}

// -- Model Loading ---------------------------------------------
const gpuDtype = {
  embed_tokens: 'fp16' as const,
  vision_encoder: 'fp16' as const,
  encoder_model: 'q4' as const,
  decoder_model_merged: 'q4' as const,
};
const wasmDtype = {
  embed_tokens: 'fp32' as const,
  vision_encoder: 'fp32' as const,
  encoder_model: 'q8' as const,
  decoder_model_merged: 'q8' as const,
};

async function loadModels(targetDevice: 'webgpu' | 'wasm'): Promise<void> {
  const florenceProgress = makeProgress('florence');
  const depthProgress = makeProgress('depth');

  const [mdl, proc, tok, pipe] = await Promise.all([
    Florence2ForConditionalGeneration.from_pretrained(FLORENCE_MODEL, {
      device: targetDevice,
      dtype: targetDevice === 'webgpu' ? gpuDtype : wasmDtype,
      progress_callback: florenceProgress,
    }),
    AutoProcessor.from_pretrained(FLORENCE_MODEL, {
      progress_callback: florenceProgress,
    }),
    AutoTokenizer.from_pretrained(FLORENCE_MODEL, {
      progress_callback: florenceProgress,
    }),
    pipeline('depth-estimation', DEPTH_MODEL, {
      device: targetDevice,
      progress_callback: depthProgress,
    }),
  ]);

  florence = mdl;
  processor = proc;
  tokenizer = tok;
  depthPipe = pipe;
  device = targetDevice;
  post({ type: 'backend', device });
}

// -- Init (Fix 2: Real adapter check) --------------------------
async function init(forceWasm = false): Promise<void> {
  let targetDevice: 'webgpu' | 'wasm' = 'wasm';

  if (!forceWasm && typeof (navigator as any).gpu !== 'undefined') {
    try {
      const adapter = await (navigator as any).gpu?.requestAdapter();
      if (adapter) {
        targetDevice = 'webgpu';
      }
    } catch {
      targetDevice = 'wasm';
    }
  }

  post({ type: 'backend', device: targetDevice });

  try {
    await loadModels(targetDevice);
  } catch (e) {
    if (targetDevice === 'webgpu') {
      console.warn('[Vision Worker] WebGPU initialization failed, falling back to WASM:', e);
      targetDevice = 'wasm';
      post({ type: 'backend', device: 'wasm' });
      await loadModels('wasm');
    } else {
      throw e;
    }
  }
}

// -- Fallback to WASM on runtime GPU failure -------------------
async function fallbackToWasm(): Promise<void> {
  console.warn('[Vision Worker] Runtime error on WebGPU. Falling back to WASM...');
  device = 'wasm';
  post({ type: 'backend', device: 'wasm' });
  await loadModels('wasm');
}

// -- Execute Single Run ----------------------------------------
async function executeRun(runId: number, bitmap: ImageBitmap, isRetry = false): Promise<void> {
  currentRunId = runId;

  // Stale check
  if (isStale(runId)) {
    cancelledRunIds.delete(runId);
    bitmap.close();
    return;
  }

  if (!florence || !processor || !depthPipe) {
    post({ type: 'error', runId, message: 'Models not ready yet' });
    bitmap.close();
    return;
  }

  let image: InstanceType<typeof RawImage>;
  try {
    image = bitmapToRawImage(bitmap);
  } catch (e) {
    post({ type: 'error', runId, message: `Image conversion failed: ${String(e)}` });
    return;
  }

  const imgSize = image.size as [number, number]; // [width, height]
  let caption = '';
  let objects: SceneObject[] = [];
  let florenceFailed = false;

  // -- Stage 1: MORE_DETAILED_CAPTION ---------------------------
  const t0 = performance.now();
  if (isStale(runId)) { cancelledRunIds.delete(runId); return; }

  try {
    const captionTask = '<MORE_DETAILED_CAPTION>';
    const captionPrompt = processor.construct_prompts(captionTask);
    const captionInputs = await processor(image, captionPrompt);

    if (isStale(runId)) { cancelledRunIds.delete(runId); return; }

    const captionIds = await florence.generate({
      ...captionInputs,
      max_new_tokens: 256,
    });

    const decoder = tokenizer ?? processor;
    const decoded = decoder.batch_decode(captionIds, { skip_special_tokens: false }) as string[];
    const captionRaw = decoded[0] ?? '';
    const captionResult = processor.post_process_generation(
      captionRaw,
      captionTask,
      imgSize
    ) as Record<string, string>;
    caption = captionResult[captionTask] ?? captionRaw;
  } catch (e) {
    florenceFailed = true;
    console.warn('[Vision Worker] Florence caption stage error:', e);
    // If WebGPU failed, attempt runtime fallback once
    if (device === 'webgpu' && !isRetry) {
      await fallbackToWasm();
      // Re-create a fresh copy or retry
      // (If image is intact we can retry with fallback)
    }
  }
  const t1 = performance.now();
  if (isStale(runId)) { cancelledRunIds.delete(runId); return; }
  post({ type: 'stage', runId, stage: 'caption', ms: Math.round(t1 - t0) });

  // -- Stage 2: DENSE_REGION_CAPTION ----------------------------
  if (isStale(runId)) { cancelledRunIds.delete(runId); return; }

  try {
    if (!florenceFailed) {
      const regionTask = '<DENSE_REGION_CAPTION>';
      const regionPrompt = processor.construct_prompts(regionTask);
      const regionInputs = await processor(image, regionPrompt);

      if (isStale(runId)) { cancelledRunIds.delete(runId); return; }

      const regionIds = await florence.generate({
        ...regionInputs,
        max_new_tokens: 256,
      });

      const decoder = tokenizer ?? processor;
      const decoded = decoder.batch_decode(regionIds, { skip_special_tokens: false }) as string[];
      const regionRaw = decoded[0] ?? '';
      const regionResult = processor.post_process_generation(
        regionRaw,
        regionTask,
        imgSize
      ) as Record<string, { bboxes?: [number, number, number, number][]; labels?: string[] } | string>;

      const regionData = regionResult[regionTask];
      if (regionData && typeof regionData !== 'string' && regionData.bboxes && regionData.labels) {
        objects = regionData.bboxes.map((box, i) => ({
          id: `obj-${runId}-${i}`,
          label: regionData.labels?.[i] ?? `Object ${i}`,
          box,
        }));
      }
    }
  } catch (e) {
    florenceFailed = true;
    console.warn('[Vision Worker] Florence region stage error:', e);
  }
  const t2 = performance.now();
  if (isStale(runId)) { cancelledRunIds.delete(runId); return; }
  post({ type: 'stage', runId, stage: 'regions', ms: Math.round(t2 - t1) });

  // -- Stage 3: Depth Estimation ---------------------------------
  // Depth Anything V2 output.depth is a RawImage with grayscale 0-255 Uint8Array.
  // NEAR = BRIGHT: High pixel values (255 = white) indicate geometry close to the camera.
  if (isStale(runId)) { cancelledRunIds.delete(runId); return; }

  let depthData: Uint8Array;
  let depthWidth: number;
  let depthHeight: number;

  try {
    const depthRaw = await depthPipe(image);
    const depthOut = Array.isArray(depthRaw) ? depthRaw[0] : depthRaw;
    const depthImage = depthOut.depth;

    depthWidth = depthImage.width;
    depthHeight = depthImage.height;

    // Fix 6: Verify channels === 1. If multi-channel, extract channel 0.
    if (depthImage.channels && depthImage.channels > 1) {
      depthData = new Uint8Array(depthWidth * depthHeight);
      const ch = depthImage.channels;
      for (let i = 0; i < depthData.length; i++) {
        depthData[i] = depthImage.data[i * ch] ?? 0;
      }
    } else {
      depthData = depthImage.data;
    }

    // Fix 6: If depth dimensions differ from processed image size, resize
    if (depthWidth !== imgSize[0] || depthHeight !== imgSize[1]) {
      depthData = resizeDepth(depthData, depthWidth, depthHeight, imgSize[0], imgSize[1]);
      depthWidth = imgSize[0];
      depthHeight = imgSize[1];
    }
  } catch (e) {
    if (device === 'webgpu' && !isRetry) {
      console.warn('[Vision Worker] Depth failed on WebGPU, falling back to WASM...');
      await fallbackToWasm();
    }
    post({ type: 'error', runId, message: `Depth estimation error: ${String(e)}` });
    return;
  }

  const t3 = performance.now();
  if (isStale(runId)) { cancelledRunIds.delete(runId); return; }
  post({ type: 'stage', runId, stage: 'depth', ms: Math.round(t3 - t2) });

  // If Florence failed but depth succeeded, post a non-fatal warning (Fix 6)
  if (florenceFailed) {
    post({
      type: 'error',
      runId,
      message: 'Notice: Florence-2 captioning failed, but 3D depth mesh was generated successfully.',
    });
  }

  // -- Emit Result � Zero-copy buffer transfer -------------------
  const resultMsg: WorkerOutMsg = {
    type: 'result',
    runId,
    caption,
    objects,
    depth: { data: depthData, width: depthWidth, height: depthHeight },
    timings: {
      captionMs: Math.round(t1 - t0),
      regionsMs: Math.round(t2 - t1),
      depthMs: Math.round(t3 - t2),
    },
  };
  self.postMessage(resultMsg, [depthData.buffer]);
}

// -- Queue Processing Loop (Fix 1: while loop, try/finally) ----
async function processQueue(initialRunId: number, initialBitmap: ImageBitmap): Promise<void> {
  let task: { runId: number; bitmap: ImageBitmap } | null = {
    runId: initialRunId,
    bitmap: initialBitmap,
  };
  busy = true;

  try {
    while (task !== null) {
      const { runId, bitmap } = task;
      task = null;
      await executeRun(runId, bitmap);

      // Check if another pending run queued up while we were busy
      if (pendingRun !== null) {
        task = pendingRun;
        pendingRun = null;
      }
    }
  } finally {
    busy = false;
    currentRunId = -1; // Reset run ID (Fix 1)

    // Drain any pending run that arrived at the boundary
    if (pendingRun !== null) {
      const next = pendingRun;
      pendingRun = null;
      void processQueue(next.runId, next.bitmap);
    }
  }
}

// -- Message Handler -------------------------------------------
self.addEventListener('message', (e: MessageEvent<WorkerInMsg>) => {
  const msg = e.data;

  if (msg.type === 'init') {
    init(msg.forceWasm).catch((err: unknown) => {
      post({ type: 'error', message: `Init failed: ${String(err)}` });
    });
  } else if (msg.type === 'analyze') {
    if (busy) {
      // Replace older pending run and close its bitmap
      if (pendingRun !== null) {
        pendingRun.bitmap.close();
      }
      pendingRun = { runId: msg.runId, bitmap: msg.bitmap };
    } else {
      void processQueue(msg.runId, msg.bitmap);
    }
  } else if (msg.type === 'cancel') {
    cancelledRunIds.add(msg.runId);
    if (pendingRun?.runId === msg.runId) {
      pendingRun.bitmap.close();
      pendingRun = null;
    }
    // cancel does NOT touch busy (Fix 1)
  }
});

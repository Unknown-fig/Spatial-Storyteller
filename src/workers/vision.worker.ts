/// <reference lib="webworker" />
// ============================================================
//  SpatialLens 3D — Vision Worker (Track 1)
//  Runs Florence-2 (caption + region grounding) + Depth Anything v2
//  All inference runs locally in the browser — no backend.
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

// -- Environment -----------------------------------------------
env.useBrowserCache = true;
// If not cross-origin isolated, SharedArrayBuffer is unavailable ? single thread
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
let currentRunId = -1;
let pendingRun: { runId: number; bitmap: ImageBitmap } | null = null;
let isProcessing = false;

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

function bitmapToRawImage(bmp: ImageBitmap): InstanceType<typeof RawImage> {
  const oc = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = oc.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0);
  return RawImage.fromCanvas(oc as unknown as HTMLCanvasElement);
}

// -- Init ------------------------------------------------------
async function init(forceWasm = false): Promise<void> {
  // Detect WebGPU unless explicitly forced to WASM
  if (forceWasm) {
    device = 'wasm';
  } else {
    try {
      if (typeof (self as unknown as { gpu?: unknown }).gpu === 'undefined') {
        throw new Error('WebGPU not supported on this device/browser');
      }
      device = 'webgpu';
    } catch {
      device = 'wasm';
    }
  }
  post({ type: 'backend', device });

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

  const florenceProgress = makeProgress('florence');
  const depthProgress = makeProgress('depth');

  // Load Florence-2
  const tryLoadFlorence = async (dev: 'webgpu' | 'wasm') => {
    const [mdl, proc, tok] = await Promise.all([
      Florence2ForConditionalGeneration.from_pretrained(FLORENCE_MODEL, {
        device: dev,
        dtype: dev === 'webgpu' ? gpuDtype : wasmDtype,
        progress_callback: florenceProgress,
      }),
      AutoProcessor.from_pretrained(FLORENCE_MODEL, {
        progress_callback: florenceProgress,
      }),
      AutoTokenizer.from_pretrained(FLORENCE_MODEL, {
        progress_callback: florenceProgress,
      }),
    ]);
    return { mdl, proc, tok };
  };

  try {
    const { mdl, proc, tok } = await tryLoadFlorence(device);
    florence = mdl;
    processor = proc;
    tokenizer = tok;
  } catch (e) {
    if (device === 'webgpu') {
      device = 'wasm';
      post({ type: 'backend', device });
      const { mdl, proc, tok } = await tryLoadFlorence('wasm');
      florence = mdl;
      processor = proc;
      tokenizer = tok;
    } else {
      throw e;
    }
  }

  // Load Depth Anything v2
  const tryLoadDepth = async (dev: 'webgpu' | 'wasm') => {
    return pipeline('depth-estimation', DEPTH_MODEL, {
      device: dev,
      progress_callback: depthProgress,
    });
  };

  try {
    depthPipe = await tryLoadDepth(device);
  } catch (e) {
    if (device === 'webgpu') {
      device = 'wasm';
      post({ type: 'backend', device });
      depthPipe = await tryLoadDepth('wasm');
    } else {
      throw e;
    }
  }

  post({ type: 'backend', device }); // Confirm active backend
}

// -- Analyze ---------------------------------------------------
async function analyze(runId: number, bitmap: ImageBitmap): Promise<void> {
  if (!florence || !processor || !depthPipe) {
    post({ type: 'error', runId, message: 'Models not ready yet' });
    bitmap.close();
    return;
  }

  currentRunId = runId;
  isProcessing = true;

  let image: InstanceType<typeof RawImage>;
  try {
    image = bitmapToRawImage(bitmap);
    bitmap.close();
  } catch (e) {
    post({ type: 'error', runId, message: `Image conversion failed: ${String(e)}` });
    isProcessing = false;
    bitmap.close();
    return;
  }

  const imgSize = image.size as [number, number]; // [width, height]
  let caption = '';
  let objects: SceneObject[] = [];

  // -- Stage 1: MORE_DETAILED_CAPTION ---------------------------
  const t0 = performance.now();
  if (currentRunId !== runId) { isProcessing = false; return; }
  try {
    const captionTask = '<MORE_DETAILED_CAPTION>';
    const captionPrompt = processor.construct_prompts(captionTask);
    const captionInputs = await processor(image, captionPrompt);

    if (currentRunId !== runId) { isProcessing = false; return; }

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
    post({ type: 'error', runId, message: `Florence caption: ${String(e)}` });
  }
  const t1 = performance.now();
  if (currentRunId !== runId) { isProcessing = false; return; }
  post({ type: 'stage', runId, stage: 'caption', ms: Math.round(t1 - t0) });

  // -- Stage 2: DENSE_REGION_CAPTION ----------------------------
  if (currentRunId !== runId) { isProcessing = false; return; }
  try {
    const regionTask = '<DENSE_REGION_CAPTION>';
    const regionPrompt = processor.construct_prompts(regionTask);
    const regionInputs = await processor(image, regionPrompt);

    if (currentRunId !== runId) { isProcessing = false; return; }

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
  } catch (e) {
    post({ type: 'error', runId, message: `Florence regions: ${String(e)}` });
  }
  const t2 = performance.now();
  if (currentRunId !== runId) { isProcessing = false; return; }
  post({ type: 'stage', runId, stage: 'regions', ms: Math.round(t2 - t1) });

  // -- Stage 3: Depth Estimation ---------------------------------
  // Depth Anything V2 output.depth is a RawImage with grayscale 0-255 Uint8Array data.
  // NEAR = BRIGHT: High pixel values (255 = white) indicate geometry close to the camera;
  // dark values (0 = black) represent distant background.
  if (currentRunId !== runId) { isProcessing = false; return; }
  let depthData: Uint8Array;
  let depthWidth: number;
  let depthHeight: number;
  try {
    const depthRaw = await depthPipe(image);
    const depthOut = Array.isArray(depthRaw) ? depthRaw[0] : depthRaw;
    const depthImage = depthOut.depth;

    depthData = depthImage.data;
    depthWidth = depthImage.width;
    depthHeight = depthImage.height;
  } catch (e) {
    post({ type: 'error', runId, message: `Depth estimation: ${String(e)}` });
    isProcessing = false;
    return;
  }
  const t3 = performance.now();
  if (currentRunId !== runId) { isProcessing = false; return; }
  post({ type: 'stage', runId, stage: 'depth', ms: Math.round(t3 - t2) });

  // -- Emit result — Transfer buffer (zero-copy) -----------------
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

  isProcessing = false;

  // Process any pending queued run
  if (pendingRun !== null) {
    const next = pendingRun;
    pendingRun = null;
    await analyze(next.runId, next.bitmap);
  }
}

// -- Message handler -------------------------------------------
self.addEventListener('message', (e: MessageEvent<WorkerInMsg>) => {
  const msg = e.data;
  if (msg.type === 'init') {
    init(msg.forceWasm).catch((err: unknown) => {
      post({ type: 'error', message: `Init failed: ${String(err)}` });
    });
  } else if (msg.type === 'analyze') {
    if (isProcessing) {
      // Discard older pending run if present
      if (pendingRun) {
        pendingRun.bitmap.close();
      }
      // Cancel currently running task so it bails at next stage
      currentRunId = msg.runId;
      pendingRun = { runId: msg.runId, bitmap: msg.bitmap };
    } else {
      analyze(msg.runId, msg.bitmap).catch((err: unknown) => {
        post({ type: 'error', runId: msg.runId, message: String(err) });
        isProcessing = false;
      });
    }
  } else if (msg.type === 'cancel') {
    if (currentRunId === msg.runId) {
      currentRunId = -1;
    }
    if (pendingRun?.runId === msg.runId) {
      pendingRun.bitmap.close();
      pendingRun = null;
    }
  }
});

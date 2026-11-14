import { create } from 'zustand';
import type { SceneObject, RenderMode, Selection } from '../types/protocol';

export interface ProgressEntry { file: string; loaded: number; total: number }

export interface AppState {
  // Pipeline status
  status: 'idle' | 'loading-models' | 'analyzing' | 'done' | 'error';
  errorMessage: string | null;
  device: 'webgpu' | 'wasm' | null;
  modelsReady: boolean;
  florenceProgress: ProgressEntry[];
  depthProgress: ProgressEntry[];
  timings: { captionMs: number; regionsMs: number; depthMs: number } | null;
  stageMs: { caption?: number; regions?: number; depth?: number };

  // Source image (kept in main thread for display — NOT transferred)
  sourceCanvas: HTMLCanvasElement | null;
  processedWidth: number;
  processedHeight: number;

  // CV results
  caption: string;
  objects: SceneObject[];
  depthData: Uint8Array | null;
  depthWidth: number;
  depthHeight: number;
  currentRunId: number;

  // Viewport controls
  renderMode: RenderMode;
  displacementScale: number;
  cameraFov: number;
  selection: Selection;

  // Actions
  setDevice: (d: 'webgpu' | 'wasm') => void;
  setModelsReady: (r: boolean) => void;
  addFlorenceProgress: (e: ProgressEntry) => void;
  addDepthProgress: (e: ProgressEntry) => void;
  setStageMs: (stage: 'caption' | 'regions' | 'depth', ms: number) => void;
  setStatus: (s: AppState['status'], err?: string) => void;
  setSceneResult: (p: {
    caption: string;
    objects: SceneObject[];
    depthData: Uint8Array;
    depthWidth: number;
    depthHeight: number;
    timings: { captionMs: number; regionsMs: number; depthMs: number };
  }) => void;
  setSourceCanvas: (c: HTMLCanvasElement | null, w: number, h: number) => void;
  setRenderMode: (m: RenderMode) => void;
  setDisplacementScale: (v: number) => void;
  setCameraFov: (v: number) => void;
  setSelection: (s: Partial<Selection>) => void;
  nextRunId: () => number;
  reset: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  status: 'idle',
  errorMessage: null,
  device: null,
  modelsReady: false,
  florenceProgress: [],
  depthProgress: [],
  timings: null,
  stageMs: {},
  sourceCanvas: null,
  processedWidth: 0,
  processedHeight: 0,
  caption: '',
  objects: [],
  depthData: null,
  depthWidth: 0,
  depthHeight: 0,
  currentRunId: 0,
  renderMode: 'textured',
  displacementScale: 0.35,
  cameraFov: 50,
  selection: { objectId: null, hoveredId: null },

  setDevice: (d) => set({ device: d }),
  setModelsReady: (r) => set({ modelsReady: r }),
  addFlorenceProgress: (e) =>
    set((s) => ({ florenceProgress: upsertProgress(s.florenceProgress, e) })),
  addDepthProgress: (e) =>
    set((s) => ({ depthProgress: upsertProgress(s.depthProgress, e) })),
  setStageMs: (stage, ms) =>
    set((s) => ({ stageMs: { ...s.stageMs, [stage]: ms } })),
  setStatus: (status, err) =>
    set({ status, errorMessage: err ?? null }),
  setSceneResult: (p) =>
    set({
      caption: p.caption,
      objects: p.objects,
      depthData: p.depthData,
      depthWidth: p.depthWidth,
      depthHeight: p.depthHeight,
      timings: p.timings,
      status: 'done',
      selection: { objectId: null, hoveredId: null },
    }),
  setSourceCanvas: (c, w, h) =>
    set({ sourceCanvas: c, processedWidth: w, processedHeight: h }),
  setRenderMode: (m) => set({ renderMode: m }),
  setDisplacementScale: (v) => set({ displacementScale: v }),
  setCameraFov: (v) => set({ cameraFov: v }),
  setSelection: (s) =>
    set((prev) => ({ selection: { ...prev.selection, ...s } })),
  nextRunId: () => {
    const id = get().currentRunId + 1;
    set({ currentRunId: id });
    return id;
  },
  reset: () =>
    set({
      status: 'idle',
      errorMessage: null,
      caption: '',
      objects: [],
      depthData: null,
      depthWidth: 0,
      depthHeight: 0,
      timings: null,
      stageMs: {},
      florenceProgress: [],
      depthProgress: [],
      selection: { objectId: null, hoveredId: null },
    }),
}));

function upsertProgress(arr: ProgressEntry[], entry: ProgressEntry): ProgressEntry[] {
  const idx = arr.findIndex((e) => e.file === entry.file);
  if (idx >= 0) {
    const next = [...arr];
    next[idx] = entry;
    return next;
  }
  return [...arr, entry];
}

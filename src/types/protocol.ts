// ============================================================
//  SpatialLens 3D — Shared Protocol Contract
// ============================================================

// -- Main ? Worker messages -----------------------------------
export interface InitMsg    { type: 'init'; forceWasm?: boolean }
export interface AnalyzeMsg { type: 'analyze'; runId: number; bitmap: ImageBitmap }
export interface CancelMsg  { type: 'cancel';  runId: number }
export type WorkerInMsg = InitMsg | AnalyzeMsg | CancelMsg;

// -- Worker ? Main messages -----------------------------------
export interface BackendMsg  { type: 'backend'; device: 'webgpu' | 'wasm' }
export interface ProgressMsg { type: 'progress'; model: 'florence' | 'depth'; file: string; loaded: number; total: number }
export interface ReadyMsg    { type: 'ready' }
export interface StageMsg    { type: 'stage'; runId: number; stage: 'caption' | 'regions' | 'depth'; ms: number }
export interface ResultMsg   {
  type: 'result';
  runId: number;
  caption: string;
  objects: SceneObject[];
  depth: { data: Uint8Array; width: number; height: number };
  timings: { captionMs: number; regionsMs: number; depthMs: number };
}
export interface ErrorMsg { type: 'error'; runId?: number; message: string }
export type WorkerOutMsg = BackendMsg | ProgressMsg | ReadyMsg | StageMsg | ResultMsg | ErrorMsg;

// -- Shared domain types --------------------------------------
export interface SceneObject {
  id: string;
  label: string;
  box: [number, number, number, number]; // [x1,y1,x2,y2] in processed-image px
  depthNorm?: number; // 0-1, median of depth inside box / 255
}

export type RenderMode = 'textured' | 'heatmap' | 'wireframe' | 'pointcloud';

export interface Selection {
  objectId: string | null;
  hoveredId: string | null;
}

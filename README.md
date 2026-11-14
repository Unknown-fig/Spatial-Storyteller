# SpatialLens 3D

> **Browser-native computer vision diorama** — no backend, no server.

Turns any image into an interactive 2.5D displacement-mapped scene with live CV telemetry. All inference runs locally in your browser via WebGPU or WASM fallback.

## Stack

- **React 19** + **TypeScript** (strict) + **Vite**
- **three.js** — OrbitControls + CSS2DRenderer
- **@huggingface/transformers v3** — Florence-2 + Depth Anything v2 (local, in-browser)
- **Zustand** + **Tailwind CSS** + **lucide-react**

## Features

- 🧠 **Florence-2** — scene captioning + dense region grounding (object detection with boxes)
- 📏 **Depth Anything v2** — monocular depth estimation → 2.5D displacement mesh
- 🎮 **4 render modes** — Textured 3D Relief, Turbo Heatmap, Wireframe, Point Cloud
- 📌 **3D pins** — click to fly camera to object, hover to highlight 2D + 3D simultaneously
- 📊 **Inspector HUD** — backend badge, download progress, timing table, tensor X-ray, live math
- 🌐 **100% offline after first load** — models cached by browser

## Getting Started

```bash
npm install
npm run dev
```

> **First load requires internet** to download Florence-2 (~1.1 GB quantized) and Depth Anything v2 (~100 MB). After that the app works fully offline.

## Browser Support

| Feature | Chrome 113+ | Edge 113+ | Firefox | Safari |
|---------|-------------|-----------|---------|--------|
| WebGPU  | ✅          | ✅        | ❌ (falls back to WASM) | ❌ (falls back) |
| WASM    | ✅          | ✅        | ✅      | ✅ |

WASM inference is significantly slower (~30-120s per run) but fully functional.

## Controls

- **Orbit** — left drag
- **Zoom** — scroll wheel  
- **Pan** — right drag
- **Fly to object** — click any 3D pin or object card
- **Displacement slider** — controls 2.5D depth exaggeration (0–1, default 0.35)
- **FOV slider** — controls camera field of view (30–90°)

## Architecture

```
src/
├── workers/vision.worker.ts    ← CV pipeline (runs off main thread)
├── components/
│   ├── SpatialViewport.tsx     ← Three.js 3D scene
│   └── InspectorHUD.tsx        ← Telemetry + X-Ray + Live Math
├── store/appStore.ts           ← Zustand global state
├── scenes/sampleScenes.ts      ← 3 procedural canvas scenes
└── types/protocol.ts           ← Worker message contract
```

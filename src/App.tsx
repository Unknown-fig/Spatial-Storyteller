import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SpatialViewport } from './components/SpatialViewport';
import { InspectorHUD } from './components/InspectorHUD';
import { RenderModeToolbar } from './components/RenderModeToolbar';
import { SliderControls } from './components/SliderControls';
import { SceneSelector } from './components/SceneSelector';
import { useAppStore } from './store/appStore';
import type { WorkerOutMsg } from './types/protocol';
import { resizeDepth, medianDepthInBox } from './utils/depthUtils';

export const App: React.FC = () => {
  const workerRef = useRef<Worker | null>(null);
  const store = useAppStore();

  const [forceWasm, setForceWasm] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      return p.get('backend') === 'wasm' || p.has('wasm');
    }
    return false;
  });

  const initWorker = useCallback((useWasm: boolean) => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }

    const worker = new Worker(
      new URL('./workers/vision.worker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.addEventListener('message', (e: MessageEvent<WorkerOutMsg>) => {
      const msg = e.data;
      const s = useAppStore.getState();

      switch (msg.type) {
        case 'backend':
          s.setDevice(msg.device);
          break;

        case 'progress':
          if (msg.model === 'florence') {
            s.addFlorenceProgress({ file: msg.file, loaded: msg.loaded, total: msg.total });
          } else {
            s.addDepthProgress({ file: msg.file, loaded: msg.loaded, total: msg.total });
          }
          if (s.status === 'idle') {
            s.setStatus('loading-models');
          }
          break;

        case 'stage':
          s.setStageMs(msg.stage, msg.ms);
          if (!s.modelsReady && msg.stage === 'caption') {
            s.setModelsReady(true);
          }
          break;

        case 'result': {
          if (msg.runId !== s.currentRunId) break; // Stale result discarded silently

          const imgW = s.processedWidth;
          const imgH = s.processedHeight;
          const resized = resizeDepth(msg.depth.data, msg.depth.width, msg.depth.height, imgW, imgH);
          const enriched = msg.objects.map(obj => {
            const med = medianDepthInBox(resized, imgW, imgH, imgW, imgH, obj.box);
            return { ...obj, depthNorm: med / 255 };
          });

          s.setSceneResult({
            caption: msg.caption,
            objects: enriched,
            depthData: resized,
            depthWidth: imgW,
            depthHeight: imgH,
            timings: msg.timings,
          });
          s.setModelsReady(true);
          break;
        }

        case 'error':
          console.warn('[Vision Worker]', msg.message);
          if (msg.runId === undefined || msg.runId === s.currentRunId) {
            if (s.status === 'analyzing') {
              s.setStatus('error', msg.message);
            }
          }
          break;
      }
    });

    worker.postMessage({ type: 'init', forceWasm: useWasm });
  }, []);

  useEffect(() => {
    initWorker(forceWasm);

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [forceWasm, initWorker]);

  const handleToggleForceWasm = () => {
    const next = !forceWasm;
    setForceWasm(next);
    // Sync URL without full reload
    const url = new URL(window.location.href);
    if (next) {
      url.searchParams.set('backend', 'wasm');
    } else {
      url.searchParams.delete('backend');
      url.searchParams.delete('wasm');
    }
    window.history.replaceState({}, '', url.toString());
  };

  const { status, errorMessage, device } = store;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-canvas tech-grid select-none">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-4 h-11 border-b border-white/5 glass flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono font-semibold text-white/90 tracking-tight">
            SpatialLens <span className="text-accent">3D</span>
          </span>
          <span className="hidden sm:inline text-xs font-mono text-white/30">
            browser-native CV diorama · no backend
          </span>
        </div>

        <div className="flex items-center gap-3">
          {status === 'loading-models' && (
            <span className="text-xs font-mono text-wasm animate-pulse">
              ? downloading models (first visit)…
            </span>
          )}
          {status === 'error' && (
            <span className="text-xs font-mono text-red-400 truncate max-w-xs" title={errorMessage ?? ''}>
              ? {errorMessage?.slice(0, 50)}
            </span>
          )}
          {device && (
            <button
              onClick={handleToggleForceWasm}
              title="Click to toggle WebGPU / WASM"
              className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                device === 'webgpu'
                  ? 'text-webgpu border-webgpu/30 bg-webgpu/10 hover:border-webgpu/60'
                  : 'text-wasm border-wasm/30 bg-wasm/10 hover:border-wasm/60'
              }`}
            >
              {device.toUpperCase()}
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Viewport Column */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Controls toolbar */}
          <div className="flex items-center gap-4 px-3 py-2 border-b border-white/5 glass flex-shrink-0 z-10 overflow-x-auto">
            <RenderModeToolbar />
            <div className="w-px h-5 bg-white/10 hidden sm:block" />
            <SliderControls />
          </div>

          {/* Three.js 3D Viewport */}
          <div className="flex-1 relative overflow-hidden">
            <SpatialViewport />

            {/* Empty state prompt */}
            {status === 'idle' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center space-y-2 p-6 rounded-xl glass pointer-events-auto border border-white/5">
                  <p className="text-3xl font-mono text-accent">?</p>
                  <p className="text-sm font-mono text-white/70 font-semibold">
                    Select a built-in sample scene below or upload an image
                  </p>
                  <p className="text-xs font-mono text-white/40">
                    All AI inference runs locally in browser via WebGPU / WASM
                  </p>
                </div>
              </div>
            )}

            {/* Analyzing overlay indicator */}
            {status === 'analyzing' && (
              <div className="absolute top-3 left-3 glass px-3 py-1.5 rounded text-xs font-mono text-accent animate-pulse border border-accent/30 shadow-lg">
                ? Executing local CV pipeline…
              </div>
            )}
          </div>

          {/* Bottom Bar — Scene Selector & Upload */}
          <div className="flex items-center px-3 py-2 border-t border-white/5 glass flex-shrink-0 z-10 overflow-x-auto">
            <SceneSelector workerRef={workerRef as React.RefObject<Worker | null>} />
          </div>
        </div>

        {/* Right Column — Inspector HUD */}
        <div className="relative h-full border-l border-white/5">
          <InspectorHUD
            onToggleForceWasm={handleToggleForceWasm}
            isForcingWasm={forceWasm}
          />
        </div>
      </div>
    </div>
  );
};

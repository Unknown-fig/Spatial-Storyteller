import React, { useRef, useEffect, useState } from 'react';
import { ChevronRight, ChevronLeft, Cpu, Zap, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { medianDepthInBox } from '../utils/depthUtils';
import type { SceneObject } from '../types/protocol';

interface InspectorHUDProps {
  onToggleForceWasm?: () => void;
  isForcingWasm?: boolean;
}

export const InspectorHUD: React.FC<InspectorHUDProps> = ({ onToggleForceWasm, isForcingWasm }) => {
  const [collapsed, setCollapsed] = useState(false);
  const store = useAppStore();
  const {
    device, modelsReady, florenceProgress, depthProgress, timings, stageMs,
    caption, objects, depthData, depthWidth, depthHeight,
    processedWidth, processedHeight, sourceCanvas,
    selection, setSelection, displacementScale,
  } = store;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute right-0 top-1/2 -translate-y-1/2 glass rounded-l-lg p-2 z-20 hover:bg-white/10 transition-colors"
        title="Open Inspector"
      >
        <ChevronLeft size={16} className="text-accent" />
      </button>
    );
  }

  return (
    <div className="relative h-full w-80 flex-shrink-0 glass overflow-y-auto z-10">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5 sticky top-0 glass z-10">
        <span className="text-xs font-mono text-white/70 tracking-widest uppercase">CV Telemetry HUD</span>
        <button
          onClick={() => setCollapsed(true)}
          className="text-white/40 hover:text-white/80 transition-colors"
          title="Collapse Inspector"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="flex flex-col gap-0">
        <TelemetrySection
          device={device}
          modelsReady={modelsReady}
          florenceProgress={florenceProgress}
          depthProgress={depthProgress}
          timings={timings}
          stageMs={stageMs}
          onToggleForceWasm={onToggleForceWasm}
          isForcingWasm={isForcingWasm}
        />

        <TensorXRay
          sourceCanvas={sourceCanvas}
          objects={objects}
          depthData={depthData}
          depthWidth={depthWidth}
          depthHeight={depthHeight}
          processedWidth={processedWidth}
          processedHeight={processedHeight}
          caption={caption}
          selection={selection}
          setSelection={setSelection}
        />

        {selection.objectId && (
          <LiveMathPanel
            objects={objects}
            objectId={selection.objectId}
            depthData={depthData}
            depthWidth={depthWidth}
            depthHeight={depthHeight}
            processedWidth={processedWidth}
            processedHeight={processedHeight}
            displacementScale={displacementScale}
          />
        )}
      </div>
    </div>
  );
};

// -- Telemetry --------------------------------------------------------------
const TelemetrySection: React.FC<{
  device: 'webgpu' | 'wasm' | null;
  modelsReady: boolean;
  florenceProgress: { file: string; loaded: number; total: number }[];
  depthProgress: { file: string; loaded: number; total: number }[];
  timings: { captionMs: number; regionsMs: number; depthMs: number } | null;
  stageMs: { caption?: number; regions?: number; depth?: number };
  onToggleForceWasm?: () => void;
  isForcingWasm?: boolean;
}> = ({ device, modelsReady, florenceProgress, depthProgress, timings, stageMs, onToggleForceWasm, isForcingWasm }) => {
  const [open, setOpen] = useState(true);

  return (
    <Section title="Telemetry" open={open} onToggle={() => setOpen(o => !o)}>
      {/* Backend badge + Force WASM toggle */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          {device === 'webgpu' ? (
            <span className="flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded bg-webgpu/10 text-webgpu border border-webgpu/30">
              <Zap size={11} /> WebGPU
            </span>
          ) : device === 'wasm' ? (
            <span className="flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded bg-wasm/10 text-wasm border border-wasm/30">
              <Cpu size={11} /> WASM
            </span>
          ) : (
            <span className="text-xs font-mono text-white/30">— detecting —</span>
          )}
          {modelsReady && (
            <span className="text-xs font-mono text-emerald-400/80">ready</span>
          )}
        </div>

        {onToggleForceWasm && (
          <button
            onClick={onToggleForceWasm}
            title={isForcingWasm ? 'Click to allow WebGPU' : 'Click to force WASM CPU mode'}
            className={`flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
              isForcingWasm
                ? 'border-wasm/60 bg-wasm/10 text-wasm'
                : 'border-white/10 text-white/40 hover:text-white/70 hover:border-white/20'
            }`}
          >
            <RefreshCw size={9} />
            {isForcingWasm ? 'Forced WASM' : 'Force WASM'}
          </button>
        )}
      </div>

      {/* Download progress (first load) */}
      {!modelsReady && (florenceProgress.length > 0 || depthProgress.length > 0) && (
        <div className="mb-3 space-y-2 p-2 rounded bg-white/5 border border-white/5">
          <p className="text-[11px] font-mono text-white/50 mb-1">
            Downloading models (first visit only — cached offline after)
          </p>
          <ProgressGroup label="Florence-2" entries={florenceProgress} />
          <ProgressGroup label="Depth Anything v2" entries={depthProgress} />
        </div>
      )}

      {/* Timing table */}
      <table className="w-full text-xs font-mono">
        <tbody>
          <TimingRow label="Florence Caption" ms={timings?.captionMs ?? stageMs.caption} />
          <TimingRow label="Region Grounding" ms={timings?.regionsMs ?? stageMs.regions} />
          <TimingRow label="Depth Estimation" ms={timings?.depthMs ?? stageMs.depth} />
          {timings && (
            <tr className="border-t border-white/10 mt-1">
              <td className="py-1 text-white/50 font-semibold">Total Inference</td>
              <td className="py-1 text-right text-accent font-semibold">
                {(timings.captionMs + timings.regionsMs + timings.depthMs).toLocaleString()} ms
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Section>
  );
};

const ProgressGroup: React.FC<{ label: string; entries: { file: string; loaded: number; total: number }[] }> = ({ label, entries }) => {
  const total = entries.reduce((s, e) => s + (e.total || 1), 0);
  const loaded = entries.reduce((s, e) => s + (e.loaded || 0), 0);
  const pct = total > 0 ? Math.min(100, (loaded / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-[11px] font-mono text-white/60 mb-0.5">
        <span>{label}</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1 bg-white/10 rounded overflow-hidden">
        <div className="h-full progress-bar-fill rounded" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const TimingRow: React.FC<{ label: string; ms?: number }> = ({ label, ms }) => (
  <tr>
    <td className="py-0.5 text-white/40">{label}</td>
    <td className="py-0.5 text-right text-white/80">
      {ms !== undefined ? `${ms.toLocaleString()} ms` : <span className="text-white/20">—</span>}
    </td>
  </tr>
);

// -- Tensor X-Ray -----------------------------------------------------------
const TensorXRay: React.FC<{
  sourceCanvas: HTMLCanvasElement | null;
  objects: SceneObject[];
  depthData: Uint8Array | null;
  depthWidth: number; depthHeight: number;
  processedWidth: number; processedHeight: number;
  caption: string;
  selection: { objectId: string | null; hoveredId: string | null };
  setSelection: (s: { objectId?: string | null; hoveredId?: string | null }) => void;
}> = ({
  sourceCanvas, objects, depthData, depthWidth, depthHeight,
  processedWidth, processedHeight, caption, selection, setSelection
}) => {
  const [open, setOpen] = useState(true);
  const srcCanvasRef = useRef<HTMLCanvasElement>(null);
  const depthCanvasRef = useRef<HTMLCanvasElement>(null);

  // Redraw source image with 2D bboxes
  useEffect(() => {
    const c = srcCanvasRef.current;
    if (!c || !sourceCanvas) return;
    const ctx = c.getContext('2d')!;
    c.width = sourceCanvas.width;
    c.height = sourceCanvas.height;
    ctx.drawImage(sourceCanvas, 0, 0);

    for (const obj of objects) {
      const isHov = obj.id === selection.hoveredId || obj.id === selection.objectId;
      ctx.strokeStyle = isHov ? '#00D9FF' : 'rgba(0, 217, 255, 0.45)';
      ctx.lineWidth = isHov ? 2.5 : 1;
      const [x1, y1, x2, y2] = obj.box;
      const bw = x2 - x1;
      const bh = y2 - y1;
      ctx.strokeRect(x1, y1, bw, bh);

      ctx.fillStyle = isHov ? 'rgba(0, 217, 255, 0.18)' : 'rgba(0, 217, 255, 0.04)';
      ctx.fillRect(x1, y1, bw, bh);

      ctx.fillStyle = isHov ? '#00D9FF' : 'rgba(0, 217, 255, 0.75)';
      ctx.font = '10px monospace';
      ctx.fillText(obj.label.slice(0, 18), x1 + 2, Math.max(12, y1 + 12));
    }
  }, [sourceCanvas, objects, selection]);

  // Redraw depth tensor canvas
  useEffect(() => {
    const c = depthCanvasRef.current;
    if (!c || !depthData || depthWidth === 0 || depthHeight === 0) return;
    const ctx = c.getContext('2d')!;
    c.width = depthWidth;
    c.height = depthHeight;
    const imageData = ctx.createImageData(depthWidth, depthHeight);
    for (let i = 0; i < depthData.length; i++) {
      const v = depthData[i] ?? 0;
      imageData.data[i * 4]     = v; // R
      imageData.data[i * 4 + 1] = v; // G
      imageData.data[i * 4 + 2] = v; // B
      imageData.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
  }, [depthData, depthWidth, depthHeight]);

  return (
    <Section title="Tensor X-Ray" open={open} onToggle={() => setOpen(o => !o)}>
      {!sourceCanvas ? (
        <EmptyState text="Select a scene or upload an image" />
      ) : (
        <>
          {caption && (
            <div className="mb-2 p-2 rounded bg-white/5 border border-white/5">
              <span className="text-[10px] font-mono text-white/40 block mb-0.5">Scene Caption</span>
              <p className="text-xs font-mono text-white/80 leading-relaxed italic">
                "{caption}"
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5 mb-3">
            <div>
              <p className="text-[10px] font-mono text-white/40 mb-1">Source + 2D BBoxes</p>
              <canvas
                ref={srcCanvasRef}
                className="w-full rounded border border-white/10"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            <div>
              <p className="text-[10px] font-mono text-white/40 mb-1">Depth Tensor (NEAR = White)</p>
              <canvas
                ref={depthCanvasRef}
                className="w-full rounded border border-white/10"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
          </div>

          {/* Object cards */}
          <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
            {objects.length === 0 ? (
              <EmptyState text="No grounded regions detected" />
            ) : (
              objects.map((obj) => (
                <ObjectCard
                  key={obj.id}
                  obj={obj}
                  isActive={obj.id === selection.objectId}
                  isHovered={obj.id === selection.hoveredId}
                  onHover={(h) => setSelection({ hoveredId: h ? obj.id : null })}
                  onClick={() => setSelection({ objectId: obj.id })}
                  depthData={depthData}
                  depthWidth={depthWidth}
                  depthHeight={depthHeight}
                  imgW={processedWidth}
                  imgH={processedHeight}
                />
              ))
            )}
          </div>
        </>
      )}
    </Section>
  );
};

const ObjectCard: React.FC<{
  obj: SceneObject;
  isActive: boolean;
  isHovered: boolean;
  onHover: (h: boolean) => void;
  onClick: () => void;
  depthData: Uint8Array | null;
  depthWidth: number;
  depthHeight: number;
  imgW: number;
  imgH: number;
}> = ({ obj, isActive, isHovered, onHover, onClick, depthData, depthWidth, depthHeight, imgW, imgH }) => {
  const depthNorm = depthData && depthWidth > 0 && imgW > 0
    ? medianDepthInBox(depthData, depthWidth, depthHeight, imgW, imgH, obj.box) / 255
    : null;

  return (
    <div
      className={`p-2 rounded cursor-pointer border transition-all duration-100 ${
        isActive
          ? 'border-accent bg-accent/15'
          : isHovered
          ? 'border-accent/40 bg-accent/5'
          : 'border-white/5 bg-white/2 hover:bg-white/5'
      }`}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono text-white/90 truncate">{obj.label}</p>
        {depthNorm !== null && (
          <span className="text-[11px] font-mono text-accent">
            Z: {depthNorm.toFixed(3)}
          </span>
        )}
      </div>
    </div>
  );
};

// -- Live Math Panel --------------------------------------------------------
const LiveMathPanel: React.FC<{
  objects: SceneObject[];
  objectId: string;
  depthData: Uint8Array | null;
  depthWidth: number;
  depthHeight: number;
  processedWidth: number;
  processedHeight: number;
  displacementScale: number;
}> = ({ objects, objectId, depthData, depthWidth, depthHeight, processedWidth, processedHeight, displacementScale }) => {
  const [open, setOpen] = useState(true);
  const obj = objects.find(o => o.id === objectId);
  if (!obj) return null;

  const [x1, y1, x2, y2] = obj.box;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const imgW = processedWidth;
  const imgH = processedHeight;
  const planeW = imgW > 0 && imgH > 0 ? imgW / imgH : 1;
  const planeH = 1;

  let depthNorm = 0;
  if (depthData && depthWidth > 0 && imgW > 0) {
    depthNorm = medianDepthInBox(depthData, depthWidth, depthHeight, imgW, imgH, obj.box) / 255;
  }

  const u = imgW > 0 ? cx / imgW : 0;
  const v = imgH > 0 ? cy / imgH : 0;
  const X = (u - 0.5) * planeW;
  const Y = (0.5 - v) * planeH;
  const Z = depthNorm * displacementScale;

  const mathRow = (eq: string, val: string) => (
    <tr key={eq} className="border-b border-white/5">
      <td className="py-1 pr-2 text-white/40 font-mono text-xs">{eq}</td>
      <td className="py-1 text-right text-accent font-mono text-xs">{val}</td>
    </tr>
  );

  return (
    <Section title="Live Math" open={open} onToggle={() => setOpen(o => !o)}>
      <p className="text-xs font-mono text-white/60 mb-2 truncate">
        Selected: <span className="text-white font-semibold">{obj.label}</span>
      </p>

      <table className="w-full mb-3">
        <tbody>
          {mathRow('u = cx / imgW', `${cx.toFixed(1)} / ${imgW} = ${u.toFixed(4)}`)}
          {mathRow('v = cy / imgH', `${cy.toFixed(1)} / ${imgH} = ${v.toFixed(4)}`)}
          {mathRow('Z_norm = median / 255', depthNorm.toFixed(4))}
          {mathRow('X = (u - 0.5) × W_plane', `${X.toFixed(4)}`)}
          {mathRow('Y = (0.5 - v) × H_plane', `${Y.toFixed(4)}`)}
          {mathRow('Z = Z_norm × dispScale', `${depthNorm.toFixed(3)} × ${displacementScale.toFixed(2)} = ${Z.toFixed(4)}`)}
        </tbody>
      </table>

      <div className="space-y-2">
        <Callout
          color="amber"
          text="? Monocular Scale Ambiguity: Estimated depth is relative (0–1), not metric physical distance."
        />
        <Callout
          color="red"
          text="? Silhouette Edge-Stretching: At high displacementScale, geometry stretching occurs at object silhouettes."
        />
      </div>
    </Section>
  );
};

// -- Shared UI primitives ---------------------------------------------------
const Section: React.FC<{ title: string; open: boolean; onToggle: () => void; children: React.ReactNode }> = ({ title, open, onToggle, children }) => (
  <div className="border-b border-white/5">
    <button
      className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/3 transition-colors"
      onClick={onToggle}
    >
      <span className="text-xs font-mono text-white/50 uppercase tracking-wider">{title}</span>
      <ChevronRight size={12} className={`text-white/30 transition-transform ${open ? 'rotate-90' : ''}`} />
    </button>
    {open && <div className="px-3 pb-3">{children}</div>}
  </div>
);

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <p className="text-xs font-mono text-white/20 text-center py-3">{text}</p>
);

const Callout: React.FC<{ color: 'amber' | 'red'; text: string }> = ({ color, text }) => (
  <div className={`text-[11px] font-mono leading-relaxed p-2 rounded border ${
    color === 'amber'
      ? 'border-wasm/30 bg-wasm/5 text-wasm'
      : 'border-red-500/30 bg-red-500/5 text-red-300'
  }`}>
    {text}
  </div>
);

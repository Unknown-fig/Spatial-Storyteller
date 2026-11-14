import React, { useRef } from 'react';
import { Upload, ImageIcon, Loader2 } from 'lucide-react';
import { SAMPLE_SCENES, renderScene, type SampleSceneId } from '../scenes/sampleScenes';
import { useAppStore } from '../store/appStore';
import { prepareCanvas, canvasToBitmap } from '../utils/imageUtils';

interface SceneSelectorProps {
  workerRef: React.RefObject<Worker | null>;
}

export const SceneSelector: React.FC<SceneSelectorProps> = ({ workerRef }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const store = useAppStore();
  const { status, modelsReady, nextRunId, setStatus, setSourceCanvas, reset, currentRunId } = store;

  const isAnalyzing = status === 'analyzing';
  // Allow switching/uploading even if analyzing (to test mid-run cancellation)
  const disabled = !modelsReady;

  const runAnalysis = async (canvas: HTMLCanvasElement) => {
    const worker = workerRef.current;
    if (!worker) return;

    // If there was an ongoing run, cancel it explicitly
    if (currentRunId > 0) {
      worker.postMessage({ type: 'cancel', runId: currentRunId });
    }

    reset();
    setStatus('analyzing');
    setSourceCanvas(canvas, canvas.width, canvas.height);

    const runId = nextRunId();

    // Create bitmap for transfer (canvas remains in main thread for display)
    const bitmap = await canvasToBitmap(canvas);
    worker.postMessage({ type: 'analyze', runId, bitmap }, [bitmap]);
  };

  const handleSampleScene = async (id: SampleSceneId) => {
    if (disabled) return;
    try {
      setStatus('analyzing');
      const { canvas } = await renderScene(id);
      await runAnalysis(canvas);
    } catch (e) {
      setStatus('error', String(e));
    }
  };

  const handleUpload = async (file: File) => {
    if (disabled) return;
    try {
      setStatus('analyzing');
      const canvas = await prepareCanvas(file);
      await runAnalysis(canvas);
    } catch (e) {
      setStatus('error', String(e));
    }
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-mono text-white/30 uppercase tracking-wider">Sample Scenes</span>

      {SAMPLE_SCENES.map(s => (
        <button
          key={s.id}
          disabled={disabled}
          onClick={() => void handleSampleScene(s.id)}
          title={s.desc}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded border transition-all duration-150 ${
            disabled
              ? 'opacity-30 cursor-not-allowed border-white/10 text-white/30'
              : 'border-white/10 text-white/70 hover:border-accent/40 hover:text-accent hover:bg-white/5 active:scale-95'
          }`}
        >
          <ImageIcon size={12} />
          {s.label}
        </button>
      ))}

      <div className="w-px h-5 bg-white/10" />

      <button
        disabled={disabled}
        onClick={() => fileRef.current?.click()}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded border transition-all duration-150 ${
          disabled
            ? 'opacity-30 cursor-not-allowed border-white/10 text-white/30'
            : 'border-accent/40 text-accent hover:border-accent hover:bg-accent/10 active:scale-95'
        }`}
      >
        <Upload size={12} />
        Upload Image
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) void handleUpload(f);
          e.target.value = '';
        }}
      />

      {isAnalyzing && (
        <span className="flex items-center gap-1.5 text-xs font-mono text-accent animate-pulse ml-2">
          <Loader2 size={12} className="animate-spin" />
          Analyzing scene…
        </span>
      )}
    </div>
  );
};

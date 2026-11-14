import React from 'react';
import { Grid3X3, Layers, Eye, Dot } from 'lucide-react';
import type { RenderMode } from '../types/protocol';
import { useAppStore } from '../store/appStore';

const MODES: { id: RenderMode; label: string; icon: React.ReactNode }[] = [
  { id: 'textured',    label: '3D Relief',   icon: <Layers size={13} /> },
  { id: 'heatmap',    label: 'Heatmap',      icon: <Eye size={13} /> },
  { id: 'wireframe',  label: 'Wireframe',    icon: <Grid3X3 size={13} /> },
  { id: 'pointcloud', label: 'Point Cloud',  icon: <Dot size={13} /> },
];

export const RenderModeToolbar: React.FC = () => {
  const { renderMode, setRenderMode, depthData } = useAppStore();
  const disabled = !depthData;

  return (
    <div className="flex gap-1">
      {MODES.map(m => (
        <button
          key={m.id}
          disabled={disabled}
          onClick={() => setRenderMode(m.id)}
          className={`mode-btn flex items-center gap-1.5 ${renderMode === m.id ? 'active' : ''} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
          title={m.label}
        >
          {m.icon}
          <span className="hidden sm:inline">{m.label}</span>
        </button>
      ))}
    </div>
  );
};

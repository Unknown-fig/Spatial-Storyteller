import React from 'react';
import { useAppStore } from '../store/appStore';

export const SliderControls: React.FC = () => {
  const { displacementScale, setDisplacementScale, cameraFov, setCameraFov, depthData } = useAppStore();
  const disabled = !depthData;

  return (
    <div className="flex items-center gap-6">
      <SliderField
        label="Displacement"
        value={displacementScale}
        min={0} max={1} step={0.01}
        disabled={disabled}
        onChange={setDisplacementScale}
        display={displacementScale.toFixed(2)}
      />
      <SliderField
        label="FOV"
        value={cameraFov}
        min={30} max={90} step={1}
        disabled={disabled}
        onChange={setCameraFov}
        display={`${cameraFov}°`}
      />
    </div>
  );
};

const SliderField: React.FC<{
  label: string; value: number; min: number; max: number; step: number;
  disabled: boolean; onChange: (v: number) => void; display: string;
}> = ({ label, value, min, max, step, disabled, onChange, display }) => (
  <div className="flex items-center gap-2 min-w-0">
    <span className="text-xs font-mono text-white/40 whitespace-nowrap">{label}</span>
    <input
      type="range" min={min} max={max} step={step} value={value}
      disabled={disabled}
      onChange={e => onChange(parseFloat(e.target.value))}
      className={`w-24 ${disabled ? 'opacity-30' : ''}`}
    />
    <span className="text-xs font-mono text-accent/80 w-10 text-right">{display}</span>
  </div>
);

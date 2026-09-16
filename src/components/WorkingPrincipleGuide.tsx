import React from 'react';
import {
  TopologyType,
  WorkingPrincipleStage,
  WaveformPoint,
} from '../types';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Info,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface WorkingPrincipleGuideProps {
  topology: TopologyType;
  stages: WorkingPrincipleStage[];
  currentPoint: WaveformPoint;
  scrubberIndex: number;
  totalPoints: number;
  onScrub: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  vdc: number;
  f0: number;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
}

export const WorkingPrincipleGuide: React.FC<WorkingPrincipleGuideProps> = ({
  topology,
  stages,
  currentPoint,
  scrubberIndex,
  totalPoints,
  onScrub,
  isPlaying,
  onTogglePlay,
  vdc,
  f0,
  playbackSpeed,
  onSpeedChange,
}) => {
  // Determine current active stage based on phaseDeg
  const deg = currentPoint.phaseDeg;
  const activeStage =
    stages.find((s) => deg >= s.degStart && deg < s.degEnd) ||
    stages[stages.length - 1] ||
    stages[0];

  const jumpToStage = (stage: WorkingPrincipleStage) => {
    const ratio = stage.centerDeg / 360;
    const targetIdx = Math.min(totalPoints - 1, Math.round(ratio * totalPoints));
    onScrub(targetIdx);
  };

  const handleStep = (direction: 'prev' | 'next') => {
    if (!activeStage) return;
    const currentIdx = stages.findIndex((s) => s.id === activeStage.id);
    let targetIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;
    if (targetIdx < 0) targetIdx = stages.length - 1;
    if (targetIdx >= stages.length) targetIdx = 0;
    jumpToStage(stages[targetIdx]);
  };

  const is2L = topology === '2L-VSI';
  const isOEW = topology === 'OEW-VSI';

  const poleLevelCount = is2L ? 2 : 3;
  const poleVoltageText = is2L
    ? '2 Levels: +V_dc/2 (+400V) and -V_dc/2 (-400V)'
    : isOEW
    ? '3 Differential Levels: +V_dc (+800V), 0V, and -V_dc (-800V)'
    : '3 Levels: +V_dc/2 (+400V), 0V (Neutral), and -V_dc/2 (-400V)';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-4">
      {/* Top Banner: Mode Identity and Philosophy */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-mono font-bold text-white tracking-wide">
                Working Principle Mode • 1-Cycle Fundamental Operation
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-sky-950 border border-sky-500/40 text-sky-300">
                Square Wave (No PWM)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Simplified 1-cycle view highlighting {poleLevelCount}-level pole voltage transitions, load current lag, and exact semiconductor conduction paths.
            </p>
          </div>
        </div>

        {/* Playback & Step Controls */}
        <div className="flex items-center gap-2">
          {/* Step Back Button */}
          <button
            onClick={() => handleStep('prev')}
            title="Jump to previous commutation stage"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono border border-slate-700 transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Prev Stage
          </button>

          {/* Play/Pause Button */}
          <button
            onClick={onTogglePlay}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition shadow ${
              isPlaying
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            {isPlaying ? 'Pause' : 'Play Cycle'}
          </button>

          {/* Step Forward Button */}
          <button
            onClick={() => handleStep('next')}
            title="Jump to next commutation stage"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono border border-slate-700 transition"
          >
            Next Stage <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Speed Presets */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[11px] font-mono">
            {[0.1, 0.25, 0.5, 1.0].map((spd) => (
              <button
                key={spd}
                onClick={() => onSpeedChange(spd)}
                className={`px-2 py-1 rounded transition ${
                  playbackSpeed === spd
                    ? 'bg-sky-500/20 text-sky-300 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          <button
            onClick={() => onScrub(0)}
            title="Reset to 0°"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Interactive 1-Cycle Timeline Ribbon (0° to 360°) */}
      <div>
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1.5">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>1-Cycle Commutation Timeline (0° to 360°):</span>
          </span>
          <span>
            Current Electrical Angle:{' '}
            <strong className="text-white font-mono text-sm">{currentPoint.phaseDeg.toFixed(1)}°</strong>{' '}
            <span className="text-slate-500">({(currentPoint.t * 1000).toFixed(2)} ms)</span>
          </span>
        </div>

        <div className="relative w-full h-11 bg-slate-950 rounded-lg border border-slate-800 p-1 flex gap-1 select-none overflow-hidden">
          {stages.map((st) => {
            const widthPct = ((st.degEnd - st.degStart) / 360) * 100;
            const isActive = activeStage?.id === st.id;

            // Color coding based on state and current
            let bgClass = 'bg-slate-800/80 border-slate-700 text-slate-300';
            if (st.stateA === 'P') {
              bgClass = st.currentSign >= 0
                ? 'bg-emerald-950/80 border-emerald-600/50 text-emerald-300 hover:bg-emerald-900/80'
                : 'bg-teal-950/80 border-teal-600/50 text-teal-300 hover:bg-teal-900/80';
            } else if (st.stateA === 'N') {
              bgClass = st.currentSign <= 0
                ? 'bg-rose-950/80 border-rose-600/50 text-rose-300 hover:bg-rose-900/80'
                : 'bg-orange-950/80 border-orange-600/50 text-orange-300 hover:bg-orange-900/80';
            } else {
              // State O
              bgClass = 'bg-indigo-950/80 border-indigo-600/50 text-indigo-300 hover:bg-indigo-900/80';
            }

            return (
              <button
                key={st.id}
                onClick={() => jumpToStage(st)}
                style={{ width: `${widthPct}%` }}
                className={`h-full rounded flex flex-col items-center justify-center text-[10px] font-mono px-1 transition-all border ${bgClass} ${
                  isActive
                    ? 'ring-2 ring-white scale-[1.02] z-10 shadow-lg font-bold'
                    : 'opacity-75 hover:opacity-100'
                }`}
              >
                <span className="truncate leading-tight">{st.phaseRange}</span>
                <span className="truncate text-[9px] opacity-80">
                  {st.stateA === 'P' ? '+Vdc/2' : st.stateA === 'N' ? '-Vdc/2' : '0V (O)'}
                </span>
              </button>
            );
          })}

          {/* Needle Indicator for current scrubber angle */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-white shadow-md pointer-events-none transition-[left] duration-75 z-20"
            style={{ left: `${(currentPoint.phaseDeg / 360) * 100}%` }}
          >
            <div className="w-2.5 h-2.5 bg-white rounded-full -ml-[3px] -mt-1 shadow-sm" />
          </div>
        </div>
      </div>

      {/* Stage Detail Card: Active Devices, Physics Explanation, and Electrical State */}
      {activeStage && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-950/90 border border-slate-800 rounded-lg p-3.5">
          {/* Left Column: Stage Status & Devices */}
          <div className="md:col-span-4 space-y-2 border-b md:border-b-0 md:border-r border-slate-800/80 pb-3 md:pb-0 md:pr-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Active Operating Stage
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-950 text-sky-300 border border-sky-600/40">
                {activeStage.phaseRange}
              </span>
            </div>

            <div className="font-mono text-sm font-bold text-white flex items-center gap-1.5">
              <span>{activeStage.title}</span>
            </div>

            {/* Conducting Semiconductor Tags */}
            <div className="pt-1">
              <span className="text-[10px] font-mono text-slate-400 block mb-1">
                Active Conducting Devices:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {activeStage.activeDevices.map((dev) => (
                  <span
                    key={dev}
                    className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 shadow-sm flex items-center gap-1"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {dev}
                  </span>
                ))}
              </div>
            </div>

            {/* Instantaneous Values */}
            <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] font-mono">
              <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Pole Voltage V_AN</span>
                <strong
                  className={
                    currentPoint.van > 0
                      ? 'text-emerald-400'
                      : currentPoint.van < 0
                      ? 'text-rose-400'
                      : 'text-indigo-400'
                  }
                >
                  {currentPoint.van > 0 ? `+${currentPoint.van.toFixed(0)}` : currentPoint.van.toFixed(0)} V
                </strong>
              </div>
              <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Phase Current i_a</span>
                <strong
                  className={currentPoint.ia >= 0 ? 'text-emerald-400' : 'text-amber-400'}
                >
                  {currentPoint.ia >= 0 ? `+${currentPoint.ia.toFixed(1)}` : currentPoint.ia.toFixed(1)} A
                </strong>
              </div>
            </div>
          </div>

          {/* Right Column: Physical & Electrical Explanation */}
          <div className="md:col-span-8 space-y-2 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-300 mb-1">
                <Info className="w-3.5 h-3.5 text-sky-400" />
                <span>Working Principle &amp; Commutation Mechanism:</span>
              </div>
              <p className="text-xs font-sans text-slate-300 leading-relaxed">
                {activeStage.physicsExplanation}
              </p>
            </div>

            {/* Educational Takeaway Bar */}
            <div className="p-2.5 rounded-lg bg-sky-950/40 border border-sky-800/40 text-xs font-mono text-sky-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                <span>
                  <strong>Topology Architecture Note:</strong> {poleVoltageText}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 shrink-0 hidden sm:block">
                Fundamental f0: <strong>{f0} Hz</strong> | V_dc: <strong>{vdc}V</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

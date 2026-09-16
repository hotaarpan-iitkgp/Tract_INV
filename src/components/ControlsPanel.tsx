import React from 'react';
import { InverterParameters, ModulationScheme, CarrierDisposition, TopologyType } from '../types';
import { Sliders, Zap, Sparkles } from 'lucide-react';

interface ControlsPanelProps {
  params: InverterParameters;
  onChange: (updated: InverterParameters) => void;
  topology: TopologyType;
}

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  params,
  onChange,
  topology,
}) => {
  const updateField = <K extends keyof InverterParameters>(field: K, val: InverterParameters[K]) => {
    onChange({ ...params, [field]: val });
  };

  const applyPreset = (presetName: string) => {
    if (presetName === '800v-perf') {
      onChange({
        ...params,
        vdc: 800,
        ma: 0.88,
        f0: 75,
        fsw: 16000,
        modulation: 'THIPWM',
        carrierDisposition: 'IPD',
        ls: 1.0,
        rs: 0.05,
        epeak: 290,
      });
    } else if (presetName === '400v-urban') {
      onChange({
        ...params,
        vdc: 400,
        ma: 0.80,
        f0: 50,
        fsw: 10000,
        modulation: 'SPWM',
        carrierDisposition: 'IPD',
        ls: 1.5,
        rs: 0.08,
        epeak: 140,
      });
    } else if (presetName === 'formula-e') {
      onChange({
        ...params,
        vdc: 900,
        ma: 0.95,
        f0: 400,
        fsw: 32000,
        modulation: 'THIPWM',
        carrierDisposition: 'PSPWM',
        ls: 0.4,
        rs: 0.02,
        epeak: 350,
      });
    } else if (presetName === 'low-loss-dpwm') {
      onChange({
        ...params,
        vdc: 800,
        ma: 0.92,
        f0: 60,
        fsw: 12000,
        modulation: 'DPWM1',
        carrierDisposition: 'IPD',
        ls: 1.2,
        rs: 0.06,
        epeak: 270,
      });
    }
  };

  const isOvermodulated = params.ma > (params.modulation === 'SPWM' ? 1.0 : 1.1547);
  const is3Level = topology !== '2L-VSI';

  return (
    <div id="panel-c-controls" className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-xl space-y-3">
      {/* Header & Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-indigo-950/70 border border-indigo-500/40 text-indigo-400">
            <Sliders className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
            Inverter Parameters &amp; Modulation
          </span>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> Presets:
          </span>
          <button
            onClick={() => applyPreset('800v-perf')}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-mono text-sky-300 transition"
          >
            800V SiC
          </button>
          <button
            onClick={() => applyPreset('400v-urban')}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-mono text-emerald-300 transition"
          >
            400V EV
          </button>
          <button
            onClick={() => applyPreset('formula-e')}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-mono text-purple-300 transition"
          >
            High-Speed
          </button>
          <button
            onClick={() => applyPreset('low-loss-dpwm')}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-mono text-amber-300 transition"
          >
            DPWM1
          </button>
        </div>
      </div>

      {/* Grid of Sliders and Modulation Pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Vdc */}
        <div className="space-y-1 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-slate-400 flex items-center gap-1">
              <Zap className="w-3 h-3 text-sky-400" /> V_dc
            </span>
            <span className="font-bold text-sky-300">{params.vdc} V</span>
          </div>
          <input
            type="range"
            min={200}
            max={1000}
            step={20}
            value={params.vdc}
            onChange={(e) => updateField('vdc', parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-sky-400"
          />
        </div>

        {/* Modulation Index ma */}
        <div className="space-y-1 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-slate-400">Index (m_a)</span>
            <span className={`font-bold ${isOvermodulated ? 'text-amber-400' : 'text-purple-300'}`}>
              {params.ma.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={0.1}
            max={1.15}
            step={0.01}
            value={params.ma}
            onChange={(e) => updateField('ma', parseFloat(e.target.value))}
            className={`w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer ${
              isOvermodulated ? 'accent-amber-400' : 'accent-purple-400'
            }`}
          />
        </div>

        {/* Fundamental Frequency f0 */}
        <div className="space-y-1 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-slate-400">Fundamental (f_0)</span>
            <span className="font-bold text-pink-300">{params.f0} Hz</span>
          </div>
          <input
            type="range"
            min={10}
            max={500}
            step={5}
            value={params.f0}
            onChange={(e) => updateField('f0', parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-pink-400"
          />
        </div>

        {/* Switching Frequency fsw */}
        <div className="space-y-1 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-slate-400">Carrier (f_sw)</span>
            <span className="font-bold text-emerald-300">{(params.fsw / 1000).toFixed(1)} kHz</span>
          </div>
          <input
            type="range"
            min={2000}
            max={40000}
            step={1000}
            value={params.fsw}
            onChange={(e) => updateField('fsw', parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-emerald-400"
          />
        </div>
      </div>

      {/* Row 2: Modulation Strategy & Carrier Disposition & Load Params */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Modulation Reference Strategy */}
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-300 font-semibold">Modulation:</span>
            <span className="text-[11px] text-sky-400 font-bold">{params.modulation}</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {(['SPWM', 'THIPWM', 'DPWM1'] as ModulationScheme[]).map((scheme) => (
              <button
                key={scheme}
                onClick={() => updateField('modulation', scheme)}
                className={`py-1 px-1.5 rounded text-[11px] font-mono font-semibold transition-all border ${
                  params.modulation === scheme
                    ? 'bg-sky-500/20 border-sky-500/40 text-sky-300 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {scheme === 'SPWM' ? 'SPWM' : scheme === 'THIPWM' ? 'SVPWM' : 'DPWM1'}
              </button>
            ))}
          </div>
        </div>

        {/* Carrier Modulation (LSPWM & PSPWM) */}
        {is3Level && (
          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 font-semibold">Carrier Mode:</span>
              <span className="text-[11px] text-purple-400 font-bold">
                {params.carrierDisposition === 'PD' ? 'IPD' : params.carrierDisposition}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {[
                { id: 'IPD', label: 'LS: IPD' },
                { id: 'POD', label: 'LS: POD' },
                { id: 'APOD', label: 'LS: APOD' },
                { id: 'PSPWM', label: 'PS: 180°' },
              ].map((item) => {
                const isSelected =
                  params.carrierDisposition === item.id ||
                  (item.id === 'IPD' && params.carrierDisposition === 'PD');
                return (
                  <button
                    key={item.id}
                    onClick={() => updateField('carrierDisposition', item.id as CarrierDisposition)}
                    className={`py-1 px-1 rounded text-[10px] font-mono font-semibold transition-all border ${
                      isSelected
                        ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* PMSM Load Controls */}
        <div className={`bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 space-y-1.5 ${!is3Level ? 'lg:col-span-2' : ''}`}>
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-300 font-semibold">Load (PMSM):</span>
            <span className="text-[10px] text-amber-400 font-mono">
              {params.ls.toFixed(1)} mH | {params.rs.toFixed(2)} Ω | {params.epeak} V
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs font-mono">
            <div>
              <span className="text-[10px] text-slate-400">Ls: {params.ls.toFixed(1)}mH</span>
              <input
                type="range"
                min={0.2}
                max={5.0}
                step={0.1}
                value={params.ls}
                onChange={(e) => updateField('ls', parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-400 mt-1"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-400">Rs: {params.rs.toFixed(2)}Ω</span>
              <input
                type="range"
                min={0.01}
                max={0.5}
                step={0.01}
                value={params.rs}
                onChange={(e) => updateField('rs', parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-400 mt-1"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-400">EMF: {params.epeak}V</span>
              <input
                type="range"
                min={0}
                max={500}
                step={10}
                value={params.epeak}
                onChange={(e) => updateField('epeak', parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-400 mt-1"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

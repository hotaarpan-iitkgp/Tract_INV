import React, { useState } from 'react';
import { AnalyticalMetrics, TopologyType } from '../types';
import { BarChart3, Zap, Activity, Flame, ShieldAlert, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

interface MetricsBarProps {
  metrics: AnalyticalMetrics;
  topology: TopologyType;
  vdc: number;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({
  metrics,
  topology,
  vdc,
}) => {
  const [showHarmonicsModal, setShowHarmonicsModal] = useState(false);

  return (
    <div id="panel-d-metrics" className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
      {/* Top row: Title and Key Indicators */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
            <BarChart3 className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
            Real-Time Analytical Performance & Stress Metrics
          </h3>
        </div>

        <button
          onClick={() => setShowHarmonicsModal(!showHarmonicsModal)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-sky-300 transition"
        >
          <Activity className="w-3.5 h-3.5 text-sky-400" />
          <span>DFT Harmonic Spectrum (1st - 50th)</span>
          {showHarmonicsModal ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* 4 Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: Line Voltage THD % */}
        <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-mono text-slate-400">Total Harmonic Distortion</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
              metrics.thdPercent < 30 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
            }`}>
              THD (V_AB)
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-mono font-extrabold text-white">
              {metrics.thdPercent.toFixed(1)}%
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              (50 harmonics)
            </span>
          </div>
          <p className="mt-1 text-[10px] text-slate-400 font-sans">
            Fundamental V_1,rms = <strong className="text-slate-200 font-mono">{metrics.vabFundamentalRms.toFixed(0)} V</strong>
            {topology !== '2L-VSI' && ' (Reduced filter size required)'}
          </p>
        </div>

        {/* Metric 2: Peak dv/dt Step & Insulation Stress */}
        <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-mono text-slate-400">Insulation dv/dt Step</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
              metrics.peakDvDtStep <= vdc / 2 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
            }`}>
              {metrics.peakDvDtStep <= vdc / 2 ? '50% Reduced' : 'Full V_dc'}
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-mono font-extrabold text-white">
              {metrics.peakDvDtStep.toFixed(0)} V
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              (~{metrics.dvDtSlopeMax.toFixed(0)} V/ns)
            </span>
          </div>
          <p className="mt-1 text-[10px] text-slate-400 font-sans">
            V_CM pk-pk = <strong className="text-amber-300 font-mono">{metrics.vcmPeakToPeak.toFixed(0)} V</strong> (Bearing current stress)
          </p>
        </div>

        {/* Metric 3: Normalized Loss Breakdown (Conduction vs Switching) */}
        <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-mono text-slate-400">Estimated Inverter Loss</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold bg-sky-500/20 text-sky-300">
              ~{metrics.estimatedEfficiency.toFixed(1)}% Eff
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-mono font-bold text-white">
              {metrics.totalLossW.toFixed(0)} W
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              (P_cond + P_sw)
            </span>
          </div>

          {/* Loss dynamic stacked bar */}
          <div className="mt-1.5 space-y-1">
            <div className="w-full h-2.5 bg-slate-800 rounded-full flex overflow-hidden border border-slate-700">
              <div
                style={{ width: `${metrics.conductionLossPct}%` }}
                className="bg-emerald-500 h-full transition-all duration-300"
                title={`Conduction Loss: ${metrics.conductionLossPct.toFixed(1)}%`}
              />
              <div
                style={{ width: `${metrics.switchingLossPct}%` }}
                className="bg-purple-500 h-full transition-all duration-300"
                title={`Switching Loss: ${metrics.switchingLossPct.toFixed(1)}%`}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Cond: {metrics.conductionLossPct.toFixed(0)}% ({metrics.conductionLossW.toFixed(0)}W)
              </span>
              <span className="text-purple-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                Sw: {metrics.switchingLossPct.toFixed(0)}% ({metrics.switchingLossW.toFixed(0)}W)
              </span>
            </div>
          </div>
        </div>

        {/* Metric 4: DC Link Capacitor Ripple & Midpoint Stress */}
        <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-mono text-slate-400">Capacitor & Midpoint Stress</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold bg-indigo-500/20 text-indigo-300">
              DC Link Stress
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-mono font-extrabold text-white">
              {metrics.dcLinkCapRippleCurrentA.toFixed(1)} A
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              RMS Ripple
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] font-mono">
            <span className="text-slate-400">Neutral Point Drift Risk:</span>
            <span className={`font-bold ${
              metrics.neutralStressIndex < 35 ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {metrics.neutralStressIndex === 0 ? 'N/A (2L/OEW)' : `${metrics.neutralStressIndex}/100`}
            </span>
          </div>
        </div>
      </div>

      {/* Expandable DFT Harmonics Bar Chart (1st to 50th) */}
      {showHarmonicsModal && (
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono">
            <span className="text-slate-300 font-bold flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-sky-400" /> V_AB Discrete Fourier Transform (DFT) Spectrum
            </span>
            <span className="text-slate-400 text-[11px]">
              Harmonics 1 to 50 (Relative to fundamental)
            </span>
          </div>

          <div className="mt-3 h-32 flex items-end gap-[2px] pt-4 px-1 overflow-x-auto">
            {metrics.harmonics.map((h) => {
              const heightPct = Math.min(100, Math.max(2, h.relativePct));
              const isFundamental = h.order === 1;
              const isSignificant = h.relativePct > 5 && !isFundamental;

              return (
                <div
                  key={h.order}
                  className="flex-1 min-w-[10px] flex flex-col items-center group relative cursor-pointer"
                >
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                    <div className="bg-slate-800 border border-slate-700 text-slate-200 text-[10px] font-mono px-2 py-1 rounded shadow-lg whitespace-nowrap">
                      <div>Harmonic #{h.order} ({(h.frequency).toFixed(0)} Hz)</div>
                      <div className="font-bold text-sky-400">{h.amplitude.toFixed(1)} V_rms ({h.relativePct.toFixed(1)}%)</div>
                    </div>
                  </div>

                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full rounded-t transition-all ${
                      isFundamental
                        ? 'bg-emerald-500 shadow-sm'
                        : isSignificant
                        ? 'bg-amber-500'
                        : 'bg-slate-700 group-hover:bg-sky-400'
                    }`}
                  />
                  {h.order % 5 === 0 && (
                    <span className="text-[8px] text-slate-500 font-mono mt-1">
                      {h.order}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-900 text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Fundamental (h=1)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-amber-500" /> Dominant Carrier Harmonics (&gt;5%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-slate-700" /> Minor Residuals
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

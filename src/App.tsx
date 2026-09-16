import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { TopologyType, InverterParameters } from './types';
import { simulateCycle, getConductionPath } from './simulation/engine';
import { TopologySchematic } from './components/TopologySchematic';
import { OscilloscopeCanvas, ChannelState, DEFAULT_CHANNELS } from './components/OscilloscopeCanvas';
import { ControlsPanel } from './components/ControlsPanel';
import { MetricsBar } from './components/MetricsBar';
import { ANPCControlStudio } from './components/ANPCControlStudio';
import { Zap, Layers, Activity, Sparkles, SlidersHorizontal, Maximize2, Minimize2, ChevronDown } from 'lucide-react';

const TOPOLOGIES: { id: TopologyType; label: string; tag: string }[] = [
  { id: '2L-VSI', label: '2L-VSI', tag: '6-Switch Baseline' },
  { id: '3L-NPC', label: '3L-NPC', tag: 'Diode Clamped' },
  { id: '3L-ANPC', label: '3L-ANPC', tag: 'Active Clamped' },
  { id: '3L-TNPC', label: '3L-TNPC', tag: 'T-Type Midpoint' },
  { id: 'OEW-VSI', label: 'OEW-VSI', tag: 'Open-End Winding' },
];

export default function App() {
  const [topology, setTopology] = useState<TopologyType>('3L-ANPC');
  const [anpcMode, setAnpcMode] = useState<'studio' | 'standard'>('studio');
  const [fullscreenMode, setFullscreenMode] = useState<'topology' | 'scope' | null>(null);

  // Simulation Parameters
  const [params, setParams] = useState<InverterParameters>({
    vdc: 800,
    ma: 0.88,
    f0: 60,
    fsw: 14000,
    modulation: 'THIPWM',
    carrierDisposition: 'IPD',
    ls: 1.2,
    rs: 0.06,
    epeak: 280,
    deadTimeNs: 500,
  });

  // Oscilloscope Scrubber state
  const [scrubberIndex, setScrubberIndex] = useState<number>(180);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  // Oscilloscope trace visibility state (persisted across tab changes and fullscreen toggle)
  const [channels, setChannels] = useState<ChannelState[]>(() => {
    try {
      const saved = localStorage.getItem('ev_workbench_traces');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 5) {
          return DEFAULT_CHANNELS.map((def) => {
            const item = parsed.find((p: any) => p.id === def.id);
            return item ? { ...def, enabled: !!item.enabled } : def;
          });
        }
      }
    } catch {
      // Ignore local storage error
    }
    return DEFAULT_CHANNELS;
  });

  const handleToggleChannel = useCallback((id: string) => {
    setChannels((prev) => {
      const next = prev.map((ch) => (ch.id === id ? { ...ch, enabled: !ch.enabled } : ch));
      try {
        localStorage.setItem(
          'ev_workbench_traces',
          JSON.stringify(next.map((c) => ({ id: c.id, enabled: c.enabled })))
        );
      } catch {
        // Ignore local storage error
      }
      return next;
    });
  }, []);

  const [zoomMode, setZoomMode] = useState<'2cycles' | '1cycle' | 'carrierZoom'>('1cycle');

  // Compute full simulation waveforms & metrics
  const { points, metrics } = useMemo(() => {
    return simulateCycle(params, topology, 2, 1600);
  }, [params, topology]);

  // Keep scrubber index in bounds
  useEffect(() => {
    if (scrubberIndex >= points.length) {
      setScrubberIndex(points.length - 1);
    }
  }, [points.length, scrubberIndex]);

  // Smooth 60 FPS animation loop
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  const animate = useCallback(
    (time: number) => {
      const elapsed = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      const cyclePoints = points.length / 2;
      const pointsPerSec = cyclePoints / 20; // 20 seconds per fundamental cycle to match ANPC Studio speed
      const step = Math.max(1, Math.round(pointsPerSec * elapsed));

      setScrubberIndex((prev) => (prev + step) % points.length);
      animFrameRef.current = requestAnimationFrame(animate);
    },
    [points.length, params.f0]
  );

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      animFrameRef.current = requestAnimationFrame(animate);
    } else if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, animate]);

  const currentSample = points[scrubberIndex] || points[0];

  const conductionInfo = useMemo(() => {
    return getConductionPath(
      topology,
      currentSample.stateA,
      currentSample.ia,
      currentSample.bridge2StateA
    );
  }, [topology, currentSample.stateA, currentSample.ia, currentSample.bridge2StateA]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Sleek Minimal Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30 px-4 lg:px-8 py-2.5">
        <div className="w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                EV Traction Inverter Workbench
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-medium">
                  SiC 3-Level
                </span>
              </h1>
            </div>
          </div>

          {/* Key Parameters Chips */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300">
              V_dc: <strong className="text-white">{params.vdc}V</strong>
            </span>
            <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300">
              f_sw: <strong className="text-emerald-400">{(params.fsw / 1000).toFixed(0)}kHz</strong>
            </span>
            <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300">
              m_a: <strong className="text-purple-300">{params.ma.toFixed(2)}</strong>
            </span>
            <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-sky-400 font-bold">
              {params.carrierDisposition}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full px-4 lg:px-8 py-4 flex-1 space-y-4">
        {/* Topology Selector */}
        <section aria-label="Topology Selection" className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 shadow-lg">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" /> Inverter Topology:
            </span>
            <span className="text-xs font-mono text-slate-400">
              Active: <strong className="text-sky-300">{topology}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {TOPOLOGIES.map((t) => {
              const isSelected = topology === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTopology(t.id)}
                  className={`flex flex-col text-left p-2 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-sky-500/15 border-sky-500/50 shadow-md shadow-sky-950/50'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-xs font-mono font-bold ${isSelected ? 'text-sky-300' : 'text-slate-200'}`}>
                      {t.label}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-1 py-0.5 rounded font-medium ${
                        isSelected
                          ? 'bg-sky-400/20 text-sky-200 border border-sky-400/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {t.tag}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ANPC Specialized Mode Selector Banner (Only when 3L-ANPC is selected) */}
        {topology === '3L-ANPC' && (
          <section className="bg-gradient-to-r from-teal-950/40 via-slate-900 to-slate-900 border border-teal-500/30 rounded-xl p-3 shadow-lg flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/40">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>3L-ANPC Operating Modes:</span>
                  <span className="text-[10px] font-mono text-teal-400 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800">
                    Giuseppe Marsotto Control Suite Active
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Switch between the dedicated closed-loop control studio and the open-loop multi-topology benchmark.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
              <button
                onClick={() => setAnpcMode('studio')}
                className={`px-3 py-1.5 rounded transition flex items-center gap-1.5 ${
                  anpcMode === 'studio'
                    ? 'bg-teal-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                ANPC Control Studio (PI, PR, FCS/OSS-MPC)
              </button>
              <button
                onClick={() => setAnpcMode('standard')}
                className={`px-3 py-1.5 rounded transition flex items-center gap-1.5 ${
                  anpcMode === 'standard'
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Standard LSPWM Open-Loop
              </button>
            </div>
          </section>
        )}

        {/* Main Render Area: Either ANPC Control Studio or Standard Workbench */}
        {topology === '3L-ANPC' && anpcMode === 'studio' ? (
          <ANPCControlStudio />
        ) : (
          <>
            {/* Grid: Schematic & Real-time Oscilloscope */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
              {/* Panel A: Dynamic Circuit Schematic (5 cols) */}
              <div className="xl:col-span-5 flex flex-col">
                <TopologySchematic
                  topology={topology}
                  conductionInfo={conductionInfo}
                  vdc={params.vdc}
                  ia={currentSample.ia}
                  van={currentSample.van}
                  vPhaseA={currentSample.vPhaseA}
                  stateA={currentSample.stateA}
                  stateB={currentSample.stateB}
                  stateC={currentSample.stateC}
                  bridge2StateA={currentSample.bridge2StateA}
                  isFullscreen={false}
                  onToggleFullscreen={() => setFullscreenMode('topology')}
                />
              </div>

              {/* Panel B: Real-time Multi-channel Oscilloscope (7 cols) */}
              <div className="xl:col-span-7 flex flex-col">
                <OscilloscopeCanvas
                  points={points}
                  topology={topology}
                  scrubberIndex={scrubberIndex}
                  onScrub={setScrubberIndex}
                  isPlaying={isPlaying}
                  onTogglePlay={() => setIsPlaying(!isPlaying)}
                  vdc={params.vdc}
                  f0={params.f0}
                  fsw={params.fsw}
                  carrierDisposition={params.carrierDisposition}
                  isFullscreen={false}
                  onToggleFullscreen={() => setFullscreenMode('scope')}
                  channels={channels}
                  onToggleChannel={handleToggleChannel}
                  zoomMode={zoomMode}
                  onSetZoomMode={setZoomMode}
                />
              </div>
            </div>

            {/* Panel C: Parameter Controls */}
            <section aria-label="Parametric Controls">
              <ControlsPanel
                params={params}
                onChange={setParams}
                topology={topology}
              />
            </section>

            {/* Panel D: Performance Metrics Bar */}
            <section aria-label="Analytical Metrics">
              <MetricsBar
                metrics={metrics}
                topology={topology}
                vdc={params.vdc}
              />
            </section>
          </>
        )}
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 px-4 lg:px-8 py-2.5 mt-4">
        <div className="w-full flex items-center justify-between text-[11px] font-mono text-slate-500">
          <div>EV Traction Inverter Workbench • 3-Level LSPWM / PSPWM Simulation</div>
          <div>60 FPS Synchronized Scrubber • RK4 Load ODE</div>
        </div>
      </footer>
      {/* Full Screen Overlay with Tab Switcher & Topology Dropdown Menu */}
      {fullscreenMode && (
        <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col p-4 space-y-4 overflow-y-auto">
          {/* Tabs bar, Topology Menu, and Exit */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex flex-wrap items-center gap-4">
              {/* Studio View Tabs */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                  Widescreen Studio View:
                </span>
                <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800 text-xs font-mono">
                  <button
                    onClick={() => setFullscreenMode('topology')}
                    className={`px-3 py-1.5 rounded transition ${
                      fullscreenMode === 'topology'
                        ? 'bg-sky-500 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🔌 Circuit Schematic
                  </button>
                  <button
                    onClick={() => setFullscreenMode('scope')}
                    className={`px-3 py-1.5 rounded transition ${
                      fullscreenMode === 'scope'
                        ? 'bg-sky-500 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    📺 Oscilloscope Waveforms
                  </button>
                </div>
              </div>

              {/* Topology Switcher Dropdown Menu in Full Screen Mode (as requested) */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                  Topology:
                </span>
                <div className="relative">
                  <select
                    value={topology}
                    onChange={(e) => setTopology(e.target.value as TopologyType)}
                    className="bg-slate-900 hover:bg-slate-850 border border-slate-700 hover:border-sky-500/70 text-slate-100 text-xs font-mono font-bold rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-sky-500/50 cursor-pointer transition-all shadow-md appearance-none"
                    aria-label="Switch topology in full screen mode"
                  >
                    {TOPOLOGIES.map((t) => (
                      <option key={t.id} value={t.id} className="bg-slate-900 text-slate-100 font-mono py-1">
                        {t.label} — {t.tag}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Quick Topology Pills for 1-click switching in wide screens */}
              <div className="hidden 2xl:flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800 text-[11px] font-mono">
                {TOPOLOGIES.map((t) => {
                  const active = topology === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTopology(t.id)}
                      className={`px-2 py-1 rounded transition ${
                        active
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                      }`}
                    >
                      {t.id}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Active Topology Badge */}
              <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-xs font-mono">
                <span className="text-slate-500">Active:</span>
                <span className="text-sky-300 font-bold">{topology}</span>
              </div>

              <button
                onClick={() => setFullscreenMode(null)}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-xs rounded-lg transition flex items-center gap-1.5 shadow"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                Exit Full Screen
              </button>
            </div>
          </div>

          {/* Full Screen Content */}
          <div className="flex-1 flex flex-col min-h-0">
            {fullscreenMode === 'topology' ? (
              <TopologySchematic
                topology={topology}
                conductionInfo={conductionInfo}
                vdc={params.vdc}
                ia={currentSample.ia}
                van={currentSample.van}
                vPhaseA={currentSample.vPhaseA}
                stateA={currentSample.stateA}
                stateB={currentSample.stateB}
                stateC={currentSample.stateC}
                bridge2StateA={currentSample.bridge2StateA}
                isFullscreen={true}
                onToggleFullscreen={() => setFullscreenMode(null)}
              />
            ) : (
              <OscilloscopeCanvas
                points={points}
                topology={topology}
                scrubberIndex={scrubberIndex}
                onScrub={setScrubberIndex}
                isPlaying={isPlaying}
                onTogglePlay={() => setIsPlaying(!isPlaying)}
                vdc={params.vdc}
                f0={params.f0}
                fsw={params.fsw}
                carrierDisposition={params.carrierDisposition}
                isFullscreen={true}
                onToggleFullscreen={() => setFullscreenMode(null)}
                channels={channels}
                onToggleChannel={handleToggleChannel}
                zoomMode={zoomMode}
                onSetZoomMode={setZoomMode}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

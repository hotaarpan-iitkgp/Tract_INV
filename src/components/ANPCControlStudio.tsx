import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  ANPCConfig,
  ANPC_DEFAULTS,
  ANPC_GATES,
  ANPC_LEVELS,
  ANPC_SPACE_VECTORS,
  ZERO_VECTOR_INDEX,
  simulateANPC,
  runFairComparison,
  SimulationResult,
  ComparisonRow,
  branchConduction,
} from '../simulation/anpcControlStudio';
import {
  Play,
  Pause,
  RotateCcw,
  Activity,
  Sliders,
  Sparkles,
  BarChart3,
  Cpu,
  Workflow,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Zap,
} from 'lucide-react';

const COLORS = ['#ff6b81', '#38bdf8', '#facc15']; // Phase A (Rose), Phase B (Sky), Phase C (Amber)
const NAMES = ['A', 'B', 'C'];

const METHODS_BY_FAMILY = {
  pwm: [
    { id: 'pi', name: 'Digital PI', subtitle: 'DC tracking · triangular PWM' },
    { id: 'pr', name: 'Digital Resonant (PR)', subtitle: 'AC zero steady-state error at f0' },
  ],
  direct: [
    { id: 'hyst', name: '3-Level Hysteresis', subtitle: 'Instantaneous tolerance band' },
    { id: 'fcs', name: 'FCS-MPC', subtitle: '27 switching states · cost minimization' },
  ],
  embedded: [
    { id: 'oss', name: 'OSS-MPC', subtitle: 'Optimal switching sequences & dwell times' },
  ],
} as const;

export const ANPCControlStudio: React.FC = () => {
  const [config, setConfig] = useState<ANPCConfig>({ ...ANPC_DEFAULTS });
  const [family, setFamily] = useState<'pwm' | 'direct' | 'embedded'>('pwm');
  const [viewMode, setViewMode] = useState<'studio' | 'audit'>('studio');
  const [showFlow, setShowFlow] = useState<boolean>(false);

  // Animation & Scrubber State
  const [index, setIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playSpeed, setPlaySpeed] = useState<number>(1); // 0.25, 1, 4

  // Fair Comparison results state
  const [comparisonResults, setComparisonResults] = useState<ComparisonRow[] | null>(null);
  const [isComparing, setIsComparing] = useState<boolean>(false);

  // Simulation run
  const simData: SimulationResult = useMemo(() => {
    return simulateANPC(config);
  }, [config]);

  // Keep index within bounds on re-simulation
  useEffect(() => {
    if (index >= simData.n) {
      setIndex(Math.max(0, simData.n - 1));
    }
  }, [simData.n, index]);

  // Scrubber animation loop
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  const animate = useCallback(
    (now: number) => {
      const elapsed = now - lastTimeRef.current;
      if (elapsed > 40) {
        lastTimeRef.current = now;
        const step = Math.max(1, Math.round((simData.c.resolution / 2) * playSpeed));
        setIndex((prev) => (prev + step) % simData.n);
      }
      animRef.current = requestAnimationFrame(animate);
    },
    [simData.n, simData.c.resolution, playSpeed]
  );

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      animRef.current = requestAnimationFrame(animate);
    } else if (animRef.current) {
      cancelAnimationFrame(animRef.current);
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, animate]);

  // Current Instant sample data
  const sampleIdx = Math.floor(index / simData.c.resolution);
  const currentDecision = simData.decisions[sampleIdx] || simData.decisions[0];
  const currentTimeMs = (simData.t[index] * 1000).toFixed(2);

  // Run Fair Comparison (Compare all 5 controllers)
  const handleRunComparison = () => {
    setIsComparing(true);
    setTimeout(() => {
      const results = runFairComparison(config);
      setComparisonResults(results);
      setIsComparing(false);
      setViewMode('audit');
    }, 50);
  };

  // Quick preset helper
  const handleFamilyChange = (fam: 'pwm' | 'direct' | 'embedded') => {
    setFamily(fam);
    const firstMethod = METHODS_BY_FAMILY[fam][0].id as ANPCConfig['method'];
    setConfig((prev) => ({ ...prev, method: firstMethod }));
  };

  const handleVariableChange = (v: 'i' | 'v') => {
    const toV = v === 'v';
    const factor = toV ? config.R : 1 / config.R;
    setConfig((prev) => ({
      ...prev,
      variable: v,
      amp: Math.min(toV ? 200 : 35, prev.amp * factor),
      final: Math.min(toV ? 200 : 35, prev.final * factor),
      band: Math.min(toV ? 30 : 3, prev.band * factor),
    }));
  };

  // Widescreen 5-Channel Oscilloscope Canvas Refs
  const oscilloscopeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const oscilloscopeContainerRef = useRef<HTMLDivElement | null>(null);

  // Render Widescreen 5-Channel Oscilloscope Canvas
  useEffect(() => {
    const renderOscilloscope = () => {
      const canvas = oscilloscopeCanvasRef.current;
      const container = oscilloscopeContainerRef.current;
      if (!canvas || !container || !simData) return;

      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth || 800;
      const h = 450; // Widescreen fixed height for 5 channels

      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.resetTransform();
      ctx.scale(dpr, dpr);

      // Background
      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, w, h);

      const margin = { top: 12, bottom: 24, left: 62, right: 18 };
      const traceAreaHeight = h - margin.top - margin.bottom;
      const traceHeight = traceAreaHeight / 5;
      const traceWidth = w - margin.left - margin.right;

      // Calculate peak values for scaling
      let peakIa = 5;
      for (let j = 0; j < simData.n; j++) {
        const val = Math.abs(simData.y[j * 3 + 0]);
        if (val > peakIa) peakIa = val;
        const refVal = Math.abs(simData.ref[j * 3 + 0]);
        if (refVal > peakIa) peakIa = refVal;
      }
      const maxIa = peakIa * 1.35;

      const xp = (j: number) => margin.left + (j / (simData.n - 1)) * traceWidth;

      // Analytical carrier function for CH1 PI/PR modulation
      const getCarrier = (t: number, fcr: number, phaseShift = 0) => {
        const T = 1 / fcr;
        const tc = ((t + phaseShift * T) % T + T) % T;
        const ratio = tc / T;
        return ratio < 0.5 ? -1 + 4 * ratio : 3 - 4 * ratio;
      };

      const isPWM = ['pi', 'pr'].includes(config.method);

      // We have 5 subplots (CH1 to CH5)
      const subplots = [
        {
          id: 'ch1',
          name: isPWM ? 'CH1: PWM Modulator & Carriers' : 'CH1: Tracking Details (Phase A)',
          color: '#38bdf8',
          yRange: isPWM ? [-1.2, 1.2] as [number, number] : [-maxIa, maxIa] as [number, number],
          unit: isPWM ? 'p.u.' : (config.variable === 'i' ? 'A' : 'V'),
        },
        {
          id: 'ch2',
          name: 'CH2: Phase A Pole Voltage V_AN',
          color: '#c084fc',
          yRange: [-config.vdc * 0.65, config.vdc * 0.65] as [number, number],
          unit: 'V',
        },
        {
          id: 'ch3',
          name: 'CH3: Line-to-Line Voltage V_AB',
          color: '#f43f5e',
          yRange: [-config.vdc * 1.15, config.vdc * 1.15] as [number, number],
          unit: 'V',
        },
        {
          id: 'ch4',
          name: config.variable === 'i' ? 'CH4: Output Phase Current i_a' : 'CH4: Resistor Voltage vR_a',
          color: '#10b981',
          yRange: [-maxIa, maxIa] as [number, number],
          unit: config.variable === 'i' ? 'A' : 'V',
        },
        {
          id: 'ch5',
          name: 'CH5: Common Mode Voltage V_CM',
          color: '#fbbf24',
          yRange: [-config.vdc * 0.45, config.vdc * 0.45] as [number, number],
          unit: 'V',
        },
      ];

      subplots.forEach((sub, idx) => {
        const traceTop = margin.top + idx * traceHeight;
        const traceBottom = traceTop + traceHeight;
        const traceMid = traceTop + traceHeight / 2;

        // Background tint
        ctx.fillStyle = idx % 2 === 0 ? 'rgba(10, 15, 30, 0.5)' : 'rgba(4, 8, 16, 0.8)';
        ctx.fillRect(margin.left, traceTop, traceWidth, traceHeight);

        // Subplot border
        ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(margin.left, traceTop, traceWidth, traceHeight);

        // Mid zero reference line
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.35)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(margin.left, traceMid);
        ctx.lineTo(margin.left + traceWidth, traceMid);
        ctx.stroke();
        ctx.setLineDash([]);

        // Vertical time divisions (8 divisions)
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
        ctx.lineWidth = 0.75;
        for (let d = 1; d < 8; d++) {
          const divX = margin.left + (traceWidth / 8) * d;
          ctx.beginPath();
          ctx.moveTo(divX, traceTop);
          ctx.lineTo(divX, traceBottom);
          ctx.stroke();
        }

        const [yMin, yMax] = sub.yRange;
        const mapY = (val: number) => {
          const ratio = (val - yMin) / (yMax - yMin);
          return traceBottom - ratio * traceHeight;
        };

        // Y-axis tick labels
        ctx.fillStyle = '#64748b';
        ctx.font = '9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`+${Math.abs(yMax).toFixed(0)}`, margin.left - 5, traceTop + 10);
        ctx.fillText('0', margin.left - 5, traceMid + 3);
        ctx.fillText(`-${Math.abs(yMin).toFixed(0)}`, margin.left - 5, traceBottom - 3);

        // Draw Subplot title pill (Name & Unit)
        ctx.fillStyle = sub.color;
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(sub.name, margin.left + 8, traceTop + 12);

        // Draw instantaneous cursor value readout
        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'right';
        let readoutText = '';

        const curT = simData.t[index];
        const curSa = simData.state[index * 3 + 0];
        const curSb = simData.state[index * 3 + 1];
        const curSc = simData.state[index * 3 + 2];

        const lvlA = ANPC_LEVELS[curSa] ?? 0;
        const lvlB = ANPC_LEVELS[curSb] ?? 0;
        const lvlC = ANPC_LEVELS[curSc] ?? 0;

        if (sub.id === 'ch1') {
          if (isPWM) {
            readoutText = `ma=${simData.d[index * 3 + 0].toFixed(2)}`;
          } else {
            readoutText = `ref=${simData.ref[index * 3 + 0].toFixed(1)}A, act=${simData.y[index * 3 + 0].toFixed(1)}A`;
          }
        } else if (sub.id === 'ch2') {
          const van = lvlA * (config.vdc / 2);
          readoutText = `V_AN=${van.toFixed(0)} V`;
        } else if (sub.id === 'ch3') {
          const vab = (lvlA - lvlB) * (config.vdc / 2);
          readoutText = `V_AB=${vab.toFixed(0)} V`;
        } else if (sub.id === 'ch4') {
          const val = simData.y[index * 3 + 0];
          const ref = simData.ref[index * 3 + 0];
          readoutText = `y=${val.toFixed(1)} ${sub.unit} (ref=${ref.toFixed(1)})`;
        } else if (sub.id === 'ch5') {
          const vcm = (lvlA + lvlB + lvlC) * (config.vdc / 6);
          readoutText = `V_CM=${vcm.toFixed(1)} V`;
        }

        ctx.fillText(`[${readoutText}]`, margin.left + traceWidth - 8, traceTop + 12);

        // Draw the waveform lines!
        const stride = Math.max(1, Math.floor(simData.n / (traceWidth * 1.5)));
        ctx.lineWidth = 1.6;
        ctx.globalAlpha = 1.0;

        if (sub.id === 'ch1') {
          if (isPWM) {
            // LS-PWM or PS-PWM Carriers
            const fcr = config.carrier || 2000;
            ctx.lineWidth = 1.0;

            if (config.pwmType === 'level') {
              // Upper carrier: 0 to 1
              ctx.strokeStyle = '#eab308'; // Amber/gold
              ctx.beginPath();
              for (let j = 0; j < simData.n; j += stride) {
                const tVal = simData.t[j];
                const carrVal = 0.5 + 0.5 * getCarrier(tVal, fcr, 0);
                const x = xp(j);
                const y = mapY(carrVal);
                if (j === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
              }
              ctx.stroke();

              // Lower carrier: -1 to 0
              ctx.strokeStyle = '#f97316'; // Orange
              ctx.beginPath();
              for (let j = 0; j < simData.n; j += stride) {
                const tVal = simData.t[j];
                const carrVal = -0.5 + 0.5 * getCarrier(tVal, fcr, 0);
                const x = xp(j);
                const y = mapY(carrVal);
                if (j === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
              }
              ctx.stroke();
            } else {
              // PS-PWM: two full-range carriers shifted by 180 deg
              ctx.strokeStyle = '#eab308';
              ctx.beginPath();
              for (let j = 0; j < simData.n; j += stride) {
                const tVal = simData.t[j];
                const carrVal = getCarrier(tVal, fcr, 0);
                const x = xp(j);
                const y = mapY(carrVal);
                if (j === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
              }
              ctx.stroke();

              ctx.strokeStyle = '#f97316';
              ctx.beginPath();
              for (let j = 0; j < simData.n; j += stride) {
                const tVal = simData.t[j];
                const carrVal = getCarrier(tVal, fcr, 0.5);
                const x = xp(j);
                const y = mapY(carrVal);
                if (j === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
              }
              ctx.stroke();
            }

            // Draw Phase A duty cycle reference wave
            ctx.strokeStyle = '#38bdf8'; // Sky blue
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            for (let j = 0; j < simData.n; j += stride) {
              const x = xp(j);
              const y = mapY(simData.d[j * 3 + 0]);
              if (j === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();

          } else {
            // Direct Control Tracking Viewer
            // Draw Reference Wave (dashed sky blue)
            ctx.strokeStyle = '#38bdf8';
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            for (let j = 0; j < simData.n; j += stride) {
              const x = xp(j);
              const y = mapY(simData.ref[j * 3 + 0]);
              if (j === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw Hysteresis Band lines if applicable
            if (config.method === 'hyst') {
              ctx.strokeStyle = '#eab308';
              ctx.setLineDash([2, 4]);
              ctx.lineWidth = 0.9;
              // Upper band
              ctx.beginPath();
              for (let j = 0; j < simData.n; j += stride) {
                const x = xp(j);
                const y = mapY(simData.ref[j * 3 + 0] + config.band);
                if (j === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
              }
              ctx.stroke();
              // Lower band
              ctx.beginPath();
              for (let j = 0; j < simData.n; j += stride) {
                const x = xp(j);
                const y = mapY(simData.ref[j * 3 + 0] - config.band);
                if (j === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
              }
              ctx.stroke();
              ctx.setLineDash([]);
            }

            // Draw Actual Output (solid emerald green)
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            for (let j = 0; j < simData.n; j += stride) {
              const x = xp(j);
              const y = mapY(simData.y[j * 3 + 0]);
              if (j === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }

        } else if (sub.id === 'ch2') {
          // Pole Voltage
          ctx.strokeStyle = '#c084fc'; // Light purple
          ctx.beginPath();
          for (let j = 0; j < simData.n; j += stride) {
            const stVal = simData.state[j * 3 + 0];
            const lvlA = ANPC_LEVELS[stVal] ?? 0;
            const val = lvlA * (config.vdc / 2);
            const x = xp(j);
            const y = mapY(val);
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

        } else if (sub.id === 'ch3') {
          // Line Voltage
          ctx.strokeStyle = '#f43f5e'; // Rose
          ctx.beginPath();
          for (let j = 0; j < simData.n; j += stride) {
            const stA = simData.state[j * 3 + 0];
            const stB = simData.state[j * 3 + 1];
            const lvlA = ANPC_LEVELS[stA] ?? 0;
            const lvlB = ANPC_LEVELS[stB] ?? 0;
            const val = (lvlA - lvlB) * (config.vdc / 2);
            const x = xp(j);
            const y = mapY(val);
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

        } else if (sub.id === 'ch4') {
          // Phase Current (Plot reference and actual)
          // Reference wave
          ctx.strokeStyle = '#38bdf8';
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          for (let j = 0; j < simData.n; j += stride) {
            const x = xp(j);
            const y = mapY(simData.ref[j * 3 + 0]);
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.setLineDash([]);

          // Actual wave
          ctx.strokeStyle = '#10b981'; // Emerald
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          for (let j = 0; j < simData.n; j += stride) {
            const x = xp(j);
            const y = mapY(simData.y[j * 3 + 0]);
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

        } else if (sub.id === 'ch5') {
          // Common Mode Voltage
          ctx.strokeStyle = '#fbbf24'; // Amber yellow
          ctx.beginPath();
          for (let j = 0; j < simData.n; j += stride) {
            const stA = simData.state[j * 3 + 0];
            const stB = simData.state[j * 3 + 1];
            const stC = simData.state[j * 3 + 2];
            const lvlA = ANPC_LEVELS[stA] ?? 0;
            const lvlB = ANPC_LEVELS[stB] ?? 0;
            const lvlC = ANPC_LEVELS[stC] ?? 0;
            const val = (lvlA + lvlB + lvlC) * (config.vdc / 6);
            const x = xp(j);
            const y = mapY(val);
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      });

      // Synchronized Widescreen Cursor Scrubber Line
      const cursorX = xp(index);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cursorX, margin.top);
      ctx.lineTo(cursorX, h - margin.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw bottom timeline grid ticks
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      for (let k = 0; k <= 4; k++) {
        const xVal = margin.left + (traceWidth * k) / 4;
        const timeValMs = (config.duration * (k / 4)).toFixed(0);
        ctx.fillText(`${timeValMs} ms`, xVal, h - 8);
      }
    };

    renderOscilloscope();

    // Resize tracking to keep oscilloscope aligned perfectly
    const observer = new ResizeObserver(() => {
      renderOscilloscope();
    });
    if (oscilloscopeContainerRef.current) {
      observer.observe(oscilloscopeContainerRef.current);
    }
    return () => {
      observer.disconnect();
    };
  }, [simData, index, config.method, config.pwmType, config.variable, config.band, config.vdc, config.duration, config.carrier]);

  // Space Vector calculations for instantaneous sample
  const spaceVectorInfo = useMemo(() => {
    const va = simData.v[index * 3];
    const vb = simData.v[index * 3 + 1];
    const vc = simData.v[index * 3 + 2];
    const valpha = (2 / 3) * (va - 0.5 * vb - 0.5 * vc);
    const vbeta = (1 / Math.sqrt(3)) * (vb - vc);
    const mag = Math.hypot(valpha, vbeta);
    const st = [
      simData.state[index * 3],
      simData.state[index * 3 + 1],
      simData.state[index * 3 + 2],
    ];
    const stStr = st
      .map((s) => (ANPC_LEVELS[s] > 0 ? '+' : ANPC_LEVELS[s] < 0 ? '−' : '0'))
      .join('');
    const isZero = mag < 1e-4;
    return { valpha, vbeta, mag, stStr, isZero };
  }, [simData, index]);

  // Worst phase metrics summary
  const worstMetric = (key: 'relative' | 'thd' | 'phase') => {
    const vals = simData.metrics.phase
      .map((p) => p[key])
      .filter((v): v is number => v !== null && Number.isFinite(v));
    return vals.length ? Math.max(...vals.map(Math.abs)) : null;
  };

  const meanSwKHz =
    simData.metrics.phase.reduce((acc, p) => acc + p.switching, 0) / 3000;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl space-y-4">
      {/* Header Bar */}
      <div className="bg-slate-950/80 px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight">
                3L-ANPC Closed-Loop Control Studio
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 font-semibold">
                Giuseppe Marsotto Edition
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-400">
              18 IGBTs / MOSFETs · Star RL Load · Closed-Loop PI / PR / FCS-MPC / OSS-MPC
            </p>
          </div>
        </div>

        {/* Quick Family Selector */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs font-mono">
          <button
            onClick={() => handleFamilyChange('pwm')}
            className={`px-2.5 py-1 rounded transition ${
              family === 'pwm'
                ? 'bg-teal-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            PWM Control
          </button>
          <button
            onClick={() => handleFamilyChange('direct')}
            className={`px-2.5 py-1 rounded transition ${
              family === 'direct'
                ? 'bg-teal-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Direct Switching
          </button>
          <button
            onClick={() => handleFamilyChange('embedded')}
            className={`px-2.5 py-1 rounded transition ${
              family === 'embedded'
                ? 'bg-teal-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Embedded Modulator
          </button>
        </div>
      </div>

      {/* Control Selector Toolbar */}
      <div className="px-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Active Controller Selector */}
        <div>
          <label className="text-[11px] font-mono text-slate-400 block mb-1">
            Active Controller Algorithm
          </label>
          <select
            value={config.method}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, method: e.target.value as ANPCConfig['method'] }))
            }
            className="w-full bg-slate-950 border border-slate-700 text-slate-100 text-xs font-mono rounded-lg px-2.5 py-1.5 focus:border-teal-500 focus:outline-none"
          >
            {METHODS_BY_FAMILY[family].map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.subtitle})
              </option>
            ))}
          </select>
          {['pi', 'pr'].includes(config.method) && (
            <div className="flex items-center gap-1 mt-1.5 text-[10px] font-mono">
              <span className="text-slate-400 mr-0.5">PWM:</span>
              <button
                onClick={() => setConfig((p) => ({ ...p, pwmType: 'level' }))}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                  config.pwmType === 'level'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-slate-950 text-slate-500 hover:text-slate-300 border border-transparent'
                }`}
              >
                LS-PWM
              </button>
              <button
                onClick={() => setConfig((p) => ({ ...p, pwmType: 'phase' }))}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                  config.pwmType === 'phase'
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                    : 'bg-slate-950 text-slate-500 hover:text-slate-300 border border-transparent'
                }`}
              >
                PS-PWM
              </button>
            </div>
          )}
        </div>

        {/* Controlled Variable y */}
        <div>
          <label className="text-[11px] font-mono text-slate-400 block mb-1">
            Controlled Variable y
          </label>
          <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            <button
              onClick={() => handleVariableChange('i')}
              className={`py-1 rounded text-center transition ${
                config.variable === 'i'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Phase Current i [A]
            </button>
            <button
              onClick={() => handleVariableChange('v')}
              className={`py-1 rounded text-center transition ${
                config.variable === 'v'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Load Voltage vR [V]
            </button>
          </div>
        </div>

        {/* Reference Signal Pattern */}
        <div>
          <label className="text-[11px] font-mono text-slate-400 block mb-1">
            Reference Waveform &amp; Step
          </label>
          <div className="flex items-center gap-2">
            <select
              value={config.reference}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, reference: e.target.value as 'sine' | 'dc' }))
              }
              className="bg-slate-950 border border-slate-700 text-slate-100 text-xs font-mono rounded-lg px-2 py-1.5 focus:border-teal-500 focus:outline-none"
            >
              <option value="sine">Sine 120°</option>
              <option value="dc">DC Step</option>
            </select>
            <span className="text-xs font-mono text-slate-300">
              {config.amp} → <strong>{config.final}</strong>{' '}
              {config.variable === 'i' ? 'A' : 'V'}
            </span>
          </div>
        </div>

        {/* Compare All 5 Button */}
        <div className="flex items-end">
          <button
            onClick={handleRunComparison}
            disabled={isComparing}
            className="w-full flex items-center justify-center gap-2 py-1.5 px-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-lg text-xs font-mono font-bold shadow-md shadow-teal-950/50 transition"
          >
            <BarChart3 className="w-4 h-4" />
            {isComparing ? 'Simulating All 5…' : 'Compare All 5 Controllers'}
          </button>
        </div>
      </div>

      {/* Real-Time Control Loop Flow Diagram */}
      <div className="px-4">
        <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-2.5 overflow-x-auto">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <button
              onClick={() => setShowFlow(!showFlow)}
              className="flex items-center gap-1.5 text-teal-400 font-bold hover:text-teal-300 transition"
            >
              <Workflow className="w-3.5 h-3.5 animate-pulse" />
              <span>{showFlow ? '▼ Hide Controller State Machine' : '▶ Show Controller State Machine & Signal Flow'}</span>
            </button>
            <span>Current Sample: t = {currentTimeMs} ms</span>
          </div>

          {showFlow && (
            <div className="flex items-center justify-between gap-2 min-w-[720px] text-center mt-3 animate-in slide-in-from-top-2 duration-150">
              {/* Box 1: Reference */}
              <div className="flex-1 bg-slate-900 border border-slate-700/80 rounded p-2">
                <div className="text-[10px] font-mono uppercase text-slate-400">Reference r(t)</div>
                <div className="text-xs font-mono font-bold text-sky-300">
                  {currentDecision.reference.map((v) => v.toFixed(1)).join(' / ')}{' '}
                  {config.variable === 'i' ? 'A' : 'V'}
                </div>
              </div>
              <span className="text-teal-400 font-bold">➔</span>

              {/* Box 2: Error */}
              <div className="flex-1 bg-slate-900 border border-slate-700/80 rounded p-2">
                <div className="text-[10px] font-mono uppercase text-slate-400">Error e(t)</div>
                <div className="text-xs font-mono font-bold text-rose-400">
                  {currentDecision.reference
                    .map((r, h) => (r - currentDecision.y[h]).toFixed(1))
                    .join(' / ')}
                </div>
              </div>
              <span className="text-teal-400 font-bold">➔</span>

              {/* Box 3: Algorithm */}
              <div className="flex-1 bg-teal-950/60 border border-teal-500/50 rounded p-2">
                <div className="text-[10px] font-mono uppercase text-teal-300 font-semibold">
                  {config.method.toUpperCase()} Engine
                </div>
                <div className="text-xs font-mono text-teal-200">
                  {config.method === 'pi' && `Kp·e + ∫e (AW: ${config.aw ? 'ON' : 'OFF'})`}
                  {config.method === 'pr' && `Resonant f0=${config.f0}Hz`}
                  {config.method === 'hyst' && `Band ±${config.band}${config.variable === 'i' ? 'A' : 'V'}`}
                  {config.method === 'fcs' && `N=${config.horizon} · λ=${config.lambda}`}
                  {config.method === 'oss' && `Symmetric 5-Segment Dwell`}
                </div>
              </div>
              <span className="text-teal-400 font-bold">➔</span>

              {/* Box 4: Command / Dwells */}
              <div className="flex-1 bg-slate-900 border border-slate-700/80 rounded p-2">
                <div className="text-[10px] font-mono uppercase text-slate-400">
                  {['pi', 'pr'].includes(config.method) ? 'PWM Duty d' : 'Switching Decision'}
                </div>
                <div className="text-xs font-mono font-bold text-amber-300">
                  {['pi', 'pr'].includes(config.method)
                    ? currentDecision.d.map((v) => v.toFixed(2)).join(' / ')
                    : `State: [${currentDecision.next
                        .map((s) => (ANPC_LEVELS[s] > 0 ? '+' : ANPC_LEVELS[s] < 0 ? '−' : '0'))
                        .join(' ')}]`}
                </div>
              </div>
              <span className="text-teal-400 font-bold">➔</span>

              {/* Box 5: 18 Gate Drivers */}
              <div className="flex-1 bg-slate-900 border border-slate-700/80 rounded p-2">
                <div className="text-[10px] font-mono uppercase text-slate-400">18 Gates (A·B·C)</div>
                <div className="text-[10px] font-mono font-bold text-emerald-400 tracking-wider">
                  {ANPC_GATES[currentDecision.next[0]].join('')} ·{' '}
                  {ANPC_GATES[currentDecision.next[1]].join('')} ·{' '}
                  {ANPC_GATES[currentDecision.next[2]].join('')}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Studio Viewport (Widescreen Grid) */}
      <div className="px-4">
        {/* View Mode Switching Tabs (Clean and modern) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-slate-800 pb-2 mb-4 gap-2">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setViewMode('studio')}
              className={`px-3 py-1.5 rounded transition flex items-center gap-1.5 font-bold ${
                viewMode === 'studio'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🔌 Interactive Live Studio (Full Grid)
            </button>
            <button
              onClick={() => setViewMode('audit')}
              className={`px-3 py-1.5 rounded transition flex items-center gap-1.5 font-bold ${
                viewMode === 'audit'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📊 5-Controller Comparative Benchmark
            </button>
          </div>

          {/* Time Scrubber & Playback Controls */}
          <div className="flex items-center justify-between sm:justify-end gap-2 text-xs font-mono">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-1 border border-slate-700 min-w-[70px] justify-center"
            >
              {isPlaying ? <Pause className="w-3 h-3 text-amber-400" /> : <Play className="w-3 h-3 text-emerald-400" />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              onClick={() => {
                setIsPlaying(false);
                setIndex((prev) => Math.max(0, prev - simData.c.resolution));
              }}
              title="Step back 1 control sample Ts"
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            >
              ← Ts
            </button>
            <button
              onClick={() => {
                setIsPlaying(false);
                setIndex((prev) => Math.min(simData.n - 1, prev + simData.c.resolution));
              }}
              title="Step forward 1 control sample Ts"
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            >
              Ts →
            </button>
            <button
              onClick={() => setPlaySpeed((s) => (s === 1 ? 4 : s === 4 ? 0.25 : 1))}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700"
            >
              ×{playSpeed}
            </button>
            <span className="text-slate-400 pl-1">
              t = <strong className="text-white">{currentTimeMs} ms</strong>
            </span>
          </div>
        </div>

        {/* View Mode 1: Unified Studio Grid */}
        {viewMode === 'studio' && (
          <div className="space-y-4">
            {/* Top Row: Bridge Schematic (Left) & Space Vector αβ Plane (Right) */}
            <div className="grid grid-cols-12 gap-4">
              
              {/* Left Column: Bridge Schematic Card */}
              <div className="col-span-12 xl:col-span-8">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3 h-full flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-200 font-bold">
                      Three-Phase 3L-ANPC Bridge (18 SiC Power MOSFETs + Floating Star RL Load)
                    </span>
                    <div className="hidden lg:flex items-center gap-4 text-[10px]">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span> SiC MOSFET (ON)
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-cyan-400"></span> Body Diode
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-sky-400"></span> Gate Drive ON
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto my-auto">
                    <svg viewBox="0 0 920 460" className="w-full max-w-4xl mx-auto font-mono select-none">
                      {/* DC Rails */}
                      <line x1="40" y1="40" x2="820" y2="40" stroke="#10b981" strokeWidth="3" />
                      <text x="35" y="32" fill="#10b981" fontSize="11" fontWeight="bold">
                        +V_DC/2 (+{(config.vdc / 2).toFixed(0)} V)
                      </text>

                      <line x1="40" y1="360" x2="820" y2="360" stroke="#f43f5e" strokeWidth="3" />
                      <text x="35" y="378" fill="#f43f5e" fontSize="11" fontWeight="bold">
                        −V_DC/2 (−{(config.vdc / 2).toFixed(0)} V)
                      </text>

                      {/* Neutral Rail */}
                      <line x1="40" y1="175" x2="645" y2="175" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="5 3" />
                      <circle cx="40" cy="175" r="4" fill="#f59e0b" />
                      <text x="48" y="167" fill="#f59e0b" fontSize="11" fontWeight="bold">
                        Neutral Rail O (0V)
                      </text>

                      {/* 3 Phases: Phase A, B, C */}
                      {[0, 1, 2].map((h) => {
                        const x = 230 + h * 240;
                        const z = x - 65; // active clamp midpoint
                        const outX = x + 85;
                        const col = COLORS[h];
                        const phaseName = NAMES[h];
                        const stateIdx = simData.state[index * 3 + h];
                        const cur = simData.i[index * 3 + h];
                        const gates = ANPC_GATES[stateIdx];
                        const cond = branchConduction(stateIdx, cur);

                        const isCond0 = Math.abs(cond[0]) > 1e-4;
                        const isCond1 = Math.abs(cond[1]) > 1e-4;
                        const isCond2 = Math.abs(cond[2]) > 1e-4;
                        const isCond3 = Math.abs(cond[3]) > 1e-4;
                        const isCond4 = Math.abs(cond[4]) > 1e-4;
                        const isCond5 = Math.abs(cond[5]) > 1e-4;

                        return (
                          <g key={phaseName}>
                            {/* Phase Header */}
                            <text x={x - 20} y="24" fill={col} fontSize="13" fontWeight="bold">
                              Phase {phaseName} (State:{' '}
                              {ANPC_LEVELS[stateIdx] > 0 ? '+' : ANPC_LEVELS[stateIdx] < 0 ? '−' : '0'})
                            </text>
                            <text x={x - 20} y="37" fill="#94a3b8" fontSize="10">
                              Gates: {gates.join('')}
                            </text>

                            {/* Main Vertical Phase Leg Wire Segments with Conduction Highlighting */}
                            <line
                              x1={x}
                              y1="40"
                              x2={x}
                              y2="57"
                              stroke={isCond0 ? '#10b981' : '#334155'}
                              strokeWidth={isCond0 ? '3' : '2'}
                            />
                            <line
                              x1={x}
                              y1="93"
                              x2={x}
                              y2="115"
                              stroke={isCond0 ? '#10b981' : '#334155'}
                              strokeWidth={isCond0 ? '3' : '2'}
                            />
                            <circle cx={x} cy="115" r="3.5" fill={isCond0 || isCond1 || isCond4 ? '#10b981' : '#475569'} />

                            <line
                              x1={x}
                              y1="115"
                              x2={x}
                              y2="137"
                              stroke={isCond1 ? '#10b981' : '#334155'}
                              strokeWidth={isCond1 ? '3' : '2'}
                            />
                            <line
                              x1={x}
                              y1="173"
                              x2={x}
                              y2="200"
                              stroke={isCond1 ? '#10b981' : '#334155'}
                              strokeWidth={isCond1 ? '3' : '2'}
                            />

                            <line
                              x1={x}
                              y1="200"
                              x2={x}
                              y2="227"
                              stroke={isCond2 ? '#10b981' : '#334155'}
                              strokeWidth={isCond2 ? '3' : '2'}
                            />
                            <line
                              x1={x}
                              y1="263"
                              x2={x}
                              y2="285"
                              stroke={isCond2 ? '#10b981' : '#334155'}
                              strokeWidth={isCond2 ? '3' : '2'}
                            />
                            <circle cx={x} cy="285" r="3.5" fill={isCond2 || isCond3 || isCond5 ? '#10b981' : '#475569'} />

                            <line
                              x1={x}
                              y1="285"
                              x2={x}
                              y2="307"
                              stroke={isCond3 ? '#10b981' : '#334155'}
                              strokeWidth={isCond3 ? '3' : '2'}
                            />
                            <line
                              x1={x}
                              y1="343"
                              x2={x}
                              y2="360"
                              stroke={isCond3 ? '#10b981' : '#334155'}
                              strokeWidth={isCond3 ? '3' : '2'}
                            />

                            {/* Neutral Active Clamp Branch Connections */}
                            <line
                              x1={x}
                              y1="115"
                              x2={z}
                              y2="115"
                              stroke={isCond4 ? '#10b981' : '#334155'}
                              strokeWidth={isCond4 ? '3' : '2'}
                            />
                            <line
                              x1={z}
                              y1="115"
                              x2={z}
                              y2="137"
                              stroke={isCond4 ? '#10b981' : '#334155'}
                              strokeWidth={isCond4 ? '3' : '2'}
                            />
                            <line
                              x1={z}
                              y1="173"
                              x2={z}
                              y2="175"
                              stroke={isCond4 ? '#10b981' : '#334155'}
                              strokeWidth={isCond4 ? '3' : '2'}
                            />

                            <circle cx={z} cy="175" r="4" fill={isCond4 || isCond5 ? '#10b981' : '#f59e0b'} />

                            <line
                              x1={z}
                              y1="175"
                              x2={z}
                              y2="227"
                              stroke={isCond5 ? '#10b981' : '#334155'}
                              strokeWidth={isCond5 ? '3' : '2'}
                            />
                            <line
                              x1={z}
                              y1="263"
                              x2={z}
                              y2="285"
                              stroke={isCond5 ? '#10b981' : '#334155'}
                              strokeWidth={isCond5 ? '3' : '2'}
                            />
                            <line
                              x1={z}
                              y1="285"
                              x2={x}
                              y2="285"
                              stroke={isCond5 ? '#10b981' : '#334155'}
                              strokeWidth={isCond5 ? '3' : '2'}
                            />

                            {/* 18 Authentic Power MOSFETs */}
                            {renderStudioMosfet(x, 75, `S${phaseName}1`, gates[0], cond[0], false, phaseName)}
                            {renderStudioMosfet(x, 155, `S${phaseName}2`, gates[1], cond[1], false, phaseName)}
                            {renderStudioMosfet(x, 245, `S${phaseName}3`, gates[2], cond[2], false, phaseName)}
                            {renderStudioMosfet(x, 325, `S${phaseName}4`, gates[3], cond[3], false, phaseName)}
                            {renderStudioMosfet(z, 155, `S${phaseName}5`, gates[4], cond[4], true, phaseName)}
                            {renderStudioMosfet(z, 245, `S${phaseName}6`, gates[5], cond[5], true, phaseName)}

                            {/* Phase Output Terminal & Filter Load */}
                            <line x1={x} y1="200" x2={outX} y2="200" stroke={col} strokeWidth="2.5" />
                            <circle cx={x} cy="200" r="4.5" fill={col} stroke="#0f172a" strokeWidth="1.5" />
                            <circle cx={outX} cy="200" r="3.5" fill={col} />

                            {/* Current Direction Arrow */}
                            <text x={outX - 18} y="190" fill={col} fontSize="11" fontWeight="bold">
                              {cur >= 0 ? '→' : '←'} {cur.toFixed(1)} A
                            </text>

                            {/* Load RL Inductor & Resistor */}
                            <line x1={outX} y1="200" x2={outX} y2="235" stroke={col} strokeWidth="2" />
                            <path
                              d={`M${outX},235 q-8,6 0,12 q-8,6 0,12 q-8,6 0,12 v6`}
                              fill="none"
                              stroke={col}
                              strokeWidth="2.5"
                            />
                            <text x={outX + 10} y="255" fill="#94a3b8" fontSize="10">
                              L {config.L} mH
                            </text>

                            <rect
                              x={outX - 10}
                              y="280"
                              width="20"
                              height="36"
                              fill={col}
                              fillOpacity="0.2"
                              stroke={col}
                              strokeWidth="2"
                            />
                            <text x={outX + 14} y="302" fill="#94a3b8" fontSize="10">
                              R {config.R} Ω
                            </text>
                            <line x1={outX} y1="316" x2={outX} y2="390" stroke={col} strokeWidth="2" />
                          </g>
                        );
                      })}

                      {/* Star Neutral Connection n */}
                      <line x1="315" y1="390" x2="795" y2="390" stroke="#94a3b8" strokeWidth="2.5" />
                      <circle cx="555" cy="390" r="5" fill="#f8fafc" />
                      <text x="565" y="394" fill="#f8fafc" fontSize="12" fontWeight="bold">
                        Load Star Neutral n (Floating)
                      </text>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Right Column: Space Vector alpha-beta Plane */}
              <div className="col-span-12 xl:col-span-4 flex flex-col gap-4">
                {/* Space Vector Hexagon Card */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-md flex flex-col justify-between items-center space-y-3 flex-1 min-h-[350px]">
                  <div className="w-full text-left font-mono">
                    <span className="text-slate-200 font-bold text-xs flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-emerald-400" /> Space Vector αβ Plane
                    </span>
                  </div>

                  <div className="flex justify-center w-full my-auto">
                    <svg viewBox="0 0 280 280" className="w-56 h-56 font-mono select-none">
                      {/* Axes */}
                      <line x1="20" y1="140" x2="260" y2="140" stroke="#334155" strokeWidth="1.5" strokeDasharray="3 3" />
                      <line x1="140" y1="20" x2="140" y2="260" stroke="#334155" strokeWidth="1.5" strokeDasharray="3 3" />
                      <text x="262" y="144" fill="#94a3b8" fontSize="11">α</text>
                      <text x="144" y="16" fill="#94a3b8" fontSize="11">β</text>

                      {/* 3-Level Outer & Inner Hexagon Rings */}
                      {renderHexagonRings()}

                      {/* 19 Discrete ANPC Space Vectors */}
                      {ANPC_SPACE_VECTORS.map((sv, idx) => {
                        const va = sv.v[0] * (config.vdc / 2);
                        const vb = sv.v[1] * (config.vdc / 2);
                        const vc = sv.v[2] * (config.vdc / 2);
                        const alpha = (2 / 3) * (va - 0.5 * vb - 0.5 * vc);
                        const beta = (1 / Math.sqrt(3)) * (vb - vc);
                        const scale = 110 / (config.vdc * 0.7);
                        const px = 140 + alpha * scale;
                        const py = 140 - beta * scale;
                        return (
                          <circle
                            key={idx}
                            cx={px}
                            cy={py}
                            r="3"
                            fill="#475569"
                            stroke="#1e293b"
                            strokeWidth="1"
                          />
                        );
                      })}

                      {/* Instantaneous Applied Vector Arrow */}
                      {!spaceVectorInfo.isZero && (
                        <line
                          x1="140"
                          y1="140"
                          x2={140 + spaceVectorInfo.valpha * (110 / (config.vdc * 0.7))}
                          y2={140 - spaceVectorInfo.vbeta * (110 / (config.vdc * 0.7))}
                          stroke="#10b981"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                        />
                      )}

                      {/* Cursor Vector Dot */}
                      <circle
                        cx={140 + spaceVectorInfo.valpha * (110 / (config.vdc * 0.7))}
                        cy={140 - spaceVectorInfo.vbeta * (110 / (config.vdc * 0.7))}
                        r={spaceVectorInfo.isZero ? '6' : '5'}
                        fill={spaceVectorInfo.isZero ? '#10b981' : '#38bdf8'}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                    </svg>
                  </div>

                  <div className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[11px] font-mono space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Applied Vector:</span>
                      <span className="font-bold text-sky-300">[{spaceVectorInfo.stStr}]</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Coordinates:</span>
                      <span className="text-slate-200">
                        α = {spaceVectorInfo.valpha.toFixed(1)}V · β = {spaceVectorInfo.vbeta.toFixed(1)}V
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Magnitude:</span>
                      <span className="text-emerald-400 font-bold">{spaceVectorInfo.mag.toFixed(1)} V</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Middle Row: Full Widescreen 5-Channel Power Electronics Oscilloscope */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3 flex flex-col">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-200 font-bold flex items-center gap-1.5">
                  📺 Widescreen 5-Channel Real-Time Oscilloscope
                </span>
                <div className="hidden md:flex items-center gap-4 text-[10px]">
                  <span className="text-[#38bdf8]">● CH1: Carriers / Modulator</span>
                  <span className="text-[#c084fc]">● CH2: V_AN</span>
                  <span className="text-[#f43f5e]">● CH3: V_AB</span>
                  <span className="text-[#10b981]">● CH4: i_a (Emerald)</span>
                  <span className="text-[#fbbf24]">● CH5: V_CM</span>
                </div>
              </div>

              {/* High precision canvas container */}
              <div ref={oscilloscopeContainerRef} className="w-full rounded border border-slate-900 bg-slate-950 overflow-hidden relative">
                <canvas ref={oscilloscopeCanvasRef} className="block w-full h-[450px]" />
              </div>

              {/* Time Scrubber Slider */}
              <div className="flex items-center gap-3 bg-slate-900 p-2 rounded-lg border border-slate-800">
                <span className="text-xs font-mono text-slate-400 min-w-[50px]">0 ms</span>
                <input
                  type="range"
                  min="0"
                  max={simData.n - 1}
                  value={index}
                  onChange={(e) => {
                    setIsPlaying(false);
                    setIndex(Number(e.target.value));
                  }}
                  className="w-full accent-teal-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
                <span className="text-xs font-mono text-slate-400 min-w-[50px] text-right">
                  {config.duration} ms
                </span>
              </div>
            </div>

            {/* Bottom Row: Metrics & Active Commutation Inspector */}
            <div className="grid grid-cols-12 gap-4">
              
              {/* Left Side: Real-Time Controller Metrics */}
              <div className="col-span-12 xl:col-span-5 bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between min-h-[300px]">
                <div className="text-slate-200 font-bold text-xs font-mono mb-3">
                  📊 Real-Time Control System Performance Metrics
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono h-full">
                  <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-3 flex flex-col justify-center">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Worst Tracking Error</div>
                    <div className="text-lg font-bold text-sky-400">
                      {worstMetric('relative') !== null ? `${worstMetric('relative')!.toFixed(2)} %` : '—'}
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-3 flex flex-col justify-center">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">THD (Steady-State)</div>
                    <div className="text-lg font-bold text-emerald-400">
                      {worstMetric('thd') !== null ? `${worstMetric('thd')!.toFixed(2)} %` : '—'}
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-3 flex flex-col justify-center">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Phase Angle Error</div>
                    <div className="text-lg font-bold text-purple-400">
                      {worstMetric('phase') !== null ? `${worstMetric('phase')!.toFixed(2)}°` : '—'}
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-3 flex flex-col justify-center">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Mean Switching Freq</div>
                    <div className="text-lg font-bold text-amber-400">
                      {meanSwKHz.toFixed(2)} kHz
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side: Active Commutation Inspector Card */}
              <div className="col-span-12 xl:col-span-7 bg-slate-950 p-3.5 rounded-xl border border-slate-800 shadow-md font-mono text-xs space-y-2 min-h-[300px]">
                <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-1.5">
                  <span className="text-slate-200 font-bold flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-amber-400" /> Commutation Inspector
                  </span>
                  <span className="text-[10px] text-teal-300 font-bold bg-teal-950/40 px-1.5 py-0.5 rounded border border-teal-500/30">
                    {config.method.toUpperCase()}
                  </span>
                </div>

                {/* Specific Inspector view depending on active method */}
                {['pi', 'pr'].includes(config.method) && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-900 text-slate-500">
                          <th className="py-1">Phase</th>
                          <th>e [{config.variable === 'i' ? 'A' : 'V'}]</th>
                          <th>Kp·e</th>
                          <th>Raw u</th>
                          <th>Clipped d</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900">
                        {[0, 1, 2].map((h) => {
                          const err = currentDecision.reference[h] - currentDecision.y[h];
                          return (
                            <tr key={h} className="hover:bg-slate-900/40">
                              <td className="py-1.5 font-bold" style={{ color: COLORS[h] }}>
                                Phase {NAMES[h]}
                              </td>
                              <td>{err.toFixed(1)}</td>
                              <td>{(simData.p.Kp * err).toFixed(2)}</td>
                              <td>{currentDecision.raw[h].toFixed(2)}</td>
                              <td className="font-bold text-teal-300">{currentDecision.d[h].toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {config.method === 'hyst' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-900 text-slate-500">
                          <th className="py-1">Phase</th>
                          <th>e [{config.variable === 'i' ? 'A' : 'V'}]</th>
                          <th>Action</th>
                          <th>Next State</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900">
                        {[0, 1, 2].map((h) => {
                          const err = currentDecision.reference[h] - currentDecision.y[h];
                          const act =
                            err > config.band
                              ? 'Step Up (+)'
                              : err < -config.band
                              ? 'Step Down (−)'
                              : 'Hold';
                          return (
                            <tr key={h} className="hover:bg-slate-900/40">
                              <td className="py-1.5 font-bold" style={{ color: COLORS[h] }}>
                                Phase {NAMES[h]}
                              </td>
                              <td>{err.toFixed(1)}</td>
                              <td className="font-bold text-amber-300">{act}</td>
                              <td className="font-bold text-teal-300">
                                {ANPC_LEVELS[currentDecision.next[h]] > 0
                                  ? '+'
                                  : ANPC_LEVELS[currentDecision.next[h]] < 0
                                  ? '−'
                                  : '0'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {config.method === 'fcs' && currentDecision.search && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-900 text-slate-500">
                          <th className="py-1">Rank</th>
                          <th>State [ABC]</th>
                          <th>Cost J</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900">
                        {currentDecision.search.candidates
                          .slice()
                          .sort((a, b) => a.cost - b.cost)
                          .slice(0, 4)
                          .map((cand, rank) => {
                            const isBest = cand.id === currentDecision.search?.choice;
                            const st = ANPC_SPACE_VECTORS[cand.id].state;
                            return (
                              <tr key={cand.id} className={isBest ? 'text-teal-300 font-semibold' : ''}>
                                <td className="py-1">#{rank + 1}</td>
                                <td>
                                  [
                                  {st
                                    .map((s) => (ANPC_LEVELS[s] > 0 ? '+' : ANPC_LEVELS[s] < 0 ? '−' : '0'))
                                    .join(' ')}
                                  ]
                                </td>
                                <td className="font-mono">{cand.cost.toFixed(4)}</td>
                                <td>
                                  {isBest ? <span className="text-emerald-400 font-bold">Optimal</span> : <span className="text-slate-600">—</span>}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}

                {config.method === 'oss' && currentDecision.sequence && (
                  <div className="space-y-2 pt-1">
                    <div className="flex h-7 w-full rounded overflow-hidden border border-slate-800 text-[10px] font-bold">
                      {currentDecision.sequence.sequence.map((vecId, sIdx) => {
                        const frac = currentDecision.sequence!.fractions[sIdx];
                        if (frac < 0.001) return null;
                        const st = ANPC_SPACE_VECTORS[vecId].state;
                        const stStr = st
                          .map((s) => (ANPC_LEVELS[s] > 0 ? '+' : ANPC_LEVELS[s] < 0 ? '−' : '0'))
                          .join('');
                        const bgColors = ['#1e293b', '#0d9488', '#0284c7', '#0d9488', '#1e293b'];
                        return (
                          <div
                            key={sIdx}
                            className="flex flex-col items-center justify-center text-white overflow-hidden text-center"
                            style={{ flex: frac, backgroundColor: bgColors[sIdx] }}
                          >
                            <span>[{stStr}]</span>
                            <span className="text-[8px] text-slate-300">{(frac * 100).toFixed(0)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* View Mode 2: 5-Controller Comparative Benchmark Audit */}
        {viewMode === 'audit' && (
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-teal-400" />
                  5-Controller Comparative Benchmark Audit
                </h3>
                <p className="text-[11px] text-slate-400">
                  Rigorous comparison under exact same operating conditions: R={config.R}Ω, L={config.L}mH, Vdc=
                  {config.vdc}V, fs={config.fs}Hz.
                </p>
              </div>
              <button
                onClick={handleRunComparison}
                disabled={isComparing}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded text-xs font-bold transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Re-run Comparison
              </button>
            </div>

            {comparisonResults ? (
              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2">Control Algorithm</th>
                        <th>Relative Error %</th>
                        <th>THD %</th>
                        <th>Phase Lag |φ|°</th>
                        <th>Switching Freq</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {comparisonResults.map((row) => {
                        const isCurrent = row.method === config.method;
                        return (
                          <tr
                            key={row.method}
                            className={`hover:bg-slate-900/60 ${isCurrent ? 'bg-teal-950/30' : ''}`}
                          >
                            <td className="py-2.5 font-bold flex items-center gap-2">
                              {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>}
                              <span className={isCurrent ? 'text-teal-300' : 'text-slate-200'}>
                                {row.label}
                              </span>
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <span className="min-w-[42px]">
                                  {row.relativeErrorPct !== null ? `${row.relativeErrorPct.toFixed(2)}%` : '—'}
                                </span>
                                <div className="w-24 bg-slate-800 h-1.5 rounded overflow-hidden">
                                  <div
                                    className="bg-sky-400 h-full rounded"
                                    style={{
                                      width: `${Math.min(100, (row.relativeErrorPct || 0) * 2)}%`,
                                    }}
                                  ></div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <span className="min-w-[42px]">
                                  {row.thdPct !== null ? `${row.thdPct.toFixed(2)}%` : '—'}
                                </span>
                                <div className="w-24 bg-slate-800 h-1.5 rounded overflow-hidden">
                                  <div
                                    className="bg-emerald-400 h-full rounded"
                                    style={{
                                      width: `${Math.min(100, (row.thdPct || 0) * 3)}%`,
                                    }}
                                  ></div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <span className="min-w-[42px]">
                                  {row.phaseErrorDeg !== null ? `${row.phaseErrorDeg.toFixed(2)}°` : '—'}
                                </span>
                                <div className="w-20 bg-slate-800 h-1.5 rounded overflow-hidden">
                                  <div
                                    className="bg-purple-400 h-full rounded"
                                    style={{
                                      width: `${Math.min(100, (row.phaseErrorDeg || 0) * 5)}%`,
                                    }}
                                  ></div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <span className="min-w-[48px] font-bold text-amber-300">
                                  {row.meanSwitchingKHz.toFixed(2)} kHz
                                </span>
                                <div className="w-20 bg-slate-800 h-1.5 rounded overflow-hidden">
                                  <div
                                    className="bg-amber-400 h-full rounded"
                                    style={{
                                      width: `${Math.min(100, (row.meanSwitchingKHz / 12) * 100)}%`,
                                    }}
                                  ></div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-400 leading-relaxed space-y-1">
                  <div>
                    • <strong>Resonant (PR)</strong> provides superior AC tracking with near 0° phase lag by placing an
                    infinite-gain resonant pole at the fundamental frequency $f_0$.
                  </div>
                  <div>
                    • <strong>FCS-MPC</strong> provides the fastest dynamic response during reference steps, but has variable
                    switching frequency.
                  </div>
                  <div>
                    • <strong>OSS-MPC</strong> provides optimal constant-period sequences that combine MPC's rapid tracking
                    with well-defined switching spectra.
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center space-y-2">
                <p className="text-slate-400">
                  Click the button below to run a simultaneous simulation of all 5 control strategies under identical plant
                  conditions.
                </p>
                <button
                  onClick={handleRunComparison}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded font-bold transition"
                >
                  Run 5-Controller Benchmark
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Interactive Parameter Tuning Sliders Panel */}
      <div className="px-4 pb-4">
        <details className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs font-mono group" open>
          <summary className="font-bold text-slate-200 cursor-pointer flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-teal-400" /> Plant, Reference &amp; Controller Tuning Parameters
            </span>
            <span className="text-[10px] text-slate-500 group-open:rotate-180 transition">▼</span>
          </summary>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3 pt-3 border-t border-slate-900">
            {/* Column 1: Controller Specific Tuning */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-teal-400 uppercase">Algorithm Tuning</div>

              {['pi', 'pr'].includes(config.method) && (
                <>
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Damping Ratio ζ:</span>
                      <span className="text-white font-bold">{config.zeta.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.25"
                      max="2.5"
                      step="0.05"
                      value={config.zeta}
                      onChange={(e) => setConfig((p) => ({ ...p, zeta: Number(e.target.value) }))}
                      className="w-full accent-teal-400 h-1 bg-slate-800 rounded"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Natural ωn:</span>
                      <span className="text-white font-bold">{config.wn} rad/s</span>
                    </div>
                    <input
                      type="range"
                      min="300"
                      max="4000"
                      step="50"
                      value={config.wn}
                      onChange={(e) => setConfig((p) => ({ ...p, wn: Number(e.target.value) }))}
                      className="w-full accent-teal-400 h-1 bg-slate-800 rounded"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Carrier f_cr:</span>
                      <span className="text-white font-bold">{config.carrier} Hz</span>
                    </div>
                    <input
                      type="range"
                      min="1000"
                      max="8000"
                      step="500"
                      value={config.carrier}
                      onChange={(e) => setConfig((p) => ({ ...p, carrier: Number(e.target.value) }))}
                      className="w-full accent-teal-400 h-1 bg-slate-800 rounded"
                    />
                  </div>
                  {config.method === 'pr' && (
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>Detuning Δf:</span>
                        <span className="text-white font-bold">{config.detune} Hz</span>
                      </div>
                      <input
                        type="range"
                        min="-15"
                        max="15"
                        step="0.5"
                        value={config.detune}
                        onChange={(e) => setConfig((p) => ({ ...p, detune: Number(e.target.value) }))}
                        className="w-full accent-teal-400 h-1 bg-slate-800 rounded"
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-400">Anti-Windup:</span>
                    <button
                      onClick={() => setConfig((p) => ({ ...p, aw: !p.aw }))}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        config.aw
                          ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {config.aw ? 'ENABLED' : 'DISABLED'}
                    </button>
                  </div>
                </>
              )}

              {config.method === 'hyst' && (
                <>
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Half-Band h:</span>
                      <span className="text-white font-bold">
                        {config.band.toFixed(2)} {config.variable === 'i' ? 'A' : 'V'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={config.variable === 'i' ? 0.1 : 1}
                      max={config.variable === 'i' ? 3 : 30}
                      step={config.variable === 'i' ? 0.1 : 1}
                      value={config.band}
                      onChange={(e) => setConfig((p) => ({ ...p, band: Number(e.target.value) }))}
                      className="w-full accent-teal-400 h-1 bg-slate-800 rounded"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Sampling Rate fs:</span>
                      <span className="text-white font-bold">{config.fs} Hz</span>
                    </div>
                    <input
                      type="range"
                      min="2000"
                      max="16000"
                      step="1000"
                      value={config.fs}
                      onChange={(e) => setConfig((p) => ({ ...p, fs: Number(e.target.value) }))}
                      className="w-full accent-teal-400 h-1 bg-slate-800 rounded"
                    />
                  </div>
                </>
              )}

              {(config.method === 'fcs' || config.method === 'oss') && (
                <>
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Switching Penalty λ:</span>
                      <span className="text-white font-bold">{config.lambda.toFixed(3)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="0.3"
                      step="0.005"
                      value={config.lambda}
                      onChange={(e) => setConfig((p) => ({ ...p, lambda: Number(e.target.value) }))}
                      className="w-full accent-teal-400 h-1 bg-slate-800 rounded"
                    />
                  </div>
                  {config.method === 'fcs' && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-400">Prediction Horizon:</span>
                      <div className="flex gap-1">
                        {[1, 2].map((h) => (
                          <button
                            key={h}
                            onClick={() => setConfig((p) => ({ ...p, horizon: h }))}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              config.horizon === h
                                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            N={h}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Sampling / Sequence fs:</span>
                      <span className="text-white font-bold">{config.fs} Hz</span>
                    </div>
                    <input
                      type="range"
                      min="2000"
                      max="16000"
                      step="1000"
                      value={config.fs}
                      onChange={(e) => setConfig((p) => ({ ...p, fs: Number(e.target.value) }))}
                      className="w-full accent-teal-400 h-1 bg-slate-800 rounded"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Column 2: Reference Step Settings */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-sky-400 uppercase">Reference Step</div>
              <div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Initial Peak:</span>
                  <span className="text-white font-bold">
                    {config.amp} {config.variable === 'i' ? 'A' : 'V'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={config.variable === 'i' ? 35 : 200}
                  step={config.variable === 'i' ? 0.5 : 2}
                  value={config.amp}
                  onChange={(e) => setConfig((p) => ({ ...p, amp: Number(e.target.value) }))}
                  className="w-full accent-sky-400 h-1 bg-slate-800 rounded"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Final Peak:</span>
                  <span className="text-white font-bold">
                    {config.final} {config.variable === 'i' ? 'A' : 'V'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={config.variable === 'i' ? 35 : 200}
                  step={config.variable === 'i' ? 0.5 : 2}
                  value={config.final}
                  onChange={(e) => setConfig((p) => ({ ...p, final: Number(e.target.value) }))}
                  className="w-full accent-sky-400 h-1 bg-slate-800 rounded"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Step Time:</span>
                  <span className="text-white font-bold">{config.step} ms</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="70"
                  step="5"
                  value={config.step}
                  onChange={(e) => setConfig((p) => ({ ...p, step: Number(e.target.value) }))}
                  className="w-full accent-sky-400 h-1 bg-slate-800 rounded"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>AC Frequency f0:</span>
                  <span className="text-white font-bold">{config.f0} Hz</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={config.f0}
                  onChange={(e) => setConfig((p) => ({ ...p, f0: Number(e.target.value) }))}
                  className="w-full accent-sky-400 h-1 bg-slate-800 rounded"
                />
              </div>
            </div>

            {/* Column 3: Physical Load & DC Bus */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-amber-400 uppercase">Load &amp; DC Bus</div>
              <div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Load Resistance R:</span>
                  <span className="text-white font-bold">{config.R} Ω</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="20"
                  step="0.5"
                  value={config.R}
                  onChange={(e) => setConfig((p) => ({ ...p, R: Number(e.target.value) }))}
                  className="w-full accent-amber-400 h-1 bg-slate-800 rounded"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Filter Inductance L:</span>
                  <span className="text-white font-bold">{config.L} mH</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="15"
                  step="0.5"
                  value={config.L}
                  onChange={(e) => setConfig((p) => ({ ...p, L: Number(e.target.value) }))}
                  className="w-full accent-amber-400 h-1 bg-slate-800 rounded"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>DC Bus V_dc:</span>
                  <span className="text-white font-bold">{config.vdc} V</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="600"
                  step="20"
                  value={config.vdc}
                  onChange={(e) => setConfig((p) => ({ ...p, vdc: Number(e.target.value) }))}
                  className="w-full accent-amber-400 h-1 bg-slate-800 rounded"
                />
              </div>
            </div>

            {/* Column 4: Reset & Quick Actions */}
            <div className="space-y-2 flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-bold text-purple-400 uppercase mb-1.5">Simulation State</div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800 text-[10px] space-y-1 text-slate-400">
                  <div>Plant Time Constant: {((config.L / 1000 / config.R) * 1000).toFixed(2)} ms</div>
                  <div>Sample Interval: {(1e6 / config.fs).toFixed(1)} µs</div>
                  {['pi', 'pr'].includes(config.method) && (
                    <div>
                      Gain Kp = {simData.p.Kp.toFixed(4)}, Ki = {simData.p.Ki.toFixed(1)}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setConfig({ ...ANPC_DEFAULTS })}
                className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-bold transition flex items-center justify-center gap-1.5 border border-slate-700"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset to Defaults
              </button>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};

// Helper SVG render functions
function renderStudioMosfet(
  x: number,
  y: number,
  label: string,
  gateOn: number,
  current: number,
  isNeutral = false,
  phaseName = 'A'
) {
  const active = Math.abs(current) > 1e-4;
  const isForward = current > 0; // Channel conduction (forward)
  const isReverse = current < 0; // Body diode conduction (reverse 3rd quadrant)

  const isChannelConducting = active && isForward;
  const isDiodeConducting = active && isReverse;

  const isActive = active;
  const activeColor = '#10b981'; // Vibrant green

  const channelColor = isActive ? activeColor : '#475569';
  const diodeColor = isActive ? activeColor : '#64748b';
  const gateColor = gateOn ? '#10b981' : '#64748b';
  const bodyFill = isActive ? 'rgba(16, 185, 129, 0.14)' : 'rgba(15, 23, 42, 0.65)';
  const boxBorder = isActive
    ? activeColor
    : gateOn
    ? '#0284c7'
    : '#334155';

  const statusText = isChannelConducting
    ? 'SiC ON'
    : isDiodeConducting
    ? 'DIODE ON'
    : gateOn
    ? 'GATE'
    : 'OFF';

  const statusColor = isActive
    ? activeColor
    : gateOn
    ? '#38bdf8'
    : '#64748b';

  return (
    <g key={label} id={`mosfet-${label}`} className="cursor-pointer group">
      {/* Active Glow Halo */}
      {isActive && (
        <rect
          x={x - 21}
          y={y - 20}
          width={42}
          height={40}
          rx={7}
          fill="none"
          stroke={activeColor}
          strokeWidth="1.5"
          opacity="0.6"
          className="animate-pulse"
        />
      )}

      {/* Package Boundary Box */}
      <rect
        x={x - 19}
        y={y - 18}
        width={38}
        height={36}
        rx={5}
        fill={bodyFill}
        stroke={boxBorder}
        strokeWidth={active ? '1.8' : '1.2'}
        className="group-hover:stroke-sky-400 transition"
      />

      {/* Drain Terminal (Top in at x, y-18) */}
      <line x1={x} y1={y - 18} x2={x} y2={y - 11} stroke={channelColor} strokeWidth="1.8" />
      <line x1={x} y1={y - 11} x2={x - 6} y2={y - 11} stroke={channelColor} strokeWidth="1.4" />
      <line x1={x - 6} y1={y - 11} x2={x - 6} y2={y - 8} stroke={channelColor} strokeWidth="1.4" />

      {/* Source Terminal (Bottom out at x, y+18) */}
      <line x1={x} y1={y + 18} x2={x} y2={y + 11} stroke={channelColor} strokeWidth="1.8" />
      <line x1={x} y1={y + 11} x2={x - 6} y2={y + 11} stroke={channelColor} strokeWidth="1.4" />
      <line x1={x - 6} y1={y + 11} x2={x - 6} y2={y + 8} stroke={channelColor} strokeWidth="1.4" />

      {/* 3 Enhancement-mode Channel Segments at x-6 */}
      <line x1={x - 6} y1={y - 8} x2={x - 6} y2={y - 4} stroke={channelColor} strokeWidth="2" />
      <line x1={x - 6} y1={y - 2} x2={x - 6} y2={y + 2} stroke={channelColor} strokeWidth="2" />
      <line x1={x - 6} y1={y + 4} x2={x - 6} y2={y + 8} stroke={channelColor} strokeWidth="2" />

      {/* Dielectric Insulated Gate Plate at x-10 */}
      <line
        x1={x - 10}
        y1={y - 9}
        x2={x - 10}
        y2={y + 9}
        stroke={gateColor}
        strokeWidth="2"
      />
      {/* Gate Terminal Lead */}
      <line x1={x - 10} y1={y} x2={x - 16} y2={y} stroke={gateColor} strokeWidth="1.4" />
      <circle cx={x - 16} cy={y} r="1.5" fill={gateColor} />

      {/* N-Channel Inward Arrow on center channel segment */}
      <polygon
        points={`${x - 8},${y} ${x - 11},${y - 2.5} ${x - 11},${y + 2.5}`}
        fill={channelColor}
      />

      {/* Antiparallel Body Diode (Right branch inside package) */}
      <line x1={x} y1={y - 11} x2={x + 7} y2={y - 11} stroke={diodeColor} strokeWidth="1.2" />
      <line x1={x + 7} y1={y - 11} x2={x + 7} y2={y - 4} stroke={diodeColor} strokeWidth="1.2" />
      <line x1={x} y1={y + 11} x2={x + 7} y2={y + 11} stroke={diodeColor} strokeWidth="1.2" />
      <line x1={x + 7} y1={y + 11} x2={x + 7} y2={y + 4} stroke={diodeColor} strokeWidth="1.2" />

      {/* Diode Triangle (Anode at Source bottom, Cathode at Drain top) */}
      <polygon
        points={`${x + 3},${y + 4} ${x + 11},${y + 4} ${x + 7},${y - 3}`}
        fill={isActive ? '#10b981' : 'none'}
        stroke={diodeColor}
        strokeWidth="1.2"
      />
      {/* Cathode Bar */}
      <line x1={x + 3} y1={y - 3} x2={x + 11} y2={y - 3} stroke={diodeColor} strokeWidth="1.2" />

      {/* Device Label & Status Badge */}
      <text
        x={isNeutral ? x - 22 : x + 22}
        y={y - 1}
        fill={statusColor}
        fontSize="10"
        fontWeight="bold"
        textAnchor={isNeutral ? 'end' : 'start'}
      >
        {label}
      </text>
      <text
        x={isNeutral ? x - 22 : x + 22}
        y={y + 10}
        fill={statusColor}
        fontSize="8"
        textAnchor={isNeutral ? 'end' : 'start'}
      >
        {statusText}
      </text>

      {/* Informative Tooltip */}
      <title>
        {`Phase ${phaseName} - ${label}: ${
          isChannelConducting
            ? 'MOSFET Channel ON (Forward Conduction)'
            : isDiodeConducting
            ? 'Antiparallel Body Diode ON (3rd-Quadrant Conduction)'
            : gateOn
            ? 'Gate ON (+15V driven, no current)'
            : 'Gate OFF (Forward/Reverse Blocking)'
        } | i = ${current.toFixed(2)} A`}
      </title>
    </g>
  );
}

function renderHexagonRings() {
  const rings = [65, 100];
  return (
    <>
      {rings.map((r, idx) => {
        const points = Array.from({ length: 6 }, (_, i) => {
          const angle = (i * Math.PI) / 3;
          const px = 140 + r * Math.cos(angle);
          const py = 140 - r * Math.sin(angle);
          return `${px.toFixed(1)},${py.toFixed(1)}`;
        }).join(' ');
        return (
          <polygon
            key={idx}
            points={points}
            fill="none"
            stroke="#1e293b"
            strokeWidth="1.2"
          />
        );
      })}
    </>
  );
}

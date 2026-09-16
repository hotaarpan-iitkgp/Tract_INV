import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { WaveformPoint, TopologyType, CarrierDisposition } from '../types';
import { Play, Pause, RotateCcw, ZoomIn, Eye, EyeOff, Activity, Maximize2, Minimize2 } from 'lucide-react';

export interface ChannelState {
  id: string;
  name: string;
  color: string;
  enabled: boolean;
  unit: string;
}

export const DEFAULT_CHANNELS: ChannelState[] = [
  { id: 'ch1', name: 'CH1: Ref & Carrier', color: '#38bdf8', enabled: true, unit: 'p.u.' },
  { id: 'ch2', name: 'CH2: Pole V_AN', color: '#c084fc', enabled: true, unit: 'V' },
  { id: 'ch3', name: 'CH3: Line V_AB', color: '#f43f5e', enabled: true, unit: 'V' },
  { id: 'ch4', name: 'CH4: Current i_a', color: '#10b981', enabled: true, unit: 'A' },
  { id: 'ch5', name: 'CH5: Common V_CM', color: '#fbbf24', enabled: true, unit: 'V' },
];

export interface OscilloscopeCanvasProps {
  points: WaveformPoint[];
  topology: TopologyType;
  scrubberIndex: number;
  onScrub: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  vdc: number;
  f0: number;
  fsw: number;
  carrierDisposition?: CarrierDisposition;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  channels?: ChannelState[];
  onToggleChannel?: (id: string) => void;
  zoomMode?: '2cycles' | '1cycle' | 'carrierZoom';
  onSetZoomMode?: (mode: '2cycles' | '1cycle' | 'carrierZoom') => void;
}

// Standard 1-2-5 oscilloscope decade scale rounding with 20-30% headroom
function getNiceScale(peak: number, minScale = 20): number {
  const target = Math.max(minScale, peak * 1.25);
  const exponent = Math.floor(Math.log10(target));
  const fraction = target / Math.pow(10, exponent);
  let niceFraction: number;
  if (fraction <= 1.2) niceFraction = 1.2;
  else if (fraction <= 1.5) niceFraction = 1.5;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 3) niceFraction = 3;
  else if (fraction <= 5) niceFraction = 5;
  else if (fraction <= 8) niceFraction = 8;
  else niceFraction = 10;
  return niceFraction * Math.pow(10, exponent);
}

export const OscilloscopeCanvas: React.FC<OscilloscopeCanvasProps> = ({
  points,
  topology,
  scrubberIndex,
  onScrub,
  isPlaying,
  onTogglePlay,
  vdc,
  f0,
  fsw,
  carrierDisposition = 'IPD',
  isFullscreen = false,
  onToggleFullscreen,
  channels: externalChannels,
  onToggleChannel: externalToggleChannel,
  zoomMode: externalZoomMode,
  onSetZoomMode: externalSetZoomMode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef(false);

  // Time-base zoom options: 1 cycle, 2 cycles, or carrier zoom (shows 4-6 carrier periods)
  const [internalZoomMode, setInternalZoomMode] = useState<'2cycles' | '1cycle' | 'carrierZoom'>('1cycle');
  const zoomMode = externalZoomMode ?? internalZoomMode;
  const setZoomMode = externalSetZoomMode ?? setInternalZoomMode;

  // Channel enable toggles
  const [internalChannels, setInternalChannels] = useState<ChannelState[]>(DEFAULT_CHANNELS);
  const channels = externalChannels ?? internalChannels;

  const toggleChannel = (id: string) => {
    if (externalToggleChannel) {
      externalToggleChannel(id);
    } else {
      setInternalChannels((prev) =>
        prev.map((ch) => (ch.id === id ? { ...ch, enabled: !ch.enabled } : ch))
      );
    }
  };

  // Compute current display window indices
  const totalPoints = points.length;
  let startIndex = 0;
  let endIndex = Math.max(1, totalPoints - 1);

  if (zoomMode === '1cycle') {
    // Show first fundamental cycle
    endIndex = Math.max(1, Math.floor(totalPoints / 2));
  } else if (zoomMode === 'carrierZoom') {
    // Zoom around the current scrubber position to show 4 carrier periods
    const pointsPerCarrier = Math.max(12, Math.floor(totalPoints / ((fsw / f0) * 2)));
    const windowSpan = pointsPerCarrier * 4;
    const center = scrubberIndex;
    startIndex = Math.max(0, center - Math.floor(windowSpan / 2));
    endIndex = Math.min(totalPoints - 1, startIndex + windowSpan);
    if (endIndex - startIndex < windowSpan && startIndex > 0) {
      startIndex = Math.max(0, endIndex - windowSpan);
    }
  }

  const visiblePointsCount = Math.max(2, endIndex - startIndex + 1);

  // Dynamically compute safe, generous ranges for all channels so nothing ever clips
  const channelRanges = useMemo(() => {
    // Current ia: scan actual peak current across entire simulation dataset
    let peakIa = 10;
    for (let i = 0; i < points.length; i++) {
      const val = Math.abs(points[i]?.ia || 0);
      if (val > peakIa) peakIa = val;
    }
    const iaScale = getNiceScale(peakIa, 30);

    // Pole voltage Van:
    const maxPole = topology === 'OEW-VSI' ? vdc : vdc / 2;
    const vanScale = getNiceScale(maxPole, 100);

    // Line voltage Vab:
    const vabScale = getNiceScale(vdc, 200);

    // Common mode voltage Vcm:
    const vcmScale = getNiceScale(vdc / 2, 100);

    return {
      ch1: [-1.2, 1.2] as [number, number],
      ch2: [-vanScale, vanScale] as [number, number],
      ch3: [-vabScale, vabScale] as [number, number],
      ch4: [-iaScale, iaScale] as [number, number],
      ch5: [-vcmScale, vcmScale] as [number, number],
      peakIa,
      iaScale,
    };
  }, [points, topology, vdc]);

  // Render waveforms on canvas with analytical triangle precision and zero clipping
  const drawWaveforms = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High DPI scaling
    const dpr = window.devicePixelRatio || 1;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Active channels
    const activeChannels = channels.filter((c) => c.enabled);
    const numTraces = activeChannels.length;
    if (numTraces === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('All oscilloscope traces are disabled. Enable traces below.', width / 2, height / 2);
      ctx.restore();
      return;
    }

    const margin = { top: 18, bottom: 26, left: 62, right: 20 };
    const traceAreaHeight = height - margin.top - margin.bottom;
    const traceHeight = traceAreaHeight / numTraces;
    const traceWidth = width - margin.left - margin.right;

    const tStart = points[startIndex]?.t || 0;
    const tEnd = points[endIndex]?.t || (tStart + 0.01);
    const tDuration = Math.max(1e-7, tEnd - tStart);

    const mapXFromTime = (t: number) => {
      const ratio = (t - tStart) / tDuration;
      return margin.left + ratio * traceWidth;
    };

    const mapXFromIndex = (ptIndex: number) => {
      const ratio = (ptIndex - startIndex) / (visiblePointsCount - 1);
      return margin.left + ratio * traceWidth;
    };

    const is3Level = topology !== '2L-VSI';
    const isPSPWM = carrierDisposition === 'PSPWM';
    const Tsw = 1 / fsw;
    const visibleCarrierCycles = tDuration * fsw;
    const maxCarrierCycles = isFullscreen ? 4000 : 2500;

    // Draw each active channel in its own dedicated subplot
    activeChannels.forEach((ch, traceIdx) => {
      const traceTop = margin.top + traceIdx * traceHeight;
      const traceBottom = traceTop + traceHeight;
      const traceMid = traceTop + traceHeight / 2;

      // Subplot background tint
      ctx.fillStyle = traceIdx % 2 === 0 ? 'rgba(15, 23, 42, 0.55)' : 'rgba(2, 6, 23, 0.75)';
      ctx.fillRect(margin.left, traceTop, traceWidth, traceHeight);

      // Subplot outer border
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(margin.left, traceTop, traceWidth, traceHeight);

      // Center reference zero line (dashed)
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.4)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(margin.left, traceMid);
      ctx.lineTo(margin.left + traceWidth, traceMid);
      ctx.stroke();
      ctx.setLineDash([]);

      // Vertical time grid lines (8 divisions)
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
      ctx.lineWidth = 0.75;
      const numDivs = 8;
      for (let d = 1; d < numDivs; d++) {
        const divX = margin.left + (traceWidth / numDivs) * d;
        ctx.beginPath();
        ctx.moveTo(divX, traceTop);
        ctx.lineTo(divX, traceBottom);
        ctx.stroke();
      }

      // Dynamic Y-range for this trace
      let range = channelRanges.ch1;
      if (ch.id === 'ch2') range = channelRanges.ch2;
      else if (ch.id === 'ch3') range = channelRanges.ch3;
      else if (ch.id === 'ch4') range = channelRanges.ch4;
      else if (ch.id === 'ch5') range = channelRanges.ch5;

      const [yMin, yMax] = range;
      const mapY = (val: number) => {
        const norm = (val - yMin) / (yMax - yMin);
        return traceBottom - norm * traceHeight;
      };

      // Y-Axis scale tick marks (Left margin)
      ctx.fillStyle = '#64748b';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`+${Math.abs(yMax).toFixed(0)}`, margin.left - 5, traceTop + 10);
      ctx.fillText('0', margin.left - 5, traceMid + 3);
      ctx.fillText(`-${Math.abs(yMin).toFixed(0)}`, margin.left - 5, traceBottom - 3);

      // Subplot Header Pill (Channel Name + Scale + instantaneous reading at cursor)
      const currentPoint = points[scrubberIndex] || points[0];
      let instantValText = '';
      if (ch.id === 'ch1') instantValText = `vref=${currentPoint.vrefA.toFixed(2)}`;
      else if (ch.id === 'ch2') instantValText = `V_AN=${currentPoint.van.toFixed(0)}V`;
      else if (ch.id === 'ch3') instantValText = `V_AB=${currentPoint.vab.toFixed(0)}V`;
      else if (ch.id === 'ch4') instantValText = `i_a=${currentPoint.ia.toFixed(1)}A (pk: ${channelRanges.peakIa.toFixed(1)}A)`;
      else if (ch.id === 'ch5') instantValText = `V_CM=${currentPoint.vcm.toFixed(0)}V`;

      // Draw Channel Label Badge
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = ch.color;
      ctx.fillText(`${ch.name}`, margin.left + 8, traceTop + 13);

      ctx.font = '10px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`[±${Math.abs(yMax).toFixed(0)} ${ch.unit}]`, margin.left + 150, traceTop + 13);

      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(instantValText, margin.left + 230, traceTop + 13);

      // CRITICAL: Clip each trace to its exact subplot bounds to prevent any bleeding!
      ctx.save();
      ctx.beginPath();
      ctx.rect(margin.left, traceTop, traceWidth, traceHeight);
      ctx.clip();

      // ==========================================
      // TRACE 1: MODULATION REFERENCE & CARRIERS
      // ==========================================
      if (ch.id === 'ch1') {
        const yZero = mapY(0);
        const yPlus1 = mapY(1);
        const yMinus1 = mapY(-1);

        if (!is3Level) {
          // 2-Level VSI: Single symmetrical triangular carrier [-1, +1]
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = isFullscreen ? 1.5 : 1.2;

          if (visibleCarrierCycles <= maxCarrierCycles) {
            // Draw analytical vertices: never distorted at any switching frequency
            const kStart = Math.floor(tStart / Tsw);
            const kEnd = Math.ceil(tEnd / Tsw);
            ctx.beginPath();
            for (let k = kStart; k <= kEnd; k++) {
              const t0 = k * Tsw;
              const tMid = (k + 0.5) * Tsw;
              const t1 = (k + 1.0) * Tsw;
              const x0 = mapXFromTime(t0);
              const xMid = mapXFromTime(tMid);
              const x1 = mapXFromTime(t1);

              if (k === kStart) ctx.moveTo(x0, mapY(-1));
              else ctx.lineTo(x0, mapY(-1));
              ctx.lineTo(xMid, mapY(1));
              ctx.lineTo(x1, mapY(-1));
            }
            ctx.stroke();
          } else {
            // High frequency envelope
            ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
            ctx.fillRect(margin.left, yPlus1, traceWidth, yMinus1 - yPlus1);
          }
        } else if (isPSPWM) {
          // ----------------------------------------
          // 3-Level Phase-Shifted PWM (PS-PWM)
          // Both carriers span [-1, +1] with 180° shift
          // ----------------------------------------
          // Shaded full carrier envelope [-1, +1]
          ctx.fillStyle = 'rgba(168, 85, 247, 0.05)';
          ctx.fillRect(margin.left, yPlus1, traceWidth, yMinus1 - yPlus1);

          // Neutral Point line
          ctx.save();
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(margin.left, yZero);
          ctx.lineTo(margin.left + traceWidth, yZero);
          ctx.stroke();
          ctx.restore();

          if (visibleCarrierCycles <= maxCarrierCycles) {
            // Carrier 1 (Primary, Amber-400): Starts at -1, peaks at +1 at mid-period
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = isFullscreen ? 1.5 : 1.3;
            ctx.beginPath();
            const kStart = Math.floor(tStart / Tsw);
            const kEnd = Math.ceil(tEnd / Tsw);
            for (let k = kStart; k <= kEnd; k++) {
              const t0 = k * Tsw;
              const tMid = (k + 0.5) * Tsw;
              const t1 = (k + 1.0) * Tsw;
              const x0 = mapXFromTime(t0);
              const xMid = mapXFromTime(tMid);
              const x1 = mapXFromTime(t1);

              if (k === kStart) ctx.moveTo(x0, mapY(-1));
              else ctx.lineTo(x0, mapY(-1));
              ctx.lineTo(xMid, mapY(1));
              ctx.lineTo(x1, mapY(-1));
            }
            ctx.stroke();

            // Carrier 2 (Secondary, Sky-400): 180° phase shifted across carrier period
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = isFullscreen ? 1.5 : 1.3;
            ctx.beginPath();
            for (let k = kStart; k <= kEnd; k++) {
              const t0 = k * Tsw;
              const tMid = (k + 0.5) * Tsw;
              const t1 = (k + 1.0) * Tsw;
              const x0 = mapXFromTime(t0);
              const xMid = mapXFromTime(tMid);
              const x1 = mapXFromTime(t1);

              if (k === kStart) ctx.moveTo(x0, mapY(1));
              else ctx.lineTo(x0, mapY(1));
              ctx.lineTo(xMid, mapY(-1));
              ctx.lineTo(x1, mapY(1));
            }
            ctx.stroke();
          } else {
            // Zoomed out high frequency envelope for PSPWM
            ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
            ctx.lineWidth = 1;
            ctx.strokeRect(margin.left, yPlus1, traceWidth, yMinus1 - yPlus1);
          }

          // Top-right indicator
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'right';
          ctx.fillStyle = '#fbbf24';
          ctx.fillText('Carrier 1 [0°]', margin.left + traceWidth - 170, traceTop + 13);
          ctx.fillStyle = '#38bdf8';
          ctx.fillText('Carrier 2 [180°]', margin.left + traceWidth - 90, traceTop + 13);
          ctx.fillStyle = '#c084fc';
          ctx.fillText('PSPWM', margin.left + traceWidth - 6, traceTop + 13);
        } else {
          // ----------------------------------------
          // 3-Level Level-Shifted PWM (IPD, POD, APOD)
          // Upper Carrier strictly [0, 1], Lower Carrier strictly [-1, 0]
          // ----------------------------------------
          // Shaded non-overlapping carrier bands
          ctx.fillStyle = 'rgba(251, 191, 36, 0.05)'; // Upper band amber
          ctx.fillRect(margin.left, yPlus1, traceWidth, yZero - yPlus1);

          ctx.fillStyle = 'rgba(56, 189, 248, 0.05)'; // Lower band sky
          ctx.fillRect(margin.left, yZero, traceWidth, yMinus1 - yZero);

          // Neutral Point line at 0V
          ctx.save();
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(margin.left, yZero);
          ctx.lineTo(margin.left + traceWidth, yZero);
          ctx.stroke();
          ctx.restore();

          if (visibleCarrierCycles <= maxCarrierCycles) {
            // Draw exact analytical carrier triangles to completely avoid high-fsw distortion
            const kStart = Math.floor(tStart / Tsw);
            const kEnd = Math.ceil(tEnd / Tsw);

            // Upper Carrier [0, +1]
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = isFullscreen ? 1.6 : 1.35;
            ctx.beginPath();
            for (let k = kStart; k <= kEnd; k++) {
              const t0 = k * Tsw;
              const tMid = (k + 0.5) * Tsw;
              const t1 = (k + 1.0) * Tsw;
              const x0 = mapXFromTime(t0);
              const xMid = mapXFromTime(tMid);
              const x1 = mapXFromTime(t1);

              if (carrierDisposition === 'APOD') {
                // Starts at 1, troughs at 0 at mid-period, returns to 1
                if (k === kStart) ctx.moveTo(x0, mapY(1));
                else ctx.lineTo(x0, mapY(1));
                ctx.lineTo(xMid, mapY(0));
                ctx.lineTo(x1, mapY(1));
              } else {
                // IPD / POD: Starts at 0, peaks at 1 at mid-period, returns to 0
                if (k === kStart) ctx.moveTo(x0, mapY(0));
                else ctx.lineTo(x0, mapY(0));
                ctx.lineTo(xMid, mapY(1));
                ctx.lineTo(x1, mapY(0));
              }
            }
            ctx.stroke();

            // Lower Carrier [-1, 0]
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = isFullscreen ? 1.6 : 1.35;
            ctx.beginPath();
            for (let k = kStart; k <= kEnd; k++) {
              const t0 = k * Tsw;
              const tMid = (k + 0.5) * Tsw;
              const t1 = (k + 1.0) * Tsw;
              const x0 = mapXFromTime(t0);
              const xMid = mapXFromTime(tMid);
              const x1 = mapXFromTime(t1);

              if (carrierDisposition === 'POD') {
                // Inverted across 0V: Starts at 0, bottoms at -1 at mid-period, returns to 0
                if (k === kStart) ctx.moveTo(x0, mapY(0));
                else ctx.lineTo(x0, mapY(0));
                ctx.lineTo(xMid, mapY(-1));
                ctx.lineTo(x1, mapY(0));
              } else if (carrierDisposition === 'APOD') {
                // Starts at -1, peaks at 0 at mid-period, returns to -1
                if (k === kStart) ctx.moveTo(x0, mapY(-1));
                else ctx.lineTo(x0, mapY(-1));
                ctx.lineTo(xMid, mapY(0));
                ctx.lineTo(x1, mapY(-1));
              } else {
                // IPD: In-phase, starts at -1, peaks at 0 at mid-period, returns to -1
                if (k === kStart) ctx.moveTo(x0, mapY(-1));
                else ctx.lineTo(x0, mapY(-1));
                ctx.lineTo(xMid, mapY(0));
                ctx.lineTo(x1, mapY(-1));
              }
            }
            ctx.stroke();
          } else {
            // High frequency carrier envelopes
            ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
            ctx.strokeRect(margin.left, yPlus1, traceWidth, yZero - yPlus1);
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
            ctx.strokeRect(margin.left, yZero, traceWidth, yMinus1 - yZero);
          }

          // Top-right indicator
          const activeDisp = carrierDisposition === 'PD' ? 'IPD' : carrierDisposition;
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'right';
          ctx.fillStyle = '#fbbf24';
          ctx.fillText('Upper [0,+1]', margin.left + traceWidth - 170, traceTop + 13);
          ctx.fillStyle = '#38bdf8';
          ctx.fillText('Lower [-1,0]', margin.left + traceWidth - 90, traceTop + 13);
          ctx.fillStyle = '#c084fc';
          ctx.fillText(`LSPWM: ${activeDisp}`, margin.left + traceWidth - 6, traceTop + 13);
        }

        // Reference Sine Waves
        // Phase B & C subtle context
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.2)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        for (let i = startIndex; i <= endIndex; i++) {
          const x = mapXFromIndex(i);
          const y = mapY(points[i].vrefB);
          if (i === startIndex) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Phase A Fundamental Reference Sine (Rose-500)
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let i = startIndex; i <= endIndex; i++) {
          const x = mapXFromIndex(i);
          const y = mapY(points[i].vrefA);
          if (i === startIndex) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // ==========================================
      // TRACE 2: POLE VOLTAGE V_AN (Stepped PWM)
      // ==========================================
      else if (ch.id === 'ch2') {
        ctx.strokeStyle = ch.color;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let i = startIndex; i <= endIndex; i++) {
          const x = mapXFromIndex(i);
          const y = mapY(points[i].van);
          if (i === startIndex) {
            ctx.moveTo(x, y);
          } else {
            const prevY = mapY(points[i - 1].van);
            if (points[i].van !== points[i - 1].van) {
              ctx.lineTo(x, prevY);
            }
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      // ==========================================
      // TRACE 3: LINE-TO-LINE VOLTAGE V_AB
      // ==========================================
      else if (ch.id === 'ch3') {
        ctx.strokeStyle = ch.color;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let i = startIndex; i <= endIndex; i++) {
          const x = mapXFromIndex(i);
          const y = mapY(points[i].vab);
          if (i === startIndex) {
            ctx.moveTo(x, y);
          } else {
            const prevY = mapY(points[i - 1].vab);
            if (points[i].vab !== points[i - 1].vab) {
              ctx.lineTo(x, prevY);
            }
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      // ==========================================
      // TRACE 4: LOAD CURRENT i_a (FULLY VISIBLE)
      // ==========================================
      else if (ch.id === 'ch4') {
        ctx.strokeStyle = ch.color;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        for (let i = startIndex; i <= endIndex; i++) {
          const x = mapXFromIndex(i);
          const y = mapY(points[i].ia);
          if (i === startIndex) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Zero-current horizontal guide line
        ctx.save();
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(margin.left, traceMid);
        ctx.lineTo(margin.left + traceWidth, traceMid);
        ctx.stroke();
        ctx.restore();
      }

      // ==========================================
      // TRACE 5: COMMON-MODE VOLTAGE V_CM
      // ==========================================
      else if (ch.id === 'ch5') {
        ctx.strokeStyle = ch.color;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let i = startIndex; i <= endIndex; i++) {
          const x = mapXFromIndex(i);
          const y = mapY(points[i].vcm);
          if (i === startIndex) {
            ctx.moveTo(x, y);
          } else {
            const prevY = mapY(points[i - 1].vcm);
            if (points[i].vcm !== points[i - 1].vcm) {
              ctx.lineTo(x, prevY);
            }
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      ctx.restore(); // Restore clipping
    });

    // Draw Vertical Time Scrubber Cursor
    if (scrubberIndex >= startIndex && scrubberIndex <= endIndex) {
      const cursorX = margin.left + ((scrubberIndex - startIndex) / (visiblePointsCount - 1)) * traceWidth;

      // Cursor Line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cursorX, margin.top);
      ctx.lineTo(cursorX, height - margin.bottom);
      ctx.stroke();

      // Top Marker Arrow
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(cursorX - 4, margin.top - 6);
      ctx.lineTo(cursorX + 4, margin.top - 6);
      ctx.lineTo(cursorX, margin.top);
      ctx.closePath();
      ctx.fill();

      // Bottom Marker Arrow
      ctx.beginPath();
      ctx.moveTo(cursorX - 4, height - margin.bottom + 6);
      ctx.lineTo(cursorX + 4, height - margin.bottom + 6);
      ctx.lineTo(cursorX, height - margin.bottom);
      ctx.closePath();
      ctx.fill();
    }

    // Time Axis Marks at Bottom
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    const numTimeMarks = 8;
    for (let m = 0; m <= numTimeMarks; m++) {
      const markX = margin.left + (traceWidth / numTimeMarks) * m;
      const tVal = (tStart + (m / numTimeMarks) * tDuration) * 1000; // in milliseconds
      ctx.fillText(`${tVal.toFixed(1)}ms`, markX, height - 7);
    }

    ctx.restore();
  }, [
    points,
    topology,
    scrubberIndex,
    channels,
    channelRanges,
    zoomMode,
    startIndex,
    endIndex,
    visiblePointsCount,
    vdc,
    f0,
    fsw,
    carrierDisposition,
  ]);

  useEffect(() => {
    drawWaveforms();
  }, [drawWaveforms]);

  useEffect(() => {
    const handleResize = () => drawWaveforms();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawWaveforms]);

  // Scrubbing on Canvas Click or Drag
  const handleScrubAtClientX = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const margin = { left: 62, right: 20 };
    const traceWidth = rect.width - margin.left - margin.right;
    const relX = Math.max(0, Math.min(traceWidth, clientX - rect.left - margin.left));
    const ratio = relX / traceWidth;
    const targetIndex = Math.round(startIndex + ratio * (visiblePointsCount - 1));
    const clampedIndex = Math.max(0, Math.min(totalPoints - 1, targetIndex));
    onScrub(clampedIndex);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    handleScrubAtClientX(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      handleScrubAtClientX(e.clientX);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const currentPt = points[scrubberIndex] || points[0];

  return (
    <div id="panel-b-oscilloscope" className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      {/* Scope Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-sky-950 border border-sky-500/40 text-sky-400">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold tracking-wider uppercase text-slate-200">
              Oscilloscope
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              f0 = {f0} Hz | fsw = {(fsw / 1000).toFixed(1)} kHz | {carrierDisposition}
            </span>
          </div>
        </div>

        {/* Oscilloscope Toolbar: Controls, Zoom, Play/Pause */}
        <div className="flex items-center gap-2">
          {/* Zoom Modes */}
          <div className="flex rounded-md bg-slate-900 p-0.5 border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setZoomMode('2cycles')}
              className={`px-2 py-0.5 rounded transition-all ${
                zoomMode === '2cycles'
                  ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              2T₀
            </button>
            <button
              onClick={() => setZoomMode('1cycle')}
              className={`px-2 py-0.5 rounded transition-all ${
                zoomMode === '1cycle'
                  ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              1T₀
            </button>
            <button
              onClick={() => setZoomMode('carrierZoom')}
              className={`px-2 py-0.5 rounded flex items-center gap-1 transition-all ${
                zoomMode === 'carrierZoom'
                  ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ZoomIn className="w-3 h-3" /> Zoom
            </button>
          </div>

          {/* Play/Pause Button */}
          <button
            onClick={onTogglePlay}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-all ${
              isPlaying
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
            }`}
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>

          <button
            onClick={() => onScrub(0)}
            title="Reset to t=0"
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition"
          >
            <RotateCcw className="w-3 h-3" />
          </button>

          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition flex items-center justify-center"
              title={isFullscreen ? "Exit Full Screen" : "Full Screen"}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div
        ref={containerRef}
        className={`relative flex-1 w-full bg-slate-950 cursor-crosshair overflow-hidden ${
          isFullscreen ? 'min-h-[580px] h-[calc(100vh-210px)]' : 'min-h-[480px] h-[520px]'
        }`}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="absolute inset-0 w-full h-full"
        />

        {/* Compact Cursor Readout HUD */}
        <div className="absolute top-2 right-3 pointer-events-none bg-slate-900/90 border border-slate-700/70 rounded-md px-2 py-1 shadow-lg text-[10px] font-mono text-slate-300 flex items-center gap-3">
          <span className="text-white font-bold">t = {(currentPt.t * 1000).toFixed(2)} ms</span>
          <span>θ = {currentPt.phaseDeg.toFixed(0)}°</span>
          <span className="text-emerald-400 font-bold">ia = {currentPt.ia.toFixed(1)} A</span>
        </div>
      </div>

      {/* Synchronized Time Scrubber Slider Bar */}
      <div className="px-3 py-1.5 bg-slate-950 border-t border-slate-800 flex items-center gap-3">
        <span className="text-[11px] font-mono text-slate-400 shrink-0">Scrubber:</span>
        <input
          type="range"
          min={0}
          max={totalPoints - 1}
          value={scrubberIndex}
          onChange={(e) => onScrub(parseInt(e.target.value, 10))}
          className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-ew-resize accent-sky-400"
        />
        <span className="text-[11px] font-mono text-slate-300 shrink-0 w-16 text-right">
          {(currentPt.t * 1000).toFixed(2)} ms
        </span>
      </div>

      {/* Scope Channel Visibility Toggles */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-slate-900 border-t border-slate-800 text-xs font-mono">
        <span className="text-slate-500 uppercase tracking-wider text-[9px]">Traces:</span>
        {channels.map((ch) => (
          <button
            key={ch.id}
            onClick={() => toggleChannel(ch.id)}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] transition-all ${
              ch.enabled
                ? 'bg-slate-800 border-slate-700 text-white font-medium'
                : 'bg-slate-950/60 border-slate-800 text-slate-500 line-through'
            }`}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ch.enabled ? ch.color : '#475569' }} />
            {ch.enabled ? <Eye className="w-2.5 h-2.5 text-slate-400" /> : <EyeOff className="w-2.5 h-2.5 text-slate-600" />}
            <span>{ch.name.split(':')[0]}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

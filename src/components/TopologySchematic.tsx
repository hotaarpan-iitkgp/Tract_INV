import React, { useState } from 'react';
import { ConductionPathInfo, SwitchState, TopologyType } from '../types';
import {
  Activity,
  ShieldCheck,
  Zap,
  Info,
  Layers,
  ArrowRight,
  Cpu,
  Compass,
  Maximize2,
  Minimize2,
  HelpCircle,
} from 'lucide-react';

interface TopologySchematicProps {
  topology: TopologyType;
  conductionInfo: ConductionPathInfo;
  vdc: number;
  ia: number;
  van: number;
  vPhaseA?: number;
  stateA: SwitchState;
  stateB: SwitchState;
  stateC: SwitchState;
  bridge2StateA?: 'P' | 'N';
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

interface DeviceTooltip {
  id: string;
  name: string;
  type: string;
  rating: string;
  status: 'Conducting' | 'Blocking';
  channelState: string;
  vds: string;
  gateVoltage: string;
  lossEstimate: string;
}

export const TopologySchematic: React.FC<TopologySchematicProps> = ({
  topology,
  conductionInfo,
  vdc,
  ia,
  van,
  vPhaseA,
  stateA,
  stateB,
  stateC,
  bridge2StateA,
  isFullscreen = false,
  onToggleFullscreen,
}) => {
  const [selectedDevice, setSelectedDevice] = useState<DeviceTooltip | null>(null);
  const [viewMode, setViewMode] = useState<'detailed' | 'threePhase'>('detailed');
  const [showLegend, setShowLegend] = useState<boolean>(false);
  const [showConduction, setShowConduction] = useState<boolean>(false);

  // 3-Phase complete topology helper functions
  const renderSwitch = (
    x: number,
    y: number,
    label: string,
    active: boolean,
    labelPos: 'left' | 'right' | 'top' | 'bottom' = 'right',
    options?: {
      orientation?: 'vertical' | 'horizontal';
      flipHorizontal?: boolean;
      customRating?: string;
    }
  ) => {
    return renderMosfet(
      label,
      label,
      x,
      y,
      {
        orientation: options?.orientation || 'vertical',
        flipHorizontal: options?.flipHorizontal || false,
        customRating: options?.customRating || `${(vdc / 2).toFixed(0)}V`,
        labelPos: labelPos,
        forceActiveChannel: active,
        forceActiveDiode: false,
        gateOn: active,
      }
    );
  };

  const renderThreePhaseSVG = () => {
    // Balanced 3-phase currents for animation
    const theta = ((vPhaseA ?? 0) * Math.PI) / 180;
    const isConductingA = Math.abs(ia) > 0.05;
    
    // Balanced current approximations for phases B and C
    const curA = ia;
    const curB = isConductingA ? Math.abs(ia) * 1.15 * Math.sin(theta - (2 * Math.PI) / 3) : 0;
    const curC = isConductingA ? Math.abs(ia) * 1.15 * Math.sin(theta + (2 * Math.PI) / 3) : 0;

    const dirA = curA >= 0.05 ? 'forward' : curA <= -0.05 ? 'reverse' : 'none';
    const dirB = curB >= 0.05 ? 'forward' : curB <= -0.05 ? 'reverse' : 'none';
    const dirC = curC >= 0.05 ? 'forward' : curC <= -0.05 ? 'reverse' : 'none';

    return (
      <g id="circuit-three-phase-complete" className="animate-in fade-in duration-200">
        {/* DC Voltage Source (Left Rail) */}
        <g id="tp-dc-source" className="stroke-slate-700">
          {/* DC Battery Symbol */}
          <line x1="80" y1="180" x2="80" y2="300" stroke="#475569" strokeWidth="2" />
          {/* Parallel plates representing DC Source */}
          <line x1="60" y1="210" x2="100" y2="210" stroke="#38bdf8" strokeWidth="4" />
          <line x1="70" y1="230" x2="90" y2="230" stroke="#f43f5e" strokeWidth="2" />
          <line x1="60" y1="250" x2="100" y2="250" stroke="#38bdf8" strokeWidth="4" />
          <line x1="70" y1="270" x2="90" y2="270" stroke="#f43f5e" strokeWidth="2" />
          
          <text x="80" y="170" textAnchor="middle" fill="#38bdf8" className="text-[10px] font-mono font-bold">
            V_DC ({vdc}V)
          </text>
          
          {/* Connect DC source to main DC Bus lines */}
          <path d="M 80 180 L 80 60 L 140 60" fill="none" stroke="#334155" strokeWidth="2" />
          <path d="M 80 300 L 80 420 L 140 420" fill="none" stroke="#334155" strokeWidth="2" />
        </g>

        {/* DC Link Capacitors */}
        {topology.includes('3L') ? (
          <g id="tp-dc-caps">
            {/* Split capacitor configuration */}
            <line x1="140" y1="60" x2="140" y2="135" stroke="#334155" strokeWidth="2" />
            {/* Cap 1 plates */}
            <line x1="125" y1="135" x2="155" y2="135" stroke="#38bdf8" strokeWidth="3" />
            <line x1="125" y1="142" x2="155" y2="142" stroke="#475569" strokeWidth="3" />
            {/* Mid connection wire */}
            <line x1="140" y1="142" x2="140" y2="338" stroke="#475569" strokeWidth="2" />
            <circle cx="140" cy="240" r="3.5" fill="#eab308" />

            {/* Cap 2 plates */}
            <line x1="125" y1="338" x2="155" y2="338" stroke="#475569" strokeWidth="3" />
            <line x1="125" y1="345" x2="155" y2="345" stroke="#f43f5e" strokeWidth="3" />
            {/* Bottom wire */}
            <line x1="140" y1="345" x2="140" y2="420" stroke="#334155" strokeWidth="2" />

            {/* Horizontal Neutral Point Line */}
            <line x1="140" y1="240" x2="680" y2="240" stroke="#475569" strokeWidth="1.5" strokeDasharray="3,3" />
            
            <text x="110" y="110" textAnchor="middle" fill="#64748b" className="text-[8px] font-mono">C1</text>
            <text x="110" y="370" textAnchor="middle" fill="#64748b" className="text-[8px] font-mono">C2</text>
            <text x="110" y="244" textAnchor="middle" fill="#eab308" className="text-[8px] font-mono font-bold">NP (0V)</text>
          </g>
        ) : (
          <g id="tp-dc-cap-single">
            {/* Single capacitor bank for 2L-VSI */}
            <line x1="140" y1="60" x2="140" y2="230" stroke="#334155" strokeWidth="2" />
            <line x1="125" y1="230" x2="155" y2="230" stroke="#38bdf8" strokeWidth="3" />
            <line x1="125" y1="240" x2="155" y2="240" stroke="#f43f5e" strokeWidth="3" />
            <line x1="140" y1="240" x2="140" y2="420" stroke="#334155" strokeWidth="2" />
            <text x="110" y="238" textAnchor="middle" fill="#64748b" className="text-[8px] font-mono">C_link</text>
          </g>
        )}

        {/* DC Bus rails (Positive and Negative horizontal) */}
        <line x1="140" y1="60" x2="680" y2="60" stroke="#38bdf8" strokeWidth="2.5" />
        <line x1="140" y1="420" x2="680" y2="420" stroke="#f43f5e" strokeWidth="2.5" />

        {/* ==================== RENDERING LEGS FOR 2L-VSI ==================== */}
        {topology === '2L-VSI' && (
          <g id="tp-legs-2l-vsi">
            {/* Leg A (X = 280) - Node at y=215 where Phase A motor terminal first touches and intersects */}
            <line x1="280" y1="60" x2="280" y2="420" stroke="#334155" strokeWidth="1.5" />
            {renderSwitch(280, 140, 'S_A1', stateA === 'P', 'right')}
            {renderSwitch(280, 340, 'S_A2', stateA === 'N', 'right')}
            <circle cx="280" cy="215" r="4" fill="#38bdf8" />

            {/* Leg B (X = 460) - Node at y=240 where Phase B motor terminal first touches and intersects */}
            <line x1="460" y1="60" x2="460" y2="420" stroke="#334155" strokeWidth="1.5" />
            {renderSwitch(460, 140, 'S_B1', stateB === 'P', 'right')}
            {renderSwitch(460, 340, 'S_B2', stateB === 'N', 'right')}
            <circle cx="460" cy="240" r="4" fill="#38bdf8" />

            {/* Leg C (X = 640) - Node at y=265 where Phase C motor terminal first touches and intersects */}
            <line x1="640" y1="60" x2="640" y2="420" stroke="#334155" strokeWidth="1.5" />
            {renderSwitch(640, 140, 'S_C1', stateC === 'P', 'right')}
            {renderSwitch(640, 340, 'S_C2', stateC === 'N', 'right')}
            <circle cx="640" cy="265" r="4" fill="#38bdf8" />
          </g>
        )}

        {/* ==================== RENDERING LEGS FOR 3L-NPC ==================== */}
        {topology === '3L-NPC' && (
          <g id="tp-legs-3l-npc">
            {[
              { x: 280, state: stateA, ph: 'A', dir: dirA, nodeY: 215 },
              { x: 460, state: stateB, ph: 'B', dir: dirB, nodeY: 240 },
              { x: 640, state: stateC, ph: 'C', dir: dirC, nodeY: 265 },
            ].map(({ x, state, ph, dir, nodeY }) => {
              const xClamp = x - 48;
              const isUpperActive = state === 'O' && (dir === 'forward' || dir === 'none');
              const isLowerActive = state === 'O' && (dir === 'reverse' || dir === 'none');

              return (
                <g key={ph}>
                  {/* Vertical main leg rail */}
                  <line x1={x} y1="60" x2={x} y2="420" stroke="#334155" strokeWidth="1.5" />
                  {renderSwitch(x, 110, `S_${ph}1`, state === 'P', 'right')}
                  {renderSwitch(x, 170, `S_${ph}2`, state === 'P' || state === 'O', 'right')}
                  {renderSwitch(x, 310, `S_${ph}3`, state === 'N' || state === 'O', 'right')}
                  {renderSwitch(x, 370, `S_${ph}4`, state === 'N', 'right')}

                  {/* Neutral Point tap dot on horizontal NP bus */}
                  <circle cx={xClamp} cy="240" r="3.5" fill="#f59e0b" />

                  {/* Upper Clamp Path: from NP (xClamp, 240) up to node between S_ph1 and S_ph2 (x, 140) */}
                  <path
                    d={`M ${xClamp} 240 L ${xClamp} 140 L ${x} 140`}
                    fill="none"
                    stroke={isUpperActive ? '#f59e0b' : '#475569'}
                    strokeWidth={isUpperActive ? '2.5' : '1.5'}
                    className={isUpperActive ? 'active-current-path' : ''}
                  />
                  {/* Upper Clamping Diode (points UP, Anode at bottom from NP, Cathode at top to leg node) */}
                  {renderClampDiode(`D_${ph}1`, `D_${ph}1`, xClamp, 185, 'up', {
                    active: isUpperActive,
                    labelSide: 'left',
                  })}
                  {/* Tap junction dot on leg */}
                  <circle cx={x} cy="140" r="3.5" fill="#38bdf8" />

                  {/* Lower Clamp Path: from node between S_ph3 and S_ph4 (x, 340) left and up to NP (xClamp, 240) */}
                  <path
                    d={`M ${x} 340 L ${xClamp} 340 L ${xClamp} 240`}
                    fill="none"
                    stroke={isLowerActive ? '#f59e0b' : '#475569'}
                    strokeWidth={isLowerActive ? '2.5' : '1.5'}
                    className={isLowerActive ? 'active-current-path' : ''}
                  />
                  {/* Lower Clamping Diode (points UP, Anode at bottom from leg node, Cathode at top to NP) */}
                  {renderClampDiode(`D_${ph}2`, `D_${ph}2`, xClamp, 295, 'up', {
                    active: isLowerActive,
                    labelSide: 'left',
                  })}
                  {/* Tap junction dot on leg */}
                  <circle cx={x} cy="340" r="3.5" fill="#f43f5e" />

                  {/* Phase output terminal node intersecting motor line */}
                  <circle cx={x} cy={nodeY} r="4" fill="#38bdf8" />
                </g>
              );
            })}
          </g>
        )}

        {/* ==================== RENDERING LEGS FOR 3L-ANPC ==================== */}
        {topology === '3L-ANPC' && (
          <g id="tp-legs-3l-anpc">
            {[
              { x: 280, state: stateA, ph: 'A', nodeY: 215 },
              { x: 460, state: stateB, ph: 'B', nodeY: 240 },
              { x: 640, state: stateC, ph: 'C', nodeY: 265 },
            ].map(({ x, state, ph, nodeY }) => (
              <g key={ph}>
                <line x1={x} y1="60" x2={x} y2="420" stroke="#334155" strokeWidth="1.5" />
                {renderSwitch(x, 110, `S_${ph}1`, state === 'P', 'right')}
                {renderSwitch(x, 170, `S_${ph}2`, state === 'P' || state === 'O', 'right')}
                {renderSwitch(x, 310, `S_${ph}3`, state === 'N' || state === 'O', 'right')}
                {renderSwitch(x, 370, `S_${ph}4`, state === 'N', 'right')}

                {/* Active Clamping Switches */}
                <line x1={x - 48} y1="240" x2={x - 48} y2="140" stroke="#334155" strokeWidth="1.2" />
                <line x1={x - 48} y1="140" x2={x} y2="140" stroke="#334155" strokeWidth="1.2" />
                <line x1={x - 48} y1="240" x2={x - 48} y2="340" stroke="#334155" strokeWidth="1.2" />
                <line x1={x - 48} y1="340" x2={x} y2="340" stroke="#334155" strokeWidth="1.2" />

                {renderSwitch(x - 48, 190, `S_${ph}5`, state === 'O', 'left')}
                {renderSwitch(x - 48, 290, `S_${ph}6`, state === 'O', 'left')}

                <circle cx={x - 48} cy="240" r="3.5" fill="#f59e0b" />
                <circle cx={x} cy={nodeY} r="4" fill="#38bdf8" />
              </g>
            ))}
          </g>
        )}

        {/* ==================== RENDERING LEGS FOR 3L-TNPC ==================== */}
        {topology === '3L-TNPC' && (
          <g id="tp-legs-3l-tnpc">
            {/* Phase A: Anti-Series Switches in Middle at y = 240 */}
            <g id="tp-tnpc-leg-a">
              <line x1="280" y1="60" x2="280" y2="420" stroke="#334155" strokeWidth="1.5" />
              {renderSwitch(280, 130, 'S_A1', stateA === 'P', 'right')}
              {renderSwitch(280, 350, 'S_A4', stateA === 'N', 'right')}

              {/* Neutral Point tap dot on horizontal NP bus */}
              <circle cx="175" cy="240" r="3.5" fill="#f59e0b" />
              {/* Horizontal line from tap at x=175 into Leg A at (280, 240) */}
              <line x1="175" y1="240" x2="280" y2="240" stroke={stateA === 'O' ? '#10b981' : '#475569'} strokeWidth="1.5" />
              {renderSwitch(205, 240, 'S_A2', stateA === 'O', 'top', { orientation: 'horizontal' })}
              {renderSwitch(245, 240, 'S_A3', stateA === 'O', 'bottom', { orientation: 'horizontal', flipHorizontal: true })}

              <circle cx="280" cy="240" r="3.5" fill="#f59e0b" />
              {/* Motor output node at y=215 */}
              <circle cx="280" cy="215" r="4" fill="#38bdf8" />
            </g>

            {/* Phase B: Anti-Series Switches Staggered UP at y = 195 to prevent overlap */}
            <g id="tp-tnpc-leg-b">
              <line x1="460" y1="60" x2="460" y2="420" stroke="#334155" strokeWidth="1.5" />
              {renderSwitch(460, 130, 'S_B1', stateB === 'P', 'right')}
              {renderSwitch(460, 350, 'S_B4', stateB === 'N', 'right')}

              {/* Neutral Point tap dot on horizontal NP bus */}
              <circle cx="355" cy="240" r="3.5" fill="#f59e0b" />
              {/* Vertical connector up from NP bus to y=195 */}
              <line x1="355" y1="240" x2="355" y2="195" stroke={stateB === 'O' ? '#10b981' : '#475569'} strokeWidth="1.5" />
              {/* Horizontal line at y=195 into Leg B at (460, 195) */}
              <line x1="355" y1="195" x2="460" y2="195" stroke={stateB === 'O' ? '#10b981' : '#475569'} strokeWidth="1.5" />
              {renderSwitch(385, 195, 'S_B2', stateB === 'O', 'top', { orientation: 'horizontal' })}
              {renderSwitch(425, 195, 'S_B3', stateB === 'O', 'bottom', { orientation: 'horizontal', flipHorizontal: true })}

              <circle cx="460" cy="195" r="3.5" fill="#f59e0b" />
              {/* Motor output node at y=240 */}
              <circle cx="460" cy="240" r="4" fill="#38bdf8" />
            </g>

            {/* Phase C: Anti-Series Switches Staggered DOWN at y = 285 to prevent overlap */}
            <g id="tp-tnpc-leg-c">
              <line x1="640" y1="60" x2="640" y2="420" stroke="#334155" strokeWidth="1.5" />
              {renderSwitch(640, 130, 'S_C1', stateC === 'P', 'right')}
              {renderSwitch(640, 350, 'S_C4', stateC === 'N', 'right')}

              {/* Neutral Point tap dot on horizontal NP bus */}
              <circle cx="535" cy="240" r="3.5" fill="#f59e0b" />
              {/* Vertical connector down from NP bus to y=285 */}
              <line x1="535" y1="240" x2="535" y2="285" stroke={stateC === 'O' ? '#10b981' : '#475569'} strokeWidth="1.5" />
              {/* Horizontal line at y=285 into Leg C at (640, 285) */}
              <line x1="535" y1="285" x2="640" y2="285" stroke={stateC === 'O' ? '#10b981' : '#475569'} strokeWidth="1.5" />
              {renderSwitch(565, 285, 'S_C2', stateC === 'O', 'top', { orientation: 'horizontal' })}
              {renderSwitch(605, 285, 'S_C3', stateC === 'O', 'bottom', { orientation: 'horizontal', flipHorizontal: true })}

              <circle cx="640" cy="285" r="3.5" fill="#f59e0b" />
              {/* Motor output node at y=265 */}
              <circle cx="640" cy="265" r="4" fill="#38bdf8" />
            </g>
          </g>
        )}

        {/* ==================== RENDERING LEGS FOR OEW-VSI ==================== */}
        {topology === 'OEW-VSI' && (
          <g id="tp-legs-oew-vsi">
            {/* Left Bridge (Primary) */}
            <g id="tp-primary-bridge">
              <text x="290" y="44" textAnchor="middle" fill="#38bdf8" className="text-[10px] font-mono font-bold">PRIMARY BRIDGE</text>
              {[
                { x: 220, state: stateA, ph: 'A', nodeY: 215 },
                { x: 290, state: stateB, ph: 'B', nodeY: 240 },
                { x: 360, state: stateC, ph: 'C', nodeY: 265 },
              ].map(({ x, state, ph, nodeY }) => (
                <g key={ph}>
                  <line x1={x} y1="60" x2={x} y2="420" stroke="#334155" strokeWidth="1.5" />
                  {renderSwitch(x, 140, `S_${ph}1`, state === 'P', 'right')}
                  {renderSwitch(x, 340, `S_${ph}2`, state === 'N', 'right')}
                  <circle cx={x} cy={nodeY} r="4" fill="#38bdf8" />
                </g>
              ))}
            </g>

            {/* Right Bridge (Secondary) */}
            <g id="tp-secondary-bridge">
              <text x="610" y="44" textAnchor="middle" fill="#c084fc" className="text-[10px] font-mono font-bold">SECONDARY BRIDGE</text>
              {[
                { x: 540, state: bridge2StateA || 'P', ph: 'A', nodeY: 215 },
                { x: 610, state: stateB === 'P' ? 'N' : 'P', ph: 'B', nodeY: 240 },
                { x: 680, state: stateC === 'P' ? 'N' : 'P', ph: 'C', nodeY: 265 },
              ].map(({ x, state, ph, nodeY }) => (
                <g key={ph}>
                  <line x1={x} y1="60" x2={x} y2="420" stroke="#334155" strokeWidth="1.5" />
                  {renderSwitch(x, 140, `S2_${ph}1`, state === 'P', 'right')}
                  {renderSwitch(x, 340, `S2_${ph}2`, state === 'N', 'right')}
                  <circle cx={x} cy={nodeY} r="4" fill="#38bdf8" />
                </g>
              ))}
            </g>
          </g>
        )}

        {/* 3-Phase Star Load (PMAC Motor / Winding) */}
        {topology !== 'OEW-VSI' ? (
          <g id="tp-motor-load">
            {/* Dynamic Animated Line Connections from Midpoint Nodes */}
            {/* Phase C Cable: starts directly at Leg C node (x=640, y=265) and connects to Motor Terminal C (x=748, y=265) */}
            <path
              d="M 640 265 L 748 265"
              fill="none"
              stroke={dirC === 'none' ? '#334155' : '#10b981'}
              strokeWidth="2.5"
              className={dirC === 'forward' ? 'flow-forward' : dirC === 'reverse' ? 'flow-reverse' : undefined}
            />

            {/* Phase B Cable: starts directly at Leg B node (x=460, y=240) and connects to Motor Terminal B (x=740, y=240) with jumper arc over Leg C */}
            <path
              d="M 460 240 L 634 240 A 6 6 0 0 1 646 240 L 740 240"
              fill="none"
              stroke={dirB === 'none' ? '#334155' : '#10b981'}
              strokeWidth="2.5"
              className={dirB === 'forward' ? 'flow-forward' : dirB === 'reverse' ? 'flow-reverse' : undefined}
            />

            {/* Phase A Cable: starts directly at Leg A node (x=280, y=215) and connects to Motor Terminal A (x=748, y=215) with jumper arcs over Leg B and Leg C */}
            <path
              d="M 280 215 L 454 215 A 6 6 0 0 1 466 215 L 634 215 A 6 6 0 0 1 646 215 L 748 215"
              fill="none"
              stroke={dirA === 'none' ? '#334155' : '#10b981'}
              strokeWidth="2.5"
              className={dirA === 'forward' ? 'flow-forward' : dirA === 'reverse' ? 'flow-reverse' : undefined}
            />

            {/* Circular Machine Body (Stator) */}
            <circle cx="780" cy="240" r="40" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" filter="url(#glow-emerald)" />
            <circle cx="780" cy="240" r="24" fill="#0f172a" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="3,3" />
            <text x="780" y="244" textAnchor="middle" fill="#fbbf24" className="text-[10px] font-bold font-sans">
              M_3~
            </text>

            {/* Terminal connections dots on motor stator */}
            <circle cx="748" cy="215" r="3.5" fill="#10b981" />
            <circle cx="740" cy="240" r="3.5" fill="#10b981" />
            <circle cx="748" cy="265" r="3.5" fill="#10b981" />

            {/* Phase labels beside terminals */}
            <text x="734" y="213" textAnchor="end" fill="#10b981" className="text-[8px] font-mono font-bold">U (A)</text>
            <text x="726" y="238" textAnchor="end" fill="#10b981" className="text-[8px] font-mono font-bold">V (B)</text>
            <text x="734" y="269" textAnchor="end" fill="#10b981" className="text-[8px] font-mono font-bold">W (C)</text>
          </g>
        ) : (
          <g id="tp-oew-load">
            {/* Open End Load sit in middle of primary and secondary bridges */}
            {/* Phase A Load Coil */}
            <line x1="220" y1="240" x2="540" y2="240" stroke="#334155" strokeWidth="2" />
            <path
              d="M 220 240 L 320 240 M 320 240 C 330 230, 340 230, 350 240 C 360 250, 370 250, 380 240 C 390 230, 400 230, 410 240 M 410 240 L 540 240"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="2.5"
            />
            {/* Phase B Load Coil */}
            <line x1="290" y1="260" x2="610" y2="260" stroke="#334155" strokeWidth="2" />
            <path
              d="M 290 260 L 390 260 C 400 250, 410 250, 420 260 C 430 270, 440 270, 450 260 C 460 250, 470 250, 480 260 L 610 260"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="2.5"
            />
            {/* Phase C Load Coil */}
            <line x1="360" y1="220" x2="680" y2="220" stroke="#334155" strokeWidth="2" />
            <path
              d="M 360 220 L 460 220 C 470 210, 480 210, 490 220 C 500 230, 510 230, 520 220 C 530 210, 540 210, 550 220 L 680 220"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="2.5"
            />
            <rect x="340" y="185" fill="#0f172a" fillOpacity="0.8" stroke="#fbbf24" strokeWidth="1" width="220" height="24" rx="4" />
            <text x="450" y="201" textAnchor="middle" fill="#fbbf24" className="text-[10px] font-mono font-bold">
              OPEN-END 3-PHASE MOTOR WINDINGS
            </text>
          </g>
        )}
      </g>
    );
  };

  const activeDevs = new Set(conductionInfo.activeDevices);
  const isDevActive = (id: string) => activeDevs.has(id);

  // Current direction relative to phase terminal
  const currentDir = ia >= 0.05 ? 'outward' : ia <= -0.05 ? 'inward' : 'zero';
  const isMotoring = (van * ia) >= 0;

  // Render an authentic IEEE standard N-channel Power MOSFET with body diode
  const renderMosfet = (
    id: string,
    label: string,
    x: number,
    y: number,
    options?: {
      orientation?: 'vertical' | 'horizontal';
      flipHorizontal?: boolean;
      customRating?: string;
      customTech?: string;
      gateOn?: boolean;
      bodyDiodeId?: string;
      labelPos?: 'left' | 'right' | 'top' | 'bottom';
      mini?: boolean;
      forceActiveChannel?: boolean;
      forceActiveDiode?: boolean;
    }
  ) => {
    const orientation = options?.orientation || 'vertical';
    const bodyDiodeId = options?.bodyDiodeId || `D${id.replace(/[^0-9]/g, '')}`;
    const isChannelConducting = options?.forceActiveChannel !== undefined ? options.forceActiveChannel : isDevActive(id);
    const isDiodeConducting = options?.forceActiveDiode !== undefined ? options.forceActiveDiode : isDevActive(bodyDiodeId);
    const isActive = isChannelConducting || isDiodeConducting;

    // Gate control logic: gate is driven ON (+15V) if channel is instructed ON
    const gateOn = options?.gateOn !== undefined ? options.gateOn : isChannelConducting;

    const rating =
      options?.customRating ||
      (topology === '2L-VSI' || (topology === '3L-TNPC' && (id === 'S1' || id === 'S4'))
        ? '1200V / 200A'
        : '650V / 300A');
    const tech = options?.customTech || 'Wolfspeed Gen-3 SiC MOSFET (Planar/Trench)';
    const status = isActive ? 'Conducting' : 'Blocking';

    const rdsOn = rating.includes('1200V') ? '16 mΩ' : '6 mΩ';
    const vds = isActive
      ? isChannelConducting
        ? `${(Math.abs(ia) * (rating.includes('1200V') ? 0.016 : 0.006)).toFixed(2)} V (On-state)`
        : '1.25 V (Body Diode drop)'
      : rating.includes('1200V')
      ? `${vdc.toFixed(0)} V (Standoff)`
      : `${(vdc / 2).toFixed(0)} V (Standoff)`;

    const lossEst = isActive
      ? `${(Math.pow(Math.abs(ia) * 0.707, 2) * (rating.includes('1200V') ? 0.016 : 0.006)).toFixed(1)} W`
      : '0 W (Leakage < 5μA)';

    const labelPos = options?.labelPos || (orientation === 'vertical' ? 'left' : 'top');

    // Colors
    const channelColor = isActive ? '#10b981' : '#475569';
    const diodeColor = isActive ? '#10b981' : '#64748b';
    const bodyFill = isActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(15, 23, 42, 0.4)';
    const boxBorder = isActive ? '#10b981' : '#334155';

    return (
      <g
        id={`mosfet-${id}`}
        className="cursor-pointer transition-all duration-150 group"
        onClick={() =>
          setSelectedDevice({
            id,
            name: `${label} (${id})`,
            type: tech,
            rating,
            status,
            channelState: isChannelConducting
              ? 'Channel ON (MOSFET conduction)'
              : isDiodeConducting
              ? 'Third Quadrant (Antiparallel Diode Conduction)'
              : 'Channel OFF (Forward Blocking)',
            vds,
            gateVoltage: gateOn ? '+15.0 V (Turn-On)' : '-4.0 V (Active Miller Clamp)',
            lossEstimate: lossEst,
          })
        }
      >
        {/* Active Glow Halo */}
        {isActive && (
          <rect
            x={x - 22}
            y={y - 22}
            width={44}
            height={44}
            rx={8}
            fill="none"
            stroke="#10b981"
            strokeWidth="1.5"
            opacity="0.5"
            className="animate-pulse"
          />
        )}

        {/* Boundary package box */}
        <rect
          x={x - 20}
          y={y - 20}
          width={40}
          height={40}
          rx={6}
          fill={bodyFill}
          stroke={boxBorder}
          strokeWidth={isActive ? '2' : '1.2'}
          className="group-hover:stroke-sky-400 transition"
        />

        {orientation === 'vertical' ? (
          /* VERTICAL MOSFET (Standard Leg Configuration) */
          <g>
            {/* Drain Terminal (Top in) */}
            <line x1={x} y1={y - 20} x2={x} y2={y - 12} stroke={channelColor} strokeWidth="2" />
            <line x1={x} y1={y - 12} x2={x - 6} y2={y - 12} stroke={channelColor} strokeWidth="1.5" />
            <line x1={x - 6} y1={y - 12} x2={x - 6} y2={y - 8} stroke={channelColor} strokeWidth="1.5" />

            {/* Source Terminal (Bottom out) */}
            <line x1={x} y1={y + 12} x2={x} y2={y + 20} stroke={channelColor} strokeWidth="2" />
            <line x1={x} y1={y + 12} x2={x - 6} y2={y + 12} stroke={channelColor} strokeWidth="1.5" />
            <line x1={x - 6} y1={y + 12} x2={x - 6} y2={y + 8} stroke={channelColor} strokeWidth="1.5" />

            {/* Middle channel plate (N-channel substrate tap) */}
            <line x1={x - 6} y1={y} x2={x - 6} y2={y} stroke={channelColor} strokeWidth="1.5" />

            {/* MOSFET Channel 3 segmented bars */}
            <line x1={x - 6} y1={y - 9} x2={x - 6} y2={y - 5} stroke={channelColor} strokeWidth="2" />
            <line x1={x - 6} y1={y - 2} x2={x - 6} y2={y + 2} stroke={channelColor} strokeWidth="2" />
            <line x1={x - 6} y1={y + 5} x2={x - 6} y2={y + 9} stroke={channelColor} strokeWidth="2" />

            {/* Insulated Gate Plate (Dielectric separation) */}
            <line x1={x - 10} y1={y - 10} x2={x - 10} y2={y + 10} stroke={gateOn ? '#10b981' : '#64748b'} strokeWidth="2" />
            {/* Gate lead to the left */}
            <line x1={x - 10} y1={y} x2={x - 18} y2={y} stroke={gateOn ? '#10b981' : '#64748b'} strokeWidth="1.5" />
            <circle cx={x - 18} cy={y} r="1.5" fill={gateOn ? '#10b981' : '#64748b'} />

            {/* N-Channel Inward Arrow on Center Bar */}
            <polygon
              points={`${x - 8},${y} ${x - 12},${y - 2.5} ${x - 12},${y + 2.5}`}
              fill={channelColor}
            />

            {/* Antiparallel Body Diode (Right branch inside package) */}
            <line x1={x} y1={y - 12} x2={x + 7} y2={y - 12} stroke={diodeColor} strokeWidth="1.2" />
            <line x1={x + 7} y1={y - 12} x2={x + 7} y2={y - 4} stroke={diodeColor} strokeWidth="1.2" />
            <line x1={x} y1={y + 12} x2={x + 7} y2={y + 12} stroke={diodeColor} strokeWidth="1.2" />
            <line x1={x + 7} y1={y + 12} x2={x + 7} y2={y + 4} stroke={diodeColor} strokeWidth="1.2" />

            {/* Diode Triangle (Anode at source y+4, Cathode at drain y-4) */}
            <polygon
              points={`${x + 3},${y + 4} ${x + 11},${y + 4} ${x + 7},${y - 3}`}
              fill={isActive ? '#10b981' : 'none'}
              stroke={diodeColor}
              strokeWidth="1.2"
            />
            {/* Cathode Bar */}
            <line x1={x + 3} y1={y - 3} x2={x + 11} y2={y - 3} stroke={diodeColor} strokeWidth="1.2" />
          </g>
        ) : (
          /* HORIZONTAL MOSFET (for TNPC Bidirectional Auxiliary Midpoint Leg) */
          <g>
            {!options?.flipHorizontal ? (
              /* STANDARD HORIZONTAL MOSFET (e.g. S2): Drain on Left (NP side), Source on Right (Midpoint) */
              /* Body Diode points LEFT (Anode at Source/Right, Cathode at Drain/Left) */
              <g>
                {/* Drain Terminal (Left in from NP) */}
                <line x1={x - 20} y1={y} x2={x - 12} y2={y} stroke={channelColor} strokeWidth="2" />
                <line x1={x - 12} y1={y} x2={x - 12} y2={y - 6} stroke={channelColor} strokeWidth="1.5" />

                {/* Source Terminal (Right out to Midpoint) */}
                <line x1={x + 12} y1={y} x2={x + 20} y2={y} stroke={channelColor} strokeWidth="2" />
                <line x1={x + 12} y1={y} x2={x + 12} y2={y - 6} stroke={channelColor} strokeWidth="1.5" />

                {/* Channel segments */}
                <line x1={x - 9} y1={y - 6} x2={x - 5} y2={y - 6} stroke={channelColor} strokeWidth="2" />
                <line x1={x - 2} y1={y - 6} x2={x + 2} y2={y - 6} stroke={channelColor} strokeWidth="2" />
                <line x1={x + 5} y1={y - 6} x2={x + 9} y2={y - 6} stroke={channelColor} strokeWidth="2" />

                {/* Gate Bar (Top) */}
                <line x1={x - 10} y1={y - 10} x2={x + 10} y2={y - 10} stroke={gateOn ? '#10b981' : '#64748b'} strokeWidth="2" />
                <line x1={x} y1={y - 10} x2={x} y2={y - 18} stroke={gateOn ? '#10b981' : '#64748b'} strokeWidth="1.5" />
                <circle cx={x} cy={y - 18} r="1.5" fill={gateOn ? '#10b981' : '#64748b'} />

                {/* Inward Arrow */}
                <polygon
                  points={`${x},${y - 8} ${x - 2.5},${y - 12} ${x + 2.5},${y - 12}`}
                  fill={channelColor}
                />

                {/* Antiparallel Body Diode D2 (Points LEFT towards Drain / NP) */}
                <line x1={x - 12} y1={y} x2={x - 12} y2={y + 7} stroke={diodeColor} strokeWidth="1.2" />
                <line x1={x - 12} y1={y + 7} x2={x - 4} y2={y + 7} stroke={diodeColor} strokeWidth="1.2" />
                <line x1={x + 12} y1={y} x2={x + 12} y2={y + 7} stroke={diodeColor} strokeWidth="1.2" />
                <line x1={x + 12} y1={y + 7} x2={x + 4} y2={y + 7} stroke={diodeColor} strokeWidth="1.2" />

                {/* Diode Triangle (Anode at right x+4, Cathode at left x-3) */}
                <polygon
                  points={`${x + 4},${y + 3} ${x + 4},${y + 11} ${x - 3},${y + 7}`}
                  fill={isActive ? '#10b981' : 'none'}
                  stroke={diodeColor}
                  strokeWidth="1.2"
                />
                <line x1={x - 3} y1={y + 3} x2={x - 3} y2={y + 11} stroke={diodeColor} strokeWidth="1.2" />

                {/* Terminal markers: D on left, S on right */}
                <text x={x - 16} y={y - 2} fill="#94a3b8" className="text-[7px] font-mono font-bold select-none">D</text>
                <text x={x + 11} y={y - 2} fill="#94a3b8" className="text-[7px] font-mono font-bold select-none">S</text>
              </g>
            ) : (
              /* FLIPPED HORIZONTAL MOSFET (e.g. S3): Source on Left (Midpoint), Drain on Right (Phase A side) */
              /* Body Diode points RIGHT (Anode at Source/Left, Cathode at Drain/Right) */
              <g>
                {/* Source Terminal (Left in from Midpoint) */}
                <line x1={x - 20} y1={y} x2={x - 12} y2={y} stroke={channelColor} strokeWidth="2" />
                <line x1={x - 12} y1={y} x2={x - 12} y2={y - 6} stroke={channelColor} strokeWidth="1.5" />

                {/* Drain Terminal (Right out to Phase A node) */}
                <line x1={x + 12} y1={y} x2={x + 20} y2={y} stroke={channelColor} strokeWidth="2" />
                <line x1={x + 12} y1={y} x2={x + 12} y2={y - 6} stroke={channelColor} strokeWidth="1.5" />

                {/* Channel segments */}
                <line x1={x - 9} y1={y - 6} x2={x - 5} y2={y - 6} stroke={channelColor} strokeWidth="2" />
                <line x1={x - 2} y1={y - 6} x2={x + 2} y2={y - 6} stroke={channelColor} strokeWidth="2" />
                <line x1={x + 5} y1={y - 6} x2={x + 9} y2={y - 6} stroke={channelColor} strokeWidth="2" />

                {/* Gate Bar (Top) */}
                <line x1={x - 10} y1={y - 10} x2={x + 10} y2={y - 10} stroke={gateOn ? '#10b981' : '#64748b'} strokeWidth="2" />
                <line x1={x} y1={y - 10} x2={x} y2={y - 18} stroke={gateOn ? '#10b981' : '#64748b'} strokeWidth="1.5" />
                <circle cx={x} cy={y - 18} r="1.5" fill={gateOn ? '#10b981' : '#64748b'} />

                {/* Inward Arrow */}
                <polygon
                  points={`${x},${y - 8} ${x - 2.5},${y - 12} ${x + 2.5},${y - 12}`}
                  fill={channelColor}
                />

                {/* Antiparallel Body Diode D3 (Points RIGHT towards Drain / Phase A) */}
                <line x1={x - 12} y1={y} x2={x - 12} y2={y + 7} stroke={diodeColor} strokeWidth="1.2" />
                <line x1={x - 12} y1={y + 7} x2={x - 4} y2={y + 7} stroke={diodeColor} strokeWidth="1.2" />
                <line x1={x + 12} y1={y} x2={x + 12} y2={y + 7} stroke={diodeColor} strokeWidth="1.2" />
                <line x1={x + 12} y1={y + 7} x2={x + 4} y2={y + 7} stroke={diodeColor} strokeWidth="1.2" />

                {/* Diode Triangle (Anode at left x-4, Cathode at right x+3) */}
                <polygon
                  points={`${x - 4},${y + 3} ${x - 4},${y + 11} ${x + 3},${y + 7}`}
                  fill={isActive ? '#10b981' : 'none'}
                  stroke={diodeColor}
                  strokeWidth="1.2"
                />
                <line x1={x + 3} y1={y + 3} x2={x + 3} y2={y + 11} stroke={diodeColor} strokeWidth="1.2" />

                {/* Terminal markers: S on left, D on right */}
                <text x={x - 16} y={y - 2} fill="#94a3b8" className="text-[7px] font-mono font-bold select-none">S</text>
                <text x={x + 11} y={y - 2} fill="#94a3b8" className="text-[7px] font-mono font-bold select-none">D</text>
              </g>
            )}
          </g>
        )}

        {/* Gate Drive Status Pill */}
        <g transform={`translate(${x + (orientation === 'vertical' ? 14 : 0)}, ${y - (orientation === 'vertical' ? 18 : 24)})`}>
          <rect
            x={-14}
            y={-6}
            width={28}
            height={12}
            rx={3}
            fill={gateOn ? 'rgba(16, 185, 129, 0.25)' : 'rgba(30, 41, 59, 0.8)'}
            stroke={gateOn ? '#10b981' : '#475569'}
            strokeWidth="0.8"
          />
          <text
            x={0}
            y={3}
            textAnchor="middle"
            className={`text-[8px] font-mono font-bold ${gateOn ? 'fill-emerald-300' : 'fill-slate-500'}`}
          >
            {gateOn ? 'ON' : 'OFF'}
          </text>
        </g>

        {/* Device Label & Rating */}
        {labelPos === 'left' && (
          <g transform={`translate(${x - 28}, ${y})`}>
            <text
              x={0}
              y={-1}
              textAnchor="end"
              className={`text-[11px] font-mono font-bold ${isActive ? 'fill-emerald-300' : 'fill-slate-300'}`}
            >
              {label}
            </text>
            <text
              x={0}
              y={10}
              textAnchor="end"
              className="text-[8.5px] font-mono fill-slate-400"
            >
              {rating.split(' ')[0]}
            </text>
          </g>
        )}

        {labelPos === 'right' && (
          <g transform={`translate(${x + 28}, ${y})`}>
            <text
              x={0}
              y={-1}
              textAnchor="start"
              className={`text-[11px] font-mono font-bold ${isActive ? 'fill-emerald-300' : 'fill-slate-300'}`}
            >
              {label}
            </text>
            <text
              x={0}
              y={10}
              textAnchor="start"
              className="text-[8.5px] font-mono fill-slate-400"
            >
              {rating.split(' ')[0]}
            </text>
          </g>
        )}

        {labelPos === 'top' && (
          <g transform={`translate(${x}, ${y - 28})`}>
            <text
              x={0}
              y={0}
              textAnchor="middle"
              className={`text-[11px] font-mono font-bold ${isActive ? 'fill-emerald-300' : 'fill-slate-300'}`}
            >
              {label}
            </text>
          </g>
        )}

        {labelPos === 'bottom' && (
          <g transform={`translate(${x}, ${y + 32})`}>
            <text
              x={0}
              y={0}
              textAnchor="middle"
              className={`text-[11px] font-mono font-bold ${isActive ? 'fill-emerald-300' : 'fill-slate-300'}`}
            >
              {label}
            </text>
          </g>
        )}
      </g>
    );
  };

  // Render dedicated clamping diode symbol (for 3L-NPC)
  const renderClampDiode = (
    id: string,
    label: string,
    x: number,
    y: number,
    direction: 'up' | 'down',
    options?: {
      active?: boolean;
      labelSide?: 'left' | 'right';
    }
  ) => {
    const active = options?.active !== undefined ? options.active : isDevActive(id);
    const strokeColor = active ? '#f59e0b' : '#64748b';
    const fillColor = active ? 'rgba(245, 158, 11, 0.25)' : 'rgba(30, 41, 59, 0.4)';
    const labelSide = options?.labelSide || 'right';

    return (
      <g
        id={`clamp-diode-${id}`}
        className="cursor-pointer transition-all duration-150 group"
        onClick={() =>
          setSelectedDevice({
            id,
            name: `${label} (${id})`,
            type: 'SiC Schottky High-Speed Clamping Diode',
            rating: `${(vdc / 2).toFixed(0)}V / 200A Zero Recovery`,
            status: active ? 'Conducting' : 'Blocking',
            channelState: active
              ? 'Forward Biased (Clamping phase to Neutral Point)'
              : 'Reverse Biased (Blocking Standoff)',
            vds: active ? '1.15 V (V_F forward drop)' : `${(vdc / 2).toFixed(0)} V (Reverse standoff)`,
            gateVoltage: 'Passive Autonomous (P-N Schottky junction)',
            lossEstimate: active ? `${(Math.abs(ia) * 1.15).toFixed(1)} W` : '0 W',
          })
        }
      >
        {active && (
          <circle
            cx={x}
            cy={y}
            r={18}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="1.5"
            opacity="0.6"
            className="animate-pulse"
          />
        )}

        <rect
          x={x - 16}
          y={y - 16}
          width={32}
          height={32}
          rx={5}
          fill={fillColor}
          stroke={active ? '#f59e0b' : '#334155'}
          strokeWidth={active ? '2' : '1.2'}
          className="group-hover:stroke-amber-400 transition"
        />

        {direction === 'up' ? (
          /* Points upward (Anode at bottom y+8, Cathode at top y-8) */
          <g>
            <line x1={x} y1={y + 16} x2={x} y2={y + 8} stroke={strokeColor} strokeWidth="1.5" />
            <polygon
              points={`${x - 7},${y + 8} ${x + 7},${y + 8} ${x},${y - 5}`}
              fill={active ? '#f59e0b' : 'none'}
              stroke={strokeColor}
              strokeWidth="1.5"
            />
            <line x1={x - 8} y1={y - 5} x2={x + 8} y2={y - 5} stroke={strokeColor} strokeWidth="1.8" />
            <line x1={x} y1={y - 5} x2={x} y2={y - 16} stroke={strokeColor} strokeWidth="1.5" />

            {/* Terminal Polarity: A (Anode) at bottom, K (Cathode) at top */}
            <text x={x - 10} y={y + 12} fill="#94a3b8" className="text-[7px] font-mono font-bold select-none">A</text>
            <text x={x - 10} y={y - 6} fill="#94a3b8" className="text-[7px] font-mono font-bold select-none">K</text>
          </g>
        ) : (
          /* Points downward (Anode at top y-8, Cathode at bottom y+8) */
          <g>
            <line x1={x} y1={y - 16} x2={x} y2={y - 8} stroke={strokeColor} strokeWidth="1.5" />
            <polygon
              points={`${x - 7},${y - 8} ${x + 7},${y - 8} ${x},${y + 5}`}
              fill={active ? '#f59e0b' : 'none'}
              stroke={strokeColor}
              strokeWidth="1.5"
            />
            <line x1={x - 8} y1={y + 5} x2={x + 8} y2={y + 5} stroke={strokeColor} strokeWidth="1.8" />
            <line x1={x} y1={y + 5} x2={x} y2={y + 16} stroke={strokeColor} strokeWidth="1.5" />

            {/* Terminal Polarity: A (Anode) at top, K (Cathode) at bottom */}
            <text x={x - 10} y={y - 6} fill="#94a3b8" className="text-[7px] font-mono font-bold select-none">A</text>
            <text x={x - 10} y={y + 12} fill="#94a3b8" className="text-[7px] font-mono font-bold select-none">K</text>
          </g>
        )}

        <text
          x={labelSide === 'left' ? x - 20 : x + 22}
          y={y + 3}
          textAnchor={labelSide === 'left' ? 'end' : 'start'}
          className={`text-[9.5px] font-mono font-bold ${active ? 'fill-amber-300' : 'fill-slate-400'}`}
        >
          {label}
        </text>
      </g>
    );
  };

  // Render authentic DC Link Capacitors with balancing resistors
  const renderCapacitorBranch = (
    x: number,
    yTop: number,
    yBottom: number,
    isSplit: boolean = false
  ) => {
    if (!isSplit) {
      // Single DC Link Capacitor (for 2L-VSI)
      const yMid = (yTop + yBottom) / 2;
      return (
        <g id="dc-link-single-cap">
          {/* Main wire */}
          <line x1={x} y1={yTop} x2={x} y2={yMid - 10} stroke="#475569" strokeWidth="2" />
          {/* Positive top plate */}
          <line x1={x - 18} y1={yMid - 10} x2={x + 18} y2={yMid - 10} stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
          <text x={x - 24} y={yMid - 14} fill="#38bdf8" className="text-[10px] font-mono font-bold">+</text>

          {/* Negative bottom plate */}
          <line x1={x - 18} y1={yMid + 2} x2={x + 18} y2={yMid + 2} stroke="#f43f5e" strokeWidth="3" strokeLinecap="round" />
          <line x1={x} y1={yMid + 2} x2={x} y2={yBottom} stroke="#475569" strokeWidth="2" />

          {/* Label */}
          <text x={x + 24} y={yMid - 2} fill="#94a3b8" className="text-[10px] font-mono font-bold">C_dc</text>
          <text x={x + 24} y={yMid + 10} fill="#64748b" className="text-[8.5px] font-mono">1.2 mF / {vdc}V</text>

          {/* Parallel Bleeder Resistor */}
          <line x1={x} y1={yMid - 30} x2={x + 48} y2={yMid - 30} stroke="#334155" strokeWidth="1.2" />
          <line x1={x + 48} y1={yMid - 30} x2={x + 48} y2={yMid - 12} stroke="#334155" strokeWidth="1.2" />
          <rect x={x + 42} y={yMid - 12} width={12} height={24} fill="#0f172a" stroke="#64748b" strokeWidth="1.2" rx="2" />
          <text x={x + 60} y={yMid + 4} fill="#64748b" className="text-[8px] font-mono">R_bleed (100k)</text>
          <line x1={x + 48} y1={yMid + 12} x2={x + 48} y2={yMid + 30} stroke="#334155" strokeWidth="1.2" />
          <line x1={x + 48} y1={yMid + 30} x2={x} y2={yMid + 30} stroke="#334155" strokeWidth="1.2" />
        </g>
      );
    }

    // Split DC Capacitors C1 & C2 (for 3L topologies)
    const yMid = (yTop + yBottom) / 2;
    const yC1 = (yTop + yMid) / 2;
    const yC2 = (yMid + yBottom) / 2;

    return (
      <g id="dc-link-split-caps">
        {/* Wire top to C1 */}
        <line x1={x} y1={yTop} x2={x} y2={yC1 - 8} stroke="#475569" strokeWidth="2" />
        <line x1={x - 16} y1={yC1 - 8} x2={x + 16} y2={yC1 - 8} stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
        <text x={x - 22} y={yC1 - 12} fill="#38bdf8" className="text-[9px] font-mono font-bold">+</text>
        <line x1={x - 16} y1={yC1 + 4} x2={x + 16} y2={yC1 + 4} stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
        <line x1={x} y1={yC1 + 4} x2={x} y2={yMid} stroke="#f59e0b" strokeWidth="2.5" />

        {/* C1 Label */}
        <text x={x + 22} y={yC1 - 1} fill="#94a3b8" className="text-[9.5px] font-mono font-bold">C_1</text>
        <text x={x + 22} y={yC1 + 10} fill="#64748b" className="text-[8px] font-mono">{(vdc / 2).toFixed(0)}V / 600μF</text>

        {/* Neutral Midpoint Junction Dot */}
        <circle cx={x} cy={yMid} r="4" fill="#f59e0b" stroke="#0f172a" strokeWidth="1.5" />

        {/* Wire mid to C2 */}
        <line x1={x} y1={yMid} x2={x} y2={yC2 - 8} stroke="#f59e0b" strokeWidth="2.5" />
        <line x1={x - 16} y1={yC2 - 8} x2={x + 16} y2={yC2 - 8} stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
        <text x={x - 22} y={yC2 - 12} fill="#f59e0b" className="text-[9px] font-mono font-bold">+</text>
        <line x1={x - 16} y1={yC2 + 4} x2={x + 16} y2={yC2 + 4} stroke="#f43f5e" strokeWidth="3" strokeLinecap="round" />
        <line x1={x} y1={yC2 + 4} x2={x} y2={yBottom} stroke="#475569" strokeWidth="2" />

        {/* C2 Label */}
        <text x={x + 22} y={yC2 - 1} fill="#94a3b8" className="text-[9.5px] font-mono font-bold">C_2</text>
        <text x={x + 22} y={yC2 + 10} fill="#64748b" className="text-[8px] font-mono">{(vdc / 2).toFixed(0)}V / 600μF</text>
      </g>
    );
  };

  // Render professional Traction PMSM Motor Machine Model
  const renderMotorLoad = (x: number, yMid: number) => {
    return (
      <g id="traction-motor-model" className="select-none">
        {/* Motor Enclosure Chassis Card */}
        <rect
          x={x}
          y={yMid - 105}
          width={220}
          height={210}
          rx={12}
          fill="rgba(15, 23, 42, 0.85)"
          stroke="#334155"
          strokeWidth="1.5"
          className="shadow-2xl"
        />

        {/* Top Header inside motor box */}
        <rect
          x={x}
          y={yMid - 105}
          width={220}
          height={30}
          rx={12}
          fill="rgba(30, 41, 59, 0.7)"
        />
        <text
          x={x + 14}
          y={yMid - 85}
          className="text-[11px] font-mono font-bold fill-sky-400 flex items-center gap-1"
        >
          TRACTION PMSM LOAD (3Φ)
        </text>

        {/* Motoring vs Regen badge */}
        <g transform={`translate(${x + 150}, ${yMid - 93})`}>
          <rect
            x={0}
            y={0}
            width={60}
            height={16}
            rx={4}
            fill={isMotoring ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}
            stroke={isMotoring ? '#10b981' : '#f59e0b'}
            strokeWidth="1"
          />
          <text
            x={30}
            y={11}
            textAnchor="middle"
            className={`text-[8.5px] font-mono font-bold ${isMotoring ? 'fill-emerald-300' : 'fill-amber-300'}`}
          >
            {isMotoring ? 'MOTORING' : 'REGEN'}
          </text>
        </g>

        {/* Phase Terminal Bushing A */}
        <circle cx={x} cy={yMid} r="6" fill="#10b981" stroke="#0f172a" strokeWidth="2" />
        <text x={x + 10} y={yMid - 6} fill="#10b981" className="text-[10px] font-mono font-bold">
          Term A
        </text>

        {/* Current Sensor Indicator (Hall transducer ring) */}
        <g transform={`translate(${x + 28}, ${yMid})`}>
          <circle cx={0} cy={0} r="9" fill="none" stroke="#38bdf8" strokeWidth="2" />
          <line x1={-9} y1={0} x2={9} y2={0} stroke="#10b981" strokeWidth="2.5" />
          <text x={0} y={-12} textAnchor="middle" fill="#38bdf8" className="text-[8px] font-mono">
            LEM CT
          </text>
        </g>

        {/* Wire from terminal through sensor into R_s */}
        <line x1={x} y1={yMid} x2={x + 45} y2={yMid} stroke="#10b981" strokeWidth="2.5" />

        {/* Stator Resistance R_s Symbol (IEC Zig-Zag or Box) */}
        <rect x={x + 45} y={yMid - 5} width={24} height={10} fill="#0f172a" stroke="#cbd5e1" strokeWidth="1.5" rx="1" />
        <text x={x + 57} y={yMid - 8} textAnchor="middle" fill="#94a3b8" className="text-[8.5px] font-mono">
          R_s (60mΩ)
        </text>
        <line x1={x + 69} y1={yMid} x2={x + 80} y2={yMid} stroke="#10b981" strokeWidth="2.5" />

        {/* Stator Inductance L_s Symbol (4 clean arcs) */}
        <g transform={`translate(${x + 80}, ${yMid})`}>
          <path
            d="M 0 0 A 5 5 0 0 1 10 0 A 5 5 0 0 1 20 0 A 5 5 0 0 1 30 0 A 5 5 0 0 1 40 0"
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="2"
          />
          <text x={20} y={-8} textAnchor="middle" fill="#94a3b8" className="text-[8.5px] font-mono">
            L_s (1.2mH)
          </text>
        </g>
        <line x1={x + 120} y1={yMid} x2={x + 135} y2={yMid} stroke="#10b981" strokeWidth="2.5" />

        {/* Back-EMF Source Circle E_a */}
        <g transform={`translate(${x + 150}, ${yMid})`}>
          <circle cx={0} cy={0} r="15" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.8" />
          {/* Sine wave glyph */}
          <path
            d="M -9 0 Q -4.5 -8 0 0 Q 4.5 8 9 0"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="1.8"
          />
          <text x={0} y={-18} textAnchor="middle" fill="#38bdf8" className="text-[9px] font-mono font-bold">
            E_a(t)
          </text>
          <text x={0} y={26} textAnchor="middle" fill="#94a3b8" className="text-[8.5px] font-mono">
            {(Math.abs(van) * 0.72).toFixed(0)} Vpk
          </text>
        </g>

        {/* Wire from Back-EMF to Motor Star Neutral Point N */}
        <line x1={x + 165} y1={yMid} x2={x + 185} y2={yMid} stroke="#64748b" strokeWidth="2" />
        <circle cx={x + 185} cy={yMid} r="3.5" fill="#f59e0b" />
        <text x={x + 195} y={yMid + 3} fill="#f59e0b" className="text-[9px] font-mono font-bold">
          N
        </text>

        {/* Star branches B & C connecting to N */}
        <line x1={x + 185} y1={yMid} x2={x + 175} y2={yMid - 35} stroke="#475569" strokeWidth="1.5" strokeDasharray="3 3" />
        <text x={x + 165} y={yMid - 37} fill="#64748b" className="text-[8px] font-mono">Phase B</text>

        <line x1={x + 185} y1={yMid} x2={x + 175} y2={yMid + 35} stroke="#475569" strokeWidth="1.5" strokeDasharray="3 3" />
        <text x={x + 165} y={yMid + 43} fill="#64748b" className="text-[8px] font-mono">Phase C</text>

        {/* Motor Chassis / Stator Frame Earth */}
        <line x1={x + 185} y1={yMid} x2={x + 185} y2={yMid + 65} stroke="#64748b" strokeWidth="1.5" />
        <line x1={x + 177} y1={yMid + 65} x2={x + 193} y2={yMid + 65} stroke="#64748b" strokeWidth="1.8" />
        <line x1={x + 180} y1={yMid + 69} x2={x + 190} y2={yMid + 69} stroke="#64748b" strokeWidth="1.5" />
        <line x1={x + 183} y1={yMid + 73} x2={x + 187} y2={yMid + 73} stroke="#64748b" strokeWidth="1.2" />
        <text x={x + 198} y={yMid + 72} fill="#64748b" className="text-[8px] font-mono">Chassis</text>

        {/* Real-time Electrical Parameters Box */}
        <g transform={`translate(${x + 10}, ${yMid + 42})`}>
          <rect x={0} y={0} width={150} height={52} rx={6} fill="#090d16" stroke="#1e293b" strokeWidth="1" />
          <text x={8} y={15} fill="#94a3b8" className="text-[9px] font-mono">
            v_an(t): <strong className="text-white">{van.toFixed(0)} V</strong>
          </text>
          <text x={8} y={29} fill="#94a3b8" className="text-[9px] font-mono">
            i_a(t): <strong className="text-amber-300">{ia.toFixed(1)} A</strong>
          </text>
          <text x={8} y={43} fill="#94a3b8" className="text-[9px] font-mono">
            P_inst: <strong className="text-emerald-300">{(van * ia / 1000).toFixed(2)} kW</strong>
          </text>
        </g>
      </g>
    );
  };

  return (
    <div id="panel-a-schematic" className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      {/* Schematic Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-mono font-bold tracking-wider uppercase text-slate-200">
                Electrical Circuit Schematic
              </h2>
              <span className="px-2 py-0.5 text-xs font-bold font-mono rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                {topology}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                IEEE Std 315-1975
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Live State: Phase A <strong className="text-emerald-400 font-mono">[{stateA}]</strong> | Pole: <strong className="text-white font-mono">{van.toFixed(0)} V</strong> | Line Current: <strong className="text-amber-400 font-mono">{ia.toFixed(1)} A</strong>
            </p>
          </div>
        </div>

        {/* View Mode & State Pills */}
        <div className="flex items-center gap-3 text-xs font-mono">
          {/* Segmented Control for Single-Phase Focus vs 3-Phase Complete */}
          <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-[11px]">
            <button
              onClick={() => setViewMode('detailed')}
              className={`px-2.5 py-1 rounded transition-all duration-150 flex items-center gap-1 ${
                viewMode === 'detailed'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🔬 Phase A Focus</span>
            </button>
            <button
              onClick={() => setViewMode('threePhase')}
              className={`px-2.5 py-1 rounded transition-all duration-150 flex items-center gap-1 ${
                viewMode === 'threePhase'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🌐 Complete 3-Phase</span>
            </button>
          </div>

          {/* Legend and Conduction Details Compact Toggles */}
          <button
            onClick={() => setShowLegend(!showLegend)}
            className={`px-2.5 py-1 rounded-md transition border flex items-center gap-1.5 ${
              showLegend
                ? 'bg-amber-500/25 text-amber-300 border-amber-500/50 font-bold shadow-sm shadow-amber-950/20'
                : 'bg-slate-900 border-slate-800/80 text-slate-400 hover:text-white'
            }`}
            title="Toggle Schematic Legend"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Legend</span>
          </button>

          <button
            onClick={() => setShowConduction(!showConduction)}
            className={`px-2.5 py-1 rounded-md transition border flex items-center gap-1.5 ${
              showConduction
                ? 'bg-teal-500/25 text-teal-300 border-teal-500/50 font-bold shadow-sm shadow-teal-950/20'
                : 'bg-slate-900 border-slate-800/80 text-slate-400 hover:text-white'
            }`}
            title="Toggle Conduction Details"
          >
            <Info className="w-3.5 h-3.5" />
            <span>Details</span>
          </button>

          {/* Phase states indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-950 border border-slate-800">
            <span className="text-slate-400 text-[11px]">States:</span>
            <span className={`px-1 rounded font-bold ${stateA === 'P' ? 'bg-emerald-500/20 text-emerald-300' : stateA === 'N' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'}`}>
              A:{stateA}
            </span>
            <span className={`px-1 rounded font-bold ${stateB === 'P' ? 'bg-emerald-500/20 text-emerald-300' : stateB === 'N' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'}`}>
              B:{stateB}
            </span>
            <span className={`px-1 rounded font-bold ${stateC === 'P' ? 'bg-emerald-500/20 text-emerald-300' : stateC === 'N' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'}`}>
              C:{stateC}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded bg-emerald-950/40 border border-emerald-500/30 text-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>SiC Die: {topology === '2L-VSI' ? `${vdc}V` : `${(vdc / 2).toFixed(0)}V`}</span>
          </div>

          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="p-1.5 rounded-md bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition flex items-center justify-center"
              title={isFullscreen ? "Exit Full Screen" : "Full Screen"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className={`relative flex-1 w-full bg-[#080d1a] p-2 flex items-center justify-center overflow-hidden transition-all duration-300 ${
        isFullscreen ? 'h-[75vh] min-h-[500px]' : 'h-[380px] min-h-[360px]'
      }`}>
        <svg
          viewBox={viewMode === 'threePhase' ? "0 0 900 480" : "0 0 740 400"}
          className={`w-full h-full select-none ${
            isFullscreen ? 'max-h-full animate-none' : 'max-h-[420px]'
          }`}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Fine Engineering CAD Grid Pattern */}
            <pattern id="cad-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="10" r="0.8" fill="#1e293b" />
            </pattern>

            {/* Glowing filter for conducting semiconductors */}
            <filter id="glow-emerald" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Animated marker for active current flow */}
            <marker
              id="flow-arrow-emerald"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10b981" />
            </marker>

            <marker
              id="flow-arrow-amber"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f59e0b" />
            </marker>

            {/* CSS Keyframes for Real Electron / Current Flow */}
            <style>{`
              @keyframes flowAnimation {
                from { stroke-dashoffset: 24; }
                to { stroke-dashoffset: 0; }
              }
              .active-current-path {
                stroke-dasharray: 6 6;
                animation: flowAnimation 0.8s linear infinite;
              }
            `}</style>
          </defs>

          {/* Background CAD Grid */}
          <rect x="0" y="0" width="100%" height="100%" fill="#080d1a" />
          <rect x="0" y="0" width="100%" height="100%" fill="url(#cad-grid)" />

          {viewMode === 'threePhase' ? renderThreePhaseSVG() : (
            <>
              {/* ========================================================= */}
              {/* TOPOLOGY 1: 2L-VSI (Two-Level 6-Switch Bridge)            */}
              {/* ========================================================= */}
          {topology === '2L-VSI' && (
            <g id="circuit-2l-vsi">
              {/* Positive DC Bus Rail (+Vdc/2) */}
              <g id="bus-dc-plus">
                <line x1="40" y1="45" x2="440" y2="45" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                <circle cx="50" cy="45" r="5" fill="#38bdf8" stroke="#080d1a" strokeWidth="1.5" />
                <rect x="60" y="32" width="110" height="18" rx="4" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
                <text x="115" y="44" textAnchor="middle" fill="#38bdf8" className="text-[10px] font-mono font-bold">
                  +V_DC ({(vdc / 2).toFixed(0)} V)
                </text>
              </g>

              {/* Negative DC Bus Rail (-Vdc/2) */}
              <g id="bus-dc-minus">
                <line x1="40" y1="355" x2="440" y2="355" stroke="#f43f5e" strokeWidth="4" strokeLinecap="round" />
                <circle cx="50" cy="355" r="5" fill="#f43f5e" stroke="#080d1a" strokeWidth="1.5" />
                <rect x="60" y="342" width="110" height="18" rx="4" fill="#0f172a" stroke="#f43f5e" strokeWidth="1" />
                <text x="115" y="354" textAnchor="middle" fill="#f43f5e" className="text-[10px] font-mono font-bold">
                  -V_DC (-{(vdc / 2).toFixed(0)} V)
                </text>
              </g>

              {/* DC Link Capacitor (Single bank) */}
              {renderCapacitorBranch(95, 45, 355, false)}

              {/* Phase Leg A Connection (Prominent, High-Resolution IEEE Switches) */}
              <g id="leg-a-power-stage">
                {/* Upper Switch S1 wire */}
                <line
                  x1="220"
                  y1="45"
                  x2="220"
                  y2="105"
                  stroke={isDevActive('S1') || isDevActive('D1') ? '#10b981' : '#475569'}
                  strokeWidth={isDevActive('S1') || isDevActive('D1') ? '3.5' : '2'}
                  className={isDevActive('S1') || isDevActive('D1') ? 'active-current-path' : ''}
                />
                <circle cx="220" cy="45" r="3.5" fill="#38bdf8" />

                {/* S1 MOSFET */}
                {renderMosfet('S1', 'S1 (Top)', 220, 125, {
                  orientation: 'vertical',
                  customRating: `${vdc}V SiC`,
                  bodyDiodeId: 'D1',
                })}

                {/* Leg A Midpoint Node (Phase A Terminal) */}
                <line
                  x1="220"
                  y1="145"
                  x2="220"
                  y2="255"
                  stroke={stateA === 'P' ? '#10b981' : stateA === 'N' ? '#f43f5e' : '#475569'}
                  strokeWidth="3"
                />
                <circle cx="220" cy="200" r="5" fill="#10b981" stroke="#080d1a" strokeWidth="1.5" />

                {/* S2 MOSFET */}
                {renderMosfet('S2', 'S2 (Bot)', 220, 275, {
                  orientation: 'vertical',
                  customRating: `${vdc}V SiC`,
                  bodyDiodeId: 'D2',
                })}

                {/* Lower Switch S2 wire to -Vdc */}
                <line
                  x1="220"
                  y1="295"
                  x2="220"
                  y2="355"
                  stroke={isDevActive('S2') || isDevActive('D2') ? '#10b981' : '#475569'}
                  strokeWidth={isDevActive('S2') || isDevActive('D2') ? '3.5' : '2'}
                  className={isDevActive('S2') || isDevActive('D2') ? 'active-current-path' : ''}
                />
                <circle cx="220" cy="355" r="3.5" fill="#f43f5e" />

                {/* Phase A Output Wire to Motor */}
                <line
                  x1="220"
                  y1="200"
                  x2="480"
                  y2="200"
                  stroke="#10b981"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  className={currentDir !== 'zero' ? 'active-current-path' : ''}
                  markerEnd={currentDir === 'outward' ? 'url(#flow-arrow-emerald)' : undefined}
                  markerStart={currentDir === 'inward' ? 'url(#flow-arrow-emerald)' : undefined}
                />
                <rect x="250" y="182" width="130" height="18" rx="4" fill="#090d16" stroke="#10b981" strokeWidth="1" />
                <text x="315" y="194" textAnchor="middle" fill="#10b981" className="text-[9.5px] font-mono font-bold">
                  Phase A (ia = {ia.toFixed(1)} A)
                </text>
              </g>

              {/* Phase Leg B & Leg C context (Full 3-Phase Inverter Representation) */}
              <g id="leg-b-c-preview" opacity="0.6">
                {/* Leg B */}
                <line x1="320" y1="45" x2="320" y2="355" stroke="#334155" strokeWidth="1.5" strokeDasharray="4 4" />
                <rect x="306" y="115" width="28" height="20" rx="3" fill="#0f172a" stroke={stateB === 'P' ? '#10b981' : '#475569'} />
                <text x="320" y="129" textAnchor="middle" fill={stateB === 'P' ? '#10b981' : '#64748b'} className="text-[9px] font-mono">S3</text>
                <rect x="306" y="265" width="28" height="20" rx="3" fill="#0f172a" stroke={stateB === 'N' ? '#10b981' : '#475569'} />
                <text x="320" y="279" textAnchor="middle" fill={stateB === 'N' ? '#10b981' : '#64748b'} className="text-[9px] font-mono">S4</text>
                <text x="320" y="204" textAnchor="middle" fill="#64748b" className="text-[9px] font-mono">Phase B</text>

                {/* Leg C */}
                <line x1="400" y1="45" x2="400" y2="355" stroke="#334155" strokeWidth="1.5" strokeDasharray="4 4" />
                <rect x="386" y="115" width="28" height="20" rx="3" fill="#0f172a" stroke={stateC === 'P' ? '#10b981' : '#475569'} />
                <text x="400" y="129" textAnchor="middle" fill={stateC === 'P' ? '#10b981' : '#64748b'} className="text-[9px] font-mono">S5</text>
                <rect x="386" y="265" width="28" height="20" rx="3" fill="#0f172a" stroke={stateC === 'N' ? '#10b981' : '#475569'} />
                <text x="400" y="279" textAnchor="middle" fill={stateC === 'N' ? '#10b981' : '#64748b'} className="text-[9px] font-mono">S6</text>
                <text x="400" y="204" textAnchor="middle" fill="#64748b" className="text-[9px] font-mono">Phase C</text>
              </g>

              {/* PMSM Motor Load Model */}
              {renderMotorLoad(480, 200)}
            </g>
          )}

          {/* ========================================================= */}
          {/* TOPOLOGY 2: 3L-NPC (Neutral Point Clamped Inverter)       */}
          {/* ========================================================= */}
          {topology === '3L-NPC' && (
            <g id="circuit-3l-npc">
              {/* Positive DC Rail (+Vdc/2) */}
              <line x1="40" y1="40" x2="440" y2="40" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
              <text x="110" y="32" textAnchor="middle" fill="#38bdf8" className="text-[10px] font-mono font-bold">
                +V_DC/2 (+{(vdc / 2).toFixed(0)} V)
              </text>

              {/* Neutral Point Rail (NP = 0V) - Feeds split capacitors and clamping leg directly at y=200 */}
              <line
                x1="40"
                y1="200"
                x2="200"
                y2="200"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeDasharray="6 3"
                strokeLinecap="round"
                className={isDevActive('D_clamp1') || isDevActive('D_clamp2') ? 'active-current-path' : ''}
              />
              <circle cx="50" cy="200" r="4" fill="#f59e0b" stroke="#080d1a" strokeWidth="1.5" />
              <circle cx="80" cy="200" r="4.5" fill="#f59e0b" stroke="#080d1a" strokeWidth="1.5" />
              <circle cx="200" cy="200" r="4.5" fill="#f59e0b" stroke="#080d1a" strokeWidth="1.5" />
              <text x="110" y="190" textAnchor="middle" fill="#f59e0b" className="text-[10px] font-mono font-bold">
                Neutral Point (NP = 0V)
              </text>

              {/* Negative DC Rail (-Vdc/2) */}
              <line x1="40" y1="360" x2="440" y2="360" stroke="#f43f5e" strokeWidth="4" strokeLinecap="round" />
              <text x="110" y="378" textAnchor="middle" fill="#f43f5e" className="text-[10px] font-mono font-bold">
                -V_DC/2 (-{(vdc / 2).toFixed(0)} V)
              </text>

              {/* Split DC Capacitors C1 & C2 */}
              {renderCapacitorBranch(80, 40, 360, true)}

              {/* Clamping Diodes Dc1 & Dc2 Branch */}
              {/* Upper Clamp: from NP (200,200) up to node between S1 and S2 (y=115) */}
              <path
                d="M 200 200 L 200 120 L 290 120"
                fill="none"
                stroke={isDevActive('D_clamp1') ? '#f59e0b' : '#64748b'}
                strokeWidth={isDevActive('D_clamp1') ? '3' : '1.5'}
                className={isDevActive('D_clamp1') ? 'active-current-path' : ''}
              />
              {renderClampDiode('D_clamp1', 'Dc1', 200, 150, 'up')}

              {/* Lower Clamp: from node between S3 and S4 (y=280) up to NP (200,200) */}
              <path
                d="M 290 280 L 200 280 L 200 200"
                fill="none"
                stroke={isDevActive('D_clamp2') ? '#f59e0b' : '#64748b'}
                strokeWidth={isDevActive('D_clamp2') ? '3' : '1.5'}
                className={isDevActive('D_clamp2') ? 'active-current-path' : ''}
              />
              {renderClampDiode('D_clamp2', 'Dc2', 200, 250, 'up')}

              {/* Main 4-Switch Series Phase Leg A (S1, S2, S3, S4) */}
              {/* Wire from +Vdc to S1 */}
              <line
                x1="290"
                y1="40"
                x2="290"
                y2="55"
                stroke={isDevActive('S1') ? '#10b981' : '#475569'}
                strokeWidth="2.5"
              />
              <circle cx="290" cy="40" r="3.5" fill="#38bdf8" />

              {/* S1 Switch */}
              {renderMosfet('S1', 'S1', 290, 75, { customRating: `${(vdc / 2).toFixed(0)}V` })}

              {/* Wire S1 -> S2 (Node A_upper at y=120) */}
              <line
                x1="290"
                y1="95"
                x2="290"
                y2="145"
                stroke={isDevActive('S1') || isDevActive('D_clamp1') ? '#10b981' : '#475569'}
                strokeWidth="2.5"
              />
              <circle cx="290" cy="120" r="4" fill="#38bdf8" />

              {/* S2 Switch */}
              {renderMosfet('S2', 'S2', 290, 165, { customRating: `${(vdc / 2).toFixed(0)}V` })}

              {/* Phase A Output Node (Between S2 and S3 at y=200) */}
              <line
                x1="290"
                y1="185"
                x2="290"
                y2="215"
                stroke="#10b981"
                strokeWidth="3.5"
              />
              <circle cx="290" cy="200" r="5" fill="#10b981" stroke="#080d1a" strokeWidth="1.5" />

              {/* S3 Switch */}
              {renderMosfet('S3', 'S3', 290, 235, { customRating: `${(vdc / 2).toFixed(0)}V` })}

              {/* Wire S3 -> S4 (Node A_lower at y=280) */}
              <line
                x1="290"
                y1="255"
                x2="290"
                y2="305"
                stroke={isDevActive('S4') || isDevActive('D_clamp2') ? '#10b981' : '#475569'}
                strokeWidth="2.5"
              />
              <circle cx="290" cy="280" r="4" fill="#f43f5e" />

              {/* S4 Switch */}
              {renderMosfet('S4', 'S4', 290, 325, { customRating: `${(vdc / 2).toFixed(0)}V` })}

              {/* Wire S4 to -Vdc */}
              <line
                x1="290"
                y1="345"
                x2="290"
                y2="360"
                stroke={isDevActive('S4') ? '#10b981' : '#475569'}
                strokeWidth="2.5"
              />
              <circle cx="290" cy="360" r="3.5" fill="#f43f5e" />

              {/* Phase A Output Wire to Motor */}
              <line
                x1="290"
                y1="200"
                x2="480"
                y2="200"
                stroke="#10b981"
                strokeWidth="3.5"
                className={currentDir !== 'zero' ? 'active-current-path' : ''}
                markerEnd={currentDir === 'outward' ? 'url(#flow-arrow-emerald)' : undefined}
                markerStart={currentDir === 'inward' ? 'url(#flow-arrow-emerald)' : undefined}
              />

              {/* Motor Load */}
              {renderMotorLoad(480, 200)}
            </g>
          )}

          {/* ========================================================= */}
          {/* TOPOLOGY 3: 3L-ANPC (Active Clamped Inverter)             */}
          {/* ========================================================= */}
          {topology === '3L-ANPC' && (
            <g id="circuit-3l-anpc">
              {/* DC Rails */}
              <line x1="40" y1="40" x2="440" y2="40" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
              <text x="110" y="32" textAnchor="middle" fill="#38bdf8" className="text-[10px] font-mono font-bold">
                +V_DC/2 (+{(vdc / 2).toFixed(0)} V)
              </text>

              {/* Neutral Point Rail (NP = 0V) - Connects directly to split capacitors and active clamp leg at y=200 */}
              <line
                x1="40"
                y1="200"
                x2="190"
                y2="200"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeDasharray="6 3"
                strokeLinecap="round"
                className={isDevActive('S5_active') || isDevActive('S6_active') ? 'active-current-path' : ''}
              />
              <circle cx="50" cy="200" r="4" fill="#f59e0b" stroke="#080d1a" strokeWidth="1.5" />
              <circle cx="80" cy="200" r="4.5" fill="#f59e0b" stroke="#080d1a" strokeWidth="1.5" />
              <circle cx="190" cy="200" r="4.5" fill="#f59e0b" stroke="#080d1a" strokeWidth="1.5" />
              <text x="110" y="190" textAnchor="middle" fill="#f59e0b" className="text-[10px] font-mono font-bold">
                Neutral Point (NP = 0V)
              </text>

              <line x1="40" y1="360" x2="440" y2="360" stroke="#f43f5e" strokeWidth="4" strokeLinecap="round" />
              <text x="110" y="378" textAnchor="middle" fill="#f43f5e" className="text-[10px] font-mono font-bold">
                -V_DC/2 (-{(vdc / 2).toFixed(0)} V)
              </text>

              {/* Split DC Capacitors */}
              {renderCapacitorBranch(80, 40, 360, true)}

              {/* Active Clamping Switch S5 (replaces Dc1) */}
              <path
                d="M 190 200 L 190 120 L 290 120"
                fill="none"
                stroke={isDevActive('S5_active') ? '#10b981' : '#475569'}
                strokeWidth={isDevActive('S5_active') ? '3' : '1.5'}
                className={isDevActive('S5_active') ? 'active-current-path' : ''}
              />
              {renderMosfet('S5_active', 'S5 (Active)', 190, 150, {
                customRating: `${(vdc / 2).toFixed(0)}V SiC`,
                customTech: 'Active Clamping Switch (Zero-State Thermal Balance)',
              })}

              {/* Active Clamping Switch S6 (replaces Dc2) */}
              <path
                d="M 290 280 L 190 280 L 190 200"
                fill="none"
                stroke={isDevActive('S6_active') ? '#10b981' : '#475569'}
                strokeWidth={isDevActive('S6_active') ? '3' : '1.5'}
                className={isDevActive('S6_active') ? 'active-current-path' : ''}
              />
              {renderMosfet('S6_active', 'S6 (Active)', 190, 250, {
                customRating: `${(vdc / 2).toFixed(0)}V SiC`,
                customTech: 'Active Clamping Switch (Zero-State Thermal Balance)',
              })}

              {/* Main 4-switch leg S1..S4 */}
              <line x1="290" y1="40" x2="290" y2="55" stroke={isDevActive('S1') ? '#10b981' : '#475569'} strokeWidth="2.5" />
              {renderMosfet('S1', 'S1', 290, 75, { customRating: `${(vdc / 2).toFixed(0)}V` })}

              <line x1="290" y1="95" x2="290" y2="145" stroke={isDevActive('S1') || isDevActive('S5_active') ? '#10b981' : '#475569'} strokeWidth="2.5" />
              <circle cx="290" cy="120" r="4" fill="#38bdf8" />

              {renderMosfet('S2', 'S2', 290, 165, { customRating: `${(vdc / 2).toFixed(0)}V` })}

              {/* Phase A output terminal */}
              <line x1="290" y1="185" x2="290" y2="215" stroke="#10b981" strokeWidth="3.5" />
              <circle cx="290" cy="200" r="5" fill="#10b981" stroke="#080d1a" strokeWidth="1.5" />

              {renderMosfet('S3', 'S3', 290, 235, { customRating: `${(vdc / 2).toFixed(0)}V` })}

              <line x1="290" y1="255" x2="290" y2="305" stroke={isDevActive('S4') || isDevActive('S6_active') ? '#10b981' : '#475569'} strokeWidth="2.5" />
              <circle cx="290" cy="280" r="4" fill="#f43f5e" />

              {renderMosfet('S4', 'S4', 290, 325, { customRating: `${(vdc / 2).toFixed(0)}V` })}
              <line x1="290" y1="345" x2="290" y2="360" stroke={isDevActive('S4') ? '#10b981' : '#475569'} strokeWidth="2.5" />

              {/* Phase A Output Wire */}
              <line
                x1="290"
                y1="200"
                x2="480"
                y2="200"
                stroke="#10b981"
                strokeWidth="3.5"
                className={currentDir !== 'zero' ? 'active-current-path' : ''}
                markerEnd={currentDir === 'outward' ? 'url(#flow-arrow-emerald)' : undefined}
                markerStart={currentDir === 'inward' ? 'url(#flow-arrow-emerald)' : undefined}
              />

              {/* Motor Load */}
              {renderMotorLoad(480, 200)}
            </g>
          )}

          {/* ========================================================= */}
          {/* TOPOLOGY 4: 3L-TNPC (T-Type Neutral Point Clamped)        */}
          {/* ========================================================= */}
          {topology === '3L-TNPC' && (
            <g id="circuit-3l-tnpc">
              {/* Positive DC Rail */}
              <line x1="40" y1="40" x2="440" y2="40" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
              <text x="110" y="32" textAnchor="middle" fill="#38bdf8" className="text-[10px] font-mono font-bold">
                +V_DC/2 (+{(vdc / 2).toFixed(0)} V)
              </text>

              {/* Neutral Midpoint Rail - Directly connects split capacitor midpoint (80, 200) to S2/S3 input terminal (185, 200) */}
              <line
                x1="40"
                y1="200"
                x2="185"
                y2="200"
                stroke={isDevActive('S2') || isDevActive('S3') ? '#10b981' : '#f59e0b'}
                strokeWidth="2.5"
                strokeDasharray="6 3"
                className={isDevActive('S2') || isDevActive('S3') ? 'active-current-path' : ''}
              />
              <circle cx="50" cy="200" r="4" fill="#f59e0b" stroke="#080d1a" strokeWidth="1.5" />
              <circle cx="80" cy="200" r="4.5" fill="#f59e0b" stroke="#080d1a" strokeWidth="1.5" />
              <circle cx="185" cy="200" r="4.5" fill={isDevActive('S2') || isDevActive('S3') ? '#10b981' : '#f59e0b'} stroke="#080d1a" strokeWidth="1.5" />
              <text x="110" y="190" textAnchor="middle" fill="#f59e0b" className="text-[10px] font-mono font-bold">
                Neutral Point (NP = 0V)
              </text>

              {/* Negative DC Rail */}
              <line x1="40" y1="360" x2="440" y2="360" stroke="#f43f5e" strokeWidth="4" strokeLinecap="round" />
              <text x="110" y="378" textAnchor="middle" fill="#f43f5e" className="text-[10px] font-mono font-bold">
                -V_DC/2 (-{(vdc / 2).toFixed(0)} V)
              </text>

              {/* Split Capacitors */}
              {renderCapacitorBranch(80, 40, 360, true)}

              {/* Main Vertical Leg: S1 (Top, 1200V) and S4 (Bottom, 1200V) */}
              <line
                x1="320"
                y1="40"
                x2="320"
                y2="90"
                stroke={isDevActive('S1') || isDevActive('D1') ? '#10b981' : '#475569'}
                strokeWidth="3"
                className={isDevActive('S1') ? 'active-current-path' : ''}
              />
              <circle cx="320" cy="40" r="4" fill="#38bdf8" />

              {renderMosfet('S1', 'S1 (1200V)', 320, 110, {
                customRating: `${vdc}V SiC`,
                customTech: '1200V SiC Main Leg Switch (Direct rail-to-rail)',
              })}

              {/* Central Output Junction T-node */}
              <line
                x1="320"
                y1="130"
                x2="320"
                y2="270"
                stroke={stateA === 'P' || stateA === 'N' || stateA === 'O' ? '#10b981' : '#475569'}
                strokeWidth="3.5"
              />
              <circle cx="320" cy="200" r="6" fill="#10b981" stroke="#080d1a" strokeWidth="2" />

              {renderMosfet('S4', 'S4 (1200V)', 320, 290, {
                customRating: `${vdc}V SiC`,
                customTech: '1200V SiC Main Leg Switch (Direct rail-to-rail)',
              })}

              <line
                x1="320"
                y1="310"
                x2="320"
                y2="360"
                stroke={isDevActive('S4') || isDevActive('D4') ? '#10b981' : '#475569'}
                strokeWidth="3"
                className={isDevActive('S4') ? 'active-current-path' : ''}
              />
              <circle cx="320" cy="360" r="4" fill="#f43f5e" />

              {/* Horizontal Bidirectional Auxiliary Midpoint Leg (T-stem) */}
              {/* Connected from NP (x=185, y=200) through anti-series S2 and S3 to Phase A (x=320, y=200) */}
              {/* S2 Horizontal MOSFET (650V rated, Drain to NP at x=185, Source to Midpoint at x=225) */}
              {renderMosfet('S2', 'S2 (650V)', 205, 200, {
                orientation: 'horizontal',
                customRating: `${(vdc / 2).toFixed(0)}V`,
                labelPos: 'bottom',
                customTech: '650V SiC Midpoint Switch (Common Source Anti-Series with S3)',
              })}

              {/* Common-Source Midpoint Wire between S2 and S3 (Sources connected back-to-back) */}
              <line
                x1="225"
                y1="200"
                x2="255"
                y2="200"
                stroke={isDevActive('S2') || isDevActive('S3') ? '#f59e0b' : '#64748b'}
                strokeWidth="2.5"
              />
              <circle cx="240" cy="200" r="3" fill={isDevActive('S2') || isDevActive('S3') ? '#10b981' : '#f59e0b'} />
              <text x="240" y="184" textAnchor="middle" fill="#f59e0b" className="text-[7.5px] font-mono font-bold select-none">
                S-S Anti-Series
              </text>

              {/* S3 Horizontal MOSFET (650V rated, Source to Midpoint, Drain to Phase A, Anti-Series with S2) */}
              {renderMosfet('S3', 'S3 (650V)', 275, 200, {
                orientation: 'horizontal',
                flipHorizontal: true,
                customRating: `${(vdc / 2).toFixed(0)}V`,
                labelPos: 'bottom',
                customTech: '650V SiC Midpoint Switch (Common Source Anti-Series with S2)',
              })}

              {/* Wire from S3 to central T-node */}
              <line
                x1="295"
                y1="200"
                x2="320"
                y2="200"
                stroke={isDevActive('S2') || isDevActive('S3') ? '#10b981' : '#64748b'}
                strokeWidth="3"
                className={isDevActive('S2') || isDevActive('S3') ? 'active-current-path' : ''}
              />

              {/* Phase A Output Wire to Motor */}
              <line
                x1="320"
                y1="200"
                x2="480"
                y2="200"
                stroke="#10b981"
                strokeWidth="3.5"
                className={currentDir !== 'zero' ? 'active-current-path' : ''}
                markerEnd={currentDir === 'outward' ? 'url(#flow-arrow-emerald)' : undefined}
                markerStart={currentDir === 'inward' ? 'url(#flow-arrow-emerald)' : undefined}
              />
              <rect x="335" y="180" width="130" height="18" rx="4" fill="#090d16" stroke="#10b981" strokeWidth="1" />
              <text x="400" y="192" textAnchor="middle" fill="#10b981" className="text-[9.5px] font-mono font-bold">
                Phase A (ia = {ia.toFixed(1)} A)
              </text>

              {/* Motor Load */}
              {renderMotorLoad(480, 200)}
            </g>
          )}

          {/* ========================================================= */}
          {/* TOPOLOGY 5: OEW-VSI (Dual Inverter Open-End Winding)       */}
          {/* ========================================================= */}
          {topology === 'OEW-VSI' && (
            <g id="circuit-oew-vsi">
              {/* Inverter Bridge 1 Substation (Left) */}
              <g id="substation-bridge1">
                <rect
                  x="30"
                  y="35"
                  width="180"
                  height="330"
                  rx="10"
                  fill="rgba(15, 23, 42, 0.7)"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeDasharray="5 3"
                />
                <rect x="40" y="45" width="160" height="24" rx="5" fill="#090d16" stroke="#38bdf8" strokeWidth="1" />
                <text x="120" y="61" textAnchor="middle" fill="#38bdf8" className="text-[11px] font-mono font-bold">
                  INVERTER BRIDGE 1 (A1)
                </text>

                {/* B1 Rails */}
                <line x1="50" y1="85" x2="190" y2="85" stroke="#38bdf8" strokeWidth="2.5" />
                <line x1="50" y1="335" x2="190" y2="335" stroke="#f43f5e" strokeWidth="2.5" />

                {/* B1 Leg A Switches */}
                <line x1="120" y1="85" x2="120" y2="120" stroke={isDevActive('B1_S1') ? '#10b981' : '#475569'} strokeWidth="2.5" />
                {renderMosfet('B1_S1', 'B1-S1', 120, 140, { customRating: `${(vdc / 2).toFixed(0)}V` })}

                {/* Terminal A1 node */}
                <line x1="120" y1="160" x2="120" y2="240" stroke="#10b981" strokeWidth="3" />
                <circle cx="120" cy="200" r="5" fill="#38bdf8" stroke="#080d1a" strokeWidth="1.5" />

                {renderMosfet('B1_S2', 'B1-S2', 120, 260, { customRating: `${(vdc / 2).toFixed(0)}V` })}
                <line x1="120" y1="280" x2="120" y2="335" stroke={isDevActive('B1_S2') ? '#10b981' : '#475569'} strokeWidth="2.5" />

                {/* Output Wire from Bridge 1 to Motor Terminal A1 */}
                <line
                  x1="120"
                  y1="200"
                  x2="250"
                  y2="200"
                  stroke="#10b981"
                  strokeWidth="3.5"
                  className="active-current-path"
                  markerEnd="url(#flow-arrow-emerald)"
                />
                <circle cx="250" cy="200" r="5" fill="#38bdf8" />
                <text x="250" y="185" textAnchor="middle" fill="#38bdf8" className="text-[11px] font-mono font-bold">
                  A1
                </text>
              </g>

              {/* Center: Open-Ended Motor Stator Coil Phase A */}
              <g id="open-ended-stator-coil">
                <rect
                  x="265"
                  y="100"
                  width="210"
                  height="200"
                  rx="10"
                  fill="rgba(15, 23, 42, 0.85)"
                  stroke="#10b981"
                  strokeWidth="2"
                  className="shadow-2xl"
                />
                <rect x="275" y="110" width="190" height="26" rx="5" fill="#090d16" />
                <text x="370" y="127" textAnchor="middle" fill="#34d399" className="text-[11px] font-mono font-bold">
                  ISOLATED STATOR COIL (PHASE A)
                </text>

                {/* Connecting leads inside */}
                <line x1="250" y1="200" x2="285" y2="200" stroke="#10b981" strokeWidth="2.5" />

                {/* Coil Graphic: 5 crisp multi-arc loops */}
                <path
                  d="M 285 200 A 7 7 0 0 1 305 200 A 7 7 0 0 1 325 200 A 7 7 0 0 1 345 200 A 7 7 0 0 1 365 200 A 7 7 0 0 1 385 200 A 7 7 0 0 1 405 200 A 7 7 0 0 1 425 200 L 455 200"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                />

                {/* Coil Differential Voltage Readout */}
                <g transform="translate(370, 165)">
                  <rect x="-85" y="-12" width="170" height="24" rx="4" fill="#090d16" stroke="#38bdf8" strokeWidth="1" />
                  <text x="0" y="4" textAnchor="middle" fill="#38bdf8" className="text-[10.5px] font-mono font-bold">
                    V_coil = V_A1 - V_A2 = {(vPhaseA ?? 0).toFixed(0)} V
                  </text>
                </g>

                <text x="370" y="245" textAnchor="middle" fill="#a7f3d0" className="text-[10px] font-mono font-bold">
                  Zero Common-Mode Voltage (V_CM = 0V)
                </text>
                <text x="370" y="265" textAnchor="middle" fill="#94a3b8" className="text-[9px] font-mono">
                  Bearing Currents &amp; Shaft Voltage Eliminated
                </text>

                <line x1="455" y1="200" x2="490" y2="200" stroke="#10b981" strokeWidth="2.5" />
                <circle cx="490" cy="200" r="5" fill="#f43f5e" />
                <text x="490" y="185" textAnchor="middle" fill="#f43f5e" className="text-[11px] font-mono font-bold">
                  A2
                </text>
              </g>

              {/* Inverter Bridge 2 Substation (Right) */}
              <g id="substation-bridge2">
                <rect
                  x="530"
                  y="35"
                  width="180"
                  height="330"
                  rx="10"
                  fill="rgba(15, 23, 42, 0.7)"
                  stroke="#f43f5e"
                  strokeWidth="1.5"
                  strokeDasharray="5 3"
                />
                <rect x="540" y="45" width="160" height="24" rx="5" fill="#090d16" stroke="#f43f5e" strokeWidth="1" />
                <text x="620" y="61" textAnchor="middle" fill="#f43f5e" className="text-[11px] font-mono font-bold">
                  INVERTER BRIDGE 2 (A2)
                </text>

                {/* B2 Rails */}
                <line x1="550" y1="85" x2="690" y2="85" stroke="#38bdf8" strokeWidth="2.5" />
                <line x1="550" y1="335" x2="690" y2="335" stroke="#f43f5e" strokeWidth="2.5" />

                {/* B2 Leg A Switches */}
                <line x1="620" y1="85" x2="620" y2="120" stroke={isDevActive('B2_S1') ? '#10b981' : '#475569'} strokeWidth="2.5" />
                {renderMosfet('B2_S1', 'B2-S1', 620, 140, { customRating: `${(vdc / 2).toFixed(0)}V` })}

                {/* Terminal A2 input */}
                <line x1="620" y1="160" x2="620" y2="240" stroke="#10b981" strokeWidth="3" />
                <circle cx="620" cy="200" r="5" fill="#f43f5e" stroke="#080d1a" strokeWidth="1.5" />

                {renderMosfet('B2_S2', 'B2-S2', 620, 260, { customRating: `${(vdc / 2).toFixed(0)}V` })}
                <line x1="620" y1="280" x2="620" y2="335" stroke={isDevActive('B2_S2') ? '#10b981' : '#475569'} strokeWidth="2.5" />

                {/* Lead from Terminal A2 into Bridge 2 */}
                <line
                  x1="490"
                  y1="200"
                  x2="620"
                  y2="200"
                  stroke="#10b981"
                  strokeWidth="3.5"
                  className="active-current-path"
                />
              </g>
            </g>
          )}
          </>
        )}
        </svg>

        {/* Dynamic Semiconductor Device Inspector Card / Popover */}
        {selectedDevice && (
          <div className="absolute top-3 right-3 max-w-[280px] p-3.5 rounded-xl bg-slate-950/95 border border-emerald-500/50 shadow-2xl backdrop-blur-md text-xs font-mono animate-in fade-in zoom-in-95 duration-150 z-20">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> {selectedDevice.name}
              </span>
              <button
                onClick={() => setSelectedDevice(null)}
                className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded bg-slate-800"
              >
                ✕
              </button>
            </div>
            <div className="mt-2.5 space-y-1.5 text-slate-300 text-[11px]">
              <p>
                <span className="text-slate-400">Technology:</span>{' '}
                <span className="text-slate-200 font-sans">{selectedDevice.type}</span>
              </p>
              <p>
                <span className="text-slate-400">Class Rating:</span>{' '}
                <strong className="text-sky-300">{selectedDevice.rating}</strong>
              </p>
              <p>
                <span className="text-slate-400">State:</span>{' '}
                <strong className={selectedDevice.status === 'Conducting' ? 'text-emerald-400' : 'text-slate-400'}>
                  {selectedDevice.status}
                </strong>
              </p>
              <div className="p-2 rounded bg-slate-900 border border-slate-800 space-y-1 mt-1">
                <p>
                  <span className="text-slate-400">V_DS / V_F:</span>{' '}
                  <span className="text-amber-300 font-bold">{selectedDevice.vds}</span>
                </p>
                <p>
                  <span className="text-slate-400">Gate Driver:</span>{' '}
                  <span className="text-emerald-300 font-bold">{selectedDevice.gateVoltage}</span>
                </p>
                <p>
                  <span className="text-slate-400">P_cond (inst):</span>{' '}
                  <span className="text-white font-bold">{selectedDevice.lossEstimate}</span>
                </p>
              </div>
              <p className="text-[10px] text-slate-400 italic mt-1 font-sans">
                {selectedDevice.channelState}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Schematic Legend Bar */}
      {showLegend && (
        <div className="px-4 py-2 bg-slate-950/90 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Legend:</span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shadow-sm" />
              <span>Conducting MOSFET</span>
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500 shadow-sm" />
              <span>Body Diode (3rd Quadrant)</span>
            </span>
            {topology.includes('NPC') && (
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 shadow-sm" />
                <span>Neutral Clamp Path</span>
              </span>
            )}
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-700" />
              <span>Blocking Device</span>
            </span>
            <span className="flex items-center gap-1.5 text-sky-400">
              <span className="w-3 h-0.5 bg-emerald-400 border-t-2 border-dashed border-emerald-400" />
              <span>Active Current Loop</span>
            </span>
          </div>

          <div className="text-[10px] text-slate-400 font-sans">
            Click any semiconductor symbol for datasheet &amp; loss analysis
          </div>
        </div>
      )}

      {/* Schematic Footer: Conduction Path Description */}
      {showConduction && (
        <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 flex items-start gap-2 text-xs animate-in slide-in-from-bottom-2 duration-150">
          <ArrowRight className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-slate-200 font-sans leading-relaxed">
              <strong className="text-emerald-400 font-mono">Active Conduction State: </strong>
              {conductionInfo.description}
            </p>
            <p className="text-slate-400 text-[11px] font-mono mt-0.5">
              {conductionInfo.commutationNotes}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

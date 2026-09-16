import React, { useState } from 'react';
import { TopologyType } from '../types';
import { BookOpen, ChevronDown, ChevronUp, Cpu, Table, FileText, AlertTriangle } from 'lucide-react';

interface TheoryAccordionProps {
  topology: TopologyType;
  vdc: number;
}

export const TheoryAccordion: React.FC<TheoryAccordionProps> = ({
  topology,
  vdc,
}) => {
  const [openSection, setOpenSection] = useState<'math' | 'lspwm' | 'truthTable' | 'tradeoffs' | null>('lspwm');

  const toggle = (sec: 'math' | 'lspwm' | 'truthTable' | 'tradeoffs') => {
    setOpenSection(openSection === sec ? null : sec);
  };

  return (
    <div id="section-theory-accordion" className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl text-slate-300">
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-950/80 border-b border-slate-800">
        <BookOpen className="w-4 h-4 text-emerald-400" />
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
          Power Electronics Theory & Traction Engineering Architecture
        </h3>
      </div>

      <div className="divide-y divide-slate-800/80">
        {/* Accordion 1: Mathematical Foundations & Voltage Synthesis */}
        <div>
          <button
            onClick={() => toggle('math')}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-850 transition"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-mono font-bold text-slate-200">
                1. Mathematical Formulations: Pole Synthesis, Harmonics & Common-Mode Voltage
              </span>
            </div>
            {openSection === 'math' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {openSection === 'math' && (
            <div className="px-5 py-4 bg-slate-950/50 text-xs font-mono space-y-4 border-t border-slate-800/50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-2">
                  <h4 className="font-bold text-sky-300 text-xs uppercase">Pole & Line Voltage Synthesis</h4>
                  <p className="text-slate-300 leading-relaxed font-sans">
                    Each phase leg synthesizes a discrete pole potential relative to DC link neutral midpoint $O$:
                  </p>
                  <div className="p-2 bg-slate-950 rounded border border-slate-800 text-sky-200">
                    {topology === '2L-VSI' ? (
                      <p>V_A0(t) ∈ &#123; +V_dc / 2,  -V_dc / 2 &#125;</p>
                    ) : topology === 'OEW-VSI' ? (
                      <p>V_coil(t) = V_A1(t) - V_A2(t) ∈ &#123; +V_dc, +V_dc/2, 0, -V_dc/2, -V_dc &#125;</p>
                    ) : (
                      <p>V_A0(t) ∈ &#123; +V_dc / 2 (P),  0 (O),  -V_dc / 2 (N) &#125;</p>
                    )}
                    <p className="mt-1">Line-to-Line Voltage: V_AB(t) = V_A0(t) - V_B0(t)</p>
                  </div>
                  <p className="text-slate-400 text-[11px] font-sans">
                    For 2L, V_AB has 3 discrete levels (+Vdc, 0, -Vdc). For 3-level NPC/ANPC/TNPC, V_AB has 5 discrete voltage levels, suppressing sideband harmonic energy by &gt;60%.
                  </p>
                </div>

                <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-2">
                  <h4 className="font-bold text-amber-300 text-xs uppercase">Common-Mode Voltage (V_CM) & Motor Bearing Stress</h4>
                  <p className="text-slate-300 leading-relaxed font-sans">
                    Common-mode voltage is the instantaneous average of the 3 phase voltages:
                  </p>
                  <div className="p-2 bg-slate-950 rounded border border-slate-800 text-amber-200">
                    <p>V_CM(t) = [ V_A0(t) + V_B0(t) + V_C0(t) ] / 3</p>
                    <p className="mt-1">Motor Stator Phase Voltage: v_an(t) = V_A0(t) - V_CM(t)</p>
                  </div>
                  <p className="text-slate-400 text-[11px] font-sans">
                    High dv/dt transitions in V_CM charge the parasitic capacitive coupling between stator winding and rotor shaft (C_sr), leading to Electrical Discharge Machining (EDM) fluting across bearing race races. 3-level and dual OEW topologies cut peak V_CM excursions in half or achieve zero-CMV modulation.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-2">
                <h4 className="font-bold text-emerald-300 text-xs uppercase">Traction Load Numerical ODE Formulation</h4>
                <p className="text-slate-300 leading-relaxed font-sans">
                  The phase current $i_a(t)$ in a permanent magnet synchronous machine (PMSM) is solved dynamically via 4th-order Runge-Kutta integration:
                </p>
                <div className="p-2 bg-slate-950 rounded border border-slate-800 text-emerald-300">
                  <p>L_s · (di_a / dt) = v_an(t) - R_s · i_a(t) - E_a(t)</p>
                  <p className="mt-1">where E_a(t) = E_peak · sin(ω_0 t - φ_e) represents rotor permanent magnet back-EMF.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Accordion 2: Level-Shifted PWM (LSPWM) Carrier Principles */}
        <div>
          <button
            onClick={() => toggle('lspwm')}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-850 transition"
          >
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-mono font-bold text-slate-200">
                2. 3-Level LSPWM Carrier Dispositions: IPD, POD &amp; APOD Mechanics
              </span>
            </div>
            {openSection === 'lspwm' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {openSection === 'lspwm' && (
            <div className="px-5 py-4 bg-slate-950/50 text-xs font-mono space-y-4 border-t border-slate-800/50">
              <div className="p-3 bg-purple-950/30 rounded-lg border border-purple-800/40 text-purple-200 font-sans leading-relaxed">
                <p className="font-bold text-purple-300 font-mono mb-1">
                  Non-Overlapping Level-Shifted Carrier Architecture (m = 3 Levels):
                </p>
                In 3-level inverters, 2 triangular carriers (m - 1 = 2) of identical peak-to-peak amplitude A_c = 1.0 and frequency f_sw are arranged into contiguous, non-overlapping vertical bands meeting at the 0V Neutral Point (NP) reference:
                <ul className="list-disc list-inside mt-1.5 space-y-1 text-slate-300">
                  <li><strong className="text-amber-300 font-mono">Upper Carrier Band:</strong> spans strictly from 0.0 to +1.0 (modulates between state P and state O).</li>
                  <li><strong className="text-sky-300 font-mono">Lower Carrier Band:</strong> spans strictly from -1.0 to 0.0 (modulates between state O and state N).</li>
                  <li><strong className="text-emerald-300 font-mono">Zero Overlap:</strong> The triangles NEVER cross the 0V boundary into each other's territory.</li>
                </ul>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-400 text-xs font-mono">IPD / PD</span>
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800 font-mono">In-Phase</span>
                  </div>
                  <p className="text-slate-300 font-sans text-[11px] leading-relaxed">
                    All carrier bands are in phase (&phi;1 = &phi;2 = 0°). Both triangles rise and fall in parallel with constant vertical distance c_u(t) - c_l(t) &equiv; 1.0.
                  </p>
                  <div className="p-2 bg-slate-950 rounded text-[10px] text-emerald-300">
                    Carrier harmonic components cancel identically across line-to-line voltage V_AB = V_A - V_B, producing the <strong>lowest overall THD</strong>.
                  </div>
                </div>

                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-400 text-xs font-mono">POD</span>
                    <span className="text-[10px] bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded border border-amber-800 font-mono">Phase Opposition</span>
                  </div>
                  <p className="text-slate-300 font-sans text-[11px] leading-relaxed">
                    Carriers above zero ($0^\circ$) are in 180° phase opposition with carriers below zero ($180^\circ$). The lower carrier is mirrored across the 0V reference ($c_l(t) = -c_u(t)$).
                  </p>
                  <div className="p-2 bg-slate-950 rounded text-[10px] text-amber-300">
                    Carriers touch at 0V at period boundaries and diverge at mid-period. Carrier harmonics cluster differently in the line-to-line spectrum.
                  </div>
                </div>

                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-400 text-xs font-mono">APOD</span>
                    <span className="text-[10px] bg-purple-950 text-purple-300 px-1.5 py-0.5 rounded border border-purple-800 font-mono">Alternate Opposition</span>
                  </div>
                  <p className="text-slate-300 font-sans text-[11px] leading-relaxed">
                    Every adjacent carrier band is 180° out of phase. For 3-level (2 bands), Band 1 and Band 2 alternate in phase opposition.
                  </p>
                  <div className="p-2 bg-slate-950 rounded text-[10px] text-purple-300">
                    Carriers meet at 0V at mid-period ($u = 0.5$) and diverge at the switching boundaries, distributing switching loss symmetrically.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Accordion 3: Conduction State Truth Table */}
        <div>
          <button
            onClick={() => toggle('truthTable')}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-850 transition"
          >
            <div className="flex items-center gap-2">
              <Table className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-mono font-bold text-slate-200">
                3. Conduction Device Truth Table for {topology}
              </span>
            </div>
            {openSection === 'truthTable' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {openSection === 'truthTable' && (
            <div className="px-5 py-4 bg-slate-950/50 text-xs font-mono space-y-3 border-t border-slate-800/50 overflow-x-auto">
              {topology === '2L-VSI' && (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 px-3">State</th>
                      <th className="py-2 px-3">Pole Voltage V_A0</th>
                      <th className="py-2 px-3">Gate Signals (S1, S2)</th>
                      <th className="py-2 px-3">Conducting Device (i_a &gt; 0)</th>
                      <th className="py-2 px-3">Conducting Device (i_a &lt; 0)</th>
                      <th className="py-2 px-3">Blocking Devices</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    <tr className="hover:bg-slate-900/50">
                      <td className="py-2.5 px-3 font-bold text-emerald-400">[P]</td>
                      <td className="py-2.5 px-3">+V_dc / 2 (+{(vdc / 2).toFixed(0)}V)</td>
                      <td className="py-2.5 px-3 font-bold text-sky-300">[1, 0]</td>
                      <td className="py-2.5 px-3 text-emerald-300 font-bold">S1 (Upper MOSFET)</td>
                      <td className="py-2.5 px-3 text-cyan-300">D1 (Body Diode)</td>
                      <td className="py-2.5 px-3 text-rose-300">S2 blocks full {vdc} V</td>
                    </tr>
                    <tr className="hover:bg-slate-900/50">
                      <td className="py-2.5 px-3 font-bold text-rose-400">[N]</td>
                      <td className="py-2.5 px-3">-V_dc / 2 (-{(vdc / 2).toFixed(0)}V)</td>
                      <td className="py-2.5 px-3 font-bold text-sky-300">[0, 1]</td>
                      <td className="py-2.5 px-3 text-cyan-300">D2 (Body Diode)</td>
                      <td className="py-2.5 px-3 text-rose-300 font-bold">S2 (Lower MOSFET)</td>
                      <td className="py-2.5 px-3 text-rose-300">S1 blocks full {vdc} V</td>
                    </tr>
                  </tbody>
                </table>
              )}

              {topology === '3L-NPC' && (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 px-3">State</th>
                      <th className="py-2 px-3">Pole Voltage V_A0</th>
                      <th className="py-2 px-3">Gates [S1, S2, S3, S4]</th>
                      <th className="py-2 px-3">Path (i_a &gt; 0)</th>
                      <th className="py-2 px-3">Path (i_a &lt; 0)</th>
                      <th className="py-2 px-3">Blocking Voltage per Switch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    <tr className="hover:bg-slate-900/50">
                      <td className="py-2.5 px-3 font-bold text-emerald-400">[P]</td>
                      <td className="py-2.5 px-3">+V_dc / 2 (+{(vdc / 2).toFixed(0)}V)</td>
                      <td className="py-2.5 px-3 font-bold text-sky-300">[1, 1, 0, 0]</td>
                      <td className="py-2.5 px-3 text-emerald-300 font-bold">S1, S2</td>
                      <td className="py-2.5 px-3 text-cyan-300">D1, D2</td>
                      <td className="py-2.5 px-3 text-slate-300">S3, S4 block {vdc / 2} V</td>
                    </tr>
                    <tr className="hover:bg-slate-900/50">
                      <td className="py-2.5 px-3 font-bold text-amber-400">[O]</td>
                      <td className="py-2.5 px-3">0 V (Neutral Midpoint)</td>
                      <td className="py-2.5 px-3 font-bold text-sky-300">[0, 1, 1, 0]</td>
                      <td className="py-2.5 px-3 text-amber-300 font-bold">D_clamp1, S2</td>
                      <td className="py-2.5 px-3 text-amber-300 font-bold">S3, D_clamp2</td>
                      <td className="py-2.5 px-3 text-slate-300">S1, S4 block {vdc / 2} V</td>
                    </tr>
                    <tr className="hover:bg-slate-900/50">
                      <td className="py-2.5 px-3 font-bold text-rose-400">[N]</td>
                      <td className="py-2.5 px-3">-V_dc / 2 (-{(vdc / 2).toFixed(0)}V)</td>
                      <td className="py-2.5 px-3 font-bold text-sky-300">[0, 0, 1, 1]</td>
                      <td className="py-2.5 px-3 text-cyan-300">D3, D4</td>
                      <td className="py-2.5 px-3 text-rose-300 font-bold">S3, S4</td>
                      <td className="py-2.5 px-3 text-slate-300">S1, S2 block {vdc / 2} V</td>
                    </tr>
                  </tbody>
                </table>
              )}

              {topology === '3L-ANPC' && (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 px-3">State</th>
                      <th className="py-2 px-3">Active Clamping Switches</th>
                      <th className="py-2 px-3">Conduction (i_a &gt; 0)</th>
                      <th className="py-2 px-3">Conduction (i_a &lt; 0)</th>
                      <th className="py-2 px-3">Thermal Balancing Advantage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    <tr className="hover:bg-slate-900/50">
                      <td className="py-2.5 px-3 font-bold text-emerald-400">[P]</td>
                      <td className="py-2.5 px-3 text-slate-400">S5, S6 inactive</td>
                      <td className="py-2.5 px-3 text-emerald-300">S1, S2</td>
                      <td className="py-2.5 px-3 text-cyan-300">D1, D2</td>
                      <td className="py-2.5 px-3 text-slate-300">Standard upper leg path</td>
                    </tr>
                    <tr className="hover:bg-slate-900/50">
                      <td className="py-2.5 px-3 font-bold text-amber-400">[O] (Active)</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-bold">S5 or S6 gated ON</td>
                      <td className="py-2.5 px-3 text-amber-300 font-bold">S5_active + S2 (or S1+S5)</td>
                      <td className="py-2.5 px-3 text-amber-300 font-bold">S3 + S6_active</td>
                      <td className="py-2.5 px-3 text-emerald-300 font-bold">Even loss sharing across all 6 switches</td>
                    </tr>
                    <tr className="hover:bg-slate-900/50">
                      <td className="py-2.5 px-3 font-bold text-rose-400">[N]</td>
                      <td className="py-2.5 px-3 text-slate-400">S5, S6 inactive</td>
                      <td className="py-2.5 px-3 text-cyan-300">D3, D4</td>
                      <td className="py-2.5 px-3 text-rose-300">S3, S4</td>
                      <td className="py-2.5 px-3 text-slate-300">Standard lower leg path</td>
                    </tr>
                  </tbody>
                </table>
              )}

              {topology === '3L-TNPC' && (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 px-3">State</th>
                      <th className="py-2 px-3">Pole Voltage V_A0</th>
                      <th className="py-2 px-3">Main Switches (1200V)</th>
                      <th className="py-2 px-3">Auxiliary Midpoint Leg (650V)</th>
                      <th className="py-2 px-3">Devices in Path</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    <tr className="hover:bg-slate-900/50">
                      <td className="py-2.5 px-3 font-bold text-emerald-400">[P]</td>
                      <td className="py-2.5 px-3">+V_dc / 2</td>
                      <td className="py-2.5 px-3 text-emerald-300 font-bold">S1 ON (S4 OFF)</td>
                      <td className="py-2.5 px-3 text-slate-500">S2, S3 OFF</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-400">Only 1 device (Lowest conduction loss!)</td>
                    </tr>
                    <tr className="hover:bg-slate-900/50">
                      <td className="py-2.5 px-3 font-bold text-amber-400">[O]</td>
                      <td className="py-2.5 px-3">0 V</td>
                      <td className="py-2.5 px-3 text-slate-500">S1 OFF, S4 OFF</td>
                      <td className="py-2.5 px-3 text-amber-300 font-bold">S2, S3 ON (Bidirectional midpoint)</td>
                      <td className="py-2.5 px-3 text-slate-300">2 devices in series (S2 + D3 or S3 + D2)</td>
                    </tr>
                    <tr className="hover:bg-slate-900/50">
                      <td className="py-2.5 px-3 font-bold text-rose-400">[N]</td>
                      <td className="py-2.5 px-3">-V_dc / 2</td>
                      <td className="py-2.5 px-3 text-rose-300 font-bold">S4 ON (S1 OFF)</td>
                      <td className="py-2.5 px-3 text-slate-500">S2, S3 OFF</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-400">Only 1 device in series</td>
                    </tr>
                  </tbody>
                </table>
              )}

              {topology === 'OEW-VSI' && (
                <div className="p-3 bg-slate-900 rounded-lg space-y-2">
                  <p className="text-slate-300 font-sans">
                    Dual-Inverter Open-End Winding operates by driving both isolated terminals of each stator coil independently with two 2-level inverters (Bridge 1: $A_1$, Bridge 2: $A_2$).
                  </p>
                  <p className="text-slate-400 font-sans text-[11px]">
                    Differential coil voltage $V_{'{coil,A}'} = V_{'{A1}'} - V_{'{A2}'}$. When modulated in complementary zero-sequence opposition, common-mode voltage is cancelled, eliminating high-frequency bearing currents entirely while doubling the effective voltage resolution (synthesizing up to 9 line voltage levels!).
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Accordion 3: EV Traction Engineering Trade-Offs */}
        <div>
          <button
            onClick={() => toggle('tradeoffs')}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-850 transition"
          >
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-mono font-bold text-slate-200">
                4. EV Traction Drive Engineering Trade-offs: SiC Area, dv/dt, Bearing Currents & Filter Mass
              </span>
            </div>
            {openSection === 'tradeoffs' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {openSection === 'tradeoffs' && (
            <div className="px-5 py-4 bg-slate-950/50 text-xs font-sans space-y-4 border-t border-slate-800/50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-1.5">
                  <h4 className="font-mono font-bold text-purple-300 text-xs">
                    Motor Bearing EDM Breakdown & dv/dt
                  </h4>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    Fast switching SiC MOSFETs operate with dv/dt slopes of 20 to 50 V/ns. In 800V 2L-VSI, every pulse applies an 800V step, inducing high Bearing Voltage Ratio (BVR = 5-10%). When this exceeds the 15-30V breakdown threshold of the oil lubricant film, electrical discharge machining creates micro-pits on balls and raceways. 3L topologies halve the voltage step to 400V, keeping bearing currents safely below damaging thresholds.
                  </p>
                </div>

                <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-1.5">
                  <h4 className="font-mono font-bold text-emerald-300 text-xs">
                    Silicon Carbide (SiC) Die Area &amp; Figure-of-Merit
                  </h4>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    Specific on-resistance scales with voltage breakdown: R_sp ∝ (V_BD)^2.5. A 650V SiC device achieves ~3x lower area-specific resistance than a 1200V device. In 3L-NPC, each switch only blocks 400V, enabling 650V rated dies. Although 3L uses twice as many dies, their lower switching energy (E_sw ∝ V^1.4) enables doubling the switching frequency from 10 kHz to 20-30 kHz.
                  </p>
                </div>

                <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-1.5">
                  <h4 className="font-mono font-bold text-sky-300 text-xs">
                    Harmonic Filtering &amp; Motor Core Loss
                  </h4>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    Higher level inverters drastically decrease high-frequency current ripple ΔI_pp ≈ V_dc / (8 · L_s · f_sw). This lowers eddy-current and hysteresis core losses inside the stator laminations, reducing traction motor cooling demands and extending EV driving range by 2% to 4% under WLTP driving cycles.
                  </p>
                </div>

                <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-1.5">
                  <h4 className="font-mono font-bold text-amber-300 text-xs">
                    Topology Selection Guidelines for EV Applications
                  </h4>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    • <strong>2L-VSI:</strong> Baseline standard, lowest gate-driver complexity, ideal for 400V battery architectures.<br />
                    • <strong>3L-TNPC:</strong> Preferred for 800V high-speed highway cruising where $m_a \approx 1$ (low conduction loss).<br />
                    • <strong>3L-ANPC:</strong> Best for high-reliability EV drives and low-speed high-torque hill climbing (solves thermal bottleneck).<br />
                    • <strong>OEW-VSI:</strong> High-performance dual powertrain with integrated onboard charging and fault tolerance.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

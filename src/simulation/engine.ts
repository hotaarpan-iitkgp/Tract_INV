import {
  AnalyticalMetrics,
  CarrierDisposition,
  ConductionPathInfo,
  HarmonicComponent,
  InverterParameters,
  SwitchState,
  TopologyType,
  WaveformPoint,
  WorkingPrincipleStage,
} from '../types';

/**
 * Generate instantaneous reference signals with selected modulation scheme
 */
export function computeReferences(
  theta: number,
  ma: number,
  scheme: 'SPWM' | 'THIPWM' | 'DPWM1'
): { vrefA: number; vrefB: number; vrefC: number } {
  // Pure fundamental sinusoidal references
  const vA = ma * Math.sin(theta);
  const vB = ma * Math.sin(theta - (2 * Math.PI) / 3);
  const vC = ma * Math.sin(theta + (2 * Math.PI) / 3);

  if (scheme === 'SPWM') {
    return {
      vrefA: Math.max(-1.15, Math.min(1.15, vA)),
      vrefB: Math.max(-1.15, Math.min(1.15, vB)),
      vrefC: Math.max(-1.15, Math.min(1.15, vC)),
    };
  }

  if (scheme === 'THIPWM') {
    // Min-Max injection (equivalent to optimal Space Vector PWM zero-sequence injection)
    const vMax = Math.max(vA, vB, vC);
    const vMin = Math.min(vA, vB, vC);
    const vOffset = -0.5 * (vMax + vMin);

    return {
      vrefA: Math.max(-1.15, Math.min(1.15, vA + vOffset)),
      vrefB: Math.max(-1.15, Math.min(1.15, vB + vOffset)),
      vrefC: Math.max(-1.15, Math.min(1.15, vC + vOffset)),
    };
  }

  // DPWM1 (Discontinuous PWM 60-degree clamped)
  // Identifies the phase with max absolute amplitude and clamps it to +1 or -1
  const vMax = Math.max(vA, vB, vC);
  const vMin = Math.min(vA, vB, vC);
  let vOffset = 0;
  if (Math.abs(vMax) >= Math.abs(vMin)) {
    vOffset = 1.0 - vMax;
  } else {
    vOffset = -1.0 - vMin;
  }

  return {
    vrefA: Math.max(-1.15, Math.min(1.15, vA + vOffset)),
    vrefB: Math.max(-1.15, Math.min(1.15, vB + vOffset)),
    vrefC: Math.max(-1.15, Math.min(1.15, vC + vOffset)),
  };
}

/**
 * Generate triangular carrier waveforms for 2-Level and 3-Level Level-Shifted PWM (LSPWM)
 * 
 * Crucial Power Electronics Principles for 3-Level LSPWM:
 * - Upper Carrier (band [0, 1]): Spans from 0.0 to +1.0. Peak = +1.0, Trough = 0.0.
 * - Lower Carrier (band [-1, 0]): Spans from -1.0 to 0.0. Peak = 0.0, Trough = -1.0.
 * - ZERO OVERLAP: The upper triangle NEVER penetrates below 0, and the lower triangle
 *   NEVER penetrates above 0. The neutral boundary is 0 V (DC-link midpoint NP).
 * 
 * Carrier Dispositions:
 * 1. IPD (In-Phase Disposition, also called PD):
 *    All carrier triangles are strictly in phase. Both triangles rise and fall simultaneously.
 *    c_upper(t) in [0, 1]
 *    c_lower(t) = c_upper(t) - 1 in [-1, 0]
 *    Constant vertical distance = 1.0. Lowest output line-to-line THD.
 * 
 * 2. POD (Phase Opposition Disposition):
 *    Carriers above zero are 180° out of phase with carriers below zero.
 *    The lower carrier is symmetrically mirrored across the zero baseline (0 V).
 *    c_upper(t) in [0, 1]
 *    c_lower(t) = -c_upper(t) in [-1, 0]
 *    At carrier period boundaries (u=0, 1), both carriers meet at 0. At mid-period (u=0.5),
 *    c_upper peaks at +1 while c_lower bottoms at -1.
 * 
 * 3. APOD (Alternative Phase Opposition Disposition):
 *    Adjacent carrier bands alternate in phase by 180°.
 *    Upper carrier: starts at +1 and reaches 0 at mid-period.
 *    Lower carrier: starts at -1 and reaches 0 at mid-period.
 *    c_upper(t) = 2*|u - 0.5| in [0, 1]
 *    c_lower(t) = -2*|u - 0.5| in [-1, 0]
 *    Both carriers meet at 0 at mid-period and diverge at period boundaries.
 */
export function computeCarriers(
  t: number,
  fsw: number,
  disposition: CarrierDisposition = 'IPD'
): { carrierSingle: number; carrierUpper: number; carrierLower: number } {
  // Normalized position inside carrier period [0, 1)
  const normT = ((t * fsw) % 1 + 1) % 1;

  // Single carrier for 2-Level VSI: symmetrical triangle from -1 to +1
  // At 0: -1, at 0.5: +1, at 1.0: -1
  const carrierSingle = 1 - 4 * Math.abs(normT - 0.5);

  let carrierUpper: number;
  let carrierLower: number;

  if (disposition === 'PSPWM') {
    // Phase-Shifted PWM (PS-PWM):
    // Carrier 1 (upper) and Carrier 2 (lower) both span [-1, +1] with 180° phase displacement (Tsw / 2)
    carrierUpper = carrierSingle; // [ -1, +1 ]
    const normT2 = (normT + 0.5) % 1;
    carrierLower = 1 - 4 * Math.abs(normT2 - 0.5); // [ -1, +1 ]
  } else if (disposition === 'POD') {
    // Phase Opposition Disposition:
    // Upper carrier rises from 0 to +1 at mid-period, returns to 0
    carrierUpper = 1 - 2 * Math.abs(normT - 0.5); // strictly [0, 1]
    // Lower carrier is 180° out of phase, mirrored across 0V line:
    carrierLower = -carrierUpper; // strictly [-1, 0]
  } else if (disposition === 'APOD') {
    // Alternative Phase Opposition Disposition:
    carrierUpper = 2 * Math.abs(normT - 0.5); // strictly [0, 1]
    carrierLower = -2 * Math.abs(normT - 0.5); // strictly [-1, 0]
  } else {
    // IPD / PD (In-Phase Disposition):
    // Both carriers are strictly in phase and move in parallel.
    carrierUpper = 1 - 2 * Math.abs(normT - 0.5); // strictly [0, 1]
    carrierLower = carrierUpper - 1; // strictly [-1, 0]
  }

  return {
    carrierSingle,
    carrierUpper,
    carrierLower,
  };
}

/**
 * Determine discrete switching pole state for 2L, 3L, or OEW
 */
export function evaluateSwitchState(
  topology: TopologyType,
  vref: number,
  carrierSingle: number,
  carrierUpper: number,
  carrierLower: number,
  disposition: CarrierDisposition = 'IPD'
): { state: SwitchState; poleVoltageFactor: number; oewBridge2State?: 'P' | 'N' } {
  if (topology === '2L-VSI') {
    if (vref >= carrierSingle) {
      return { state: 'P', poleVoltageFactor: 0.5 };
    } else {
      return { state: 'N', poleVoltageFactor: -0.5 };
    }
  }

  if (topology === 'OEW-VSI') {
    // Dual Inverter: Inverter 1 modulated with vref/2, Inverter 2 modulated with -vref/2
    const vref1 = vref / 2;
    const vref2 = -vref / 2;
    const carr2 = disposition === 'PSPWM' ? carrierLower : -carrierSingle;
    const b1State: SwitchState = vref1 >= carrierSingle ? 'P' : 'N';
    const b2State: 'P' | 'N' = vref2 >= carr2 ? 'P' : 'N';
    
    // Differential pole factor across the open-end winding
    const factor1 = b1State === 'P' ? 0.5 : -0.5;
    const factor2 = b2State === 'P' ? 0.5 : -0.5;
    const diffFactor = factor1 - factor2; // can be +1, 0, -1

    return {
      state: diffFactor > 0.2 ? 'P' : diffFactor < -0.2 ? 'N' : 'O',
      poleVoltageFactor: factor1, // Inverter 1 pole
      oewBridge2State: b2State,
    };
  }

  // 3-Level topologies (3L-NPC, 3L-ANPC, 3L-TNPC)
  if (disposition === 'PSPWM') {
    // Phase-Shifted PWM: Both carriers span [-1, +1] with 180° phase shift
    const s1 = vref >= carrierUpper ? 1 : 0;
    const s2 = vref >= carrierLower ? 1 : 0;
    const sSum = s1 + s2;
    if (sSum === 2) {
      return { state: 'P', poleVoltageFactor: 0.5 };
    } else if (sSum === 1) {
      return { state: 'O', poleVoltageFactor: 0.0 };
    } else {
      return { state: 'N', poleVoltageFactor: -0.5 };
    }
  }

  // Level-Shifted PWM (IPD, POD, APOD)
  if (vref >= carrierUpper) {
    return { state: 'P', poleVoltageFactor: 0.5 };
  } else if (vref <= carrierLower) {
    return { state: 'N', poleVoltageFactor: -0.5 };
  } else {
    return { state: 'O', poleVoltageFactor: 0.0 };
  }
}

/**
 * Full electrical simulation: generates time samples and solves load current ODE
 */
export function simulateCycle(
  params: InverterParameters,
  topology: TopologyType,
  numCycles = 2,
  samplePoints = 3200
): { points: WaveformPoint[]; metrics: AnalyticalMetrics } {
  const { vdc, ma, f0, fsw, modulation, carrierDisposition, ls, rs, epeak } = params;
  const T0 = 1 / f0;
  const totalDuration = numCycles * T0;
  // Ensure sufficient sampling density for high carrier frequencies (at least ~12 samples per carrier period)
  const requiredPoints = Math.max(samplePoints, Math.min(8000, Math.round(numCycles * (fsw / f0) * 12)));
  const actualPoints = requiredPoints;
  const dt = totalDuration / actualPoints;
  const omega = 2 * Math.PI * f0;
  const L = ls * 1e-3; // convert mH to H
  const R = rs;        // Ohms
  const backEmfPeak = epeak;
  const backEmfPhaseOffset = 0.35; // rad (current power factor angle offset)

  // Step 1: Pre-solve initial current to eliminate startup transient
  // Approximate fundamental phase voltage RMS and load impedance
  const V1_peak = (ma * vdc) / 2; // fundamental peak
  const Z_mag = Math.sqrt(R * R + (omega * L) * (omega * L));
  const Z_phi = Math.atan2(omega * L, R);
  // Initial current guess at t = 0
  let ia = (V1_peak * Math.sin(-Z_phi) - backEmfPeak * Math.sin(-backEmfPhaseOffset)) / Math.max(0.5, Z_mag);

  // Pre-run 1 fundamental cycle to reach steady-state periodic solution
  const preSteps = 600;
  const preDt = T0 / preSteps;
  for (let s = 0; s < preSteps; s++) {
    const tPre = s * preDt;
    const thetaPre = omega * tPre;
    const refsPre = computeReferences(thetaPre, ma, modulation);
    const carrPre = computeCarriers(tPre, fsw, carrierDisposition);

    const stAPre = evaluateSwitchState(topology, refsPre.vrefA, carrPre.carrierSingle, carrPre.carrierUpper, carrPre.carrierLower, carrierDisposition);
    const stBPre = evaluateSwitchState(topology, refsPre.vrefB, carrPre.carrierSingle, carrPre.carrierUpper, carrPre.carrierLower, carrierDisposition);
    const stCPre = evaluateSwitchState(topology, refsPre.vrefC, carrPre.carrierSingle, carrPre.carrierUpper, carrPre.carrierLower, carrierDisposition);

    const vanPre = stAPre.poleVoltageFactor * vdc;
    const vbnPre = stBPre.poleVoltageFactor * vdc;
    const vcnPre = stCPre.poleVoltageFactor * vdc;
    const vcmPre = (vanPre + vbnPre + vcnPre) / 3;
    const vPhasePre = vanPre - vcmPre;
    const ePre = backEmfPeak * Math.sin(thetaPre - backEmfPhaseOffset);

    // Euler/RK2 step
    const dia_dt = (vPhasePre - R * ia - ePre) / L;
    ia += dia_dt * preDt;
  }

  // Step 2: Simulate the full waveform points
  const points: WaveformPoint[] = new Array(actualPoints);

  let sumVabSq = 0;
  let maxVcm = -Infinity;
  let minVcm = Infinity;
  let sumVcmSq = 0;
  let sumIaSq = 0;
  let peakDvDtStep = 0;
  let prevVab = 0;

  for (let i = 0; i < actualPoints; i++) {
    const t = i * dt;
    const theta = omega * t;
    const phaseDeg = (theta * (180 / Math.PI)) % 360;

    const refs = computeReferences(theta, ma, modulation);
    const carriers = computeCarriers(t, fsw, carrierDisposition);

    const stateAInfo = evaluateSwitchState(topology, refs.vrefA, carriers.carrierSingle, carriers.carrierUpper, carriers.carrierLower, carrierDisposition);
    const stateBInfo = evaluateSwitchState(topology, refs.vrefB, carriers.carrierSingle, carriers.carrierUpper, carriers.carrierLower, carrierDisposition);
    const stateCInfo = evaluateSwitchState(topology, refs.vrefC, carriers.carrierSingle, carriers.carrierUpper, carriers.carrierLower, carrierDisposition);

    let van = stateAInfo.poleVoltageFactor * vdc;
    let vbn = stateBInfo.poleVoltageFactor * vdc;
    let vcn = stateCInfo.poleVoltageFactor * vdc;

    let vPhaseA = van;
    let vab = van - vbn;

    if (topology === 'OEW-VSI') {
      // In OEW-VSI, the phase coil voltage is the differential between Inverter 1 pole and Inverter 2 pole
      const inv2FactorA = stateAInfo.oewBridge2State === 'P' ? 0.5 : -0.5;
      const inv2FactorB = stateBInfo.oewBridge2State === 'P' ? 0.5 : -0.5;
      const inv2Van = inv2FactorA * vdc;
      const inv2Vbn = inv2FactorB * vdc;

      vPhaseA = van - inv2Van; // Voltage directly across phase A winding
      vab = vPhaseA - (vbn - inv2Vbn); // Line-to-line motor terminal difference
    }

    const vcm = (van + vbn + vcn) / 3;
    const loadPhaseVoltage = topology === 'OEW-VSI' ? vPhaseA : van - vcm;
    const ea = backEmfPeak * Math.sin(theta - backEmfPhaseOffset);

    // 4th-order Runge-Kutta numerical integration for motor current
    const fDeriv = (curr: number) => (loadPhaseVoltage - R * curr - ea) / L;
    const k1 = fDeriv(ia);
    const k2 = fDeriv(ia + 0.5 * dt * k1);
    const k3 = fDeriv(ia + 0.5 * dt * k2);
    const k4 = fDeriv(ia + dt * k3);
    ia = ia + (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);

    // Record sample
    points[i] = {
      t,
      phaseDeg,
      vrefA: refs.vrefA,
      vrefB: refs.vrefB,
      vrefC: refs.vrefC,
      carrierUpper: carriers.carrierUpper,
      carrierLower: carriers.carrierLower,
      carrierSingle: carriers.carrierSingle,
      van,
      vbn,
      vcn,
      vab,
      vcm,
      ia,
      ea,
      stateA: stateAInfo.state,
      stateB: stateBInfo.state,
      stateC: stateCInfo.state,
      bridge2StateA: stateAInfo.oewBridge2State,
      vPhaseA,
    };

    // Tracking stats
    sumVabSq += vab * vab;
    sumVcmSq += vcm * vcm;
    sumIaSq += ia * ia;
    if (vcm > maxVcm) maxVcm = vcm;
    if (vcm < minVcm) minVcm = vcm;

    if (i > 0) {
      const step = Math.abs(vab - prevVab);
      if (step > peakDvDtStep) peakDvDtStep = step;
    }
    prevVab = vab;
  }

  // Step 3: Harmonic analysis via Discrete Fourier Transform (DFT) up to 50th harmonic on 1 complete fundamental cycle
  const pointsPerCycle = Math.floor(actualPoints / numCycles);
  const harmonics: HarmonicComponent[] = [];
  let sumHarmonicsSq = 0;
  let vFundamentalRms = 0;

  for (let h = 1; h <= 50; h++) {
    let sumCos = 0;
    let sumSin = 0;
    for (let k = 0; k < pointsPerCycle; k++) {
      const angle = (2 * Math.PI * h * k) / pointsPerCycle;
      sumCos += points[k].vab * Math.cos(angle);
      sumSin += points[k].vab * Math.sin(angle);
    }
    const an = (2 / pointsPerCycle) * sumCos;
    const bn = (2 / pointsPerCycle) * sumSin;
    const amplitude = Math.sqrt(an * an + bn * bn);
    const rms = amplitude / Math.SQRT2;

    if (h === 1) {
      vFundamentalRms = rms;
    } else {
      sumHarmonicsSq += rms * rms;
    }

    harmonics.push({
      order: h,
      frequency: h * f0,
      amplitude: rms,
      relativePct: vFundamentalRms > 0 ? (rms / vFundamentalRms) * 100 : 0,
    });
  }

  // Calculate THD
  const thdPercent = vFundamentalRms > 0 ? (Math.sqrt(sumHarmonicsSq) / vFundamentalRms) * 100 : 0;
  const vabRms = Math.sqrt(sumVabSq / actualPoints);
  const vcmRms = Math.sqrt(sumVcmSq / actualPoints);
  const vcmPeakToPeak = maxVcm - minVcm;
  const iaRms = Math.sqrt(sumIaSq / actualPoints);

  // dv/dt slope calculation (typical 20-40 V/ns for SiC MOSFETs)
  const dvDtSlopeMax = peakDvDtStep > 0 ? peakDvDtStep / 22 : 0; // ~22ns rise time

  // Step 4: Loss modeling (Conduction vs. Switching Loss)
  // Physics-based normalized loss formulation:
  // Conduction loss: Pcond = 3 * (I_rms^2 * R_on_eq + V_th * I_avg)
  // Switching loss: Psw = 6 * fsw * E_sw_norm * (V_comm / V_ref)^alpha * (I_rms / I_ref)
  let devicesInPath = 1;
  let switchBlockingRatio = 1.0;
  let deviceRon = 0.035; // 35 mOhm for 1200V SiC
  let isANPC = topology === '3L-ANPC';

  if (topology === '2L-VSI') {
    devicesInPath = 1; // 1 switch or 1 diode per phase leg
    switchBlockingRatio = 1.0; // withstands full Vdc
    deviceRon = 0.032;
  } else if (topology === '3L-NPC' || topology === '3L-ANPC') {
    devicesInPath = 2; // 2 switches in series (e.g. S1+S2 or S2+Dclamp)
    switchBlockingRatio = 0.5; // withstands Vdc/2 (uses 650V SiC with lower Ron ~16 mOhm)
    deviceRon = 0.016;
  } else if (topology === '3L-TNPC') {
    devicesInPath = 1.3; // State P/N: 1 switch (1200V); State O: 2 switches (650V)
    switchBlockingRatio = 0.75;
    deviceRon = 0.024;
  } else if (topology === 'OEW-VSI') {
    devicesInPath = 2; // 2 bridges, 1 switch per terminal
    switchBlockingRatio = 0.5;
    deviceRon = 0.018;
  }

  // Conduction loss across 3 phases
  const conductionLossW = 3 * (iaRms * iaRms * (devicesInPath * deviceRon) + 0.9 * iaRms);

  // Switching energy scales with (V_blocking)^1.4 and fsw
  const eSwBase = 0.00035; // Joules per commutation at 800V, 50A
  const voltageScaling = Math.pow(switchBlockingRatio * (vdc / 800), 1.4);
  const currentScaling = Math.max(0.1, iaRms / 40);
  const dpwmFactor = modulation === 'DPWM1' ? 0.67 : 1.0;

  // 3L topologies have 12 or 18 switches but commutate at Vdc/2, cutting switching energy drastically
  const numCommutations = topology === 'OEW-VSI' ? 12 : topology === '2L-VSI' ? 6 : 6;
  const switchingLossW = numCommutations * fsw * eSwBase * voltageScaling * currentScaling * dpwmFactor;

  const totalLossW = conductionLossW + switchingLossW;
  const conductionLossPct = totalLossW > 0 ? (conductionLossW / totalLossW) * 100 : 50;
  const switchingLossPct = totalLossW > 0 ? (switchingLossW / totalLossW) * 100 : 50;

  // Approximate output power and efficiency
  const pOut = Math.max(100, 3 * vFundamentalRms * iaRms * 0.88);
  const estimatedEfficiency = Math.min(99.5, Math.max(90.0, (pOut / (pOut + totalLossW)) * 100));

  // DC link capacitor ripple current stress (approximate RMS ripple)
  const dcLinkCapRippleCurrentA = iaRms * Math.sqrt(Math.max(0.01, 2 * ma * ((Math.sqrt(3) / (4 * Math.PI)) + (8 * Math.sqrt(3) / (3 * Math.PI * Math.PI)) * ma * 0.7 - Math.pow(ma * 0.8, 2))));

  // Neutral point stress index (0 to 100)
  let neutralStressIndex = 0;
  if (topology === '3L-NPC' || topology === '3L-ANPC' || topology === '3L-TNPC') {
    // 3L topologies experience midpoint capacitor voltage deviation stress
    // ANPC mitigates zero-state stress by 40%
    const baseStress = Math.min(100, (iaRms * 0.8) / Math.max(1, f0 * 0.05) * (1 - ma * 0.4));
    neutralStressIndex = isANPC ? baseStress * 0.55 : baseStress;
  }

  return {
    points,
    metrics: {
      vabRms,
      vabFundamentalRms: vFundamentalRms,
      thdPercent,
      peakDvDtStep: topology === '2L-VSI' ? vdc : vdc / 2,
      dvDtSlopeMax,
      vcmPeakToPeak,
      vcmRms,
      iaRms,
      iaThdPercent: Math.max(0.4, thdPercent / 12),
      switchingLossW,
      conductionLossW,
      totalLossW,
      switchingLossPct,
      conductionLossPct,
      estimatedEfficiency,
      dcLinkCapRippleCurrentA,
      neutralStressIndex: Math.round(neutralStressIndex),
      harmonics,
    },
  };
}

/**
 * Working Principle Simulation:
 * Single fundamental cycle (0° to 360°) with square-wave operation (no PWM).
 * - 2L-VSI has exactly 2 levels in pole voltage (+Vdc/2 and -Vdc/2) with 180° conduction.
 * - 3L topologies (3L-NPC, 3L-ANPC, 3L-TNPC) have exactly 3 levels (+Vdc/2, 0V, -Vdc/2) with quasi-square stepped operation.
 * - OEW-VSI has 3 levels (+Vdc, 0V, -Vdc) differential winding voltage created by two 2-level bridges.
 */
export function simulateWorkingPrincipleCycle(
  params: InverterParameters,
  topology: TopologyType,
  samplePoints = 1200
): { points: WaveformPoint[]; metrics: AnalyticalMetrics; stages: WorkingPrincipleStage[] } {
  const { vdc, f0, ls, rs, epeak } = params;
  const conductionAngleDeg = params.conductionAngleDeg || 120; // 120° standard quasi-square wave
  const T0 = 1 / f0;
  const dt = T0 / samplePoints;
  const omega = 2 * Math.PI * f0;
  const L = ls * 1e-3;
  const R = rs;
  const backEmfPeak = epeak;
  const backEmfPhaseOffset = 0.35; // rad

  // Helper to evaluate pole factor (+0.5, 0, -0.5) for a given phase angle (deg)
  const getPoleFactor = (degNorm: number): { factor: number; state: SwitchState; oewB2State?: 'P' | 'N'; oewCoilFactor?: number } => {
    const deg = ((degNorm % 360) + 360) % 360;

    if (topology === '2L-VSI') {
      // 180° square wave: exactly 2 levels: +Vdc/2 (P) and -Vdc/2 (N)
      if (deg < 180) {
        return { factor: 0.5, state: 'P' };
      } else {
        return { factor: -0.5, state: 'N' };
      }
    }

    if (topology === 'OEW-VSI') {
      // Dual Inverter: Bridge 1 operates in 180° square wave
      // Bridge 2 operates with 60° phase shift to produce 3 levels across open stator coil
      const b1State: 'P' | 'N' = deg < 180 ? 'P' : 'N';
      const b1Factor = b1State === 'P' ? 0.5 : -0.5;

      const degB2 = (deg - 60 + 360) % 360;
      const b2State: 'P' | 'N' = degB2 < 180 ? 'P' : 'N';
      const b2Factor = b2State === 'P' ? 0.5 : -0.5;

      const diff = b1Factor - b2Factor; // can be +1.0, 0, -1.0
      const state: SwitchState = diff > 0.1 ? 'P' : diff < -0.1 ? 'N' : 'O';

      return {
        factor: b1Factor,
        state,
        oewB2State: b2State,
        oewCoilFactor: diff,
      };
    }

    // 3-Level Topologies (3L-NPC, 3L-ANPC, 3L-TNPC)
    // Symmetrical 3-level quasi-square wave with conduction angle sigma (default 120°)
    // Pulse dead-band delta on each side: delta = (180 - sigma) / 2
    const delta = Math.max(5, (180 - conductionAngleDeg) / 2); // e.g. (180 - 120)/2 = 30°
    if (deg >= delta && deg < 180 - delta) {
      return { factor: 0.5, state: 'P' };
    } else if (deg >= 180 + delta && deg < 360 - delta) {
      return { factor: -0.5, state: 'N' };
    } else {
      return { factor: 0.0, state: 'O' };
    }
  };

  // Pre-solve steady state periodic initial condition ia(0)
  // Simulate 2 fundamental cycles so current reaches true periodic equilibrium: ia(0) = ia(T0)
  let ia = 0;
  const preSteps = 1200;
  const preDt = T0 / preSteps;
  for (let cycle = 0; cycle < 2; cycle++) {
    for (let s = 0; s < preSteps; s++) {
      const t = s * preDt;
      const theta = omega * t;
      const deg = (s / preSteps) * 360;

      const pA = getPoleFactor(deg);
      const pB = getPoleFactor(deg - 120);
      const pC = getPoleFactor(deg + 120);

      const van = pA.factor * vdc;
      const vbn = pB.factor * vdc;
      const vcn = pC.factor * vdc;
      const vcm = (van + vbn + vcn) / 3;

      let vLoadA = van - vcm;
      if (topology === 'OEW-VSI' && pA.oewCoilFactor !== undefined) {
        vLoadA = pA.oewCoilFactor * vdc;
      }

      const ea = backEmfPeak * Math.sin(theta - backEmfPhaseOffset);
      const dia_dt = (vLoadA - R * ia - ea) / L;
      ia += dia_dt * preDt;
    }
  }

  // Now simulate the single cycle with samplePoints
  const points: WaveformPoint[] = new Array(samplePoints);
  let sumVabSq = 0;
  let sumIaSq = 0;
  let sumVcmSq = 0;
  let maxVcm = -Infinity;
  let minVcm = Infinity;
  let peakDvDtStep = 0;
  let prevVab = 0;

  for (let i = 0; i < samplePoints; i++) {
    const t = i * dt;
    const theta = omega * t;
    const phaseDeg = (i / samplePoints) * 360;

    const pA = getPoleFactor(phaseDeg);
    const pB = getPoleFactor(phaseDeg - 120);
    const pC = getPoleFactor(phaseDeg + 120);

    const van = pA.factor * vdc;
    const vbn = pB.factor * vdc;
    const vcn = pC.factor * vdc;

    let vPhaseA = van;
    let vab = van - vbn;

    if (topology === 'OEW-VSI') {
      vPhaseA = (pA.oewCoilFactor ?? 0) * vdc;
      const inv2FactorB = pB.oewB2State === 'P' ? 0.5 : -0.5;
      const vPhaseB = (pB.factor - inv2FactorB) * vdc;
      vab = vPhaseA - vPhaseB;
    }

    const vcm = topology === 'OEW-VSI' ? 0 : (van + vbn + vcn) / 3;
    const loadPhaseVoltage = topology === 'OEW-VSI' ? vPhaseA : van - vcm;
    const ea = backEmfPeak * Math.sin(theta - backEmfPhaseOffset);

    // RK2 integration step for load current ia
    const k1 = (loadPhaseVoltage - R * ia - ea) / L;
    const ia_half = ia + 0.5 * dt * k1;
    const theta_half = theta + 0.5 * omega * dt;
    const ea_half = backEmfPeak * Math.sin(theta_half - backEmfPhaseOffset);
    const k2 = (loadPhaseVoltage - R * ia_half - ea_half) / L;
    ia += k2 * dt;

    if (i > 0) {
      const step = Math.abs(vab - prevVab);
      if (step > peakDvDtStep) peakDvDtStep = step;
    }
    prevVab = vab;

    sumVabSq += vab * vab;
    sumIaSq += ia * ia;
    sumVcmSq += vcm * vcm;
    if (vcm > maxVcm) maxVcm = vcm;
    if (vcm < minVcm) minVcm = vcm;

    // For reference traces in working principle:
    // vrefA is a clean reference sine wave
    // carrierSingle / carrierUpper are logic levels representing gate commands (+1, 0, -1)
    const vrefA = Math.sin(theta);
    const gateLevel = pA.state === 'P' ? 1.0 : pA.state === 'N' ? -1.0 : 0.0;

    points[i] = {
      t,
      phaseDeg,
      vrefA,
      vrefB: Math.sin(theta - (2 * Math.PI) / 3),
      vrefC: Math.sin(theta + (2 * Math.PI) / 3),
      carrierSingle: gateLevel,
      carrierUpper: pA.state === 'P' ? 1.0 : 0.0,
      carrierLower: pA.state === 'N' ? -1.0 : 0.0,
      van,
      vbn,
      vcn,
      vab,
      vcm,
      ia,
      ea,
      stateA: pA.state,
      stateB: pB.state,
      stateC: pC.state,
      bridge2StateA: pA.oewB2State,
      vPhaseA: topology === 'OEW-VSI' ? vPhaseA : van,
    };
  }

  // Harmonic spectrum and RMS metrics
  const vabRms = Math.sqrt(sumVabSq / samplePoints);
  const iaRms = Math.sqrt(sumIaSq / samplePoints);
  const vcmRms = Math.sqrt(sumVcmSq / samplePoints);
  const vcmPeakToPeak = maxVcm - minVcm;

  // Fourier decomposition
  const harmonics: HarmonicComponent[] = [];
  let fundCos = 0;
  let fundSin = 0;
  for (let i = 0; i < samplePoints; i++) {
    const theta = omega * points[i].t;
    fundCos += points[i].vab * Math.cos(theta);
    fundSin += points[i].vab * Math.sin(theta);
  }
  const a1 = (2 / samplePoints) * fundCos;
  const b1 = (2 / samplePoints) * fundSin;
  const c1 = Math.sqrt(a1 * a1 + b1 * b1);
  const vFundamentalRms = c1 / Math.SQRT2;

  harmonics.push({
    order: 1,
    frequency: f0,
    amplitude: c1,
    relativePct: 100,
  });

  let sumHarmonicsSq = 0;
  for (let h = 2; h <= 25; h++) {
    let sumCos = 0;
    let sumSin = 0;
    for (let i = 0; i < samplePoints; i++) {
      const thetaH = h * omega * points[i].t;
      sumCos += points[i].vab * Math.cos(thetaH);
      sumSin += points[i].vab * Math.sin(thetaH);
    }
    const ah = (2 / samplePoints) * sumCos;
    const bh = (2 / samplePoints) * sumSin;
    const ch = Math.sqrt(ah * ah + bh * bh);
    sumHarmonicsSq += ch * ch;

    if (h <= 13) {
      harmonics.push({
        order: h,
        frequency: h * f0,
        amplitude: ch,
        relativePct: c1 > 0 ? (ch / c1) * 100 : 0,
      });
    }
  }

  const thdPercent = c1 > 0 ? (Math.sqrt(sumHarmonicsSq) / c1) * 100 : 31.08;

  // Conduction losses and switching metrics (only fundamental commutations: 2 or 4 per cycle!)
  const conductionLossW = 3 * (iaRms * iaRms * 0.03 + 0.9 * iaRms);
  const numCommutations = topology === '2L-VSI' ? 6 : 12;
  const switchingLossW = numCommutations * f0 * 0.00045 * (vdc / 800) * (iaRms / 40);
  const totalLossW = conductionLossW + switchingLossW;

  // Extract Working Principle Stages across the single cycle
  // Whenever stateA or current sign changes, a new stage begins
  const stages: WorkingPrincipleStage[] = [];
  let stageStartIndex = 0;
  let currentGroupState = points[0].stateA;
  let currentGroupSign = points[0].ia > 0.05 ? 1 : points[0].ia < -0.05 ? -1 : 0;

  const pushStage = (startIdx: number, endIdx: number) => {
    const pStart = points[startIdx];
    const pEnd = points[endIdx];
    const degStart = pStart.phaseDeg;
    const degEnd = endIdx === samplePoints - 1 ? 360 : pEnd.phaseDeg;
    const centerIdx = Math.floor((startIdx + endIdx) / 2);
    const pCenter = points[centerIdx];
    const sign = pCenter.ia > 0.05 ? 1 : pCenter.ia < -0.05 ? -1 : 0;
    const pathInfo = getConductionPath(topology, pCenter.stateA, pCenter.ia, vdc, pCenter.bridge2StateA);

    let title = '';
    let explanation = '';

    if (topology === '2L-VSI') {
      if (pCenter.stateA === 'P') {
        if (sign >= 0) {
          title = 'Positive Conduction: Upper MOSFET S1 ON';
          explanation = 'Gate driver turns S1 ON (+15V). Current flows from +Vdc rail through S1 forward channel into Phase A.';
        } else {
          title = 'Positive Freewheeling: Upper Diode D1 Conduction';
          explanation = 'Although S1 gate is high, phase current is negative (inductive lag). Current freewheels back into +Vdc rail via antiparallel diode D1.';
        }
      } else {
        if (sign >= 0) {
          title = 'Negative Freewheeling: Lower Diode D2 Conduction';
          explanation = 'S2 gate is commanded, but phase current is positive. Current freewheels from -Vdc rail upward through diode D2 into Phase A.';
        } else {
          title = 'Negative Conduction: Lower MOSFET S2 ON';
          explanation = 'Phase current is negative. Current flows from Phase A downward through lower MOSFET S2 forward channel to -Vdc rail.';
        }
      }
    } else if (topology === 'OEW-VSI') {
      if (pCenter.stateA === 'P') {
        title = 'Coil Drive: Bridge 1 (+) / Bridge 2 (-) [V_coil = +Vdc]';
        explanation = 'Dual inverters drive motor phase terminals differentially: Terminal A1 is connected to +Vdc/2 and Terminal A2 is connected to -Vdc/2. Coil sees full +Vdc.';
      } else if (pCenter.stateA === 'N') {
        title = 'Coil Reversal: Bridge 1 (-) / Bridge 2 (+) [V_coil = -Vdc]';
        explanation = 'Dual inverters invert coil polarity: Terminal A1 is at -Vdc/2 and Terminal A2 is at +Vdc/2. Differential coil voltage is -Vdc.';
      } else {
        title = 'Coil Freewheel Zero-State: Both Bridges Same State [V_coil = 0V]';
        explanation = 'Both Bridge 1 and Bridge 2 connect to the same DC rail (both + or both -). Net differential coil voltage is 0V, maintaining zero common-mode excitation.';
      }
    } else {
      // 3-Level Topologies (3L-NPC, 3L-ANPC, 3L-TNPC)
      if (pCenter.stateA === 'P') {
        if (sign >= 0) {
          title = 'State P: Upper Semiconductors S1/S2 (+Vdc/2)';
          explanation = topology === '3L-TNPC'
            ? 'Top 1200V SiC MOSFET S1 conducts from +Vdc bus directly to Phase A.'
            : 'Upper series SiC MOSFETs S1 and S2 conduct in series from +Vdc/2 to Phase A.';
        } else {
          title = 'State P (Freewheeling): Upper Diodes D1/D2';
          explanation = 'Inductive current is negative, flowing back into +Vdc rail through upper antiparallel diodes.';
        }
      } else if (pCenter.stateA === 'N') {
        if (sign <= 0) {
          title = 'State N: Lower Semiconductors S3/S4 (-Vdc/2)';
          explanation = topology === '3L-TNPC'
            ? 'Bottom 1200V SiC MOSFET S4 conducts from Phase A downward into -Vdc rail.'
            : 'Lower series SiC MOSFETs S3 and S4 conduct from Phase A downward into -Vdc/2 rail.';
        } else {
          title = 'State N (Freewheeling): Lower Diodes D3/D4';
          explanation = 'Inductive current is positive, freewheeling upward from -Vdc rail into Phase A.';
        }
      } else {
        // State O
        if (topology === '3L-TNPC') {
          title = 'State O (Midpoint Clamp): Auxiliary Bidirectional Leg';
          explanation = sign >= 0
            ? 'Current flows from Neutral Midpoint (NP=0V) through S2 and D3 into Phase A.'
            : 'Current flows from Phase A into Neutral Midpoint (NP=0V) through S3 and D2.';
        } else if (topology === '3L-ANPC') {
          title = 'State O (Active Clamp): Active Neutral Switch Balancing';
          explanation = sign >= 0
            ? 'Active clamp switch S5 turned ON simultaneously with S2 to clamp Phase A to NP (0V).'
            : 'Active clamp switch S6 turned ON simultaneously with S3 to route return neutral current.';
        } else {
          title = 'State O (Neutral Clamped): Clamping Diodes to NP (0V)';
          explanation = sign >= 0
            ? 'Clamping diode Dc1 and inner switch S2 clamp Phase A to DC Neutral Midpoint (NP = 0V).'
            : 'Inner switch S3 and clamping diode Dc2 clamp Phase A to DC Neutral Midpoint (NP = 0V).';
        }
      }
    }

    stages.push({
      id: `stage-${stages.length}`,
      index: stages.length,
      title,
      phaseRange: `${degStart.toFixed(0)}° - ${degEnd.toFixed(0)}°`,
      degStart,
      degEnd,
      centerDeg: (degStart + degEnd) / 2,
      stateA: pCenter.stateA,
      currentSign: sign,
      activeDevices: pathInfo.activeDevices,
      summary: pathInfo.description,
      physicsExplanation: explanation,
    });
  };

  for (let i = 1; i < samplePoints; i++) {
    const pt = points[i];
    const sign = pt.ia > 0.05 ? 1 : pt.ia < -0.05 ? -1 : 0;
    if (pt.stateA !== currentGroupState || (sign !== currentGroupSign && sign !== 0 && currentGroupSign !== 0)) {
      pushStage(stageStartIndex, i - 1);
      stageStartIndex = i;
      currentGroupState = pt.stateA;
      currentGroupSign = sign;
    }
  }
  pushStage(stageStartIndex, samplePoints - 1);

  return {
    points,
    metrics: {
      vabRms,
      vabFundamentalRms: vFundamentalRms,
      thdPercent,
      peakDvDtStep: topology === '2L-VSI' ? vdc : vdc / 2,
      dvDtSlopeMax: topology === '2L-VSI' ? 35.0 : 17.5,
      vcmPeakToPeak,
      vcmRms,
      iaRms,
      iaThdPercent: Math.max(1.2, thdPercent / 8),
      switchingLossW,
      conductionLossW,
      totalLossW,
      switchingLossPct: totalLossW > 0 ? (switchingLossW / totalLossW) * 100 : 15,
      conductionLossPct: totalLossW > 0 ? (conductionLossW / totalLossW) * 100 : 85,
      estimatedEfficiency: Math.min(99.4, Math.max(93.0, (1 - totalLossW / 40000) * 100)),
      dcLinkCapRippleCurrentA: iaRms * 0.45,
      neutralStressIndex: topology === '2L-VSI' ? 0 : 35,
      harmonics,
    },
    stages,
  };
}

/**
 * Returns detailed conduction path info and active semiconductor devices
 * for Phase A at the current instantaneous state and current direction.
 */
export function getConductionPath(
  topology: TopologyType,
  stateA: SwitchState,
  ia: number,
  vdc: number,
  bridge2StateA?: 'P' | 'N'
): ConductionPathInfo {
  const currentSign = ia > 0.05 ? 1 : ia < -0.05 ? -1 : 0;

  switch (topology) {
    case '2L-VSI': {
      if (stateA === 'P') {
        if (currentSign >= 0) {
          return {
            topology,
            stateA,
            currentSignA: currentSign,
            activeDevices: ['S1'],
            description: 'Upper SiC MOSFET S1 conducting outward current (+Vdc/2 to phase A).',
            blockingVoltageMax: vdc,
            commutationNotes: 'Lower switch S2 / D2 is blocking full DC link voltage Vdc.',
          };
        } else {
          return {
            topology,
            stateA,
            currentSignA: currentSign,
            activeDevices: ['D1'],
            description: 'Upper freewheeling body diode D1 conducting inward current from phase A to +DC bus.',
            blockingVoltageMax: vdc,
            commutationNotes: 'S2 is blocking Vdc; freewheeling energy recuperation.',
          };
        }
      } else {
        // State N
        if (currentSign >= 0) {
          return {
            topology,
            stateA,
            currentSignA: currentSign,
            activeDevices: ['D2'],
            description: 'Lower freewheeling diode D2 conducting current from -DC rail into phase A.',
            blockingVoltageMax: vdc,
            commutationNotes: 'Upper switch S1 blocks full Vdc (800V).',
          };
        } else {
          return {
            topology,
            stateA,
            currentSignA: currentSign,
            activeDevices: ['S2'],
            description: 'Lower SiC MOSFET S2 conducting current from phase A to -DC rail (-Vdc/2).',
            blockingVoltageMax: vdc,
            commutationNotes: 'Upper switch S1 blocks full Vdc.',
          };
        }
      }
    }

    case '3L-NPC': {
      if (stateA === 'P') {
        if (currentSign >= 0) {
          return {
            topology,
            stateA,
            currentSignA: currentSign,
            activeDevices: ['S1', 'S2'],
            description: 'Upper switches S1 and S2 conducting outward current from +DC bus (+Vdc/2).',
            blockingVoltageMax: vdc / 2,
            commutationNotes: 'Switches S3, S4 and clamp diode D_clamp2 block Vdc/2 (400V).',
          };
        } else {
          return {
            topology,
            stateA,
            currentSignA: currentSign,
            activeDevices: ['D1', 'D2'],
            description: 'Upper diodes D1 and D2 conducting freewheeling current to +DC bus.',
            blockingVoltageMax: vdc / 2,
            commutationNotes: 'S3 and S4 block Vdc/2.',
          };
        }
      } else if (stateA === 'O') {
        if (currentSign >= 0) {
          return {
            topology,
            stateA,
            currentSignA: currentSign,
            activeDevices: ['D_clamp1', 'S2'],
            description: 'Clamping diode D_clamp1 and inner switch S2 conducting current from DC Neutral Midpoint (NP=0V).',
            blockingVoltageMax: vdc / 2,
            commutationNotes: 'Neutral point clamped; S1 blocks Vdc/2, S4 blocks Vdc/2.',
          };
        } else {
          return {
            topology,
            stateA,
            currentSignA: currentSign,
            activeDevices: ['S3', 'D_clamp2'],
            description: 'Inner switch S3 and clamping diode D_clamp2 conducting current into DC Neutral Midpoint.',
            blockingVoltageMax: vdc / 2,
            commutationNotes: 'Energy clamped to neutral point NP.',
          };
        }
      } else {
        // State N
        if (currentSign >= 0) {
          return {
            topology,
            stateA,
            currentSignA: currentSign,
            activeDevices: ['D3', 'D4'],
            description: 'Lower diodes D3 and D4 conducting freewheeling current from -DC rail.',
            blockingVoltageMax: vdc / 2,
            commutationNotes: 'Upper switches S1, S2 block Vdc/2.',
          };
        } else {
          return {
            topology,
            stateA,
            currentSignA: currentSign,
            activeDevices: ['S3', 'S4'],
            description: 'Lower switches S3 and S4 conducting current to -DC rail (-Vdc/2).',
            blockingVoltageMax: vdc / 2,
            commutationNotes: 'S1, S2 and D_clamp1 block Vdc/2.',
          };
        }
      }
    }

    case '3L-ANPC': {
      // Active NPC uses controllable switches S5/S6 antiparallel to clamping diodes
      if (stateA === 'P') {
        return {
          topology,
          stateA,
          currentSignA: currentSign,
          activeDevices: currentSign >= 0 ? ['S1', 'S2'] : ['D1', 'D2'],
          description: `Positive state: Upper leg active (${currentSign >= 0 ? 'S1, S2' : 'D1, D2'}). Zero-state switches inactive.`,
          blockingVoltageMax: vdc / 2,
          commutationNotes: 'Active clamping switches S5/S6 gated for optimal dv/dt distribution.',
        };
      } else if (stateA === 'O') {
        if (currentSign >= 0) {
          return {
            topology,
            stateA,
            currentSignA: currentSign,
            activeDevices: ['S5_active', 'S2'],
            description: 'Active Clamping Switch S5 (ANPC) actively turned ON with S2 to equalize thermal stress across inner/outer semiconductors.',
            blockingVoltageMax: vdc / 2,
            commutationNotes: 'Eliminates localized thermal bottleneck inherent in passive NPC.',
          };
        } else {
          return {
            topology,
            stateA,
            currentSignA: currentSign,
            activeDevices: ['S3', 'S6_active'],
            description: 'Active Clamping Switch S6 (ANPC) actively turned ON with S3 to route return zero-state current.',
            blockingVoltageMax: vdc / 2,
            commutationNotes: 'Active bidirectional neutral clamp prevents capacitor voltage unbalance.',
          };
        }
      } else {
        return {
          topology,
          stateA,
          currentSignA: currentSign,
          activeDevices: currentSign >= 0 ? ['D3', 'D4'] : ['S3', 'S4'],
          description: `Negative state: Lower leg active (${currentSign >= 0 ? 'D3, D4' : 'S3, S4'}).`,
          blockingVoltageMax: vdc / 2,
          commutationNotes: 'Each device blocks only Vdc/2 (400V).',
        };
      }
    }

    case '3L-TNPC': {
      // T-Type: S1 to +Vdc, S4 to -Vdc (1200V rated); S2/S3 back-to-back to NP (650V rated)
      if (stateA === 'P') {
        return {
          topology,
          stateA,
          currentSignA: currentSign,
          activeDevices: currentSign >= 0 ? ['S1'] : ['D1'],
          description: `Upper main switch (${currentSign >= 0 ? 'S1' : 'D1'}) conducting. Only 1 device in path!`,
          blockingVoltageMax: vdc,
          commutationNotes: 'Neutral bidirectional switch S2/S3 blocks Vdc/2; S4 blocks full Vdc.',
        };
      } else if (stateA === 'O') {
        if (currentSign >= 0) {
          return {
            topology,
            stateA,
            currentSignA: currentSign,
            activeDevices: ['S2', 'D3'],
            description: 'Auxiliary bidirectional midpoint leg: S2 and anti-series diode D3 conduct from Neutral to Phase A.',
            blockingVoltageMax: vdc / 2,
            commutationNotes: 'Both main switches S1 and S4 are OFF, blocking Vdc/2.',
          };
        } else {
          return {
            topology,
            stateA,
            currentSignA: currentSign,
            activeDevices: ['S3', 'D2'],
            description: 'Auxiliary bidirectional midpoint leg: S3 and anti-series diode D2 conduct from Phase A into Neutral.',
            blockingVoltageMax: vdc / 2,
            commutationNotes: 'Midpoint bidirectional connection active.',
          };
        }
      } else {
        // State N
        return {
          topology,
          stateA,
          currentSignA: currentSign,
          activeDevices: currentSign >= 0 ? ['D4'] : ['S4'],
          description: `Lower main switch (${currentSign >= 0 ? 'D4' : 'S4'}) conducting to -Vdc. Only 1 device in path!`,
          blockingVoltageMax: vdc,
          commutationNotes: 'Neutral leg blocks Vdc/2; S1 blocks full Vdc.',
        };
      }
    }

    case 'OEW-VSI': {
      const b1 = stateA === 'P' ? 'Bridge1: +Vdc/2' : 'Bridge1: -Vdc/2';
      const b2 = bridge2StateA === 'P' ? 'Bridge2: +Vdc/2' : 'Bridge2: -Vdc/2';
      const activeDevs: string[] = [];
      if (stateA === 'P') {
        activeDevs.push(currentSign >= 0 ? 'B1_S1' : 'B1_D1');
      } else {
        activeDevs.push(currentSign >= 0 ? 'B1_D2' : 'B1_S2');
      }
      if (bridge2StateA === 'P') {
        activeDevs.push(currentSign >= 0 ? 'B2_D1' : 'B2_S1');
      } else {
        activeDevs.push(currentSign >= 0 ? 'B2_S2' : 'B2_D2');
      }

      return {
        topology,
        stateA,
        currentSignA: currentSign,
        activeDevices: activeDevs,
        description: `Dual Inverter Bridges driving open-ended winding A1-A2. ${b1}, ${b2}. Net coil voltage = ${stateA === bridge2StateA ? '0 V' : stateA === 'P' ? '+Vdc' : '-Vdc'}.`,
        blockingVoltageMax: vdc / 2,
        commutationNotes: 'Both ends of motor phase winding dynamically modulated; eliminates common-mode voltage with 180° carrier pairing.',
      };
    }
  }
}

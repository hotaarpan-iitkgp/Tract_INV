export type TopologyType = 
  | '2L-VSI' 
  | '3L-NPC' 
  | '3L-ANPC' 
  | '3L-TNPC' 
  | 'OEW-VSI';

export type OperationMode = 'complete_simulation' | 'working_principle';

export type ModulationScheme = 'SPWM' | 'THIPWM' | 'DPWM1';

export type CarrierDisposition = 'IPD' | 'PD' | 'POD' | 'APOD' | 'PSPWM';

export interface InverterParameters {
  vdc: number;          // V (200 - 1000)
  ma: number;           // Modulation index (0.1 - 1.15)
  f0: number;           // Fundamental frequency Hz (10 - 500)
  fsw: number;          // Carrier / switching frequency Hz (2000 - 40000)
  modulation: ModulationScheme;
  carrierDisposition: CarrierDisposition; // For 3-level
  ls: number;           // Inductance mH (0.2 - 10.0)
  rs: number;           // Resistance Ohms (0.01 - 1.0)
  epeak: number;        // Back-EMF peak V (0 - 600)
  deadTimeNs: number;   // Dead-time ns (e.g. 500ns)
  conductionAngleDeg?: number; // For 3-level square-wave working principle (e.g. 120° - 150°)
}

export type SwitchState = 'P' | 'O' | 'N';

export interface WorkingPrincipleStage {
  id: string;
  index: number;
  title: string;
  phaseRange: string;
  degStart: number;
  degEnd: number;
  centerDeg: number;
  stateA: SwitchState;
  currentSign: number;
  activeDevices: string[];
  summary: string;
  physicsExplanation: string;
}

export interface WaveformPoint {
  t: number;            // seconds
  phaseDeg: number;     // degrees 0 - 360 (or multi-cycle)
  vrefA: number;        // normalized -1 to +1
  vrefB: number;
  vrefC: number;
  carrierUpper: number; // for 3L
  carrierLower: number; // for 3L
  carrierSingle: number;// for 2L
  van: number;          // Pole voltage A (V)
  vbn: number;          // Pole voltage B (V)
  vcn: number;          // Pole voltage C (V)
  vab: number;          // Line-to-line voltage V_AB (V)
  vcm: number;          // Common-mode voltage (V_AN + V_BN + V_CN) / 3 (V)
  ia: number;           // Motor load phase A current (A)
  ea: number;           // Back-EMF (V)
  stateA: SwitchState;
  stateB: SwitchState;
  stateC: SwitchState;
  // For OEW-VSI (Dual inverter):
  bridge2StateA?: 'P' | 'N';
  vPhaseA?: number;     // Winding voltage across open-end phase coil
}

export interface ConductionPathInfo {
  topology: TopologyType;
  stateA: SwitchState;
  currentSignA: number; // +1 if ia > 0, -1 if ia < 0, 0 if ia == 0
  activeDevices: string[]; // Device IDs like 'S1', 'D1', 'S2', 'S3', 'D_clamp1', etc.
  description: string;
  blockingVoltageMax: number;
  commutationNotes: string;
}

export interface HarmonicComponent {
  order: number;
  frequency: number;
  amplitude: number;
  relativePct: number;
}

export interface AnalyticalMetrics {
  vabRms: number;
  vabFundamentalRms: number;
  thdPercent: number;
  peakDvDtStep: number;       // Volts per commutation step
  dvDtSlopeMax: number;       // V/ns estimated
  vcmPeakToPeak: number;
  vcmRms: number;
  iaRms: number;
  iaThdPercent: number;
  switchingLossW: number;
  conductionLossW: number;
  totalLossW: number;
  switchingLossPct: number;
  conductionLossPct: number;
  estimatedEfficiency: number;
  dcLinkCapRippleCurrentA: number;
  neutralStressIndex: number; // 0 to 100
  harmonics: HarmonicComponent[];
}

// Complete simulation engine and algorithms for ANPC Control Studio
// Ported and adapted from Giuseppe Marsotto's ANPC Control Studio (teaching-20260914)
// Incorporates Digital PI, Resonant (PR), Hysteresis, FCS-MPC, and OSS-MPC with 18-IGBT ANPC Bridge.

export interface ANPCConfig {
  method: 'pi' | 'pr' | 'hyst' | 'fcs' | 'oss';
  variable: 'i' | 'v'; // 'i': Phase current [A], 'v': Load resistor voltage [V]
  zeta: number;        // Tuning damping ratio ζ (0.25 - 2.5)
  wn: number;          // Natural frequency ωn [rad/s] (300 - 4000)
  f0: number;          // Fundamental frequency [Hz] (20 - 100)
  detune: number;      // Resonant detuning offset [Hz] (-15 to 15)
  amp: number;         // Initial peak amplitude [A or V]
  final: number;       // Final peak amplitude [A or V]
  step: number;        // Step time [ms] (10 - 70)
  duration: number;    // Simulation duration [ms] (e.g. 80ms)
  vdc: number;         // DC bus voltage [V] (200 - 600)
  R: number;           // Load resistance [Ω] (2 - 20)
  L: number;           // Filter inductance [mH] (2 - 15)
  fs: number;          // Sampling / sequence frequency [Hz] (2000 - 16000)
  carrier: number;     // Carrier frequency for PWM [Hz] (1000 - 8000)
  band: number;        // Hysteresis half-band h [A or V]
  lambda: number;      // Switching penalty weight λ (0 - 0.3)
  horizon: number;     // FCS-MPC prediction horizon (1 or 2)
  aw: boolean;         // Anti-windup enabled
  reference: 'sine' | 'dc'; // Reference waveform
  resolution: number;  // Sub-steps per control sample (default 32)
  autoRetune: boolean; // Auto retune gains when R/L/Vdc change
  pwmType: 'level' | 'phase'; // PWM Carrier Scheme
  tuningPlant?: { R: number; L: number; vdc: number };
}

export const ANPC_DEFAULTS: ANPCConfig = {
  method: 'pr',
  variable: 'i',
  zeta: 1.0,
  wn: 1500,
  f0: 50,
  detune: 0,
  amp: 8,
  final: 12,
  step: 30,
  duration: 80,
  vdc: 400,
  R: 8,
  L: 5,
  fs: 8000,
  carrier: 4000,
  band: 0.6,
  lambda: 0,
  horizon: 1,
  aw: true,
  reference: 'sine',
  resolution: 32,
  autoRetune: false,
  pwmType: 'level',
};

// ANPC Switching gate definitions for 6 switches per phase: [S1, S2, S3, S4, S5, S6]
// State 0 (P level):   [1, 1, 0, 0, 0, 1]
// State 1 (0^up level): [0, 1, 0, 0, 1, 1]
// State 2 (0^dn level): [0, 0, 1, 0, 1, 1]
// State 3 (N level):   [0, 0, 1, 1, 1, 0]
export const ANPC_GATES: number[][] = [
  [1, 1, 0, 0, 0, 1],
  [0, 1, 0, 0, 1, 1],
  [0, 0, 1, 0, 1, 1],
  [0, 0, 1, 1, 1, 0],
];

export const ANPC_LEVELS = [1, 0, 0, -1];
export const PHASE_OFFSETS = [0, (-2 * Math.PI) / 3, (2 * Math.PI) / 3];

export const clamp = (v: number, l = -1, h = 1): number => Math.max(l, Math.min(h, v));

export interface PIDesignResult {
  tau: number;
  Ko: number;
  Ts: number;
  Kp: number;
  Ki: number;
  nominal: { R: number; L: number; vdc: number };
  Ti: number;
  Ka: number;
  Kb: number;
  a0: number;
  a1: number;
  a2: number;
  b1: number;
  valid: boolean;
}

export function designController(c: ANPCConfig): PIDesignResult {
  const nominal = c.autoRetune || !c.tuningPlant ? c : c.tuningPlant;
  const tau = nominal.L / 1000 / nominal.R;
  const Ko = nominal.vdc / (2 * (c.variable === 'i' ? nominal.R : 1));
  const Ts = 1 / c.fs;
  const Ki = (c.wn * c.wn * tau) / Ko;
  const Kp = (2 * c.zeta * c.wn * tau) / Ko;
  const w0 = 2 * Math.PI * (c.f0 + c.detune);

  return {
    tau,
    Ko,
    Ts,
    Kp,
    Ki,
    nominal: { R: nominal.R, L: nominal.L, vdc: nominal.vdc },
    Ti: (2 * c.zeta) / c.wn,
    Ka: Kp,
    Kb: Ki * Ts - Kp,
    a0: Kp,
    a1: 2 * ((Ki / w0) * Math.sin(w0 * Ts) - Kp * Math.cos(w0 * Ts)),
    a2: Kp - 2 * (Ki / w0) * Math.sin(w0 * Ts),
    b1: 2 * Math.cos(w0 * Ts),
    valid: 1 / (2 * c.zeta * tau) < c.wn && c.wn <= c.fs / (2 * c.zeta),
  };
}

export function refAt(c: ANPCConfig, t: number): [number, number, number] {
  const amp = t < c.step / 1000 - 1e-12 ? c.amp : c.final;
  if (c.reference === 'dc') {
    return [amp, -amp / 2, -amp / 2];
  }
  return [
    amp * Math.sin(2 * Math.PI * c.f0 * t + PHASE_OFFSETS[0]),
    amp * Math.sin(2 * Math.PI * c.f0 * t + PHASE_OFFSETS[1]),
    amp * Math.sin(2 * Math.PI * c.f0 * t + PHASE_OFFSETS[2]),
  ];
}

export function digitalControl(
  e: number,
  m: number[],
  p: PIDesignResult,
  isPR: boolean,
  aw: boolean
): { raw: number; d: number; m: number[] } {
  const raw = isPR
    ? p.a0 * e + p.a1 * m[0] + p.a2 * m[1] + p.b1 * m[2] - m[3]
    : p.Ka * e + p.Kb * m[0] + m[2];
  const d = clamp(raw);
  const reset = isPR && aw && Math.abs(raw) > 1;
  return {
    raw,
    d,
    m: [reset ? 0 : e, reset ? 0 : m[0], aw ? d : raw, m[2]],
  };
}

export function pwmState(d: number, carrier: number): number {
  return d >= 1 || (d > 0 && d >= carrier)
    ? 0
    : d <= -1 || (d < 0 && d <= carrier - 1)
    ? 3
    : (d < 0 ? 2 : 1);
}

export function poleVoltages(st: number[], vdc: number): [number, number, number] {
  const poles = st.map((s) => (ANPC_LEVELS[s] * vdc) / 2);
  const n = (poles[0] + poles[1] + poles[2]) / 3;
  return [poles[0] - n, poles[1] - n, poles[2] - n];
}

export function branchConduction(st: number, current: number): number[] {
  // Returns conduction factor for [S1, S2, S3, S4, S5, S6]
  const pattern = [
    [1, 1, 0, 0, 0, 0],
    [0, 1, 0, 0, -1, 0],
    [0, 0, -1, 0, 0, 1],
    [0, 0, -1, -1, 0, 0],
  ][st];
  return pattern.map((v) => v * current);
}

// 64 Space vectors enumeration
export interface SpaceVectorItem {
  id: number;
  state: [number, number, number];
  v: [number, number, number];
  g: number[];
}

export const ANPC_SPACE_VECTORS: SpaceVectorItem[] = (() => {
  const list: SpaceVectorItem[] = [];
  let id = 0;
  for (const a of [3, 2, 1, 0]) {
    for (const b of [3, 2, 1, 0]) {
      for (const c of [3, 2, 1, 0]) {
        const state: [number, number, number] = [a, b, c];
        list.push({
          id: id++,
          state,
          v: poleVoltages(state, 2),
          g: state.flatMap((s) => ANPC_GATES[s]),
        });
      }
    }
  }
  return list;
})();

export const ZERO_VECTOR_INDEX = ANPC_SPACE_VECTORS.findIndex((v) =>
  v.state.every((s) => s === 1)
);

function countFlips(a: [number, number, number], b: [number, number, number]): number {
  let n = 0;
  for (let h = 0; h < 3; h++) {
    for (let s = 0; s < 6; s++) {
      n += ANPC_GATES[a[h]][s] !== ANPC_GATES[b[h]][s] ? 1 : 0;
    }
  }
  return n;
}

function predictOutput(
  y: [number, number, number],
  v: [number, number, number],
  c: ANPCConfig,
  dt: number = 1 / c.fs
): [number, number, number] {
  const a = Math.exp((-dt * c.R) / (c.L / 1000));
  const b = (1 - a) / (c.variable === 'i' ? c.R : 1);
  return [a * y[0] + b * v[0], a * y[1] + b * v[1], a * y[2] + b * v[2]];
}

function normError(y: [number, number, number], r: [number, number, number], scale: number): number {
  return (
    ((y[0] - r[0]) / scale) ** 2 +
    ((y[1] - r[1]) / scale) ** 2 +
    ((y[2] - r[2]) / scale) ** 2
  );
}

export interface FCSResult {
  state: [number, number, number];
  cost: number;
  choice: number;
  candidates: { id: number; cost: number; predicted: [number, number, number] }[];
}

export function fcsMPC(
  y: [number, number, number],
  prev: [number, number, number],
  c: ANPCConfig,
  t: number
): FCSResult {
  const scale = c.variable === 'i' ? 10 : 100;
  const r = refAt(c, t + 1 / c.fs);
  const r2 = refAt(c, t + 2 / c.fs);
  let best = Infinity;
  let choice = ZERO_VECTOR_INDEX;
  const candidates: { id: number; cost: number; predicted: [number, number, number] }[] = [];

  for (let k = 0; k < ANPC_SPACE_VECTORS.length; k++) {
    const q = ANPC_SPACE_VECTORS[k];
    const yp = predictOutput(
      y,
      [(q.v[0] * c.vdc) / 2, (q.v[1] * c.vdc) / 2, (q.v[2] * c.vdc) / 2],
      c
    );
    let cost = normError(yp, r, scale) + (c.lambda * countFlips(prev, q.state)) / 18;

    if (c.horizon === 2) {
      let second = Infinity;
      for (const z of ANPC_SPACE_VECTORS) {
        const yp2 = predictOutput(
          yp,
          [(z.v[0] * c.vdc) / 2, (z.v[1] * c.vdc) / 2, (z.v[2] * c.vdc) / 2],
          c
        );
        second = Math.min(
          second,
          normError(yp2, r2, scale) + (c.lambda * countFlips(q.state, z.state)) / 18
        );
      }
      cost += second;
    }

    candidates.push({ id: k, cost, predicted: yp });
    if (cost < best - 1e-13) {
      best = cost;
      choice = k;
    }
  }

  return { state: [...ANPC_SPACE_VECTORS[choice].state], cost: best, choice, candidates };
}

const dot = (a: number[], b: number[]) => a.reduce((s, x, j) => s + x * b[j], 0);
const vectorDot = ANPC_SPACE_VECTORS.map((u) =>
  ANPC_SPACE_VECTORS.map((v) => dot(u.v, v.v))
);
const gateDistance = ANPC_SPACE_VECTORS.map((u) =>
  ANPC_SPACE_VECTORS.map((v) => countFlips(u.state, v.state))
);

export interface OSSResult {
  cost: number;
  k: number;
  l: number;
  x: number;
  z: number;
  sequence: number[];
  fractions: number[];
}

export function ossMPC(
  y: [number, number, number],
  prev: [number, number, number],
  c: ANPCConfig,
  t: number
): OSSResult {
  const a = Math.exp(-c.R / (c.L / 1000) / c.fs);
  const b = (1 - a) / (c.variable === 'i' ? c.R : 1);
  const r = refAt(c, t + 1 / c.fs);
  const amplitude = (b * c.vdc) / 2;
  const target = [(r[0] - a * y[0]) / amplitude, (r[1] - a * y[1]) / amplitude, (r[2] - a * y[2]) / amplitude];
  const scale = c.variable === 'i' ? 10 : 100;
  const factor = (amplitude / scale) ** 2;
  const energy = dot(target, target);
  const projection = ANPC_SPACE_VECTORS.map((q) => dot(q.v, target));
  const prevId = ANPC_SPACE_VECTORS.findIndex((q) =>
    q.state.every((s, h) => s === prev[h])
  );

  let best = { cost: Infinity, k: ZERO_VECTOR_INDEX, l: ZERO_VECTOR_INDEX, x: 0, z: 0 };

  function trial(k: number, l: number, x: number, z: number) {
    const residual = Math.max(
      0,
      energy -
        2 * x * projection[k] -
        2 * z * projection[l] +
        x * x * vectorDot[k][k] +
        2 * x * z * vectorDot[k][l] +
        z * z * vectorDot[l][l]
    );
    let switches = 0;
    let previous = prevId;
    if (c.lambda) {
      const states = [ZERO_VECTOR_INDEX, k, l, k, ZERO_VECTOR_INDEX];
      const fractions = [(1 - x - z) / 2, x / 2, z, x / 2, (1 - x - z) / 2];
      for (let n = 0; n < 5; n++) {
        if (fractions[n] > 1e-12) {
          switches += gateDistance[previous][states[n]];
          previous = states[n];
        }
      }
    }
    const cost = residual * factor + (c.lambda * switches) / 90;
    if (cost < best.cost - 1e-13) best = { cost, k, l, x, z };
  }

  trial(ZERO_VECTOR_INDEX, ZERO_VECTOR_INDEX, 0, 0);
  for (let k = 0; k < ANPC_SPACE_VECTORS.length; k++) {
    for (let l = k + 1; l < ANPC_SPACE_VECTORS.length; l++) {
      const uu = vectorDot[k][k];
      const vv = vectorDot[l][l];
      const uv = vectorDot[k][l];
      const ut = projection[k];
      const vt = projection[l];
      const det = uu * vv - uv * uv;
      if (det > 1e-15) {
        const x = (ut * vv - vt * uv) / det;
        const z = (vt * uu - ut * uv) / det;
        if (x >= 0 && z >= 0 && x + z <= 1) trial(k, l, x, z);
      }
      if (uu > 1e-15) trial(k, l, clamp(ut / uu, 0, 1), 0);
      if (vv > 1e-15) trial(k, l, 0, clamp(vt / vv, 0, 1));
      const dd = uu + vv - 2 * uv;
      if (dd > 1e-15) {
        const x = clamp((ut - vt - uv + vv) / dd, 0, 1);
        trial(k, l, x, 1 - x);
      }
    }
  }

  const t0 = Math.max(0, 1 - best.x - best.z);
  return {
    ...best,
    sequence: [ZERO_VECTOR_INDEX, best.k, best.l, best.k, ZERO_VECTOR_INDEX],
    fractions: [t0 / 2, best.x / 2, best.z, best.x / 2, t0 / 2],
  };
}

export function sequenceState(seq: OSSResult, u: number): [number, number, number] {
  let sum = 0;
  for (let j = 0; j < 5; j++) {
    sum += seq.fractions[j];
    if (u < sum - 1e-12) return [...ANPC_SPACE_VECTORS[seq.sequence[j]].state];
  }
  return [...ANPC_SPACE_VECTORS[ZERO_VECTOR_INDEX].state];
}

export interface DecisionRecord {
  t: number;
  y: [number, number, number];
  reference: [number, number, number];
  previous: [number, number, number];
  next: [number, number, number];
  memory: number[][];
  raw: [number, number, number];
  d: [number, number, number];
  search?: FCSResult;
  sequence?: OSSResult;
}

export interface PhaseMetric {
  rms: number;
  relative: number | null;
  saturation: number | null;
  switching: number;
  max: number;
  thd: number | null;
  phase: number | null;
  cycleChange: number | null;
}

export interface SimulationResult {
  c: ANPCConfig;
  p: PIDesignResult;
  dt: number;
  n: number;
  t: Float64Array;
  i: Float64Array;
  y: Float64Array;
  ref: Float64Array;
  v: Float64Array;
  gates: Uint8Array;
  state: Uint8Array;
  d: Float64Array;
  raw: Float64Array;
  costs: Float64Array;
  times: Float64Array;
  decisions: DecisionRecord[];
  metrics: {
    start: number;
    end: number;
    phase: PhaseMetric[];
  };
}

function interpArray(a: { dt: number; n: number }, arr: Float64Array, t: number, h: number): number {
  const k = clamp(t / a.dt, 0, a.n - 1);
  const i = Math.floor(k);
  const f = k - i;
  return arr[i * 3 + h] * (1 - f) + arr[Math.min(a.n - 1, i + 1) * 3 + h] * f;
}

function spectrum(a: { dt: number; n: number; t: Float64Array; y: Float64Array; c: ANPCConfig }, h: number): {
  thd: number | null;
  phase: number | null;
} {
  const c = a.c;
  const end = a.t[a.n - 1];
  const start = end - 1 / c.f0;
  const lastChange = c.amp !== c.final && c.step / 1000 < end ? c.step / 1000 : 0;
  if (c.reference === 'dc' || start < lastChange - 1e-9) {
    return { thd: null, phase: null };
  }
  const M = 1024;
  const ys: number[] = new Array(M);
  for (let k = 0; k < M; k++) {
    ys[k] = interpArray(a, a.y, start + k / M / c.f0, h);
  }
  let energy = 0;
  let amp1 = 0;
  let phase1 = 0;
  for (let m = 1; m <= 100; m++) {
    let s = 0;
    let co = 0;
    for (let k = 0; k < M; k++) {
      const angle = 2 * Math.PI * m * c.f0 * (start + k / M / c.f0);
      s += ys[k] * Math.sin(angle);
      co += ys[k] * Math.cos(angle);
    }
    const amp = (2 * Math.hypot(s, co)) / M;
    if (m === 1) {
      amp1 = amp;
      phase1 = Math.atan2(co, s);
    } else {
      energy += amp * amp;
    }
  }
  let angle = ((phase1 - PHASE_OFFSETS[h]) * 180) / Math.PI;
  while (angle > 180) angle -= 360;
  while (angle < -180) angle += 360;
  return {
    thd: amp1 > 1e-8 ? (100 * Math.sqrt(energy)) / amp1 : null,
    phase: amp1 > 1e-8 ? angle : null,
  };
}

function computeMetrics(a: {
  c: ANPCConfig;
  n: number;
  dt: number;
  t: Float64Array;
  ref: Float64Array;
  y: Float64Array;
  raw: Float64Array;
  gates: Uint8Array;
}): { start: number; end: number; phase: PhaseMetric[] } {
  const c = a.c;
  const end = a.t[a.n - 1];
  const start = Math.max(
    0,
    end - 1 / c.f0,
    c.amp !== c.final && c.step / 1000 < end ? c.step / 1000 : 0
  );
  const first = Math.ceil(start / a.dt);
  const result: PhaseMetric[] = [];

  for (let h = 0; h < 3; h++) {
    let e2 = 0;
    let r2 = 0;
    let sat = 0;
    let flips = 0;
    let count = 0;
    let max = 0;
    for (let j = first; j < a.n - 1; j++) {
      const k = j * 3 + h;
      const e = a.ref[k] - a.y[k];
      e2 += e * e;
      r2 += a.ref[k] * a.ref[k];
      sat += Math.abs(a.raw[k]) > 1 ? 1 : 0;
      count++;
      max = Math.max(max, Math.abs(e));
      for (let s = 0; s < 6; s++) {
        flips += a.gates[j * 18 + h * 6 + s] !== a.gates[(j + 1) * 18 + h * 6 + s] ? 1 : 0;
      }
    }
    const previousStart = start - 1 / c.f0;
    const lastChange = c.amp !== c.final ? c.step / 1000 : 0;
    let cycleChange: number | null = null;
    if (c.reference !== 'dc' && previousStart >= Math.max(0, lastChange) - 1e-9) {
      let delta = 0;
      let energy = 0;
      for (let j = first; j < a.n - 1; j++) {
        const y = a.y[j * 3 + h];
        const old = interpArray(a, a.y, a.t[j] - 1 / c.f0, h);
        delta += (y - old) ** 2;
        energy += y * y;
      }
      if (energy > 1e-12) cycleChange = 100 * Math.sqrt(delta / energy);
    }

    const spec = spectrum(a, h);
    result.push({
      cycleChange,
      rms: count > 0 ? Math.sqrt(e2 / count) : 0,
      relative: r2 > 1e-9 ? 100 * Math.sqrt(e2 / r2) : null,
      saturation: ['pi', 'pr'].includes(c.method) ? (100 * sat) / Math.max(1, count) : null,
      switching: flips / (12 * Math.max(1e-6, end - start)),
      max,
      ...spec,
    });
  }
  return { start, end, phase: result };
}

export function simulateANPC(input: Partial<ANPCConfig>): SimulationResult {
  const c: ANPCConfig = { ...ANPC_DEFAULTS, ...input };
  if (c.method === 'pi' || c.method === 'pr') {
    c.fs = 2 * c.carrier;
  }
  const p = designController(c);
  const sub = c.resolution;
  const dt = 1 / c.fs / sub;
  const n = Math.round(c.duration / 1000 / dt) + 1;

  const tArr = new Float64Array(n);
  const iArr = new Float64Array(n * 3);
  const yArr = new Float64Array(n * 3);
  const refArr = new Float64Array(n * 3);
  const vArr = new Float64Array(n * 3);
  const gatesArr = new Uint8Array(n * 18);
  const stateArr = new Uint8Array(n * 3);
  const dArr = new Float64Array(n * 3);
  const rawArr = new Float64Array(n * 3);
  const decisionsLen = Math.ceil(n / sub);
  const costsArr = new Float64Array(decisionsLen);
  const timesArr = new Float64Array(decisionsLen * 3);
  const decisions: DecisionRecord[] = [];

  let current: [number, number, number] = [0, 0, 0];
  let state: [number, number, number] = [1, 1, 1];
  let d: [number, number, number] = [0, 0, 0];
  let raw: [number, number, number] = [0, 0, 0];
  const mem = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  let seq: OSSResult | null = null;

  const decay = Math.exp((-c.R / (c.L / 1000)) * dt);
  const gain = (1 - decay) / c.R;

  for (let j = 0; j < n; j++) {
    const t = j * dt;
    const r = refAt(c, t);
    const y: [number, number, number] = [
      c.variable === 'i' ? current[0] : c.R * current[0],
      c.variable === 'i' ? current[1] : c.R * current[1],
      c.variable === 'i' ? current[2] : c.R * current[2],
    ];
    tArr[j] = t;

    if (j % sub === 0) {
      const decisionIndex = j / sub;
      const decision: DecisionRecord = {
        t,
        y: [...y],
        reference: [...r],
        previous: [...state],
        next: [1, 1, 1],
        memory: mem.map((row) => [...row]),
        raw: [...raw],
        d: [...d],
      };
      decisions.push(decision);

      if (c.method === 'pi' || c.method === 'pr') {
        for (let h = 0; h < 3; h++) {
          const q = digitalControl(r[h] - y[h], mem[h], p, c.method === 'pr', c.aw);
          mem[h] = q.m;
          d[h] = q.d;
          raw[h] = q.raw;
        }
      } else if (c.method === 'hyst') {
        for (let h = 0; h < 3; h++) {
          let level = ANPC_LEVELS[state[h]];
          const e = r[h] - y[h];
          if (e > c.band) level = Math.min(1, level + 1);
          else if (e < -c.band) level = Math.max(-1, level - 1);
          
          if (level === 1) {
            state[h] = 0;
          } else if (level === -1) {
            state[h] = 3;
          } else {
            // level is 0
            if (state[h] === 0) {
              state[h] = 1; // Transition from positive -> Upper Zero
            } else if (state[h] === 3) {
              state[h] = 2; // Transition from negative -> Lower Zero
            }
          }
        }
      } else if (c.method === 'fcs') {
        const q = fcsMPC(y, state, c, t);
        state = q.state;
        costsArr[decisionIndex] = q.cost;
        decision.search = q;
      } else {
        seq = ossMPC(y, state, c, t);
        costsArr[decisionIndex] = seq.cost;
        timesArr.set([1 - seq.x - seq.z, seq.x, seq.z], decisionIndex * 3);
        decision.sequence = seq;
      }

      decision.next = [...state];
      decision.raw = [...raw];
      decision.d = [...d];
    }

    if (c.method === 'pi' || c.method === 'pr') {
      const u = (j % (2 * sub)) / (2 * sub);
      if (c.pwmType === 'phase') {
        // Phase-Shifted PWM: 2 carriers in [-1, 1] phase-shifted by 180 deg (c2 = -c1)
        const c1 = 2 * (1 - 2 * Math.abs(u - 0.5)) - 1;
        const c2 = -c1;
        state = [
          [clamp(d[0]), c1, c2],
          [clamp(d[1]), c1, c2],
          [clamp(d[2]), c1, c2]
        ].map(([dh, ca, cb]) => {
          const g1 = dh >= ca ? 1 : 0;
          const g2 = dh >= cb ? 1 : 0;
          const level = g1 + g2 - 1;
          if (level === 1) return 0;
          if (level === -1) return 3;
          return dh < 0 ? 2 : 1;
        }) as [number, number, number];
      } else {
        // Level-Shifted PWM (with non-distorted integer-based carrier phase)
        const carrier = 1 - 2 * Math.abs(u - 0.5);
        state = [pwmState(d[0], carrier), pwmState(d[1], carrier), pwmState(d[2], carrier)];
      }
    } else if (c.method === 'oss' && seq) {
      state = sequenceState(seq, (j % sub) / sub);
    }

    const volts = poleVoltages(state, c.vdc);

    for (let h = 0; h < 3; h++) {
      const k = j * 3 + h;
      iArr[k] = current[h];
      yArr[k] = y[h];
      refArr[k] = r[h];
      vArr[k] = volts[h];
      stateArr[k] = state[h];
      dArr[k] = d[h];
      rawArr[k] = raw[h];

      // Store 6 gate bits
      const gateOffset = j * 18 + h * 6;
      const g = ANPC_GATES[state[h]];
      for (let s = 0; s < 6; s++) {
        gatesArr[gateOffset + s] = g[s];
      }

      if (j < n - 1) {
        current[h] = decay * current[h] + gain * volts[h];
      }
    }
  }

  const resObj = {
    c,
    p,
    dt,
    n,
    t: tArr,
    i: iArr,
    y: yArr,
    ref: refArr,
    v: vArr,
    gates: gatesArr,
    state: stateArr,
    d: dArr,
    raw: rawArr,
    costs: costsArr,
    times: timesArr,
    decisions,
    metrics: { start: 0, end: 0, phase: [] as PhaseMetric[] },
  };

  resObj.metrics = computeMetrics(resObj);
  return resObj;
}

// Multi-controller benchmark comparison: runs all 5 controls under exact same conditions
export interface ComparisonRow {
  method: 'pi' | 'pr' | 'hyst' | 'fcs' | 'oss';
  label: string;
  relativeErrorPct: number | null;
  thdPct: number | null;
  phaseErrorDeg: number | null;
  meanSwitchingKHz: number;
}

export function runFairComparison(config: ANPCConfig): ComparisonRow[] {
  const methods: { id: 'pi' | 'pr' | 'hyst' | 'fcs' | 'oss'; label: string }[] = [
    { id: 'pi', label: 'PI (Carrier PWM)' },
    { id: 'pr', label: 'Resonant PR (Tuned f0)' },
    { id: 'hyst', label: 'Hysteresis (Tolerance Band)' },
    { id: 'fcs', label: 'FCS-MPC (27 States)' },
    { id: 'oss', label: 'OSS-MPC (Optimal Dwell)' },
  ];

  const rate = ['pi', 'pr'].includes(config.method) ? 2 * config.carrier : config.fs;

  return methods.map((m) => {
    const simConfig: ANPCConfig = {
      ...config,
      method: m.id,
      fs: rate,
      carrier: rate / 2,
    };
    const res = simulateANPC(simConfig);
    const p = res.metrics.phase;
    const worst = (k: 'relative' | 'thd' | 'phase') => {
      const vals = p.map((x) => x[k]).filter((v): v is number => v !== null && Number.isFinite(v));
      return vals.length ? Math.max(...vals.map(Math.abs)) : null;
    };
    const meanSwitching = p.reduce((s, x) => s + x.switching, 0) / 3000;

    return {
      method: m.id,
      label: m.label,
      relativeErrorPct: worst('relative'),
      thdPct: worst('thd'),
      phaseErrorDeg: worst('phase'),
      meanSwitchingKHz: meanSwitching,
    };
  });
}

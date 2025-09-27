import './theme.css';
import { createControls } from './controls';
import { createScene } from './scene';
import { createMessaging } from './messaging';
import { PHYSICS_CONSTANTS, createInitialState, stepState } from './physics';
import {
  getDefaultParams,
  loadPersistedState,
  parseHashParams,
  savePersistedState,
  writeHashParams
} from './utils';
import type { InitOptions, KiteParams, KiteState, Score } from './types';

const TEXT = {
  zh: {
    weak: '风势不足，试试加风或抬一点角度',
    stall: '角度过大，容易失速哦～',
    stable: '稳稳当当！'
  },
  en: {
    weak: 'Wind is weak, add more wind or lift the angle!',
    stall: 'Angle too high, you are stalling!',
    stable: 'Stable airflow!'
  }
};

interface Runtime {
  container: HTMLElement;
  canvasWrap: HTMLElement;
  controlsWrap: HTMLElement;
}

let runtime: Runtime | null = null;
let sceneHandle: ReturnType<typeof createScene> | null = null;
let controlsHandle: ReturnType<typeof createControls> | null = null;
let messagingHandle: ReturnType<typeof createMessaging> | null = null;
let currentOptions: InitOptions | null = null;
let currentParams: KiteParams;
let currentState: KiteState;
let teachMode = true;
let particlesEnabled = true;
let locale: 'zh' | 'en' = 'zh';
let theme: 'light' | 'ink' | 'auto' = 'light';
let twoParamMode = false;
let lastScoreReported = false;
let rafId = 0;
let running = false;
let lastStateEmit = 0;
let attempts = 1;
let lastToastType: 'weak' | 'stall' | 'stable' | '' = '';
let lastToastAt = 0;
const TOAST_COOLDOWN = 2400;

function resolveContainer(options?: InitOptions): HTMLElement {
  if (options?.container) {
    return options.container;
  }
  const el = document.getElementById('app');
  if (!el) throw new Error('[kite-lab] 未找到挂载容器 #app');
  return el;
}

function setupLayout(container: HTMLElement): Runtime {
  container.innerHTML = '';
  container.classList.add('kite-container');
  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'kite-canvas';
  const controlsWrap = document.createElement('div');
  controlsWrap.className = 'kite-controls';
  container.appendChild(canvasWrap);
  container.appendChild(controlsWrap);
  return { container, canvasWrap, controlsWrap };
}

function applyTheme(next: 'light' | 'ink' | 'auto') {
  theme = next;
  const root = document.documentElement;
  const resolved = next === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'ink' : next;
  root.setAttribute('data-theme', resolved);
}

function startLoop() {
  if (running) return;
  running = true;
  const loop = (time: number) => {
    if (!running) return;
    const seconds = time / 1000;
    const params = { ...currentParams };
    if (twoParamMode) {
      params.tension = 1;
    }
    currentState = stepState(currentState, params, seconds);
    handleStateUpdate(currentState);
    rafId = window.requestAnimationFrame(loop);
  };
  rafId = window.requestAnimationFrame(loop);
}

function stopLoop() {
  running = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

function handleStateUpdate(state: KiteState) {
  const now = performance.now();
  if (currentOptions?.onStateChange) {
    currentOptions.onStateChange(state);
  }
  if (messagingHandle && now - lastStateEmit > 200) {
    messagingHandle.postState(state);
    lastStateEmit = now;
  }
  if (!lastScoreReported && state.passed) {
    lastScoreReported = true;
    const score: Score = {
      stableSec: state.stableSeconds,
      attempts,
      passed: true
    };
    currentOptions?.onScore?.(score);
    messagingHandle?.postScore(score);
    showToast('stable');
    savePersistedState({ params: state.params, score });
  }
  if (!state.passed) {
    lastScoreReported = false;
  }
  if (state.stableSeconds === 0 && state.lift < state.gravity && state.params.wind < 1.2) {
    showToast('weak');
  }
  if (state.stableSeconds === 0 && state.pitch > PHYSICS_CONSTANTS.stallAlpha + 4) {
    showToast('stall');
  }
  writeHashParams(state.params);
}

function showToast(type: 'weak' | 'stall' | 'stable') {
  if (!sceneHandle) return;
  const now = performance.now();
  if (lastToastType === type && now - lastToastAt < TOAST_COOLDOWN) {
    return;
  }
  lastToastType = type;
  lastToastAt = now;
  sceneHandle.showToast(TEXT[locale][type]);
}

function buildInitialParams(options?: InitOptions): KiteParams {
  const persisted = loadPersistedState();
  const hash = parseHashParams();
  const defaults = getDefaultParams({ ...persisted?.params, ...options?.defaultParams, ...hash });
  const useTwoParam = options?.twoParamMode ?? twoParamMode;
  return {
    wind: defaults.wind,
    angle: defaults.angle,
    tension: useTwoParam ? 1 : defaults.tension
  };
}

function setup(options?: InitOptions) {
  currentOptions = options ?? null;
  locale = options?.locale ?? 'zh';
  theme = options?.theme ?? 'light';
  twoParamMode = options?.twoParamMode ?? false;
  teachMode = options?.mode === 'quiz' ? false : true;
  particlesEnabled = options?.enableParticles ?? true;
  applyTheme(theme);
  const container = resolveContainer(options);
  runtime = setupLayout(container);
  currentParams = buildInitialParams(options);
  attempts = 1;
  currentState = createInitialState(currentParams, 0);
  currentState.attempts = attempts;
  lastScoreReported = false;

  sceneHandle = createScene({
    container: runtime.canvasWrap,
    getState: () => currentState,
    getParams: () => currentParams,
    showVectors: () => teachMode,
    enableParticles: () => particlesEnabled,
    locale: () => locale
  });

  controlsHandle = createControls({
    container: runtime.controlsWrap,
    params: currentParams,
    locale,
    mode: options?.mode ?? 'learn',
    twoParamMode,
    enableParticles: particlesEnabled,
    onParamsChange: (params) => {
      currentParams = { ...params };
      if (twoParamMode) currentParams.tension = 1;
    },
    onReset: () => {
      reset();
    },
    onTeachToggle: (value) => {
      teachMode = value;
    },
    onParticleToggle: (value) => {
      particlesEnabled = value;
    },
    onTwoParamToggle: (value) => {
      twoParamMode = value;
    }
  });

  controlsHandle.setTwoParamMode(twoParamMode);

  messagingHandle = createMessaging({
    getState: () => currentState,
    onLocale: (value) => setLocale(value),
    onTheme: (value) => setTheme(value),
    onParams: (value) => setParams(value),
    onReset: () => reset()
  });

  messagingHandle.postReady();
  currentOptions?.onReady?.();

  startLoop();
}

function ensureSetup() {
  if (!runtime) throw new Error('[kite-lab] 组件尚未初始化');
}

function setTheme(value: 'light' | 'ink' | 'auto') {
  applyTheme(value);
}

function setLocale(value: 'zh' | 'en') {
  locale = value;
  controlsHandle?.setLocale(value);
}

function setParams(partial: Partial<KiteParams>) {
  ensureSetup();
  currentParams = { ...currentParams, ...partial };
  if (twoParamMode) currentParams.tension = 1;
  controlsHandle?.setParams(currentParams);
}

function getState(): KiteState {
  ensureSetup();
  return currentState;
}

function reset() {
  ensureSetup();
  attempts += 1;
  currentParams = buildInitialParams(currentOptions ?? undefined);
  controlsHandle?.setParams(currentParams);
  currentState = createInitialState(currentParams, 0);
  currentState.attempts = attempts;
  lastScoreReported = false;
  showToast('weak');
}

function destroy() {
  stopLoop();
  messagingHandle?.postEnd();
  messagingHandle?.dispose();
  messagingHandle = null;
  sceneHandle?.destroy();
  sceneHandle = null;
  controlsHandle?.destroy();
  controlsHandle = null;
  runtime = null;
}

function mount(el: HTMLElement, options?: InitOptions) {
  setup({ ...options, container: el });
}

function init(options?: InitOptions) {
  const container = resolveContainer(options);
  setup({ ...options, container });
}

const KiteLab = {
  mount,
  init,
  setTheme,
  setLocale,
  setParams,
  getState,
  reset,
  destroy
};

if (typeof window !== 'undefined') {
  (window as unknown as { KiteLab?: typeof KiteLab }).KiteLab = KiteLab;
}

export type { InitOptions, KiteState, KiteParams, Score };
export { KiteLab };

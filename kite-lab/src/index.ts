import './theme.css';
import { createControls, type GuidanceTone } from './controls';
import { createScene } from './scene';
import { createMessaging } from './messaging';
import { PHYSICS_CONSTANTS, createInitialState, stepState } from './physics';
import {
  getDefaultParams,
  loadPersistedState,
  parseHashParams,
  savePersistedState,
  writeHashParams,
  lerp
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


const GUIDANCE_TEXT = {
  zh: {
    default: '先加风，再抬角，再微调拉力，让升力略大于重力；也可以点击“开启演示”查看示范。',
    weak: '风势偏弱，把风势调到 1.2 以上，再慢慢抬角。',
    stall: '角度太高，降到 16° 以下更稳。',
    stable: '升力和重力接近平衡，保持当前组合。',
    demoIntro: '点击“开启演示”看看如何一步步调参。',
    demoIncreaseWind: '演示：先把风势调到约 1.4，建立稳定气流。',
    demoAngle: '演示：将提线角抬到 13° 左右，让升力贴合气流。',
    demoTension: '演示：把拉力微调到 0.92，减缓上下抖动。',
    demoHold: '演示：保持这一组数值，观察垂直速度回到 0。',
    demoComplete: '演示完成！试着自行微调或切换到测验模式。',
    demoRunning: '演示进行中，留意参数如何协同让风筝稳定。',
  },
  en: {
    default: 'Raise wind, lift the angle, then trim tension so lift just tops gravity—click “Start Demo” if you want to watch the walkthrough.',
    weak: 'Wind is still low. Raise it above 1.2 before you adjust the angle.',
    stall: 'Angle is high (>16°). Ease it down to stay smooth.',
    stable: 'Lift now balances gravity—keep this setup steady.',
    demoIntro: 'Start the demo to see how each step lines up.',
    demoIncreaseWind: 'Demo: nudge wind toward ~1.4 to build airflow.',
    demoAngle: 'Demo: lift the line angle to about 13° and align the kite.',
    demoTension: 'Demo: fine-tune tension near 0.92 to calm oscillation.',
    demoHold: 'Demo: hold steady and watch vertical speed return near zero.',
    demoComplete: 'Demo finished! Try tweaking yourself or switch to quiz mode.',
    demoRunning: 'Demo in progress—watch the sliders work together toward stability.',
  }
} as const;
type GuidanceKey = keyof (typeof GUIDANCE_TEXT)['zh'];

type DemoStep = {
  duration: number;
  target: Partial<KiteParams>;
  messageKey: GuidanceKey;
  tone?: GuidanceTone;
  toast?: 'weak' | 'stall' | 'stable';
};

const DEMO_SCRIPT: DemoStep[] = [
  {
    duration: 2,
    target: { wind: 1.4 },
    messageKey: 'demoIncreaseWind',
    tone: 'info',
    toast: 'weak'
  },
  {
    duration: 1.8,
    target: { angle: 13 },
    messageKey: 'demoAngle',
    tone: 'info'
  },
  {
    duration: 1.6,
    target: { tension: 0.92 },
    messageKey: 'demoTension',
    tone: 'info'
  },
  {
    duration: 2.8,
    target: {},
    messageKey: 'demoHold',
    tone: 'success',
    toast: 'stable'
  }
];

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
let autoInitDisabled = false;
let autoInitExecuted = false;
let removeAutoInitListener: (() => void) | null = null;
let lastGuidanceMessage = '';
let lastGuidanceTone: GuidanceTone = 'info';
let lastGuidanceKey: GuidanceKey | null = null;
let demoActive = false;
let demoPrevState: { teachMode: boolean; particlesEnabled: boolean; twoParamMode: boolean } | null = null;
let demoStepIndex = 0;
let demoStepElapsed = 0;
let demoStepStartParams: KiteParams | null = null;
let lastLoopSeconds = 0;

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
    const delta = lastLoopSeconds === 0 ? 0 : seconds - lastLoopSeconds;
    lastLoopSeconds = seconds;
    if (demoActive) {
      advanceDemo(Math.max(0, delta));
    }
    const params = { ...currentParams };
    if (twoParamMode) {
      params.tension = 1;
    }
    currentState = stepState(currentState, params, seconds);
    handleStateUpdate(currentState);
    rafId = window.requestAnimationFrame(loop);
  };
  lastLoopSeconds = 0;
  rafId = window.requestAnimationFrame(loop);
}

function stopLoop() {
  running = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  lastLoopSeconds = 0;
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
  updateGuidanceForState(state);
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

function setGuidanceMessage(message: string, tone: GuidanceTone = 'info', key: GuidanceKey | null = null) {
  if (!controlsHandle) return;
  if (lastGuidanceMessage === message && lastGuidanceTone === tone) {
    return;
  }
  controlsHandle.setGuidance(message, tone);
  lastGuidanceMessage = message;
  lastGuidanceTone = tone;
  lastGuidanceKey = key;
}

function setGuidanceFromKey(key: GuidanceKey, tone: GuidanceTone = 'info') {
  const map = GUIDANCE_TEXT[locale];
  setGuidanceMessage(map[key], tone, key);
}

function updateGuidanceForState(state: KiteState) {
  if (demoActive) return;
  if (state.passed) {
    setGuidanceFromKey('stable', 'success');
    return;
  }
  if (state.stableSeconds === 0 && state.lift < state.gravity && state.params.wind < 1.2) {
    setGuidanceFromKey('weak', 'warning');
    return;
  }
  if (state.stableSeconds === 0 && state.pitch > PHYSICS_CONSTANTS.stallAlpha + 3) {
    setGuidanceFromKey('stall', 'warning');
    return;
  }
  setGuidanceFromKey('default', 'info');
}

function toggleDemo(active: boolean) {
  if (active === demoActive) return;
  if (active) {
    startDemo();
  } else {
    stopDemo();
    updateGuidanceForState(currentState);
  }
}

function startDemo() {
  if (demoActive || !controlsHandle) return;
  demoActive = true;
  demoPrevState = {
    teachMode,
    particlesEnabled,
    twoParamMode
  };
  demoStepIndex = 0;
  demoStepElapsed = 0;
  demoStepStartParams = null;
  lastLoopSeconds = 0;

  const baseline: KiteParams = {
    wind: 0.6,
    angle: 6,
    tension: 0.88
  };
  currentParams = { ...currentParams, ...baseline };
  controlsHandle.setParams(currentParams);
  currentState = {
    ...currentState,
    params: currentParams,
    stableSeconds: 0,
    passed: false
  };

  if (!teachMode) {
    controlsHandle.setTeachMode(true);
  }
  if (!particlesEnabled) {
    controlsHandle.setParticlesEnabled(true);
  }
  if (twoParamMode) {
    controlsHandle.setTwoParamMode(false);
  }

  controlsHandle.setDemoActive(true);
  setGuidanceFromKey('demoRunning', 'info');
}

function stopDemo() {
  if (!demoActive) return;
  demoActive = false;
  controlsHandle?.setDemoActive(false);
  demoStepIndex = 0;
  demoStepElapsed = 0;
  demoStepStartParams = null;
  lastLoopSeconds = 0;
  if (demoPrevState) {
    const prev = demoPrevState;
    if (prev.teachMode !== teachMode) {
      controlsHandle?.setTeachMode(prev.teachMode);
    }
    if (prev.particlesEnabled !== particlesEnabled) {
      controlsHandle?.setParticlesEnabled(prev.particlesEnabled);
    }
    if (prev.twoParamMode !== twoParamMode) {
      controlsHandle?.setTwoParamMode(prev.twoParamMode);
    }
    demoPrevState = null;
  }
}

function advanceDemo(delta: number) {
  if (!demoActive || !controlsHandle) return;
  const step = DEMO_SCRIPT[demoStepIndex];
  if (!step) {
    completeDemo();
    return;
  }
  if (!demoStepStartParams) {
    demoStepStartParams = { ...currentParams };
    setGuidanceFromKey(step.messageKey, step.tone ?? 'info');
    if (step.toast) {
      showToast(step.toast);
    }
  }
  demoStepElapsed += delta;
  const start = demoStepStartParams;
  const target = step.target;
  const t = step.duration > 0 ? Math.min(1, demoStepElapsed / step.duration) : 1;
  const eased = 1 - Math.pow(1 - t, 3);
  if (target.wind !== undefined) {
    currentParams.wind = lerp(start.wind, target.wind, eased);
  }
  if (target.angle !== undefined) {
    currentParams.angle = lerp(start.angle, target.angle, eased);
  }
  if (target.tension !== undefined) {
    currentParams.tension = lerp(start.tension, target.tension, eased);
  }
  controlsHandle.setParams(currentParams);
  if (t >= 1) {
    currentParams = { ...currentParams, ...target };
    demoStepIndex += 1;
    demoStepElapsed = 0;
    demoStepStartParams = null;
    if (demoStepIndex >= DEMO_SCRIPT.length) {
      completeDemo();
    }
  }
}

function completeDemo() {
  stopDemo();
  setGuidanceFromKey('demoComplete', 'success');
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
    },
    onDemoToggle: (value) => {
      toggleDemo(value);
    }
  });

  controlsHandle.setTwoParamMode(twoParamMode);
  setGuidanceFromKey('default');

  messagingHandle = createMessaging({
    getState: () => currentState,
    onLocale: (value) => setLocale(value),
    onTheme: (value) => setTheme(value),
    onParams: (value) => setParams(value),
    onReset: () => reset()
  });

  messagingHandle.postReady();
  currentOptions?.onReady?.();

  if (options?.mode === 'demo') {
    toggleDemo(true);
  }

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
  lastGuidanceMessage = '';
  if (lastGuidanceKey) {
    setGuidanceFromKey(lastGuidanceKey, lastGuidanceTone);
  } else {
    updateGuidanceForState(currentState);
  }
}

function setParams(partial: Partial<KiteParams>) {
  ensureSetup();
  if (demoActive) {
    stopDemo();
  }
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
  if (demoActive) {
    stopDemo();
  }
  attempts += 1;
  currentParams = buildInitialParams(currentOptions ?? undefined);
  controlsHandle?.setParams(currentParams);
  currentState = createInitialState(currentParams, 0);
  currentState.attempts = attempts;
  lastScoreReported = false;
  setGuidanceFromKey('default');
  showToast('weak');
}

function destroy() {
  stopLoop();
  stopDemo();
  messagingHandle?.postEnd();
  messagingHandle?.dispose();
  messagingHandle = null;
  sceneHandle?.destroy();
  sceneHandle = null;
  controlsHandle?.destroy();
  controlsHandle = null;
  runtime = null;
}

function disableAutoInit() {
  autoInitDisabled = true;
  if (removeAutoInitListener) {
    removeAutoInitListener();
    removeAutoInitListener = null;
  }
}

function mount(el: HTMLElement, options?: InitOptions) {
  disableAutoInit();
  setup({ ...options, container: el });
}

function init(options?: InitOptions) {
  disableAutoInit();
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

  const runAutoInit = () => {
    if (autoInitDisabled || autoInitExecuted) return;
    const container = document.getElementById('app');
    if (!container) return;
    autoInitExecuted = true;
    disableAutoInit();
    KiteLab.init({ container });
  };

  if (document.readyState === 'loading') {
    const listener = () => {
      runAutoInit();
    };
    document.addEventListener('DOMContentLoaded', listener, { once: true });
    removeAutoInitListener = () => document.removeEventListener('DOMContentLoaded', listener);
  } else {
    runAutoInit();
  }
}

export type { InitOptions, KiteState, KiteParams, Score };
export { KiteLab };

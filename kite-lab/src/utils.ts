import type { KiteParams, PersistedState } from './types';

/** 夹取数值。 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 将风势刻度映射为实际风速（m/s）。
 */
export function mapWind(level: number): number {
  return 1 + clamp(level, 0, 5) * (8 / 5);
}

/**
 * 角度转弧度。
 */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * 弧度转角度。
 */
export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** 线性插值。 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 基于正弦与时间的简单噪声。
 */
export function gustNoise(base: number, time: number): number {
  const noise = Math.sin(time * 0.37 + base * 2.1) * 0.5 + Math.sin(time * 0.11) * 0.3;
  return 1 + noise * 0.05;
}

/** 节流函数，确保回调在时间窗内只执行一次。 */
export function throttle<T extends (...args: never[]) => void>(fn: T, wait: number): T {
  let timer: number | null = null;
  let lastArgs: Parameters<T> | null = null;
  const invoke = () => {
    if (lastArgs) {
      fn(...lastArgs);
      lastArgs = null;
      timer = window.setTimeout(invoke, wait);
    } else {
      timer = null;
    }
  };
  return ((...args: Parameters<T>) => {
    lastArgs = args;
    if (timer === null) {
      fn(...args);
      timer = window.setTimeout(() => {
        timer = null;
        if (lastArgs) {
          invoke();
        }
      }, wait);
    }
  }) as T;
}

const STORAGE_KEY = 'yy.kitelab.state.v1';

/** 读取持久化状态。 */
export function loadPersistedState(): PersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedState;
  } catch (err) {
    console.warn('[kite-lab] Failed to parse persisted state', err);
    return null;
  }
}

/** 写入持久化状态。 */
export function savePersistedState(state: PersistedState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[kite-lab] Failed to save state', err);
  }
}

/**
 * 解析 URL hash，返回初始参数。
 */
export function parseHashParams(): Partial<KiteParams> {
  if (typeof window === 'undefined') return {};
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return {};
  const result: Partial<KiteParams> = {};
  hash.split('&').forEach((pair) => {
    const [key, value] = pair.split('=');
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    if (key === 'wind') result.wind = num;
    if (key === 'angle') result.angle = num;
    if (key === 'tension') result.tension = num;
  });
  return result;
}

/**
 * 将当前参数写入 URL hash。
 */
export function writeHashParams(params: KiteParams): void {
  if (typeof window === 'undefined') return;
  const hash = `wind=${params.wind.toFixed(2)}&angle=${params.angle.toFixed(2)}&tension=${params.tension.toFixed(2)}`;
  window.history.replaceState(null, '', `#${hash}`);
}

/**
 * 默认参数。
 */
export function getDefaultParams(overrides?: Partial<KiteParams>): KiteParams {
  return {
    wind: 2,
    angle: 18,
    tension: 1,
    ...overrides
  };
}

/**
 * 参数配置对象。
 */
export interface KiteParams {
  /** 风势刻度，0-5 之间的整数。 */
  wind: number;
  /** 提线角度，单位度。 */
  angle: number;
  /** 拉力倍率。 */
  tension: number;
}

/**
 * 初始化配置项。
 */
export interface InitOptions {
  container?: HTMLElement;
  theme?: 'light' | 'ink' | 'auto';
  locale?: 'zh' | 'en';
  mode?: 'learn' | 'quiz' | 'demo';
  defaultParams?: Partial<KiteParams>;
  assetsBaseUrl?: string;
  enableParticles?: boolean;
  twoParamMode?: boolean;
  onReady?: () => void;
  onScore?: (score: Score) => void;
  onStateChange?: (state: KiteState) => void;
  onEnd?: () => void;
}

/**
 * 当前物理状态。
 */
export interface KiteState {
  params: KiteParams;
  velocity: { x: number; y: number };
  position: { x: number; y: number };
  pitch: number;
  lift: number;
  gravity: number;
  drag: number;
  stableSeconds: number;
  attempts: number;
  passed: boolean;
  timestamp: number;
}

/**
 * 成绩数据。
 */
export interface Score {
  stableSec: number;
  attempts: number;
  passed: boolean;
}

/**
 * 本地持久化结构。
 */
export interface PersistedState {
  params: KiteParams;
  score: Score;
}

export type MessageFromChildType = 'ready' | 'score' | 'state' | 'end';
export type MessageToChildType =
  | 'set-theme'
  | 'set-locale'
  | 'set-params'
  | 'reset'
  | 'get-state';

export interface MessageFromChild<T = unknown> {
  source: 'kite-lab';
  type: MessageFromChildType;
  payload?: T;
}

export interface MessageToChild<T = unknown> {
  target: 'kite-lab';
  type: MessageToChildType;
  payload?: T;
}

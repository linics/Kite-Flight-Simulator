import { clamp, gustNoise, mapWind } from './utils';
import type { KiteParams, KiteState } from './types';

/**
 * 物理常量，可根据课堂反馈调参。
 */
export const PHYSICS_CONSTANTS = {
  gravity: 1,
  liftCoeff: 0.11,
  dragCoeff: 0.12,
  extraDragCoeff: 0.04,
  baseDamping: 0.4,
  stallAlpha: 18,
  liftSlope: 0.08,
  stallSlope: 0.04,
  maxAlpha: 30,
  dt: 1 / 60,
  velocityClamp: 3,
  heightClamp: 1.2,
  pitchClamp: 45,
  stablePitch: 5,
  stableVelocity: 0.15,
  stableDuration: 2
} as const;

/**
 * 计算有效迎角。
 */
export function computeEffectiveAlpha(angle: number, pitch: number): number {
  const alpha = angle - pitch;
  return clamp(alpha, 0, PHYSICS_CONSTANTS.maxAlpha);
}

/**
 * 计算升力。
 */
export function computeLift(windSpeed: number, alpha: number): number {
  const { liftCoeff, liftSlope, stallAlpha, stallSlope } = PHYSICS_CONSTANTS;
  const effectiveAlpha = clamp(alpha, 0, PHYSICS_CONSTANTS.maxAlpha);
  const gain = effectiveAlpha <= stallAlpha
    ? liftSlope * effectiveAlpha
    : liftSlope * stallAlpha - stallSlope * (effectiveAlpha - stallAlpha);
  const liftFactor = Math.max(gain, 0);
  return liftCoeff * windSpeed * windSpeed * liftFactor;
}

/**
 * 计算阻力。
 */
export function computeDrag(windSpeed: number, lift: number): number {
  const { dragCoeff, extraDragCoeff } = PHYSICS_CONSTANTS;
  return dragCoeff * windSpeed * windSpeed + extraDragCoeff * lift * lift;
}

/**
 * 计算阻尼。
 */
export function computeDamping(tension: number): number {
  return PHYSICS_CONSTANTS.baseDamping * clamp(tension, 0.6, 1.4);
}

/**
 * 判定是否处于稳定状态。
 */
export function isStable(lift: number, gravity: number, pitch: number, velocityY: number): boolean {
  return (
    lift > gravity &&
    Math.abs(pitch) <= PHYSICS_CONSTANTS.stablePitch &&
    Math.abs(velocityY) <= PHYSICS_CONSTANTS.stableVelocity
  );
}

/**
 * 根据当前参数与状态进行积分，返回新的状态。
 */
export function stepState(prev: KiteState, params: KiteParams, time: number): KiteState {
  const dt = PHYSICS_CONSTANTS.dt;
  const baseWind = mapWind(params.wind);
  const gust = gustNoise(params.wind, time);
  const windSpeed = baseWind * gust;

  const pitch = clamp(prev.pitch, -PHYSICS_CONSTANTS.pitchClamp, PHYSICS_CONSTANTS.pitchClamp);
  const alpha = computeEffectiveAlpha(params.angle, pitch);
  const lift = computeLift(windSpeed * params.tension, alpha);
  const drag = computeDrag(windSpeed, lift);
  const gravity = PHYSICS_CONSTANTS.gravity;

  let velY = prev.velocity.y;
  let posY = prev.position.y;

  const verticalForce = lift - gravity - drag * 0.12 * Math.sign(velY);
  velY += verticalForce * dt;
  velY *= 1 - computeDamping(params.tension) * dt;
  velY = clamp(velY, -PHYSICS_CONSTANTS.velocityClamp, PHYSICS_CONSTANTS.velocityClamp);

  posY += velY * dt;
  posY = clamp(posY, -PHYSICS_CONSTANTS.heightClamp, PHYSICS_CONSTANTS.heightClamp);

  const targetPitch = alpha * 0.02;
  const pitchDamping = computeDamping(params.tension) * 0.02;
  const nextPitch = clamp(pitch + (targetPitch - pitch) * dt - pitchDamping, -PHYSICS_CONSTANTS.pitchClamp, PHYSICS_CONSTANTS.pitchClamp);

  const stable = isStable(lift, gravity, nextPitch, velY);
  const stableSeconds = stable ? prev.stableSeconds + dt : 0;
  const passed = stableSeconds >= PHYSICS_CONSTANTS.stableDuration ? true : prev.passed;

  return {
    ...prev,
    params,
    velocity: { x: 0, y: velY },
    position: { x: 0, y: posY },
    pitch: nextPitch,
    lift,
    gravity,
    drag,
    stableSeconds,
    passed,
    timestamp: time
  };
}

/**
 * 初始化状态。
 */
export function createInitialState(params: KiteParams, timestamp = 0): KiteState {
  return {
    params,
    velocity: { x: 0, y: 0 },
    position: { x: 0, y: 0 },
    pitch: 0,
    lift: 0,
    gravity: PHYSICS_CONSTANTS.gravity,
    drag: 0,
    stableSeconds: 0,
    attempts: 1,
    passed: false,
    timestamp
  };
}

/**
 * 累积尝试次数。
 */
export function incrementAttempts(state: KiteState): KiteState {
  return { ...state, attempts: state.attempts + 1, stableSeconds: 0, passed: false };
}

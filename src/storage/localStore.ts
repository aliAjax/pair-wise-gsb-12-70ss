/**
 * 本机存储层：只负责 FleetState 与 localStorage 之间的读写。
 * 不认识业务规则，数据损坏时回退到初始档案。
 */

import { createSeedState, type FleetState } from "../domain/fleet";

const STORAGE_KEY = "dfwlfront-3-tire-bay";

function isFleetState(value: unknown): value is FleetState {
  if (!value || typeof value !== "object") return false;
  const state = value as FleetState;
  return Array.isArray(state.tires) && Array.isArray(state.vehicles) && Array.isArray(state.loans);
}

export function loadState(): FleetState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return createSeedState();
  try {
    const parsed: unknown = JSON.parse(raw);
    return isFleetState(parsed) ? parsed : createSeedState();
  } catch {
    return createSeedState();
  }
}

export function saveState(state: FleetState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState(): FleetState {
  const seed = createSeedState();
  saveState(seed);
  return seed;
}

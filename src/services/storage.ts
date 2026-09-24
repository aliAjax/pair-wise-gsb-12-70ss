// 本机存储层：只负责 localStorage 的读写与数据校验，不含业务判断。

import { createSeedState, type FleetState } from "../domain/tires";

const STORAGE_KEY = "dfwlfront-3-tire-station";

export function loadState(): FleetState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedState();
    const parsed = JSON.parse(raw) as FleetState;
    if (!Array.isArray(parsed.tires) || !Array.isArray(parsed.vehicles)) {
      return createSeedState();
    }
    return parsed;
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

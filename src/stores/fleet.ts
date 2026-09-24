/**
 * 状态粘合层：页面只调这里的 action，action 走调度判断层落改，
 * 成功后交给本机存储层持久化，并把结果消息暴露给页面提示。
 */

import { computed, reactive, ref } from "vue";
import { defineStore } from "pinia";
import {
  applyRotation,
  changeVehicleStatus,
  checkoutSpare,
  mountTire,
  registerTire,
  removeTire,
  returnSpare,
  suggestRotation,
  unmountTire,
  type Result,
  type RotationPlan
} from "../domain/dispatch";
import type { FleetState, Tire, VehicleStatus, WheelPosition } from "../domain/fleet";
import { loadState, resetState, saveState } from "../storage/localStore";

export const useFleetStore = defineStore("fleet", () => {
  const state = reactive<FleetState>(loadState());
  const notice = ref<{ kind: "ok" | "error"; text: string } | null>(null);

  let timer: ReturnType<typeof setTimeout> | undefined;
  function run(result: Result): boolean {
    notice.value = { kind: result.ok ? "ok" : "error", text: result.message };
    clearTimeout(timer);
    timer = setTimeout(() => (notice.value = null), 4000);
    if (result.ok) saveState(state);
    return result.ok;
  }

  const metrics = computed(() => ({
    total: state.tires.length,
    mounted: state.tires.filter((t) => t.status === "在用").length,
    inStock: state.tires.filter((t) => t.status === "在库").length,
    loaned: state.tires.filter((t) => t.status === "借出占用").length,
    scrapped: state.tires.filter((t) => t.status === "报废").length
  }));

  const stockTires = computed(() => state.tires.filter((t) => t.status === "在库"));
  const openLoans = computed(() => state.loans.filter((l) => l.outcome === "借用中"));
  const closedLoans = computed(() => state.loans.filter((l) => l.outcome !== "借用中"));

  function tiresOf(vehicleId: string): Tire[] {
    return state.tires.filter((t) => t.status === "在用" && t.vehicleId === vehicleId);
  }

  function tireOf(vehicleId: string, position: WheelPosition): Tire | undefined {
    return state.tires.find(
      (t) => t.status === "在用" && t.vehicleId === vehicleId && t.position === position
    );
  }

  function tireById(tireId: string): Tire | undefined {
    return state.tires.find((t) => t.id === tireId);
  }

  return {
    state,
    notice,
    metrics,
    stockTires,
    openLoans,
    closedLoans,
    tiresOf,
    tireOf,
    tireById,
    registerTire: (input: { code: string; spec: string; treadDepth: number; slot: string }) =>
      run(registerTire(state, input)),
    removeTire: (tireId: string) => run(removeTire(state, tireId)),
    mountTire: (tireId: string, vehicleId: string, position: WheelPosition) =>
      run(mountTire(state, tireId, vehicleId, position)),
    unmountTire: (tireId: string) => run(unmountTire(state, tireId)),
    checkoutSpare: (tireId: string, purpose: string) => run(checkoutSpare(state, tireId, purpose)),
    returnSpare: (tireId: string, treadDepth: number, scrapReason: string) =>
      run(returnSpare(state, tireId, treadDepth, scrapReason)),
    suggestRotation: (vehicleId: string): RotationPlan => suggestRotation(state, vehicleId),
    applyRotation: (vehicleId: string) => run(applyRotation(state, vehicleId)),
    changeVehicleStatus: (vehicleId: string, status: VehicleStatus) =>
      run(changeVehicleStatus(state, vehicleId, status)),
    restoreSeed: () => {
      const seed = resetState();
      state.tires = seed.tires;
      state.vehicles = seed.vehicles;
      state.loans = seed.loans;
      notice.value = { kind: "ok", text: "已恢复示例数据" };
    }
  };
});

// 状态层：持有响应式状态，把资料层、调度判断层、存储层串起来。
// 每个动作 = 调用调度判断 → 成功则落盘 → 把结果交回页面。

import { computed, ref } from "vue";
import { defineStore } from "pinia";
import type { FleetState, TireStatus, WheelPosition } from "../domain/tires";
import * as dispatch from "../services/dispatch";
import type { Result } from "../services/dispatch";
import { loadState, resetState, saveState } from "../services/storage";

export const useTireStore = defineStore("tire-station", () => {
  const state = ref<FleetState>(loadState());

  function commit(result: Result): Result {
    if (result.ok) saveState(state.value);
    return result;
  }

  const tires = computed(() =>
    [...state.value.tires].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  );
  const vehicles = computed(() => state.value.vehicles);
  const activeVehicles = computed(() => vehicles.value.filter((v) => v.status === "active"));
  const serviceVehicles = computed(() => vehicles.value.filter((v) => v.status === "service"));

  const countByStatus = (status: TireStatus) =>
    state.value.tires.filter((tire) => tire.status === status).length;

  const metrics = computed(() => [
    { label: "轮胎总数", value: state.value.tires.length },
    { label: "装车在用", value: countByStatus("mounted") },
    { label: "在库", value: countByStatus("storage") },
    { label: "离库占用", value: countByStatus("out") },
    { label: "已报废", value: countByStatus("scrapped") },
    { label: "维修中车辆", value: serviceVehicles.value.length },
  ]);

  const tireAt = (plate: string, position: WheelPosition) =>
    dispatch.tireAt(state.value, plate, position);
  const rotationPlan = (plate: string) => dispatch.suggestRotation(state.value, plate);

  return {
    state,
    tires,
    vehicles,
    activeVehicles,
    serviceVehicles,
    metrics,
    tireAt,
    rotationPlan,
    registerTire: (input: { code: string; spec: string; treadDepth: number; storageSlot: string }) =>
      commit(dispatch.registerTire(state.value, input)),
    mountTire: (tireId: string, plate: string, position: WheelPosition) =>
      commit(dispatch.mountTire(state.value, tireId, plate, position)),
    dismountTire: (tireId: string, slot: string) =>
      commit(dispatch.dismountTire(state.value, tireId, slot)),
    checkoutSpare: (tireId: string) => commit(dispatch.checkoutSpare(state.value, tireId)),
    returnSpare: (tireId: string, treadDepth: number, slot: string, scrapReason: string) =>
      commit(dispatch.returnSpare(state.value, tireId, treadDepth, slot, scrapReason)),
    scrapTire: (tireId: string, reason: string) =>
      commit(dispatch.scrapTire(state.value, tireId, reason)),
    checkInVehicle: (plate: string) => commit(dispatch.checkInVehicle(state.value, plate)),
    deliverVehicle: (plate: string) => commit(dispatch.deliverVehicle(state.value, plate)),
    applyRotation: (plate: string) => commit(dispatch.applyRotation(state.value, plate)),
    resetAll() {
      state.value = resetState();
    },
  };
});

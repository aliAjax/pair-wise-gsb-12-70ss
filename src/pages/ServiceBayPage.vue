<script setup lang="ts">
import { reactive, ref } from "vue";
import {
  AXLE_OF,
  POSITION_LABELS,
  WHEEL_POSITIONS,
  treadLevel,
  type Vehicle,
  type WheelPosition
} from "../domain/fleet";
import { useFleetStore } from "../stores/fleet";

const store = useFleetStore();

const AXLES = ["前轴", "后轴"] as const;

function positionsOf(axle: (typeof AXLES)[number]): WheelPosition[] {
  return WHEEL_POSITIONS.filter((position) => AXLE_OF[position] === axle);
}

/** 每个空轮位各自的装胎选择 */
const mountPick = reactive<Record<string, string>>({});

function pickKey(vehicleId: string, position: WheelPosition): string {
  return `${vehicleId}:${position}`;
}

function mount(vehicleId: string, position: WheelPosition) {
  const key = pickKey(vehicleId, position);
  const tireId = mountPick[key];
  if (!tireId) return;
  if (store.mountTire(tireId, vehicleId, position)) {
    mountPick[key] = "";
  }
}

/** 当前展开换位建议的车辆 */
const rotationVehicleId = ref<string | null>(null);

function toggleRotation(vehicleId: string) {
  rotationVehicleId.value = rotationVehicleId.value === vehicleId ? null : vehicleId;
}

function rotationPlan(vehicleId: string) {
  return store.suggestRotation(vehicleId);
}

function confirmRotation(vehicleId: string) {
  if (store.applyRotation(vehicleId)) {
    rotationVehicleId.value = null;
  }
}

function checkIn(vehicle: Vehicle, status: "保养中" | "维修中") {
  store.changeVehicleStatus(vehicle.id, status);
}

function handOver(vehicle: Vehicle) {
  store.changeVehicleStatus(vehicle.id, "在途");
}
</script>

<template>
  <section class="list-panel">
    <div class="toolbar">
      <h2>车辆保养台</h2>
      <span class="hint">换位规则：前轴同侧移到后轴，后轴交叉移到前轴；确认后一次性更新四轮归属。</span>
    </div>

    <div class="vehicle-grid">
      <article v-for="vehicle in store.state.vehicles" :key="vehicle.id" class="vehicle-card">
        <div class="vehicle-head">
          <div>
            <p class="vehicle-title">{{ vehicle.plate }}</p>
            <p class="vehicle-model">{{ vehicle.model }}</p>
            <p v-if="vehicle.lastRotationAt" class="rotation-at">上次换位：{{ vehicle.lastRotationAt }}</p>
          </div>
          <div class="actions">
            <span class="status" :class="`st-${vehicle.status}`">{{ vehicle.status }}</span>
            <template v-if="vehicle.status === '在途'">
              <button type="button" @click="checkIn(vehicle, '保养中')">进站保养</button>
              <button class="secondary" type="button" @click="checkIn(vehicle, '维修中')">进站维修</button>
            </template>
            <button v-else type="button" @click="handOver(vehicle)">交车</button>
          </div>
        </div>

        <p v-if="vehicle.status === '维修中'" class="locked">
          维修中：四轮原占用保留到交车，暂不能拆装或换位。
        </p>

        <div v-for="axle in AXLES" :key="axle" class="axle">
          <p class="axle-label">{{ axle }}</p>
          <div class="wheel-row">
            <div v-for="position in positionsOf(axle)" :key="position" class="wheel">
              <p class="wheel-label">{{ POSITION_LABELS[position] }}</p>
              <template v-if="store.tireOf(vehicle.id, position)">
                <p class="wheel-tire">{{ store.tireOf(vehicle.id, position)!.code }}</p>
                <p class="wheel-meta">
                  {{ store.tireOf(vehicle.id, position)!.spec }} · 胎纹
                  <span class="tread" :class="treadLevel(store.tireOf(vehicle.id, position)!.treadDepth)">
                    {{ store.tireOf(vehicle.id, position)!.treadDepth.toFixed(1) }}mm
                  </span>
                </p>
                <div class="wheel-actions">
                  <button
                    class="secondary"
                    type="button"
                    :disabled="vehicle.status === '维修中'"
                    @click="store.unmountTire(store.tireOf(vehicle.id, position)!.id)"
                  >卸胎回库</button>
                </div>
              </template>
              <template v-else>
                <p class="wheel-empty">空位</p>
                <div class="mount-row">
                  <select v-model="mountPick[pickKey(vehicle.id, position)]" :disabled="vehicle.status === '维修中'">
                    <option value="">选择在库轮胎</option>
                    <option v-for="tire in store.stockTires" :key="tire.id" :value="tire.id">
                      {{ tire.code }} / {{ tire.spec }} / {{ tire.treadDepth.toFixed(1) }}mm
                    </option>
                  </select>
                  <button
                    type="button"
                    :disabled="vehicle.status === '维修中' || !mountPick[pickKey(vehicle.id, position)]"
                    @click="mount(vehicle.id, position)"
                  >装胎</button>
                </div>
              </template>
            </div>
          </div>
        </div>

        <div class="actions" style="margin-top: 12px">
          <button
            class="secondary"
            type="button"
            :disabled="vehicle.status !== '保养中'"
            @click="toggleRotation(vehicle.id)"
          >
            {{ rotationVehicleId === vehicle.id ? "收起换位建议" : "生成换位建议" }}
          </button>
          <span v-if="vehicle.status === '在途'" class="hint">进站保养后可生成换位建议</span>
        </div>

        <div v-if="rotationVehicleId === vehicle.id" class="rotation-box">
          <template v-if="rotationPlan(vehicle.id).ok">
            <div class="move-grid">
              <div
                v-for="move in (rotationPlan(vehicle.id) as { ok: true; moves: { tireId: string; code: string; from: WheelPosition; to: WheelPosition }[] }).moves"
                :key="move.tireId"
                class="move"
              >
                <strong>{{ move.code }}</strong>
                {{ POSITION_LABELS[move.from] }} <span class="arrow">→</span> {{ POSITION_LABELS[move.to] }}
              </div>
            </div>
            <div class="actions">
              <button type="button" @click="confirmRotation(vehicle.id)">确认换位，一次性更新四轮</button>
              <button class="secondary" type="button" @click="rotationVehicleId = null">取消</button>
            </div>
          </template>
          <p v-else class="hint warn-text">{{ (rotationPlan(vehicle.id) as { ok: false; message: string }).message }}</p>
        </div>
      </article>
    </div>
  </section>
</template>

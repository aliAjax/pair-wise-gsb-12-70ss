<script setup lang="ts">
// 页面层：只做展示和交互，业务判断全部交给 store / 调度层。
import { computed, reactive, ref } from "vue";
import { useTireStore } from "./stores/tireStore";
import {
  LOW_TREAD_MM,
  MIN_TREAD_MM,
  TIRE_SPECS,
  TIRE_STATUS_LABELS,
  VEHICLE_STATUS_LABELS,
  WHEEL_POSITIONS,
  wheelLabel,
  type Tire,
  type TireStatus,
  type Vehicle,
  type WheelPosition,
} from "./domain/tires";
import type { Result } from "./services/dispatch";

const store = useTireStore();

const notice = ref<{ type: "ok" | "err"; text: string } | null>(null);
function show(result: Result) {
  notice.value = result.ok
    ? { type: "ok", text: result.message }
    : { type: "err", text: result.error };
}

// ---------- 轮胎档案登记 ----------
const registerForm = reactive({
  code: "",
  spec: TIRE_SPECS[0] as string,
  treadDepth: 8,
  storageSlot: "",
});

function submitRegister() {
  const result = store.registerTire({ ...registerForm });
  show(result);
  if (result.ok) {
    registerForm.code = "";
    registerForm.treadDepth = 8;
    registerForm.storageSlot = "";
  }
}

// ---------- 车辆进站 / 交车 ----------
function checkIn(vehicle: Vehicle) {
  show(store.checkInVehicle(vehicle.plate));
}
function deliver(vehicle: Vehicle) {
  show(store.deliverVehicle(vehicle.plate));
}

// ---------- 换位建议 ----------
const rotationPlate = ref("");
const effectivePlate = computed(
  () => rotationPlate.value || store.serviceVehicles[0]?.plate || ""
);
const plan = computed(() =>
  effectivePlate.value ? store.rotationPlan(effectivePlate.value) : null
);

function confirmRotation() {
  if (!effectivePlate.value) return;
  show(store.applyRotation(effectivePlate.value));
}

// ---------- 台账筛选 ----------
const statusFilter = ref<"all" | TireStatus>("all");
const filteredTires = computed(() =>
  statusFilter.value === "all"
    ? store.tires
    : store.tires.filter((tire) => tire.status === statusFilter.value)
);

const chartRows = computed(() =>
  (Object.keys(TIRE_STATUS_LABELS) as TireStatus[]).map((status) => ({
    label: TIRE_STATUS_LABELS[status],
    value: store.tires.filter((tire) => tire.status === status).length,
  }))
);
const maxChart = computed(() => Math.max(1, ...chartRows.value.map((row) => row.value)));

// ---------- 弹窗（装车 / 卸下 / 归还 / 报废） ----------
type DialogKind = "mount" | "dismount" | "return" | "scrap";
const dialog = ref<{ kind: DialogKind; tireId: string } | null>(null);
const dialogTitles: Record<DialogKind, string> = {
  mount: "装车",
  dismount: "卸下回库",
  return: "备胎归还",
  scrap: "报废",
};

const mountForm = reactive({ plate: "", position: "" as WheelPosition | "" });
const dismountForm = reactive({ slot: "" });
const returnForm = reactive({ tread: 3, slot: "", scrapReason: "" });
const scrapForm = reactive({ reason: "" });

const returnNeedsScrap = computed(() => returnForm.tread < MIN_TREAD_MM);

const occupiedPositions = computed(() => {
  const taken = new Set<WheelPosition>();
  if (!mountForm.plate) return taken;
  for (const pos of WHEEL_POSITIONS) {
    if (store.tireAt(mountForm.plate, pos.key)) taken.add(pos.key);
  }
  return taken;
});

function openDialog(kind: DialogKind, tire: Tire) {
  dialog.value = { kind, tireId: tire.id };
  if (kind === "mount") {
    mountForm.plate = store.activeVehicles[0]?.plate ?? "";
    mountForm.position = "";
  } else if (kind === "dismount") {
    dismountForm.slot = "";
  } else if (kind === "return") {
    returnForm.tread = tire.treadDepth;
    returnForm.slot = "";
    returnForm.scrapReason = "";
  } else {
    scrapForm.reason = "";
  }
}

function confirmDialog() {
  const current = dialog.value;
  if (!current) return;
  let result: Result;
  if (current.kind === "mount") {
    if (!mountForm.plate || !mountForm.position) {
      show({ ok: false, error: "请选择车辆和轮位" });
      return;
    }
    result = store.mountTire(current.tireId, mountForm.plate, mountForm.position);
  } else if (current.kind === "dismount") {
    result = store.dismountTire(current.tireId,dismountForm.slot);
  } else if (current.kind === "return") {
    result = store.returnSpare(
      current.tireId,
      returnForm.tread,
      returnForm.slot,
      returnForm.scrapReason
    );
  } else {
    result = store.scrapTire(current.tireId, scrapForm.reason);
  }
  show(result);
  if (result.ok) dialog.value = null;
}

// ---------- 展示辅助 ----------
function locationText(tire: Tire): string {
  switch (tire.status) {
    case "storage":
      return `仓位 ${tire.storageSlot}`;
    case "mounted":
      return `${tire.vehiclePlate} · ${wheelLabel(tire.wheelPosition as WheelPosition)}`;
    case "out":
      return "离库占用中（备胎）";
    case "scrapped":
      return `报废：${tire.scrapReason}`;
  }
}

function treadClass(tread: number): string {
  if (tread < MIN_TREAD_MM) return "tread-bad";
  if (tread < LOW_TREAD_MM) return "tread-warn";
  return "";
}

function dismountBlocked(tire: Tire): boolean {
  const vehicle = store.vehicles.find((v) => v.plate === tire.vehiclePlate);
  return vehicle?.status === "service";
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resetAll() {
  if (window.confirm("确定恢复示例数据？当前改动将丢失。")) {
    store.resetAll();
    notice.value = { type: "ok", text: "已恢复示例数据" };
  }
}
</script>

<template>
  <main class="app">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">物流车队 · 轮胎管理</p>
          <h1>轮胎维护台</h1>
          <p class="subtitle">
            轮胎档案登记编号、规格、胎纹、仓位与装车位置；备胎离库先占用、归还复测胎纹；
            车辆进站保养按轴位给出换位建议，确认后一次性更新四轮归属。
          </p>
        </div>
        <div class="stack">
          <span class="tag">报废线 {{ MIN_TREAD_MM }}mm</span>
          <span class="tag">预警线 {{ LOW_TREAD_MM }}mm</span>
          <button class="secondary" type="button" @click="resetAll">恢复示例数据</button>
        </div>
      </header>

      <p v-if="notice" class="notice" :class="notice.type">{{ notice.text }}</p>

      <section class="metrics">
        <article v-for="metric in store.metrics" :key="metric.label" class="metric">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
        </article>
      </section>

      <section class="workspace">
        <div class="col">
          <form class="panel" @submit.prevent="submitRegister">
            <h2>轮胎档案登记</h2>
            <div class="form-grid">
              <label>
                轮胎编号
                <input v-model="registerForm.code" placeholder="如 LT-9004" required />
              </label>
              <label>
                规格
                <select v-model="registerForm.spec">
                  <option v-for="spec in TIRE_SPECS" :key="spec">{{ spec }}</option>
                </select>
              </label>
              <label>
                胎纹深度（mm）
                <input v-model.number="registerForm.treadDepth" type="number" step="0.1" min="0" max="25" required />
              </label>
              <label>
                仓位
                <input v-model="registerForm.storageSlot" placeholder="如 A-03" required />
              </label>
              <button type="submit">登记入库</button>
            </div>
          </form>

          <section class="panel">
            <h2>车辆与轮位</h2>
            <div class="record-grid">
              <article v-for="vehicle in store.vehicles" :key="vehicle.plate" class="record">
                <div class="record-head">
                  <p class="record-title">{{ vehicle.plate }} <small class="model">{{ vehicle.model }}</small></p>
                  <span class="tag-status" :class="vehicle.status === 'service' ? 'tag-service' : 'tag-active'">
                    {{ VEHICLE_STATUS_LABELS[vehicle.status] }}
                  </span>
                </div>
                <p v-if="vehicle.status === 'service'" class="hint">
                  {{ formatTime(vehicle.checkedInAt) }} 进站，维修中原轮位占用保留到交车
                </p>
                <div class="wheel-map">
                  <div v-for="pos in WHEEL_POSITIONS" :key="pos.key" class="wheel-cell">
                    {{ pos.label }}（{{ pos.axle }}）
                    <template v-if="store.tireAt(vehicle.plate, pos.key)">
                      <strong>{{ store.tireAt(vehicle.plate, pos.key)?.code }}</strong>
                      <span :class="treadClass(store.tireAt(vehicle.plate, pos.key)?.treadDepth ?? 0)">
                        {{ store.tireAt(vehicle.plate, pos.key)?.treadDepth }}mm
                      </span>
                    </template>
                    <strong v-else class="vacant">空缺</strong>
                  </div>
                </div>
                <div class="actions">
                  <button v-if="vehicle.status === 'active'" type="button" @click="checkIn(vehicle)">进站保养</button>
                  <button v-else type="button" @click="deliver(vehicle)">交车</button>
                </div>
              </article>
            </div>
          </section>
        </div>

        <div class="col">
          <section v-if="store.serviceVehicles.length" class="panel rotation">
            <div class="toolbar">
              <h2>换位建议（按轴位）</h2>
              <select v-model="rotationPlate">
                <option v-for="vehicle in store.serviceVehicles" :key="vehicle.plate" :value="vehicle.plate">
                  {{ vehicle.plate }}
                </option>
              </select>
            </div>
            <template v-if="plan">
              <p class="pattern">{{ plan.pattern }}</p>
              <p class="hint">{{ plan.reason }}</p>
              <ul v-if="plan.warnings.length" class="warn-list">
                <li v-for="warning in plan.warnings" :key="warning">⚠ {{ warning }}</li>
              </ul>
              <div class="moves">
                <div v-for="move in plan.moves" :key="move.tireId" class="move">
                  <span>{{ move.code }}</span>
                  <span>{{ wheelLabel(move.from) }} → {{ wheelLabel(move.to) }}</span>
                </div>
              </div>
              <button type="button" @click="confirmRotation">确认换位，一次性更新四轮归属</button>
            </template>
            <p v-else class="hint">该车四轮未装齐，无法生成换位方案；请先补齐装车。</p>
          </section>

          <section class="panel">
            <div class="toolbar">
              <h2>轮胎台账</h2>
              <select v-model="statusFilter">
                <option value="all">全部状态</option>
                <option v-for="(label, key) in TIRE_STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
              </select>
            </div>

            <div class="record-grid">
              <div v-if="filteredTires.length === 0" class="empty">暂无匹配轮胎</div>
              <article v-for="tire in filteredTires" :key="tire.id" class="record">
                <div class="record-head">
                  <p class="record-title">{{ tire.code }} <small class="model">{{ tire.spec }}</small></p>
                  <span class="tag-status" :class="`tag-${tire.status}`">{{ TIRE_STATUS_LABELS[tire.status] }}</span>
                </div>
                <div class="details">
                  <span>胎纹深度: <b :class="treadClass(tire.treadDepth)">{{ tire.treadDepth }}mm</b></span>
                  <span>位置: {{ locationText(tire) }}</span>
                  <span>更新: {{ formatTime(tire.updatedAt) }}</span>
                </div>
                <div class="actions">
                  <template v-if="tire.status === 'storage'">
                    <button type="button" @click="openDialog('mount', tire)">装车</button>
                    <button class="secondary" type="button" @click="show(store.checkoutSpare(tire.id))">离库占用</button>
                    <button class="danger" type="button" @click="openDialog('scrap', tire)">报废</button>
                  </template>
                  <template v-else-if="tire.status === 'mounted'">
                    <button
                      type="button"
                      :disabled="dismountBlocked(tire)"
                      :title="dismountBlocked(tire) ? '车辆维修中，原占用保留到交车' : ''"
                      @click="openDialog('dismount', tire)"
                    >卸下回库</button>
                  </template>
                  <template v-else-if="tire.status === 'out'">
                    <button type="button" @click="openDialog('return', tire)">归还</button>
                    <button class="danger" type="button" @click="openDialog('scrap', tire)">报废</button>
                  </template>
                </div>
              </article>
            </div>

            <div class="mini-chart">
              <div v-for="row in chartRows" :key="row.label" class="bar">
                <span>{{ row.label }}</span>
                <div class="bar-track"><div class="bar-fill" :style="{ width: `${(row.value / maxChart) * 100}%` }" /></div>
                <strong>{{ row.value }}</strong>
              </div>
            </div>
          </section>
        </div>
      </section>

      <div v-if="dialog" class="dialog-mask" @click.self="dialog = null">
        <div class="dialog">
          <h3>{{ dialogTitles[dialog.kind] }}</h3>

          <template v-if="dialog.kind === 'mount'">
            <label>
              车辆
              <select v-model="mountForm.plate">
                <option v-for="vehicle in store.activeVehicles" :key="vehicle.plate" :value="vehicle.plate">
                  {{ vehicle.plate }}（{{ vehicle.model }}）
                </option>
              </select>
            </label>
            <label>
              轮位
              <select v-model="mountForm.position">
                <option value="" disabled>请选择轮位</option>
                <option
                  v-for="pos in WHEEL_POSITIONS"
                  :key="pos.key"
                  :value="pos.key"
                  :disabled="occupiedPositions.has(pos.key)"
                >
                  {{ pos.label }}（{{ pos.axle }}）{{ occupiedPositions.has(pos.key) ? "· 已占用" : "" }}
                </option>
              </select>
            </label>
            <p class="hint">同一车同一轮位只能有一只在用轮胎；维修中车辆不开放装车。</p>
          </template>

          <template v-else-if="dialog.kind === 'dismount'">
            <label>
              回库仓位
              <input v-model="dismountForm.slot" placeholder="如 A-03" />
            </label>
          </template>

          <template v-else-if="dialog.kind === 'return'">
            <label>
              归还实测胎纹（mm）
              <input v-model.number="returnForm.tread" type="number" step="0.1" min="0" max="25" />
            </label>
            <template v-if="returnNeedsScrap">
              <p class="warn-text">胎纹低于报废线 {{ MIN_TREAD_MM }}mm，归还将直接转报废，必须写明理由。</p>
              <label>
                报废理由
                <textarea v-model="returnForm.scrapReason" placeholder="如：胎纹磨至极限，胎肩偏磨" />
              </label>
            </template>
            <label v-else>
              归还仓位
              <input v-model="returnForm.slot" placeholder="如 A-03" />
            </label>
          </template>

          <template v-else>
            <label>
              报废理由
              <textarea v-model="scrapForm.reason" placeholder="如：胎侧扎伤无法修补" />
            </label>
          </template>

          <div class="actions">
            <button type="button" @click="confirmDialog">确认</button>
            <button class="secondary" type="button" @click="dialog = null">取消</button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

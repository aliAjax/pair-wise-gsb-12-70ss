<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { TIRE_SPECS, TIRE_STATUSES, POSITION_LABELS, treadLevel, type TireStatus } from "../domain/fleet";
import { useFleetStore } from "../stores/fleet";

const store = useFleetStore();

const form = reactive({ code: "", spec: "", treadDepth: 8.0, slot: "" });
const filter = ref<TireStatus | "全部">("全部");

const filteredTires = computed(() => {
  const list = filter.value === "全部"
    ? store.state.tires
    : store.state.tires.filter((tire) => tire.status === filter.value);
  return [...list].sort((a, b) => a.code.localeCompare(b.code));
});

function vehiclePlate(vehicleId: string | null): string {
  if (!vehicleId) return "";
  return store.state.vehicles.find((v) => v.id === vehicleId)?.plate ?? "未知车辆";
}

function mountedText(tire: { vehicleId: string | null; position: keyof typeof POSITION_LABELS | null }): string {
  if (!tire.vehicleId || !tire.position) return "—";
  return `${vehiclePlate(tire.vehicleId)} / ${POSITION_LABELS[tire.position]}`;
}

function submit() {
  if (store.registerTire({ ...form })) {
    form.code = "";
    form.spec = "";
    form.treadDepth = 8.0;
    form.slot = "";
  }
}
</script>

<template>
  <section class="workspace">
    <form class="panel" @submit.prevent="submit">
      <h2>登记轮胎档案</h2>
      <div class="form-grid">
        <label>
          轮胎编号
          <input v-model="form.code" placeholder="如 LT-2006" required />
        </label>
        <label>
          规格
          <select v-model="form.spec" required>
            <option value="">请选择</option>
            <option v-for="spec in TIRE_SPECS" :key="spec">{{ spec }}</option>
          </select>
        </label>
        <label>
          胎纹深度 (mm)
          <input v-model.number="form.treadDepth" type="number" min="0.1" step="0.1" required />
        </label>
        <label>
          仓位
          <input v-model="form.slot" placeholder="如 A-08" required />
        </label>
        <button type="submit">登记入库</button>
        <p class="hint">新轮胎默认登记为「在库」，装车、借出请到对应页面办理。</p>
      </div>
    </form>

    <section class="list-panel">
      <div class="toolbar">
        <h2>轮胎档案</h2>
        <select v-model="filter">
          <option>全部</option>
          <option v-for="status in TIRE_STATUSES" :key="status">{{ status }}</option>
        </select>
      </div>

      <div class="record-grid">
        <div v-if="filteredTires.length === 0" class="empty">暂无匹配轮胎</div>
        <article v-for="tire in filteredTires" :key="tire.id" class="record">
          <div class="record-head">
            <p class="record-title">{{ tire.code }} <span class="spec">{{ tire.spec }}</span></p>
            <span class="status" :class="`st-${tire.status}`">{{ tire.status }}</span>
          </div>
          <div class="details">
            <span>
              胎纹深度:
              <strong class="tread" :class="treadLevel(tire.treadDepth)">{{ tire.treadDepth.toFixed(1) }}mm</strong>
              <em v-if="treadLevel(tire.treadDepth) === 'warn'">临近报废线</em>
              <em v-else-if="treadLevel(tire.treadDepth) === 'scrap'">已低于报废线</em>
            </span>
            <span>仓位: {{ tire.slot }}</span>
            <span>装车位置: {{ mountedText(tire) }}</span>
            <span v-if="tire.scrappedAt">报废时间: {{ tire.scrappedAt }}</span>
          </div>
          <p v-if="tire.scrapReason" class="note">报废理由：{{ tire.scrapReason }}</p>
          <div class="actions">
            <button
              v-if="tire.status === '在库' || tire.status === '报废'"
              class="danger"
              type="button"
              @click="store.removeTire(tire.id)"
            >删除档案</button>
          </div>
        </article>
      </div>
    </section>
  </section>
</template>

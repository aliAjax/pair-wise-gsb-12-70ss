<script setup lang="ts">
import { ref } from "vue";
import { useFleetStore } from "./stores/fleet";
import TireRegistryPage from "./pages/TireRegistryPage.vue";
import SpareDeskPage from "./pages/SpareDeskPage.vue";
import ServiceBayPage from "./pages/ServiceBayPage.vue";

const store = useFleetStore();

const tabs = [
  { key: "registry", label: "轮胎档案", component: TireRegistryPage },
  { key: "spare", label: "备胎借还", component: SpareDeskPage },
  { key: "bay", label: "进站保养", component: ServiceBayPage }
] as const;

const activeTab = ref<(typeof tabs)[number]["key"]>("registry");
</script>

<template>
  <main class="app">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">车队轮胎管理 · 物流行业前端最小闭环</p>
          <h1>轮胎维护台</h1>
          <p class="subtitle">
            轮胎档案登记编号、规格、胎纹、仓位与装车位置；同一轮位只认一只在用胎。
            备胎离库即占用，归还胎纹不足直接转报废；车辆进站保养按轴位给出换位建议，确认后一次性更新四轮归属，维修中车辆的原占用保留到交车。
          </p>
        </div>
        <div class="stack">
          <span class="tag">Vue3</span>
          <span class="tag">Vite</span>
          <span class="tag">TypeScript</span>
          <span class="tag">Pinia</span>
          <button class="secondary" type="button" @click="store.restoreSeed()">恢复示例数据</button>
        </div>
      </header>

      <section class="metrics">
        <article class="metric">
          <span>轮胎总数</span>
          <strong>{{ store.metrics.total }}</strong>
        </article>
        <article class="metric">
          <span>在用</span>
          <strong>{{ store.metrics.mounted }}</strong>
        </article>
        <article class="metric">
          <span>在库</span>
          <strong>{{ store.metrics.inStock }}</strong>
        </article>
        <article class="metric">
          <span>借出占用</span>
          <strong>{{ store.metrics.loaned }}</strong>
        </article>
        <article class="metric">
          <span>报废</span>
          <strong>{{ store.metrics.scrapped }}</strong>
        </article>
      </section>

      <p v-if="store.notice" class="notice" :class="store.notice.kind">{{ store.notice.text }}</p>

      <nav class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="tab"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </nav>

      <TireRegistryPage v-if="activeTab === 'registry'" />
      <SpareDeskPage v-else-if="activeTab === 'spare'" />
      <ServiceBayPage v-else />
    </div>
  </main>
</template>

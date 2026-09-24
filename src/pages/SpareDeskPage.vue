<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { TREAD_SCRAP_LIMIT, type SpareLoan } from "../domain/fleet";
import { useFleetStore } from "../stores/fleet";

const store = useFleetStore();

const checkout = reactive({ tireId: "", purpose: "" });

/** 归还表单：按借出单展开 */
const returningId = ref<string | null>(null);
const returnForm = reactive({ treadDepth: 0, scrapReason: "" });

const willScrap = computed(() => returnForm.treadDepth > 0 && returnForm.treadDepth < TREAD_SCRAP_LIMIT);

function tireOf(loan: SpareLoan) {
  return store.tireById(loan.tireId);
}

function submitCheckout() {
  if (store.checkoutSpare(checkout.tireId, checkout.purpose)) {
    checkout.tireId = "";
    checkout.purpose = "";
  }
}

function openReturn(loan: SpareLoan) {
  returningId.value = loan.id;
  returnForm.treadDepth = tireOf(loan)?.treadDepth ?? 0;
  returnForm.scrapReason = "";
}

function submitReturn(loan: SpareLoan) {
  if (store.returnSpare(loan.tireId, returnForm.treadDepth, returnForm.scrapReason)) {
    returningId.value = null;
  }
}
</script>

<template>
  <section class="workspace">
    <form class="panel" @submit.prevent="submitCheckout">
      <h2>备胎离库</h2>
      <div class="form-grid">
        <label>
          选择在库备胎
          <select v-model="checkout.tireId" required>
            <option value="">请选择</option>
            <option v-for="tire in store.stockTires" :key="tire.id" :value="tire.id">
              {{ tire.code }} / {{ tire.spec }} / 胎纹 {{ tire.treadDepth.toFixed(1) }}mm / 仓位 {{ tire.slot }}
            </option>
          </select>
        </label>
        <label>
          离库去向/用途
          <input v-model="checkout.purpose" placeholder="如 沪A-82L6 随车备胎" required />
        </label>
        <button type="submit" :disabled="store.stockTires.length === 0">离库并占用</button>
        <p class="hint">离库后立即标记「借出占用」，归还前不会再被派出，避免备胎重复占用。</p>
        <p v-if="store.stockTires.length === 0" class="hint warn-text">仓库已无在库备胎。</p>
      </div>
    </form>

    <section class="list-panel">
      <div class="toolbar">
        <h2>借出中（{{ store.openLoans.length }}）</h2>
      </div>

      <div class="record-grid">
        <div v-if="store.openLoans.length === 0" class="empty">当前没有借出的备胎</div>
        <article v-for="loan in store.openLoans" :key="loan.id" class="record">
          <div class="record-head">
            <p class="record-title">{{ tireOf(loan)?.code ?? "未知轮胎" }}</p>
            <span class="status st-借出占用">借出占用</span>
          </div>
          <div class="details">
            <span>去向: {{ loan.purpose }}</span>
            <span>离库时间: {{ loan.outAt }}</span>
            <span>规格: {{ tireOf(loan)?.spec }}</span>
            <span>离库时胎纹: {{ tireOf(loan)?.treadDepth.toFixed(1) }}mm</span>
          </div>

          <div v-if="returningId === loan.id" class="return-box">
            <label>
              归还实测胎纹 (mm)
              <input v-model.number="returnForm.treadDepth" type="number" min="0" step="0.1" required />
            </label>
            <p v-if="willScrap" class="hint warn-text">
              低于 {{ TREAD_SCRAP_LIMIT }}mm 报废线，确认后将转报废，必须填写报废理由。
            </p>
            <label v-if="willScrap">
              报废理由
              <textarea v-model="returnForm.scrapReason" placeholder="如：归还时胎纹磨至 1.2mm，低于报废线" />
            </label>
            <div class="actions">
              <button type="button" :class="willScrap ? 'danger' : ''" @click="submitReturn(loan)">
                {{ willScrap ? "确认归还并报废" : "确认归还入库" }}
              </button>
              <button class="secondary" type="button" @click="returningId = null">取消</button>
            </div>
          </div>
          <div v-else class="actions">
            <button type="button" @click="openReturn(loan)">办理归还</button>
          </div>
        </article>
      </div>

      <template v-if="store.closedLoans.length">
        <div class="toolbar sub">
          <h2>借还记录</h2>
        </div>
        <div class="record-grid">
          <article v-for="loan in store.closedLoans" :key="loan.id" class="record">
            <div class="record-head">
              <p class="record-title">{{ tireOf(loan)?.code ?? "未知轮胎" }}</p>
              <span class="status" :class="loan.outcome === '归还报废' ? 'st-报废' : 'st-在库'">{{ loan.outcome }}</span>
            </div>
            <div class="details">
              <span>去向: {{ loan.purpose }}</span>
              <span>离库: {{ loan.outAt }}</span>
              <span>归还: {{ loan.backAt }}</span>
            </div>
            <p v-if="tireOf(loan)?.scrapReason" class="note">报废理由：{{ tireOf(loan)?.scrapReason }}</p>
          </article>
        </div>
      </template>
    </section>
  </section>
</template>

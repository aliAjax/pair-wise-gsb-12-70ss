/**
 * 调度判断层：全部业务规则都在这里，以纯函数形式操作 FleetState。
 * 先校验、后落改，失败时不产生任何副作用；页面和存储不直接改数据。
 */

import {
  POSITION_LABELS,
  TREAD_SCRAP_LIMIT,
  type FleetState,
  type SpareLoan,
  type Tire,
  type Vehicle,
  type VehicleStatus,
  type WheelPosition
} from "./fleet";

export type Result = { ok: true; message: string } | { ok: false; message: string };

const ok = (message: string): Result => ({ ok: true, message });
const fail = (message: string): Result => ({ ok: false, message });

export function nowText(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function findTire(state: FleetState, tireId: string): Tire | undefined {
  return state.tires.find((tire) => tire.id === tireId);
}

export function findVehicle(state: FleetState, vehicleId: string): Vehicle | undefined {
  return state.vehicles.find((vehicle) => vehicle.id === vehicleId);
}

/** 某车某轮位当前在用的轮胎 */
export function tireAt(state: FleetState, vehicleId: string, position: WheelPosition): Tire | undefined {
  return state.tires.find(
    (tire) => tire.status === "在用" && tire.vehicleId === vehicleId && tire.position === position
  );
}

/** 维修中车辆：原占用保留到交车，禁止一切轮胎调整 */
function assertVehicleEditable(vehicle: Vehicle): Result | null {
  if (vehicle.status === "维修中") {
    return fail(`${vehicle.plate} 维修中，轮胎原占用保留到交车，暂不能拆装或换位`);
  }
  return null;
}

/** 登记新轮胎档案 */
export function registerTire(
  state: FleetState,
  input: { code: string; spec: string; treadDepth: number; slot: string }
): Result {
  const code = input.code.trim();
  const slot = input.slot.trim();
  if (!code) return fail("请填写轮胎编号");
  if (!input.spec) return fail("请选择轮胎规格");
  if (!slot) return fail("请填写仓位");
  if (!(input.treadDepth > 0)) return fail("胎纹深度必须大于 0");
  if (state.tires.some((tire) => tire.code === code)) return fail(`编号 ${code} 已存在，不能重复登记`);
  state.tires.push({
    id: crypto.randomUUID(),
    code,
    spec: input.spec,
    treadDepth: input.treadDepth,
    slot,
    status: "在库",
    vehicleId: null,
    position: null,
    scrapReason: null,
    scrappedAt: null
  });
  return ok(`轮胎 ${code} 已登记入库，仓位 ${slot}`);
}

/** 删除档案：只允许在库或已报废的轮胎，避免拆掉在用占用 */
export function removeTire(state: FleetState, tireId: string): Result {
  const tire = findTire(state, tireId);
  if (!tire) return fail("轮胎不存在");
  if (tire.status === "在用") return fail(`${tire.code} 正在车上使用，请先在保养台卸胎`);
  if (tire.status === "借出占用") return fail(`${tire.code} 借出未归还，不能删除`);
  state.tires = state.tires.filter((item) => item.id !== tireId);
  return ok(`轮胎 ${tire.code} 的档案已删除`);
}

/** 装胎：同一车同一轮位只能有一只在用 */
export function mountTire(state: FleetState, tireId: string, vehicleId: string, position: WheelPosition): Result {
  const tire = findTire(state, tireId);
  const vehicle = findVehicle(state, vehicleId);
  if (!tire || !vehicle) return fail("轮胎或车辆不存在");
  const locked = assertVehicleEditable(vehicle);
  if (locked) return locked;
  if (tire.status !== "在库") return fail(`${tire.code} 当前状态为「${tire.status}」，只有在库轮胎可以装车`);
  const occupant = tireAt(state, vehicleId, position);
  if (occupant) {
    return fail(`${vehicle.plate} 的${POSITION_LABELS[position]}已有 ${occupant.code} 在用，同一轮位只能装一只`);
  }
  tire.status = "在用";
  tire.vehicleId = vehicleId;
  tire.position = position;
  return ok(`${tire.code} 已装到 ${vehicle.plate} ${POSITION_LABELS[position]}`);
}

/** 卸胎回库：保留原仓位 */
export function unmountTire(state: FleetState, tireId: string): Result {
  const tire = findTire(state, tireId);
  if (!tire) return fail("轮胎不存在");
  if (tire.status !== "在用" || !tire.vehicleId) return fail(`${tire.code} 不在车上，无需拆卸`);
  const vehicle = findVehicle(state, tire.vehicleId);
  if (vehicle) {
    const locked = assertVehicleEditable(vehicle);
    if (locked) return locked;
  }
  const from = `${vehicle?.plate ?? "车辆"} ${tire.position ? POSITION_LABELS[tire.position] : ""}`;
  tire.status = "在库";
  tire.vehicleId = null;
  tire.position = null;
  return ok(`${tire.code} 已从${from}卸下，回到仓位 ${tire.slot}`);
}

/** 备胎离库：只有在库轮胎可借，离库即占用，防止重复占用 */
export function checkoutSpare(state: FleetState, tireId: string, purpose: string): Result {
  const tire = findTire(state, tireId);
  if (!tire) return fail("轮胎不存在");
  if (tire.status !== "在库") {
    return fail(`${tire.code} 当前状态为「${tire.status}」，不能重复离库`);
  }
  const trimmed = purpose.trim();
  if (!trimmed) return fail("请填写离库去向/用途");
  tire.status = "借出占用";
  state.loans.unshift({
    id: crypto.randomUUID(),
    tireId: tire.id,
    purpose: trimmed,
    outAt: nowText(),
    backAt: null,
    outcome: "借用中"
  });
  return ok(`${tire.code} 已离库并标记占用，归还前不会再被派出`);
}

/** 备胎归还：胎纹不足转报废且必须写明理由，否则回库 */
export function returnSpare(state: FleetState, tireId: string, treadDepth: number, scrapReason: string): Result {
  const tire = findTire(state, tireId);
  if (!tire) return fail("轮胎不存在");
  if (tire.status !== "借出占用") return fail(`${tire.code} 不在借出状态，不能办理归还`);
  if (!(treadDepth >= 0)) return fail("请填写归还时实测胎纹深度");
  const loan = state.loans.find((item) => item.tireId === tireId && item.outcome === "借用中");
  tire.treadDepth = treadDepth;
  if (treadDepth < TREAD_SCRAP_LIMIT) {
    const reason = scrapReason.trim();
    if (!reason) {
      return fail(`归还胎纹 ${treadDepth}mm 低于 ${TREAD_SCRAP_LIMIT}mm 报废线，必须填写报废理由`);
    }
    tire.status = "报废";
    tire.scrapReason = reason;
    tire.scrappedAt = nowText();
    if (loan) closeLoan(loan, "归还报废");
    return ok(`${tire.code} 胎纹不足，已转报废：${reason}`);
  }
  tire.status = "在库";
  if (loan) closeLoan(loan, "归还入库");
  return ok(`${tire.code} 已归还入库，仓位 ${tire.slot}，胎纹 ${treadDepth}mm`);
}

function closeLoan(loan: SpareLoan, outcome: "归还入库" | "归还报废"): void {
  loan.outcome = outcome;
  loan.backAt = nowText();
}

/** 换位规则（前交叉法）：前轴同侧移到后轴，后轴交叉移到前轴 */
export const ROTATION_MAP: Record<WheelPosition, WheelPosition> = {
  FL: "RL",
  FR: "RR",
  RL: "FR",
  RR: "FL"
};

export interface RotationMove {
  tireId: string;
  code: string;
  from: WheelPosition;
  to: WheelPosition;
}

export type RotationPlan =
  | { ok: true; moves: RotationMove[] }
  | { ok: false; message: string };

/** 按轴位生成换位建议：仅保养中车辆，且四轮必须装齐 */
export function suggestRotation(state: FleetState, vehicleId: string): RotationPlan {
  const vehicle = findVehicle(state, vehicleId);
  if (!vehicle) return { ok: false, message: "车辆不存在" };
  if (vehicle.status !== "保养中") {
    return { ok: false, message: `${vehicle.plate} 需先进站保养，才能生成换位建议` };
  }
  const moves: RotationMove[] = [];
  for (const from of Object.keys(ROTATION_MAP) as WheelPosition[]) {
    const tire = tireAt(state, vehicleId, from);
    if (!tire) {
      return { ok: false, message: `${vehicle.plate} ${POSITION_LABELS[from]}未装胎，四轮装齐后才能换位` };
    }
    moves.push({ tireId: tire.id, code: tire.code, from, to: ROTATION_MAP[from] });
  }
  return { ok: true, moves };
}

/** 确认换位：校验通过后一次性更新四轮归属 */
export function applyRotation(state: FleetState, vehicleId: string): Result {
  const vehicle = findVehicle(state, vehicleId);
  if (!vehicle) return fail("车辆不存在");
  const plan = suggestRotation(state, vehicleId);
  if (!plan.ok) return fail(plan.message);
  for (const move of plan.moves) {
    const tire = findTire(state, move.tireId);
    if (tire) tire.position = move.to;
  }
  vehicle.lastRotationAt = nowText();
  return ok(`${vehicle.plate} 已完成换位，四轮归属一次性更新`);
}

/** 车辆状态流转：在途 ⇄ 保养中 / 维修中；维修中期间轮胎占用保留到交车 */
export function changeVehicleStatus(state: FleetState, vehicleId: string, status: VehicleStatus): Result {
  const vehicle = findVehicle(state, vehicleId);
  if (!vehicle) return fail("车辆不存在");
  if (vehicle.status === status) return fail(`${vehicle.plate} 已处于「${status}」`);
  vehicle.status = status;
  if (status === "维修中") return ok(`${vehicle.plate} 已进站维修，轮胎原占用保留到交车`);
  if (status === "保养中") return ok(`${vehicle.plate} 已进站保养，可生成换位建议`);
  return ok(`${vehicle.plate} 已交车，恢复在途`);
}

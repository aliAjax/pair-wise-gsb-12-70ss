// 调度判断层：装车约束、备胎流转、换位建议等全部业务规则。
// 纯函数，直接读写传入的 FleetState，不碰 localStorage，也不依赖 Vue。

import {
  MIN_TREAD_MM,
  LOW_TREAD_MM,
  WHEEL_POSITIONS,
  axleOf,
  wheelLabel,
  type FleetState,
  type Tire,
  type Vehicle,
  type WheelPosition,
} from "../domain/tires";

export type Result = { ok: true; message: string } | { ok: false; error: string };

const ok = (message: string): Result => ({ ok: true, message });
const fail = (error: string): Result => ({ ok: false, error });

const now = () => new Date().toISOString();

export function findTire(state: FleetState, tireId: string): Tire | undefined {
  return state.tires.find((tire) => tire.id === tireId);
}

export function findVehicle(state: FleetState, plate: string): Vehicle | undefined {
  return state.vehicles.find((vehicle) => vehicle.plate === plate);
}

/** 某车某轮位上当前在用的轮胎（同一车同一轮位最多一只） */
export function tireAt(state: FleetState, plate: string, position: WheelPosition): Tire | undefined {
  return state.tires.find(
    (tire) => tire.status === "mounted" && tire.vehiclePlate === plate && tire.wheelPosition === position
  );
}

export function isSlotTaken(state: FleetState, slot: string, excludeId?: string): boolean {
  return state.tires.some(
    (tire) => tire.status === "storage" && tire.storageSlot === slot && tire.id !== excludeId
  );
}

function validTread(tread: number): boolean {
  return Number.isFinite(tread) && tread >= 0 && tread <= 25;
}

/** 登记轮胎档案：编号唯一、仓位不冲突，默认入库存放 */
export function registerTire(
  state: FleetState,
  input: { code: string; spec: string; treadDepth: number; storageSlot: string }
): Result {
  const code = input.code.trim();
  const slot = input.storageSlot.trim();
  if (!code) return fail("请填写轮胎编号");
  if (state.tires.some((tire) => tire.code === code)) return fail(`编号 ${code} 已存在，不能重复登记`);
  if (!slot) return fail("请填写仓位");
  if (isSlotTaken(state, slot)) return fail(`仓位 ${slot} 已有在库轮胎`);
  if (!validTread(input.treadDepth)) return fail("胎纹深度需在 0–25mm 之间");

  state.tires.unshift({
    id: crypto.randomUUID(),
    code,
    spec: input.spec,
    treadDepth: input.treadDepth,
    status: "storage",
    storageSlot: slot,
    vehiclePlate: null,
    wheelPosition: null,
    scrapReason: null,
    updatedAt: now(),
  });
  return ok(`轮胎 ${code} 已登记入库，存放于 ${slot}`);
}

/** 装车：同一车同一轮位只能有一只在用；维修中车辆禁止变更装车 */
export function mountTire(state: FleetState, tireId: string, plate: string, position: WheelPosition): Result {
  const tire = findTire(state, tireId);
  if (!tire) return fail("轮胎不存在");
  if (tire.status !== "storage") return fail("只有在库轮胎可以装车");
  const vehicle = findVehicle(state, plate);
  if (!vehicle) return fail("车辆不存在");
  if (vehicle.status === "service") return fail(`${plate} 维修中，原轮位占用保留到交车，禁止直接装车`);
  const occupant = tireAt(state, plate, position);
  if (occupant) {
    return fail(`同一车同一轮位只能有一只在用：${plate} ${wheelLabel(position)}已装 ${occupant.code}`);
  }

  tire.status = "mounted";
  tire.vehiclePlate = plate;
  tire.wheelPosition = position;
  tire.storageSlot = null;
  tire.updatedAt = now();
  return ok(`${tire.code} 已装到 ${plate} ${wheelLabel(position)}（${axleOf(position)}）`);
}

/** 卸下回库：维修中车辆的原占用保留到交车，不允许拆 */
export function dismountTire(state: FleetState, tireId: string, slot: string): Result {
  const tire = findTire(state, tireId);
  if (!tire) return fail("轮胎不存在");
  if (tire.status !== "mounted" || !tire.vehiclePlate) return fail("该轮胎不在车上");
  const vehicle = findVehicle(state, tire.vehiclePlate);
  if (vehicle?.status === "service") {
    return fail(`${vehicle.plate} 维修中，原轮位占用保留到交车，请交车后再拆卸`);
  }
  const target = slot.trim();
  if (!target) return fail("请填写回库仓位");
  if (isSlotTaken(state, target)) return fail(`仓位 ${target} 已有在库轮胎`);

  const from = `${tire.vehiclePlate} ${wheelLabel(tire.wheelPosition as WheelPosition)}`;
  tire.status = "storage";
  tire.vehiclePlate = null;
  tire.wheelPosition = null;
  tire.storageSlot = target;
  tire.updatedAt = now();
  return ok(`${tire.code} 已从${from}卸下，回库 ${target}`);
}

/** 备胎离库：先记为占用，防止被重复领用 */
export function checkoutSpare(state: FleetState, tireId: string): Result {
  const tire = findTire(state, tireId);
  if (!tire) return fail("轮胎不存在");
  if (tire.status !== "storage") return fail("只有在库轮胎可以办理离库");

  const slot = tire.storageSlot;
  tire.status = "out";
  tire.storageSlot = null;
  tire.updatedAt = now();
  return ok(`备胎 ${tire.code} 已从 ${slot ?? "库内"} 离库，先记为占用，归还时需复测胎纹`);
}

/** 备胎归还：复测胎纹，不足报废线直接转报废并必须写明理由 */
export function returnSpare(
  state: FleetState,
  tireId: string,
  treadDepth: number,
  slot: string,
  scrapReason: string
): Result {
  const tire = findTire(state, tireId);
  if (!tire) return fail("轮胎不存在");
  if (tire.status !== "out") return fail("只有离库占用的轮胎需要归还");
  if (!validTread(treadDepth)) return fail("请填写有效的实测胎纹深度（0–25mm）");

  tire.treadDepth = treadDepth;

  if (treadDepth < MIN_TREAD_MM) {
    const reason = scrapReason.trim();
    if (!reason) return fail(`胎纹 ${treadDepth}mm 低于报废线 ${MIN_TREAD_MM}mm，转报废必须写明理由`);
    tire.status = "scrapped";
    tire.scrapReason = reason;
    tire.storageSlot = null;
    tire.updatedAt = now();
    return ok(`胎纹不足，${tire.code} 已转报废：${reason}`);
  }

  const target = slot.trim();
  if (!target) return fail("请填写归还仓位");
  if (isSlotTaken(state, target)) return fail(`仓位 ${target} 已有在库轮胎`);
  tire.status = "storage";
  tire.storageSlot = target;
  tire.updatedAt = now();
  return ok(`${tire.code} 已归还入库 ${target}，实测胎纹 ${treadDepth}mm`);
}

/** 库内/离库轮胎直接报废（如扎伤、鼓包），必须写明理由 */
export function scrapTire(state: FleetState, tireId: string, reason: string): Result {
  const tire = findTire(state, tireId);
  if (!tire) return fail("轮胎不存在");
  if (tire.status === "mounted") return fail("装车在用的轮胎请先卸下再报废");
  if (tire.status === "scrapped") return fail("该轮胎已报废");
  const text = reason.trim();
  if (!text) return fail("报废必须写明理由");

  tire.status = "scrapped";
  tire.scrapReason = text;
  tire.storageSlot = null;
  tire.updatedAt = now();
  return ok(`${tire.code} 已报废：${text}`);
}

/** 进站保养：车辆转维修中，四轮原占用保留到交车 */
export function checkInVehicle(state: FleetState, plate: string): Result {
  const vehicle = findVehicle(state, plate);
  if (!vehicle) return fail("车辆不存在");
  if (vehicle.status === "service") return fail(`${plate} 已在维修中`);

  vehicle.status = "service";
  vehicle.checkedInAt = now();
  return ok(`${plate} 已进站保养，原轮位占用保留至交车`);
}

/** 交车：解除维修保护，车辆恢复在运 */
export function deliverVehicle(state: FleetState, plate: string): Result {
  const vehicle = findVehicle(state, plate);
  if (!vehicle) return fail("车辆不存在");
  if (vehicle.status !== "service") return fail(`${plate} 不在维修中`);

  vehicle.status = "active";
  vehicle.checkedInAt = null;
  return ok(`${plate} 已交车，恢复在运`);
}

export interface RotationMove {
  tireId: string;
  code: string;
  from: WheelPosition;
  to: WheelPosition;
}

export interface RotationPlan {
  plate: string;
  pattern: string;
  reason: string;
  moves: RotationMove[];
  warnings: string[];
}

/**
 * 按轴位生成换位建议：
 * 比较前后轴平均胎纹，让磨损较轻的一轴换到磨耗更快的前轴，交叉换向均衡偏磨。
 */
export function suggestRotation(state: FleetState, plate: string): RotationPlan | null {
  const vehicle = findVehicle(state, plate);
  if (!vehicle || vehicle.status !== "service") return null;

  const byPosition = WHEEL_POSITIONS.map((pos) => ({
    position: pos.key,
    tire: tireAt(state, plate, pos.key),
  }));
  if (byPosition.some((item) => !item.tire)) return null; // 四轮未装齐不出方案

  const treadOf = (position: WheelPosition) =>
    byPosition.find((item) => item.position === position)?.tire?.treadDepth ?? 0;
  const frontAvg = (treadOf("FL") + treadOf("FR")) / 2;
  const rearAvg = (treadOf("RL") + treadOf("RR")) / 2;
  const diff = rearAvg - frontAvg;

  let pattern: string;
  let mapping: Record<WheelPosition, WheelPosition>;
  if (diff > 0.3) {
    // 后轴胎纹更深：后轴同侧前移，前轴交叉后移
    pattern = "后轴交叉前移";
    mapping = { RL: "FL", RR: "FR", FL: "RR", FR: "RL" };
  } else if (diff < -0.3) {
    // 前轴胎纹更深：前轴同侧后移，后轴交叉前移
    pattern = "前轴交叉后移";
    mapping = { FL: "RL", FR: "RR", RL: "FR", RR: "FL" };
  } else {
    pattern = "四角交叉换位";
    mapping = { FL: "RR", FR: "RL", RL: "FR", RR: "FL" };
  }

  const reason = `前轴平均胎纹 ${frontAvg.toFixed(1)}mm，后轴 ${rearAvg.toFixed(1)}mm，按轴位磨损差采用「${pattern}」均衡磨耗`;

  const warnings: string[] = [];
  for (const item of byPosition) {
    const tire = item.tire as Tire;
    const label = `${wheelLabel(item.position)}（${tire.code}）`;
    if (tire.treadDepth < MIN_TREAD_MM) {
      warnings.push(`${label}胎纹 ${tire.treadDepth}mm 已低于报废线 ${MIN_TREAD_MM}mm，建议更换而非换位`);
    } else if (tire.treadDepth < LOW_TREAD_MM) {
      warnings.push(`${label}胎纹 ${tire.treadDepth}mm 接近预警线 ${LOW_TREAD_MM}mm，换位后重点跟踪`);
    }
  }

  const moves: RotationMove[] = byPosition.map((item) => ({
    tireId: (item.tire as Tire).id,
    code: (item.tire as Tire).code,
    from: item.position,
    to: mapping[item.position],
  }));

  return { plate, pattern, reason, moves, warnings };
}

/** 确认换位：校验目标轮位互不冲突后，一次性更新四轮归属 */
export function applyRotation(state: FleetState, plate: string): Result {
  const plan = suggestRotation(state, plate);
  if (!plan) return fail("车辆不在维修中或四轮未装齐，无法生成换位方案");

  const targets = plan.moves.map((move) => move.to);
  if (new Set(targets).size !== WHEEL_POSITIONS.length) return fail("换位目标轮位冲突，已取消");

  const stamp = now();
  for (const move of plan.moves) {
    const tire = findTire(state, move.tireId);
    if (!tire) return fail(`轮胎 ${move.code} 不存在，已取消`);
    tire.wheelPosition = move.to;
    tire.updatedAt = stamp;
  }
  return ok(`已确认「${plan.pattern}」，${plate} 四轮归属一次性更新完成`);
}

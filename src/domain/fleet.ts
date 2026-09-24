/**
 * 轮胎资料层：领域类型、业务常量与初始档案数据。
 * 只描述"数据长什么样"，不含调度判断，也不关心存储和页面。
 */

export type WheelPosition = "FL" | "FR" | "RL" | "RR";

export const WHEEL_POSITIONS: readonly WheelPosition[] = ["FL", "FR", "RL", "RR"];

export const POSITION_LABELS: Record<WheelPosition, string> = {
  FL: "左前",
  FR: "右前",
  RL: "左后",
  RR: "右后"
};

export const AXLE_OF: Record<WheelPosition, "前轴" | "后轴"> = {
  FL: "前轴",
  FR: "前轴",
  RL: "后轴",
  RR: "后轴"
};

export type TireStatus = "在库" | "在用" | "借出占用" | "报废";
export const TIRE_STATUSES: readonly TireStatus[] = ["在库", "在用", "借出占用", "报废"];

export type VehicleStatus = "在途" | "保养中" | "维修中";

export interface Tire {
  id: string;
  /** 轮胎编号 */
  code: string;
  /** 规格，如 12R22.5 */
  spec: string;
  /** 胎纹深度 mm */
  treadDepth: number;
  /** 仓库仓位 */
  slot: string;
  status: TireStatus;
  /** 装车归属：车辆 + 轮位，未装车为 null */
  vehicleId: string | null;
  position: WheelPosition | null;
  /** 报废信息 */
  scrapReason: string | null;
  scrappedAt: string | null;
}

export interface Vehicle {
  id: string;
  plate: string;
  model: string;
  status: VehicleStatus;
  /** 最近一次完成换位的日期 */
  lastRotationAt: string | null;
}

export type LoanOutcome = "借用中" | "归还入库" | "归还报废";

export interface SpareLoan {
  id: string;
  tireId: string;
  /** 离库去向/用途 */
  purpose: string;
  outAt: string;
  backAt: string | null;
  outcome: LoanOutcome;
}

export interface FleetState {
  tires: Tire[];
  vehicles: Vehicle[];
  loans: SpareLoan[];
}

/** 胎纹低于该值必须报废（国标 1.6mm） */
export const TREAD_SCRAP_LIMIT = 1.6;
/** 胎纹低于该值提示偏磨/临近更换 */
export const TREAD_WARN_LIMIT = 3.0;

export const TIRE_SPECS: readonly string[] = ["12R22.5", "11R22.5", "295/80R22.5", "315/80R22.5"];

export type TreadLevel = "ok" | "warn" | "scrap";

export function treadLevel(depth: number): TreadLevel {
  if (depth <= TREAD_SCRAP_LIMIT) return "scrap";
  if (depth <= TREAD_WARN_LIMIT) return "warn";
  return "ok";
}

/** 初始档案：演示用轮胎与车辆资料 */
export function createSeedState(): FleetState {
  const tires: Tire[] = [
    // 沪A-82L6 四轮在用，前轮新、后轮偏磨，适合做换位演示
    { id: "t-1001", code: "LT-1001", spec: "12R22.5", treadDepth: 8.2, slot: "A-01", status: "在用", vehicleId: "v-1", position: "FL", scrapReason: null, scrappedAt: null },
    { id: "t-1002", code: "LT-1002", spec: "12R22.5", treadDepth: 7.9, slot: "A-02", status: "在用", vehicleId: "v-1", position: "FR", scrapReason: null, scrappedAt: null },
    { id: "t-1003", code: "LT-1003", spec: "12R22.5", treadDepth: 6.1, slot: "A-03", status: "在用", vehicleId: "v-1", position: "RL", scrapReason: null, scrappedAt: null },
    { id: "t-1004", code: "LT-1004", spec: "12R22.5", treadDepth: 5.8, slot: "A-04", status: "在用", vehicleId: "v-1", position: "RR", scrapReason: null, scrappedAt: null },
    // 沪B-73K9 四轮在用
    { id: "t-1005", code: "LT-1005", spec: "11R22.5", treadDepth: 7.4, slot: "B-01", status: "在用", vehicleId: "v-2", position: "FL", scrapReason: null, scrappedAt: null },
    { id: "t-1006", code: "LT-1006", spec: "11R22.5", treadDepth: 7.1, slot: "B-02", status: "在用", vehicleId: "v-2", position: "FR", scrapReason: null, scrappedAt: null },
    { id: "t-1007", code: "LT-1007", spec: "11R22.5", treadDepth: 4.2, slot: "B-03", status: "在用", vehicleId: "v-2", position: "RL", scrapReason: null, scrappedAt: null },
    { id: "t-1008", code: "LT-1008", spec: "11R22.5", treadDepth: 4.0, slot: "B-04", status: "在用", vehicleId: "v-2", position: "RR", scrapReason: null, scrappedAt: null },
    // 沪C-51D2 维修中，四轮占用保留
    { id: "t-1009", code: "LT-1009", spec: "12R22.5", treadDepth: 6.6, slot: "C-01", status: "在用", vehicleId: "v-3", position: "FL", scrapReason: null, scrappedAt: null },
    { id: "t-1010", code: "LT-1010", spec: "12R22.5", treadDepth: 6.4, slot: "C-02", status: "在用", vehicleId: "v-3", position: "FR", scrapReason: null, scrappedAt: null },
    { id: "t-1011", code: "LT-1011", spec: "12R22.5", treadDepth: 5.5, slot: "C-03", status: "在用", vehicleId: "v-3", position: "RL", scrapReason: null, scrappedAt: null },
    { id: "t-1012", code: "LT-1012", spec: "12R22.5", treadDepth: 5.3, slot: "C-04", status: "在用", vehicleId: "v-3", position: "RR", scrapReason: null, scrappedAt: null },
    // 沪D-66Q7 只装了前两轮，留空位演示装胎
    { id: "t-1013", code: "LT-1013", spec: "295/80R22.5", treadDepth: 8.8, slot: "D-01", status: "在用", vehicleId: "v-4", position: "FL", scrapReason: null, scrappedAt: null },
    { id: "t-1014", code: "LT-1014", spec: "295/80R22.5", treadDepth: 8.5, slot: "D-02", status: "在用", vehicleId: "v-4", position: "FR", scrapReason: null, scrappedAt: null },
    // 在库备胎
    { id: "t-2001", code: "LT-2001", spec: "12R22.5", treadDepth: 9.5, slot: "A-05", status: "在库", vehicleId: null, position: null, scrapReason: null, scrappedAt: null },
    { id: "t-2002", code: "LT-2002", spec: "12R22.5", treadDepth: 8.8, slot: "A-06", status: "在库", vehicleId: null, position: null, scrapReason: null, scrappedAt: null },
    { id: "t-2003", code: "LT-2003", spec: "11R22.5", treadDepth: 2.4, slot: "B-05", status: "在库", vehicleId: null, position: null, scrapReason: null, scrappedAt: null },
    { id: "t-2004", code: "LT-2004", spec: "295/80R22.5", treadDepth: 9.0, slot: "D-03", status: "在库", vehicleId: null, position: null, scrapReason: null, scrappedAt: null },
    // 借出占用中的备胎
    { id: "t-2005", code: "LT-2005", spec: "12R22.5", treadDepth: 7.6, slot: "A-07", status: "借出占用", vehicleId: null, position: null, scrapReason: null, scrappedAt: null },
    // 已报废
    { id: "t-9001", code: "LT-9001", spec: "11R22.5", treadDepth: 1.2, slot: "B-06", status: "报废", vehicleId: null, position: null, scrapReason: "归还时胎纹 1.2mm，低于 1.6mm 报废线", scrappedAt: "2026-09-10 09:30" }
  ];

  const vehicles: Vehicle[] = [
    { id: "v-1", plate: "沪A-82L6", model: "解放J6 厢式货车", status: "在途", lastRotationAt: null },
    { id: "v-2", plate: "沪B-73K9", model: "东风天锦 载货车", status: "在途", lastRotationAt: "2026-08-15 14:00" },
    { id: "v-3", plate: "沪C-51D2", model: "重汽豪沃 牵引车", status: "维修中", lastRotationAt: null },
    { id: "v-4", plate: "沪D-66Q7", model: "福田欧曼 载货车", status: "在途", lastRotationAt: null }
  ];

  const loans: SpareLoan[] = [
    { id: "loan-1", tireId: "t-2005", purpose: "沪A-82L6 途中爆胎应急", outAt: "2026-09-22 08:40", backAt: null, outcome: "借用中" },
    { id: "loan-0", tireId: "t-9001", purpose: "沪B-73K9 长途随车备胎", outAt: "2026-09-01 10:00", backAt: "2026-09-10 09:30", outcome: "归还报废" }
  ];

  return { tires, vehicles, loans };
}

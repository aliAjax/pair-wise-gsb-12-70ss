// 轮胎资料层：类型、业务常量与初始档案。
// 只描述"数据长什么样"，不含调度判断，也不碰存储。

export type WheelPosition = "FL" | "FR" | "RL" | "RR";
export type TireStatus = "storage" | "mounted" | "out" | "scrapped";
export type VehicleStatus = "active" | "service";

export interface Tire {
  id: string;
  code: string; // 轮胎编号
  spec: string; // 规格
  treadDepth: number; // 胎纹深度 mm
  status: TireStatus;
  storageSlot: string | null; // 仓位（在库时有效）
  vehiclePlate: string | null; // 装车车辆
  wheelPosition: WheelPosition | null; // 装车轮位
  scrapReason: string | null; // 报废理由
  updatedAt: string;
}

export interface Vehicle {
  plate: string;
  model: string;
  status: VehicleStatus;
  checkedInAt: string | null; // 进站保养时间
}

export interface FleetState {
  tires: Tire[];
  vehicles: Vehicle[];
}

export const MIN_TREAD_MM = 1.6; // 报废线：归还实测低于此值必须转报废
export const LOW_TREAD_MM = 3; // 磨损预警线

export const WHEEL_POSITIONS = [
  { key: "FL", label: "左前", axle: "前轴" },
  { key: "FR", label: "右前", axle: "前轴" },
  { key: "RL", label: "左后", axle: "后轴" },
  { key: "RR", label: "右后", axle: "后轴" },
] as const;

export const TIRE_STATUS_LABELS: Record<TireStatus, string> = {
  storage: "在库",
  mounted: "装车在用",
  out: "离库占用",
  scrapped: "已报废",
};

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  active: "在运",
  service: "维修中",
};

export const TIRE_SPECS = ["11R22.5", "295/80R22.5", "12R22.5", "7.50R16"] as const;

export function wheelLabel(position: WheelPosition): string {
  return WHEEL_POSITIONS.find((item) => item.key === position)?.label ?? position;
}

export function axleOf(position: WheelPosition): "前轴" | "后轴" {
  return position === "FL" || position === "FR" ? "前轴" : "后轴";
}

function seedTire(partial: Omit<Tire, "updatedAt">, daysAgo: number): Tire {
  return { ...partial, updatedAt: new Date(Date.now() - daysAgo * 86400000).toISOString() };
}

function mountedSet(
  plate: string,
  entries: Array<[WheelPosition, string, string, number]>,
  daysAgo: number
): Tire[] {
  return entries.map(([position, code, spec, tread], index) =>
    seedTire(
      {
        id: `seed-${plate}-${position}`,
        code,
        spec,
        treadDepth: tread,
        status: "mounted",
        storageSlot: null,
        vehiclePlate: plate,
        wheelPosition: position,
        scrapReason: null,
      },
      daysAgo + index
    )
  );
}

export function createSeedState(): FleetState {
  const vehicles: Vehicle[] = [
    { plate: "沪A-82L6", model: "4.2米厢货", status: "active", checkedInAt: null },
    { plate: "沪B-73K9", model: "9.6米栏板", status: "active", checkedInAt: null },
    { plate: "沪C-5D21", model: "7.6米厢货", status: "service", checkedInAt: new Date().toISOString() },
  ];

  const tires: Tire[] = [
    ...mountedSet("沪A-82L6", [
      ["FL", "LT-1001", "11R22.5", 6.2],
      ["FR", "LT-1002", "11R22.5", 6.0],
      ["RL", "LT-1003", "11R22.5", 5.1],
      ["RR", "LT-1004", "11R22.5", 5.3],
    ], 30),
    ...mountedSet("沪B-73K9", [
      ["FL", "LT-2001", "295/80R22.5", 7.4],
      ["FR", "LT-2002", "295/80R22.5", 7.1],
      ["RL", "LT-2003", "295/80R22.5", 6.8],
      ["RR", "LT-2004", "295/80R22.5", 6.9],
    ], 20),
    // 维修中车辆：四轮原占用保留，前轴磨损明显，用于演示换位建议
    ...mountedSet("沪C-5D21", [
      ["FL", "LT-3001", "11R22.5", 2.8],
      ["FR", "LT-3002", "11R22.5", 3.0],
      ["RL", "LT-3003", "11R22.5", 5.6],
      ["RR", "LT-3004", "11R22.5", 5.4],
    ], 10),
    seedTire(
      { id: "seed-store-1", code: "LT-9001", spec: "11R22.5", treadDepth: 8.0, status: "storage", storageSlot: "A-01", vehiclePlate: null, wheelPosition: null, scrapReason: null },
      5
    ),
    seedTire(
      { id: "seed-store-2", code: "LT-9002", spec: "295/80R22.5", treadDepth: 7.6, status: "storage", storageSlot: "A-02", vehiclePlate: null, wheelPosition: null, scrapReason: null },
      4
    ),
    seedTire(
      { id: "seed-store-3", code: "LT-9003", spec: "7.50R16", treadDepth: 6.4, status: "storage", storageSlot: "B-01", vehiclePlate: null, wheelPosition: null, scrapReason: null },
      3
    ),
    // 备胎离库：先记占用，归还时复测胎纹
    seedTire(
      { id: "seed-out-1", code: "LT-8001", spec: "11R22.5", treadDepth: 4.2, status: "out", storageSlot: null, vehiclePlate: null, wheelPosition: null, scrapReason: null },
      1
    ),
    seedTire(
      { id: "seed-scrap-1", code: "LT-7001", spec: "11R22.5", treadDepth: 1.2, status: "scrapped", storageSlot: null, vehiclePlate: null, wheelPosition: null, scrapReason: "归还实测胎纹 1.2mm 低于报废线，胎肩偏磨严重" },
      2
    ),
  ];

  return { tires, vehicles };
}

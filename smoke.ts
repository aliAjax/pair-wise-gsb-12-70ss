import { createSeedState, TREAD_SCRAP_LIMIT } from "./src/domain/fleet";
import {
  applyRotation,
  changeVehicleStatus,
  checkoutSpare,
  mountTire,
  registerTire,
  returnSpare,
  suggestRotation,
  tireAt,
  unmountTire
} from "./src/domain/dispatch";

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`PASS ${name}`);
  else { failures++; console.error(`FAIL ${name}`); }
}

// 1. 一轮位一胎
{
  const s = createSeedState();
  const r = mountTire(s, "t-2001", "v-1", "FL"); // v-1 FL 已有 LT-1001
  check("同一轮位重复装胎被拒绝", !r.ok);
  const r2 = mountTire(s, "t-2001", "v-4", "RL"); // v-4 后轮空位
  check("空轮位可装胎", r2.ok && tireAt(s, "v-4", "RL")?.code === "LT-2001");
  const r3 = mountTire(s, "t-2001", "v-4", "RR");
  check("在用轮胎不能再装到别的轮位", !r3.ok);
}

// 2. 备胎离库占用 + 归还报废
{
  const s = createSeedState();
  const dup = checkoutSpare(s, "t-2005", "再次借用"); // t-2005 已借出
  check("借出中的备胎不能重复离库", !dup.ok);
  check("离库必须填去向", !checkoutSpare(s, "t-2001", "  ").ok);
  check("在库备胎可离库并占用", checkoutSpare(s, "t-2001", "沪D-66Q7 随车备胎").ok);
  const t = s.tires.find((x) => x.id === "t-2001")!;
  check("离库后状态为借出占用", t.status === "借出占用");
  check("占用中不能装车", !mountTire(s, "t-2001", "v-4", "RL").ok);
  // 归还：胎纹不足但没填理由
  check("胎纹不足缺理由被拒绝", !returnSpare(s, "t-2001", 1.2, "").ok);
  check("胎纹不足带理由转报废", returnSpare(s, "t-2001", 1.2, "归还实测 1.2mm，低于报废线").ok);
  check("报废状态与理由已记录", t.status === "报废" && !!t.scrapReason && !!t.scrappedAt);
  const loan = s.loans.find((l) => l.tireId === "t-2001")!;
  check("借出单闭环为归还报废", loan.outcome === "归还报废" && !!loan.backAt);
  // 正常归还回库
  check("在库备胎可离库2", checkoutSpare(s, "t-2002", "测试").ok);
  check("胎纹合格归还入库", returnSpare(s, "t-2002", 8.0, "").ok);
  check("归还后回在库且胎纹更新", s.tires.find((x) => x.id === "t-2002")!.status === "在库"
    && s.tires.find((x) => x.id === "t-2002")!.treadDepth === 8.0);
}

// 3. 换位建议与一次性更新
{
  const s = createSeedState();
  check("在途车辆不能生成换位建议", !suggestRotation(s, "v-1").ok);
  changeVehicleStatus(s, "v-1", "保养中");
  const plan = suggestRotation(s, "v-1");
  check("保养中可生成换位建议", plan.ok);
  if (plan.ok) {
    const m = Object.fromEntries(plan.moves.map((mv) => [mv.code, mv.to]));
    check("前交叉映射正确", m["LT-1001"] === "RL" && m["LT-1002"] === "RR" && m["LT-1003"] === "FR" && m["LT-1004"] === "FL");
  }
  check("确认换位成功", applyRotation(s, "v-1").ok);
  check("四轮归属一次性更新",
    tireAt(s, "v-1", "FL")?.code === "LT-1004" &&
    tireAt(s, "v-1", "FR")?.code === "LT-1003" &&
    tireAt(s, "v-1", "RL")?.code === "LT-1001" &&
    tireAt(s, "v-1", "RR")?.code === "LT-1002");
  check("换位时间已记录", !!s.vehicles.find((v) => v.id === "v-1")!.lastRotationAt);
  // 四轮不齐不能换位
  changeVehicleStatus(s, "v-4", "保养中");
  check("四轮未装齐不能换位", !suggestRotation(s, "v-4").ok);
}

// 4. 维修中锁定
{
  const s = createSeedState(); // v-3 维修中
  const mounted = s.tires.find((t) => t.vehicleId === "v-3")!;
  check("维修中不能卸胎", !unmountTire(s, mounted.id).ok);
  check("维修中不能装胎", !mountTire(s, "t-2001", "v-3", "FL").ok);
  check("维修中不能换位", !applyRotation(s, "v-3").ok);
  check("交车后恢复在途", changeVehicleStatus(s, "v-3", "在途").ok);
  check("交车后可卸胎", unmountTire(s, mounted.id).ok);
}

// 5. 档案登记
{
  const s = createSeedState();
  check("重复编号被拒绝", !registerTire(s, { code: "LT-2001", spec: "12R22.5", treadDepth: 9, slot: "A-09" }).ok);
  check("正常登记入库", registerTire(s, { code: "LT-3001", spec: "12R22.5", treadDepth: 9.9, slot: "A-09" }).ok);
  check("新胎默认在库", s.tires.find((t) => t.code === "LT-3001")!.status === "在库");
  check(`报废线常量为 ${TREAD_SCRAP_LIMIT}`, TREAD_SCRAP_LIMIT === 1.6);
}

console.log(failures === 0 ? "\n全部通过" : `\n${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);

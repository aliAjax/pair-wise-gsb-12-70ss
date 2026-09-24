# 轮胎维护台

- 行业：物流
- 技术栈：Vue3、Vite、TypeScript、Pinia、Naive UI
- 启动：`npm install && npm run dev`
- 构建：`npm run build`

车队轮胎管理前端：轮胎档案（编号/规格/胎纹/仓位/装车位置）、同车同轮位唯一占用、
备胎离库占用与归还复测（胎纹不足转报废并记录理由）、进站保养按轴位生成换位建议并
一次性更新四轮归属、维修中车辆原占用保留到交车。

分层：`src/domain`（轮胎资料）→ `src/services/dispatch`（调度判断）→
`src/services/storage`（本机存储 localStorage）→ `src/stores` + `src/App.vue`（页面）。

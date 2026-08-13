<!-- PR 模板：请如实填写，reviewer 靠这个快速判断。 -->

## 改了什么 / What
<!-- 一两句说清这个 PR 干了什么，为什么。 -->


## 影响范围 / Area
<!-- 勾选这个 PR 动到的部分（帮 reviewer 和其他人判断会不会撞车）。 -->
- [ ] `apps/web`（前端）
- [ ] `apps/api`（后端）
- [ ] `remotion-composer`（渲染引擎）
- [ ] 数据库 / migration
- [ ] CI / 配置 / 文档

## 自检 / Checklist
- [ ] 本地 `apps/web` 跑过 `npm run build`（干净通过）
- [ ] 本地 `apps/api` 能 `import app.main`（起得来）
- [ ] 这个分支是基于**最新的 main** 开的 / 已 rebase 到最新 main
- [ ] **没有和正在飞的其它 PR 改同一批文件**（若有，请在下面说明并协调）
- [ ] 一个 PR 只做一件事（功能/修复单一，别混大杂烩）

## 测过什么 / Tested
<!-- 实际跑了什么来验证。没测的部分也如实写出来（"未验证：xxx"）。 -->


## 相关 / Links
<!-- 关联的 issue、依赖的其它 PR、参考截图等。 -->

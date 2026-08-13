# 协作规范 / Contributing

这份规范的目标只有一个：**多人协作时代码不乱**。请所有人遵守。

## 分支 / Branches

- **不要直接推 `main`。** main 受保护，只能通过 PR 合入。
- 从**最新的 main** 开分支：
  ```bash
  git checkout main && git pull
  git checkout -b <type>/<简短描述>
  ```
- 分支命名：`feat/xxx`（新功能）、`fix/xxx`（修 bug）、`chore/xxx`（杂项/配置）、`sync/xxx`（同步上游）。

## 一个 PR 只做一件事

- 一个 PR 聚焦一个功能或一个修复，别把不相关的改动混在一起——越小越好审、越好合。
- 大改动拆成多个小 PR。

## 开工前先看有没有人在改同一块

- 开始前扫一眼 [Open PRs](../../pulls)。**如果你要改的文件已经有别人的 PR 在动,先协调**,别两个人各写一套(我们真发生过 #1/#4 重复造轮子)。
- 在 PR 描述里勾选「影响范围」,方便别人判断会不会撞车。

## 合并前必须满足(main 分支保护)

- ✅ **CI 全绿**(`apps/web` build+lint、`apps/api` import 冒烟)。
- ✅ **至少 1 人 review 通过**。
- ✅ **分支已同步最新 main**(GitHub 上点 "Update branch",或本地 `git merge origin/main` / rebase)。这条防止像 #3 那样基于旧 main、合的时候一堆冲突。
- 合并方式:**Squash and merge**(保持 main 历史干净,一个 PR = 一个提交)。
- 合并后**删掉分支**。

## 提交前本地自检

```bash
# 前端
cd apps/web && npm run build     # 含 TypeScript 检查
npm run lint

# 后端
cd apps/api && python -c "import app.main"   # 确认起得来
```

## 换行符 / Line endings

- 仓库统一 **LF**(见 `.gitattributes`)。Windows 用户请设 `git config core.autocrlf false`,避免 CRLF 混入把整文件标成改动。

## 密钥 / Secrets

- **绝不提交 `.env`**(已 gitignore)。需要的变量在 `apps/api/.env.example` / `apps/web/.env.example` 里列出并留空,填真值只在本地。

## 环境备注

- `apps/web` 依赖锁在 `registry.npmmirror.com`(国内快)。**如果 CI 或海外部署拉不到,用官方源重生成一次 lock**:
  ```bash
  cd apps/web && npm config set registry https://registry.npmjs.org/ && rm package-lock.json && npm install
  ```
- 真出片需要 `cd apps/api/remotion-composer && npm install`(Remotion + 首次渲染自动下 Chromium)。

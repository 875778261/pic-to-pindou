# pic-to-pindou 项目长期记忆

## Git 授权（2026-10-23 用户在会话中明确授予）

- 本**项目**拥有完全 git 权限：`add` / `commit` / `push` / 建分支 / 改远端设置都可以直接执行。用户级记忆里「所有项目禁止 git 写操作」在 pic-to-pindou 上不适用。
- 破坏性操作仍需先问：`push --force`、`reset --hard`、删分支、改写历史。

## 分支模型

- `main` = 稳定线，只放已验收的基线；`develop` = 日常开发线，ticket 工作都在这里。
- 初始基线提交 `a6feb1e`（`chore: 初始化仓库与项目文档`），main 与 develop 同点。
- GitHub 默认分支 = `main`。

## 工程约定

- 提交信息用 conventional commit 格式，摘要用中文。
- 文档命名 `YYYY-MM-DD-slug.md`；ADR 落 `docs/adr/` 递增编号；spec 落 `docs/specs/`；计划落 `docs/plans/`。
- 换行符统一 LF（`.gitattributes` 已设 `* text=auto eol=lf`）。

## 进度锚点

- issue #1 = spec 伞票，子票 #2–#10。#2/#3/#4/#5 已交付并关票，#6/#7/#8/#10 已解锁，#9 等 #8 + #10。
- 当前施工顺序（2026-10-26 定）：`#6 背景空白色 → #7 豆子渲染 → #10 用量面板 → #8 → #9`。`#4` 已于 `4877384` 关闭。
- 详细决策见当日日志：`2026-10-23.md`、`2026-10-24.md`、`2026-10-26.md`。

## 已确立的判定（跨票通用，别推翻）

- **色号是唯一标识**：不编造色名、不加 `name` 字段、系列只出字母（ADR-0005、ADR-0009）。`SERIES_LABELS` 那套中文系列名与实测色相冲突，已判撤。
- **图例/用量列表同源**：`legendEntries()` 是唯一条目与排序来源，导出图纸与屏幕用量面板都读它（ADR-0008）。
- **图例按纸面宽度换行，无例外**：每行条数 = 可用宽度 ÷ 单条槽宽，行优先；可用宽度取 max(网格宽, 抬头宽)；单条槽宽 = 实测条目宽 + `LEGEND_METRICS.itemGap`（间距归排版层加，绘制层只交裸宽度）。「小图固定一列」已作废。`legendSlot()` 是落格唯一来源。
- **导出是施工图**：扁平色块而非豆形；格数取最长边 ≤ 40 才标格内色号。
- **装图只做裁切**：比例锁定派生 `fit`，裁切几何只在 `domain/crop.ts`（ADR-0007）。
- **重算只有一条路径**：`store.convertCurrent()`，改参数经 120ms 节流，换图先 cancel 再 await。

## 环境坑

- `npm run test` 若整批挂在 `describe` 那行（`Cannot read properties of undefined (reading 'config')`），是 `node_modules` 装不全，跑一遍 `npm install`；别去改测试。
- Playwright 要 `chromium.launch({ channel: 'msedge' })`；后台服务必须 `run_in_background`；帧间隔只能在 `vite preview` 生产包上量。
- `gh` 必须在仓库目录内跑，在 `%TEMP%` 里跑报 `not a git repository`。`gh issue comment -F <仓库外绝对路径>` 会被沙箱拦（`sandbox-center cmd decisionRecord missing actual resource subject`），改用 `--body "$(cat 路径)"`。gh 路径赋给变量后调用偶发同样的沙箱错，读命令直接用字面路径更稳。
- 别拿「测试绿」当验收：图例文案与落格顺序的 bug 全是在测试全绿时从 PNG 上肉眼看出来的。
- `gh` 不在 bash PATH，用 `/c/Program Files/GitHub CLI/gh.exe`；建 issue 依赖用 `-F issue_id=<db id>`（`sub_issue_id` 是旧版本名）。

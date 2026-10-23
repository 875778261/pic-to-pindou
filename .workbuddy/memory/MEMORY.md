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

- issue #1 = spec，子 issue #2–#9 = 八张 tracer-bullet 票，原生阻塞边已建。
- 当前前沿：**#2 脚手架与色卡资产**，其余全部有未闭阻塞。
- 详细决策与调研结论见当日日志 `2026-10-23.md`。

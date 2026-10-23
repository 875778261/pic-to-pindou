# Issue 追踪：GitHub

本仓库的 issue 与需求规格都以 GitHub issue 的形式存在，所有操作通过 `gh` CLI 完成。

## 环境要求

仓库是 `875778261/pic-to-pindou`（public，Issues 已启用）。技能读写 issue 依赖 `gh` CLI，本机已就绪：

- `gh 2.103.0`，安装于 `C:\Program Files\GitHub CLI\gh.exe`，已在 Machine PATH 中（老终端需重开才生效）。
- 已登录账号 `875778261`，token 存于 Windows 凭据管理器，scopes 为 `repo`、`read:org`、`gist`。

换机器或重装时重跑以下两条即可：

```
winget install --id GitHub.cli -e
gh auth login
```

## Triage 标签

五个 triage 标签已在仓库创建（`wontfix` 沿用 GitHub 默认标签，未重复建）。角色与标签字符串的映射见 `triage-labels.md`。

重装环境后的创建命令（`wontfix` 默认已存在，不用重复跑）：

```
gh label create needs-triage --description "Maintainer needs to evaluate this issue" --color fbca04
gh label create needs-info --description "Waiting on reporter for more information" --color d876e3
gh label create ready-for-agent --description "Fully specified, ready for an AFK agent" --color 0e8a16
gh label create ready-for-human --description "Requires human implementation" --color 1d76db
```

## 约定

- **新建 issue**：`gh issue create --title "..." --body "..."`。多行正文用 heredoc。
- **读取 issue**：`gh issue view <number> --json number,title,body,labels,comments`。
- **列出 issue**：`gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`，按需加 `--label` 与 `--state` 过滤。
- **把某个 issue 设为另一个 issue 的子 issue**：`gh issue create --parent <parent> ...`，或事后 `gh issue edit <parent> --add-sub-issue <child>`（需 `gh` 2.94+）。老版本 `gh`：`gh api --method POST repos/<owner>/<repo>/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>`（此处要的是数据库 id，见下面 **阻塞关系**）。不支持 sub-issue 时，在子 issue 正文顶部写 `Part of #<parent>`。
- **评论 issue**：`gh issue comment <number> --body "..."`
- **加/去标签**：`gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **关闭**：`gh issue close <number> --comment "..."`

在克隆目录里执行 `gh` 会自动从 `git remote -v` 推断仓库，不用手动指定。

## PR 作为 triage 入口

**PRs as a request surface: no.** _（若本仓库把外部 PR 当作功能请求处理，改成 `yes`；`/triage` 会读这个标记。）_

设为 `yes` 后，PR 走与 issue 相同的标签和状态流转，命令换成 `gh pr` 等价物：

- **读取 PR**：`gh pr view <number> --comments`，看 diff 用 `gh pr diff <number>`。
- **列出待 triage 的外部 PR**：`gh api --paginate 'repos/{owner}/{repo}/pulls?state=open' --jq '.[] | select(.author_association | IN("OWNER","MEMBER","COLLABORATOR") | not) | {number, title, author: .user.login, author_association, labels: [.labels[].name]}'`。
- **评论 / 打标签 / 关闭**：`gh pr comment`、`gh pr edit --add-label`/`--remove-label`、`gh pr close`。

GitHub 的 issue 与 PR 共用一个编号空间，所以裸写的 `#42` 可能是其中之一：先用 `gh pr view 42` 解析，失败再回退到 `gh issue view 42`。

## 当某个技能要求「发布到 issue 追踪器」

新建一个 GitHub issue。

## 当某个技能要求「取出相关工单」

按上面 **读取 issue** 的方式读。

## 寻路（wayfinding）操作

供 `/wayfinder` 使用。**地图（map）** 是一个 issue，**子工单** 是它的子 issue。

- **地图**：单个 issue，加 `wayfinder:map` 标签，正文承载 Notes / Decisions-so-far / Fog 三段。`gh issue create --label wayfinder:map`。
- **子工单**：作为地图的 GitHub 子 issue 关联（见 **把某个 issue 设为另一个 issue 的子 issue**）。不支持 sub-issue 时，把子工单加进地图正文的任务列表，并在子 issue 正文顶部写 `Part of #<map>`。标签 `wayfinder:<type>`（`research`/`prototype`/`grilling`/`task`）。被认领后，指派给负责推进的开发者。
- **阻塞关系**：用 GitHub 原生的 issue 依赖，这是唯一可在 UI 里看到的规范表示。加边命令 `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`，其中 `<blocker-db-id>` 是阻塞者的数字**数据库 id**（用 `gh api repos/<owner>/<repo>/issues/<n> --jq .id` 取，_不是_ `#number`，也不是 `node_id`）。GitHub 用 `issue_dependencies_summary.blocked_by` 报告未关闭的阻塞者数量（这才是真正生效的闸门）。依赖功能不可用时，回退为在子 issue 正文顶部写 `Blocked by: #<n>, #<n>`。所有阻塞者都关闭，工单才算解除阻塞。
- **前沿查询**：列出地图下未关闭的子工单（`gh issue list --state open`，范围限定为地图的 sub-issue / 任务列表），剔除有未关闭阻塞者（`issue_dependencies_summary.blocked_by > 0`，或 `Blocked by` 行里存在未关闭 issue）或已有指派人的，按地图顺序取第一个。
- **认领**：`gh issue edit <n> --add-assignee @me`，这是本次会话的第一次写操作。
- **解决**：`gh issue comment <n> --body "<答案>"`，然后 `gh issue close <n>`，再把上下文指针（要点 + 链接）追加到地图的 Decisions-so-far 段。

# 色卡数据来源与核对记录

票面验收要求「屏幕色已对照来源核对，核对结论与差异记录进仓库」。这份文件承担那条验收：
色卡数据从哪里来、能证到什么程度、哪里证不到、为什么这样选。

## 与 ADR-0001 冲突，需显式处理

ADR-0001 决策「只做 Artkal S 系列 159 色，不做跨品牌映射」，issue #2 票面也写的是 Artkal S 159。
改用 MARD 221 + 291 **与这条决策冲突**，属于范围变更，不是实现细节。

这里不自行改写 ADR：修订需要先确认，再按编号递增落 `docs/adr/0005`。在新 ADR 落地前，色卡以本文件为准。
spec 的技术决策段与 issue #2 的验收条款同样需要同步修订。

## 当前采用：MARD 221 + 291

| 项 | 内容 |
|---|---|
| 上游仓库 | [HansBug/pindou-color-data](https://github.com/HansBug/pindou-color-data) |
| 数据集 | `mard-291-github`（291 色）、`mard-221-github`（221 色） |
| 快照 | `source/mard-291-github.colors.json`、`source/mard-221-github.colors.json` |
| 生成物 | `src/domain/palette/mard.ts`，由 `scripts/build-mard-palette.mjs` 生成 |
| 色名 | 公开数据里 `name` 与 `code` 相同，MARD 没有可查的官方色名 |

### 为什么两档都取 github 对

MARD 公开数据有三份互不相同的整理，同一色号在它们之间色值不一致：

| 两份数据 | 公共色号 | 色值一致 | 一致比例 |
|---|---:|---:|---:|
| 用户提供的页面数据 vs `mard-221-alfonse-doudou` | 221 | 2 | 0.9% |
| 用户提供的页面数据 vs `mard-221-github` | 221 | 4 | 1.8% |
| 用户提供的页面数据 vs `mard-291-github` | 291 | 17 | 5.8% |
| `mard-221-alfonse-doudou` vs `mard-221-github` | 221 | 144 | 65% |
| `mard-221-github` vs `mard-291-github` | 221 | 221 | **100%** |

只有 `mard-221-github` 与 `mard-291-github` 这一对是同号同色，且 221 完整落在 291 内。
混用不同来源会让「同一个色号在 221 档和 291 档是不同的豆色」，用户换档就换色，这是不可接受的。

`mard-221-alfonse-doudou` 在上游 README 里被标为「国内最主流/默认参考」，但它的色值与任何一份 291 都对不齐，
拿它和 291 拼成两档会直接违背上面那条约束。因此标准档也取 github 对。

### 证不到的部分

- **MARD 没有官方 RGB 发布**。上面三份都是社区整理，两两差异多在 2–8/255 之间。
- 因此色值只能保证「与所选上游一致」，不能保证「与实物一致」。
- 色号本身仍是下单可依赖的标识；色值只是屏幕近似。
- 界面上必须保留「屏幕色仅供参考，实物存在色差」的提示（P7 收尾项）。

## 已废弃：Artkal S 159

原方案是 Artkal S 系列 159 色，因为 Artkal 有官方 RGB 色卡 PDF，色值可以自证。留下结论备查：

- 官方源：`S_MIDI_Beads_RGB_Color_Chart_2024.pdf`（Shopify CDN），文本可提取，含 S01–S159 + SE01–SE17 共 176 条逐色 RGB。
- 与 bitbead 展示值逐色比对：156 个可比色号**全部一致**，0 个不一致。
- `S41 Gold`、`S42 Silver`、`S63 Copper` 官方不公布数值。bitbead 把 `S41` 标成 Copper、`S63` 标成 Gold，与官方互换。
- `S18 = S94`、`S82 = S155` 两组同值色在官方数据里本就重复，不是抄录错误。

这条路线在 2026-10-24 因需求改为 MARD 而作废。若要回退，官方 PDF 的提取路径与上述核对结论可直接复用。

## 其他参考数据

- `source/mard-colors-data.js`：用户提供的页面数据快照（`window.MARD_COLORS_DATA`，含 mard221 / mard291），
  用于上表的交叉比对，不作为生成输入。

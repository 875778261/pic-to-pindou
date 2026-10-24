# 色卡改用 MARD 221 + 291

ADR-0001 定的是只做 Artkal S 159 色。改用 MARD 体系，色卡分 221 标准档与 291 全系档两档。

Artkal 有官方 RGB 色卡 PDF，屏幕色可对官方自证；MARD 没有官方 RGB 发布，公开整理至少三份且互不相同。
为保证「换档不换色」，两档的色号与屏幕色统一取自同一来源：HansBug/pindou-color-data 的
`mard-221-github` 与 `mard-291-github`——后者完整包含前者，且 221 个公共色号屏幕色逐一相同。
代价是放弃「最主流那份整理」（`mard-221-alfonse-doudou`）的贴近度，换两档内部一致。

**Status**: accepted
**Supersedes**: ADR-0001 中「只做 Artkal S 系列 159 色」这部分。ADR-0001 里「不做跨品牌色号映射」的决策仍然有效。

**Considered Options**：
- 221 档取 `mard-221-alfonse-doudou`、291 档取 `mard-291-github`（否决——与任何一份 291 都对不齐，同一色号换档就换色）
- 只保留 291 单档（否决——用户明确要两套色卡，且 221 是线下小店最常见的现货档）
- 回退 Artkal S 159（否决——用户改了口径）

**Consequences**：MARD 屏幕色无法像 Artkal 那样对官方自证，只能证到「与所选上游一致」。
界面上必须保留「屏幕色仅供参考，实物存在色差」。色号仍是下单可依赖的标识。

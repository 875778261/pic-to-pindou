# 导出格宽恒定 24 像素 · 实施计划

单张票（#13）、单条 ADR：[0017](../adr/0017-export-cell-width-is-fixed.md)。

## 不做

- **分图 / 多页**：让 200×200 在纸上真正可读的唯一办法，lhl 2026-10-27 明确暂缓。代价见 #13「不做」段。
- **豆规格进导出换算**：「固定每颗豆的像素」与「固定打印清晰度」不可兼得，选前者。
- **索引色 PNG / 自研编码器**：2 MB 压到 1 MB 的收益抵不上复杂度。
- **PNG 写物理尺寸元数据（pHYs）**：不改像素、验不到、Chrome 打印本就不认。另开票再议。
- **提高固定格宽到 32 / 40**：会把「能固定住」的网格上限从 163 格砍到 122 / 98 格。

---

## 判定链（替换今天的四档降级）

| 情形 | 格宽 | 说明 |
|---|---:|---|
| 25M 预算装得下（**支持范围内全部**） | 24px | 恒定值，不再搜索 |
| 编码失败 → 退到 1670 万预算重排 | 按面积折算（200×200 得 19px） | 一步到位，不 10% 小步试 |
| 仍失败 | — | 报错，说明两档都试过 |

`labelled` 不再是搜索的产物：`格宽 ≥ 14` 就标。24px 与 19px 都在阈上，所以生产环境永远标。

## 改动点

**`src/export/layout.ts`**

- `ExportLimits.preferredCellSize` → `cellSize: 24`（固定值，不再是搜索起点兼上限）。
- `maxCanvasArea` 1670 万 → **2500 万**；`maxCanvasSide` 8192 保留（200 格 @24 只到 4912，永不触顶）。
- 新增 `SAFE_LIMITS`：`{ ...EXPORT_LIMITS, maxCanvasArea: 16_777_216 }`，供编码失败后的重排使用。
- 删 `clampCellSize()`：它的唯一职责是「封顶到 24」，与固定格宽同义，留下会算出第二个答案。
- `fitCellSize()` 从两条分支收敛成一条：从 `limits.cellSize` 逐 px 降到 `minCellSize`，取第一个 `fitsCaps` 成立值。删掉「先试能标色号的格宽」那条分支。
- `labelled: cellFitsCode(cellSize)`。

**`src/export/drawPattern.ts`**

- 拆出 `planPatternSheet(input, limits = EXPORT_LIMITS)`：量文字 + 调 `planExportLayout`，返回 `{ layout, entries, summary }`，不建画布。UI 的预告与导出走同一个函数，尺寸不会说两套。
- `drawPatternSheet(input, limits?)` 改用它，返回值 `{ canvas, layout }`（`labelled` 从 `layout` 读）。绘制逻辑一律不动。

**`src/export/estimate.ts`（新增）**

- `ESTIMATE_BYTES_PER_PIXEL = { low: 0.065, high: 0.15 }`：来自六张真实导出的实测区间（16 色 0.066–0.132 B/px；40 色 + 抖动取上界）。
- `estimateSheetBytes(layout): { low: number; high: number }`。系数只此一处，界面不自己乘。

**`src/export/downloadPng.ts`**

- 失败重试：`planPatternSheet(input)` → 画 → `toBlob`；为 null 就 `planPatternSheet(input, SAFE_LIMITS)` → 画 → `toBlob`；再为 null 才抛错，文案说明「24px 与降级格宽都没编码成功」。
- `ExportResult` 增 `cellSize: number` 与 `degraded: boolean`（`cellSize < EXPORT_LIMITS.cellSize`）。

**`src/ui/ExportButton.tsx`**

- 常驻预告行（`useMemo`，依赖 pattern / palette / beadSize）：`将导出 4912 × 5034，约 2–4 MB`。
- 面积超 1670 万时补一句风险：`手机上可能画不出来，会自动降到 19 像素/颗`。这句只在会触发重试时出现。
- 结果消息带真实格宽：`已生成 x.png（4912 × 5034 像素，24 像素/颗）`；降级时 `…19 像素/颗：24 像素超过手机画布上限，已自动降级`。
- 原有「格内已标色号 / 未标」那半句保留（生产环境恒为已标）。

**不动的文件**：`src/domain/bead-size.ts`、`src/domain/params.ts`、`src/state/store.ts`、`src/render/*`。豆规格本来就不进转换参数，导出也不进 —— 三处「只是换算常数」的注释仍然成立，不改。

## 测试

`src/export/layout.test.ts` 现有 6 条断言建立在「缩格宽」上，按新行为重写：

| 断言 | 去向 |
|---|---|
| 一格 24 像素，网格区域 = 格数 × 格宽 | 保留 |
| 41 格起也照标 | 改为「任何网格都照标」（200×200 下 `labelled` 为 true） |
| 大网格缩格宽也要标 | 改为「25M 预算下 200×200 仍是 24px」 |
| 连可读下限都破上限时才不标 | 改为注入极小上限，验证 `labelled` 落下（兜底分支仍要有人测） |
| 200×200 会把画布压进上限 | 改为两条：25M 下 24px / `SAFE_LIMITS` 下 19px 且面积 ≤ 1670 万 |
| 400×400 缩格宽 | 删除（超出 `MAX_GRID_SIDE`，是假想尺寸），由上面那条注入上限的测试承担 |

新增：163×163 边界（24px 且面积 ≤ 25M）、`SAFE_LIMITS` 下 200×200 的 `labelled` 仍为 true。

## 验收

1. 29×29 导出仍是 **808 × 1008**，与今天逐像素一致（防回归）。
2. 87×87 导出仍是 **2200 × 2322**，格宽 24。
3. 200×200 桌面导出 **4912 × 5034**，格宽 24，不降级。
4. 200×200 在 `SAFE_LIMITS` 下为 **19px/颗**，界面报的是 19 而不是 24。
5. 换 2.6 / 5 / 10mm，导出像素完全相同（只有文件名与抬头变）。
6. 预告行的尺寸与体积区间，与点完之后的结果对得上。
7. **肉眼验 PNG**：色块边缘无锯齿、格内色号清晰、图例不越界。测试绿不算验收。

## 风险

- **iOS 上申请 24.7M 像素的画布，可能被系统回收标签页**，而不是干净地返回 null。这是接受了的代价（支持范围内最大的图）。真机上验不到就写进 ADR 的已知限制。
- 25M 新上限只在桌面验证过；手机降级路径靠注入 `SAFE_LIMITS` 的测试覆盖，真机另算。

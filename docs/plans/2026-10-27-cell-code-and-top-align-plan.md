# 格内色号按格宽判定 + 预览纵向贴顶 · 实施计划

两件独立的事，各一张票、各一条 ADR：

| 票 | 内容 | ADR |
|---|---|---|
| A | 格内色号从「格数 ≤ 40」改成「按格宽判定」，只属于导出图纸 | [0015](../adr/0015-in-cell-code-by-cell-width.md) |
| B | 预览内容纵向贴顶，横向仍居中 | [0016](../adr/0016-preview-aligns-to-top.md) |

## 不做

- **分图 / 多页打印**：按 29×29 板切页是让 200×200 在纸上可读的唯一办法，但会牵动「图例以整张图纸为 SSOT」（ADR-0008），另行立项。
- **预览标色号**：预览的身份不变 —— 远观判断效果，认色靠点一颗豆与用量面板。
- **改豆形 / 扁平两套画法**、**改图例与用量面板**、**改转换与量化**：都不在这次范围内。

---

## 票 A：格内色号按格宽判定

### 判定链

排版从首选格宽往下试，**第一档「塞得下色号且不破画布上限」的就是答案**：

| 档 | 格宽 | 字号 | 说明 |
|---|---:|---:|---|
| 1 | 24px | ≈9px | 首选，现状值 |
| 2 | 21px | 8px | 最后一档真正舒服的 |
| 3 | 14–20px | 6px | 3 字符极限挤压，硬下限 14px |
| 4 | 4px | — | 到 14px 仍破上限才走：不标色号，退回行列坐标配图例 |

依据：`fitFontSize()` 初始字号 = `floor((格宽 − 3) × 0.46)`、下限 6px；MARD 色号 2–3 字符（3 字符占 173/283）。

### 改动点

**`src/domain/pattern.ts`**
- 删 `LABELLED_CELL_LIMIT`、`labelsCellCodes()`。
- 新增 `MIN_CODE_CELL_SIZE = 14` 与 `cellFitsCode(cellSize): boolean` —— 阈值只此一处。

**`src/export/layout.ts`**
- 新增独立常量 `COORDINATE_DENSE_LIMIT = 40`：坐标「每格都标」的分档上限。它原先借用了 `LABELLED_CELL_LIMIT`，但坐标密度与标不标色号是两件事，删掉旧常量后必须给它自己的名字，否则概念会串。
- `planExportLayout(input, limits = EXPORT_LIMITS)`：第二参数可注入，供测试制造「破上限」场景（`EXPORT_LIMITS` 是模块常量，不给注入口那条降级分支就永远测不到）。
- 格宽搜索改两级：
  1. 从 `preferredCellSize` 逐 px 降到 `MIN_CODE_CELL_SIZE`，取第一个 `fitsCaps` 成立的值 → `labelled = true`。
  2. 一路降到底都不成立 → 沿用现状（降到 `minCellSize` 4px）→ `labelled = false`。
- `labelled` 因此从「输入」变成排版输出，`coordinates` 分档改读 `COORDINATE_DENSE_LIMIT`。

**`src/export/drawPattern.ts`**
- 不改。它已经读 `layout.labelled`；`fitFontSize()` 与 `textColourOn()` 原样保留。

**`src/export/downloadPng.ts`**
- 返回值加上 `labelled`，让界面能报告这一张到底标没标。

**`src/ui/ExportButton.tsx`**
- 删掉导出前那句预测（`labelsCellCodes()` 拿不到排版算出的格宽与图例宽度，猜出来的第二个答案必与图纸不符）。
- 静态提示改成中性的一句；「标没标色号」由导出完成后的消息带出（读 `downloadPng` 的返回值）。
- 这样界面上不再存在第二份判定。

### 测试

- `domain/pattern.test.ts`：删掉 `labelsCellCodes` 那组（含 `LABELLED_CELL_LIMIT === 40` 的断言）；改为 `cellFitsCode` 边界 —— 13 → false、14 → true、24 → true。
- `export/layout.test.ts`：
  - 现有两条 `labelsCellCodes(40,40) / (41,41)` 改为断言 `layout.labelled`。
  - 29×29 → `labelled` 且 `cellSize === 24`（现状不回归）。
  - 29×58、58×58、87×87、200×200 → `labelled === true`，且 `cellSize ≥ MIN_CODE_CELL_SIZE`。
  - 注入 `{ ...EXPORT_LIMITS, maxCanvasSide: 120 }` + 200×200 → `labelled === false`（降级分支有覆盖）。
  - `coordinateStepFor` 的分档不因删常量而变：40 / 41 / 200 三档照旧。

### 验收

1. 2 块板 29×58 导出的 PNG 上，每一格都印着色号。
2. 58×58、87×87 同样有；200×200 能导出、有色号、格宽不低于 14px。
3. 1 块板 29×29 的格宽仍是 24px（不因这次改动变小）。
4. 导出完成后的消息能说清这张标没标色号。
5. 图例、行列坐标、抬头、成品尺寸与颗粒总数与改动前一致。

---

## 票 B：预览纵向贴顶

### 改动点

**`src/domain/viewport.ts`**
- `axis()` 拆成横向 / 纵向两种对齐：
  - 横向：装得下居中，装不下守 pan（现状不变）。
  - 纵向：装得下原点 0，装不下守 pan（居中分支整个删掉，pan = 0 也贴顶）。
- `panX / panY` 的注释从「相对居中摆放的偏移」改为按轴描述。
- `zoomAt()` / `fitView()` / `pinchView()` 逻辑不动：它们都以 `placement({...view, panX: 0, panY: 0})` 为基准，基准换了会自动跟随。

**`src/ui/PreviewStage.tsx`**
- 承载区顶部让出工具条高度（工具条仍是 `absolute top-2 right-2`）。几何层不掺边距，避免「装得下 → 装不下」临界点跳一个边距的高度。
- 窄屏 `fill` 模式同样处理，两条路只差布局。

### 测试

`domain/viewport.test.ts` 第 29 条按轴拆开：
- 装得下：`originY === 0`（贴顶）、`originX` 居中。
- 装不下：两轴都守 pan，pan 为 0 时贴起始边。
- `zoomAt` 锚点、`cellAtPoint`、`pinchView` 的既有断言不动。

### 验收

1. 横向图（如 29×12）在 900×700 预览区里，图案上沿贴画布上沿，不被工具条压住。
2. 横向仍居中；纵向放大跨过「装得下 → 装不下」临界点时图案不跳。
3. 窄屏全屏模式下同样贴顶。

---

## 顺序

A 与 B 无依赖，可各自独立提交。建议先 A（用户诉求的原点），再 B。

---

## 实施偏差（做完记）

1. **`export/drawPattern.ts` 不是「不改」**。计划里写它能原样读 `layout.labelled`，但要让导出结果如实回报标没标色号，它就得把 `labelled` 交出去，返回类型因此从 `HTMLCanvasElement` 变成 `{ canvas, labelled }`。调用方只有 `downloadPng.ts` 一处，跟着改。
2. **坐标分档多了一个常量**：`COORDINATE_DENSE_LIMIT = 40` 落在 `export/layout.ts`（原来借用的 `LABELLED_CELL_LIMIT` 已删）。
3. **`planExportLayout` 的第二参数**是 `ExportLimits`（`EXPORT_LIMITS` 由 `as const` 改为显式类型），测试靠它注入更紧的上限来覆盖「破上限就不标」那条分支。
4. **预览侧没有用固定上边距**（计划里原写「承载区顶部让出工具条高度」）：改成工具条单独占一行、画布量剩下的空间，避让高度跟着工具条自己走，几何层仍是原点 0。


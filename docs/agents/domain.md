# 领域文档

工程类技能在探查代码库时，应如何消费本仓库的领域文档。

## 探查之前先读这些

- 仓库根目录的 **`GLOSSARY.md`**，或
- 仓库根目录的 **`GLOSSARY-MAP.md`**（若存在）：它指向每个上下文各自的 `GLOSSARY.md`，把与当前话题相关的都读一遍。
- **`docs/adr/`**：读涉及你即将改动区域的 ADR。多上下文仓库里还要查 `src/<context>/docs/adr/` 下的上下文级决策。

这些文件如果不存在，**静默继续**。不要指出它们缺失，也不要主动建议先创建。`/domain-modeling` 技能（经 `/grill-with-docs` 与 `/improve-codebase-architecture` 触达）会在术语或决策真正定下来时按需创建。

## 文件结构

单上下文仓库（本仓库）：

```
/
├── GLOSSARY.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

多上下文仓库（根目录存在 `GLOSSARY-MAP.md`）：

```
/
├── GLOSSARY-MAP.md
├── docs/adr/                          ← 系统级决策
└── src/
    ├── ordering/
    │   ├── GLOSSARY.md
    │   └── docs/adr/                  ← 上下文级决策
    └── billing/
        ├── GLOSSARY.md
        └── docs/adr/
```

## 使用术语表里的词汇

当你的输出要提到某个领域概念（issue 标题、重构提案、猜想、测试名），用 `GLOSSARY.md` 里定义的术语。不要漂移到术语表明确规避的同义词。

若需要的概念还没进术语表，这是一个信号：要么你在发明本项目不使用的语言（重新考虑），要么确实存在空缺（记下来交给 `/domain-modeling`）。

## 与 ADR 冲突要显式提出

如果你的产出与某条现有 ADR 相矛盾，明确指出来，而不是悄悄覆盖：

> _与 ADR-0007（事件溯源订单）冲突，但值得重开讨论，因为……_

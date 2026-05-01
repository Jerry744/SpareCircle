# Canvas Node Tree Model（Tree per Screen）

## 1. 目标与统一口径

本文定义 Canvas 上的统一节点模型，目标是：

- 每个 `screenId` 仅维护 **一棵树**（tree per screen）。
- 将 `StateSection` 纳入树结构，作为可视边界的容器节点。
- 在 `StateSection` 下明确支持：
  - 唯一 `Canonical Frame`
  - 多个 `Draft Frame`
- 保留 screen 下“独立 widget”承载能力。

术语硬规则（本文件强制）：

- **Frame**：指 Canvas 内可导出的画面根节点。
- **Screen（screenId）**：指状态机/项目层的逻辑屏幕范围键。
- 当前工程里 Frame 由 `WidgetNode.type === "Screen"` 承载，但该类型名是实现细节；文档与 UI 口径统一称 **Frame**。
- 禁止使用“screen widget”表述 Frame，以免与状态机 Screen 语义冲突。

本口径用于后续 T5.2 开发与验收，优先级高于历史实现细节。

---

## 2. 节点类型总览

Canvas 节点分两类：`Non-widget Components` 与 `Widgets`。

### 2.1 Non-widget Components（结构/容器节点）

这些节点属于树结构的一部分，但不等价于现有 `WidgetNode` 基础控件。

#### A. `ScreenRootNode`（每个 screen 唯一）

- 语义：一个逻辑 screen 的唯一树根。
- 关键职责：
  - 管理该 screen 下所有 StateSection 与独立 widget 容器。
  - 作为“单树”锚点。

#### B. `StateSectionNode`

- 语义：screen 内的分区容器，承载一组 frame 与其工作资产。
- 几何语义：
  - 拥有边界（`x/y/width/height`），参与命中、渲染、选择。
  - 默认自动布局（后续可开放用户编辑）。
- 结构规则：
  - `canonical slot`：有且仅有 1 个 canonical frame。
  - `draft slot`：0..n 个 draft frames。
- 注意：StateSection 为树节点，但不是普通可导出业务 widget。

#### C. `FreeLayerNode`

- 语义：screen 下独立 widget 的统一容器。
- 作用：
  - 避免独立 widget 与 StateSection frame 混层导致语义污染。
  - 为“未归档到任何 StateSection 的临时内容”提供稳定挂载点。

### 2.2 State Frame（统一口径）

`State Frame` 不是独立新大类，而是对“StateSection 内 Screen 型根节点”的统一称呼。

- `Canonical Frame`：
  - 对应某 StateSection 内唯一主 frame。
  - 参与导出主路径。
- `Draft Frame`：
  - 同一 StateSection 下可存在多个。
  - 作为实验稿/候选稿，不自动替代 canonical。

统一规则：

- Canonical 与 Draft 都是 `State Frame`，区别在 `frameRole`。
- `State Frame` 必须是 `type === "Screen"` 的 frame 根节点。
- `State Frame` 必须挂在 `StateSectionNode` 下，且不允许作为普通可插入 widget 使用。

### 2.3 Widgets（可导出节点）

可导出节点仍是 `WidgetNode` 体系中的业务控件（含容器与基础组件），并遵循导出规则：

- 导出主路径默认来自每个 StateSection 的 canonical frame 子树。
- draft frame 子树默认不导出（除非显式策略改变）。
- `FreeLayer` 中 widget 是否导出由产品策略决定（默认建议不导出或需显式绑定）。

---

## 3. 单屏最优树结构（推荐）

推荐的 `screenId` 树形如下：

```text
ScreenRootNode(screenId)
├── StateSectionNode(section-state-A)
│   ├── StateFrame(role=canonical, widgetType=Screen, id=frame-A0)
│   │   └── ...widgets
│   ├── StateFrame(role=draft, widgetType=Screen, id=frame-A1)
│   │   └── ...widgets
│   └── StateFrame(role=draft, widgetType=Screen, id=frame-A2)
│       └── ...widgets
├── StateSectionNode(section-state-B)
│   ├── StateFrame(role=canonical, widgetType=Screen, id=frame-B0)
│   │   └── ...widgets
│   └── StateFrame(role=draft, widgetType=Screen, id=frame-B1)
│       └── ...widgets
└── FreeLayerNode(screenId-free)
    ├── ...standalone widgets
    └── ...standalone widgets
```

---

## 4. 关键约束（必须 enforce）

### 4.1 结构约束

- 一个 `screenId` 只能有一个 `ScreenRootNode`。
- `StateSectionNode` 只能挂在 `ScreenRootNode` 下。
- `State Frame` 只能挂在 `StateSectionNode` 下。
- `StateSectionNode` 下 canonical frame 数量必须严格 `= 1`（删除唯一 frame 时需同时删除该 StateSectionNode）。
- 禁止通过通用 widget 路径创建/复制/移动 `type="Screen"` 节点；Screen 型节点只能通过 Frame 专用动作进入/离开 `StateSection`。

### 4.2 几何与交互约束

- `StateSectionNode` 必须有边界并参与命中体系。
- StateSection 默认 `layoutMode = auto`，可计算包围其 frames 的边界。
- 未来若开放手动调整，必须保留最小包围约束（不得裁掉子 frame）。

### 4.3 导出约束

- canonical frame 子树是导出主入口。
- draft frame 默认不导出。
- standalone widgets 导出策略必须显式配置，不可隐式混入 canonical 输出。

---

## 5. 与当前实现的映射建议（过渡期）

- 历史 `sectionsById` / `screenTreeByScreenId` 可继续存在，但应转为“可重建索引”。
- 树关系成为唯一真源，索引只做缓存与 UI 快速访问。
- 过渡期允许保留 `widgetsById` 扁平存储，但父子关系必须可恢复上述单树模型。

---

## 6. 实施后预期收益

- 降低 StateSection 与 widget 双轨语义冲突。
- 减少跨容器移动时的特判数量。
- 消除“一个 screen 多 root + 多索引漂移”导致的混乱。
- 为后续 Figma-like StateSection 编辑能力提供稳定基础。


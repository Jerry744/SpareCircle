# SpareCircle Widget 解锁工作流（精简版）

更新时间：2026-04-15

目标：新增任意 widget 时，都能一次性打通 CRUD、编辑、导出、测试四条链路，避免后续返工。

## 1. 最小流程（只保留必须步骤）

### 步骤 1：定义能力边界

在开始编码前明确 6 件事：

1. 类型名（例如 Slider）。
2. 是否容器（可否挂子节点）。
3. 默认值（宽高、文本、颜色、可见性）。
4. 可编辑字段（位置、尺寸、文本、样式、可见性）。
5. 支持事件（clicked/pressed/value_changed）。
6. 导出目标（LVGL 对应 API）。

### 步骤 2：打通模型与 CRUD

核心文件：src/app/backend/types.ts, src/app/backend/widgets.ts, src/app/backend/validation.ts, src/app/backend/reducer.ts

必须完成：

1. 在 WidgetType、KNOWN_WIDGET_TYPES 注册类型。
2. 配置 WIDGET_EDITABLE_PROPERTIES、INSERTABLE_WIDGET_TYPES；若为容器，更新 CONTAINER_WIDGET_TYPES。
3. 在 mapPaletteWidgetToType + createWidgetNode 中接入创建逻辑和默认值。
4. 新增字段时，同步补齐 normalize/parse/schema 兼容。
5. 删除行为要清理悬挂引用（事件目标、资产等）。

### 步骤 3：打通编辑器 UI

核心文件：src/app/components/WidgetsPanel.tsx, src/app/components/CanvasViewport.tsx, src/app/components/InspectorPanel.tsx, src/app/components/EventBindingsPanel.tsx

必须完成：

1. WidgetsPanel 可拖拽；未完成时必须禁用并说明原因。
2. Canvas 有该类型渲染分支，且 visible === false 才隐藏。
3. Inspector 可编辑该类型字段并给出可读错误。
4. Event 面板只允许合法事件，禁止无效绑定。

### 步骤 4：打通 C 代码导出

核心文件：src/app/backend/codegen/ir.ts, src/app/backend/codegen/emitters.ts, src/app/backend/codegen/generator.ts

必须完成：

1. 在 IR 中注册 kind 与必要字段。
2. 在 emitter 中新增 emit 函数并接入 emitWidget。
3. 事件目标必须用 IR 的 cName，不能直接用 widgetId。
4. 如涉及资源，保证 ui.h/ui.c/manifest 引用一致。

### 步骤 5：补齐测试与验收

核心文件：src/app/backend/__tests__/reducer.test.ts, src/app/backend/__tests__/codegen.test.ts

必须完成：

1. reducer：add/update/delete 与引用清理。
2. codegen：IR 映射、关键 API 输出、事件注册符号。
3. 手工回归：拖拽新增 -> 编辑 -> 撤销重做 -> 删除 -> 导出。

---

## 2. 一页 Checklist（每个 widget 都按此执行）

1. 类型已注册：WidgetType + KNOWN_WIDGET_TYPES。
2. 可编辑与可插入策略已配置。
3. 默认节点创建逻辑已完成。
4. Canvas 可正确渲染。
5. Inspector 可编辑并校验。
6. Events 可配置且仅允许合法目标。
7. IR + emitter + generator 已接入。
8. 导出代码无未定义符号。
9. reducer/codegen 测试已补齐。
10. 手工回归通过。

---

## 3. 完成定义（DoD）

1. CRUD、渲染、导出三链路全部可用。
2. 无“可点击但无动作”的入口。
3. 新增测试通过，既有测试不回归。

---

## 4. 推荐推进顺序

1. 第一批：Slider、Switch（成本最低，优先做样板）。
2. 第二批：Checkbox、Radio。
3. 第三批：Dropdown。

每批保持小步快跑：模型 -> UI -> 导出 -> 测试，不并行开太多 widget。

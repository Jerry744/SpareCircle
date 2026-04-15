# SpareCircle Post-Demo9 完整度评估与后续里程碑

更新时间：2026-04-14
范围：基于当前仓库代码的实现状态评估（非主观猜测）

## 1) 结论摘要

当前代码库已经具备 Demo1-9 的主链路能力，但“可演示”与“可交付”之间还有明显差距。主要缺口集中在三类：

1. 交互可用性：多个按钮和面板仍是 UI 壳层，未绑定真实行为。
2. Widget 完整度：数据模型和 UI 列表已覆盖更多类型，但插入、画布渲染、导出并未打通到同一层级。
3. 导出可用性：导出文件可生成，但事件回调目标符号、资源清单、色深适配与编译验证链路仍不足以保证“拿来即用”。

这与当前目标（暂不扩新功能，优先完善已有功能、提升体验、保证导出可用）完全一致，建议后续里程碑以“硬化与收敛”为主线推进。

## 2) 已完成能力（证据）

1. 编辑器主循环：选择/移动/缩放/撤销重做链路存在，且 reducer 测试覆盖核心路径。
2. 多屏管理：create/rename/duplicate/delete/active screen 已在 reducer 与 UI 中接入。
3. 属性编辑：Inspector 支持字段校验、提交、样式 token 与资产选择。
4. 事件模型：事件绑定可在右侧面板配置并进入项目数据结构。
5. 项目持久化：JSON 序列化/反序列化、schemaVersion 校验、IndexedDB 自动保存/恢复已存在。
6. 导出链路：可导出 ui.h / ui.c / ui_events.c / assets/manifest.c 与 zip 打包。

## 3) 完整度问题清单（按优先级）

### P0 - 必须先修（直接影响“可用”和“可导出运行”）

1. 顶部工具栏存在多处“看起来可点但无动作”的按钮
- 证据：TopToolbar 中 `Grid`、`Maximize`、主题切换三按钮、`Simulate`、`Settings` 无 onClick 行为绑定。
- 影响：用户误判能力范围，降低信任与操作效率。

2. Bottom 面板大部分 Tab 仍为示例/静态数据
- 证据：Components/Themes/Events/Export/Settings 的内容为 hardcoded，未连接 editor backend actions。
- 影响：功能入口与真实能力不一致，形成“按钮有但不可用”的体验断层。

3. 导出事件代码存在目标符号风险，可能导致编译失败
- 证据：toggle_visibility 导出路径直接使用 `targetWidgetId` 作为 C 变量引用，而非 IR 里的 `cName`。
- 影响：当 widgetId 与生成变量名不一致时，`ui_events.c` 可能引用未定义符号。

4. 资源导出清单仅占位，缺乏可运行映射
- 证据：assets/manifest.c 只生成 `const lv_image_dsc_t xxx = {0};` 占位。
- 影响：即使编译通过，也无法保证运行时正确显示导出资源。

5. 缺少真实 smoke compile 验证环节
- 证据：当前 codegen 测试主要断言字符串包含关系，未调用真实 LVGL 工程编译。
- 影响：导出“可生成”不等于“可编译可运行”。

### P1 - 应尽快修（影响体验连续性）

1. Widget 列表与可插入集合不一致
- 证据：WidgetsPanel 展示了 grid/switch/slider/checkbox/radio/dropdown/arc/bar/chart/calendar/list，但 map 仅支持 container/panel/label/button/image。
- 影响：用户看到大量禁用项，且“解锁更多 widget”的预期与实际差距大。

2. 数据模型与渲染/导出支持层级不一致
- 证据：WidgetType 定义包含 Slider/Switch；但 INSERTABLE_WIDGET_TYPES 不含；Canvas 与 codegen 仅覆盖 container/label/button/image。
- 影响：后续每新增一个 widget 需要多处补齐，缺少“按模板扩展”的流水线。

3. 多选编辑仍未实现
- 证据：Inspector/Event 面板明确提示 multi-select 后续再支持。
- 影响：批量编辑效率较低，影响重度使用体验。

### P2 - 架构收敛问题（中期）

1. 后端能力存在但前端未接入远端 API
- 证据：server 已有 Fastify + SQLite 的 GET/PUT `/api/projects/:projectId`，前端 persistence 仍仅使用 IndexedDB。
- 影响：本地模式与服务端模式未形成统一 repository contract，后续协作能力难平滑演进。

2. README 状态与代码现状曾有偏差
- 证据：此前 README 仍描述 Demo3-5 在进行中。
- 影响：对外沟通与实际进度不一致（本次已修正文案）。

## 4) 针对“暂不做新功能”的里程碑建议

以下里程碑均围绕“已有功能硬化”，不新增大功能域。

### M1（1-1.5 周）：UI 行为硬化与按钮可预期性

目标：所有可见按钮必须“可用或明确禁用理由”，消除伪入口。

交付：
1. TopToolbar 所有按钮完成行为绑定，或改为 disabled + tooltip 解释。
2. BottomPanel 的非落地 Tab：要么接入真实数据/动作，要么标记为只读预览并统一样式。
3. 建立“可点击控件检查清单”（每次发布前人工回归）。

验收：
1. 用户路径中无“点击无反馈”的按钮。
2. 所有禁用项有明确原因提示。

### M2（1.5-2 周）：Widget 解锁流水线（优先现有类型）

目标：按统一模板打通“类型定义 -> 插入 -> 画布渲染 -> Inspector -> 导出”。

建议顺序：
1. 第一批：Slider、Switch（已在类型系统中，成本最低）。
2. 第二批：Checkbox、Radio、Dropdown（若保持 Demo2-9 范围，可先只做前两项）。

交付：
1. 统一 widget capability 注册表（替代分散 switch/case）。
2. 每个解锁 widget 配套最小测试：reducer + canvas + codegen snapshot。

验收：
1. WidgetsPanel 中“已解锁”项可拖入、可编辑、可导出。
2. 解锁项在导出代码中有确定 emitter 输出。

### M3（2 周）：导出可用性达标（重点：你提到的 C 代码可用）

目标：导出结果从“可下载”升级到“可编译、可运行、可验证”。

交付：
1. 修复事件导出目标符号映射（targetWidgetId -> 对应 IR cName）。
2. 资源清单从占位实现升级为可链接/可集成方案（至少提供官方推荐接入方式与示例）。
3. 建立 LVGL smoke compile（CI 或本地脚本）并纳入回归。
4. 增加导出失败诊断信息（哪个 widget/事件/资源导致问题）。

验收：
1. 固定示例项目导出后可通过 smoke compile。
2. 事件与资源在运行时可验证。

### M4（1-1.5 周）：色彩与后端收敛（不扩功能域）

目标：解决你指出的 8bit 墨水屏色彩兼容与后端不完整问题。

交付：
1. 新增导出色彩策略：RGB888 默认 + 8bit/e-ink 量化策略（含抖动开关可后置）。
2. 在项目设置中引入导出 target/color-depth，并传入 codegen IR。
3. 抽象 persistence repository：IndexedDB 与 HTTP API 使用同一接口，支持配置切换。

验收：
1. 8bit 配置下导出代码颜色映射可预测并通过示例验证。
2. 前端可在 local/server 两种模式间切换且行为一致。

## 5) 实施顺序（建议）

1. 先 M1（立刻提升体验、风险最低）。
2. 并行准备 M2 的 capability 注册表设计。
3. M2 完成后做 M3，避免导出层反复返工。
4. 最后做 M4，把“平台兼容 + 后端契约”一次收敛。

## 6) 风险与控制

1. 风险：一次性解锁过多 widget 导致回归面扩大。
- 控制：每批 1-2 个 widget，小步交付。

2. 风险：导出改动与现有项目兼容性冲突。
- 控制：保留 schemaVersion 与向后迁移，新增导出版本标记。

3. 风险：后端切换引入状态同步问题。
- 控制：先建立统一 repository 抽象，再替换调用点。

## 7) 建议的“完成定义”（DoD）

1. 功能按钮：无空操作入口。
2. 已解锁 widget：插入/编辑/渲染/导出四链路全部打通。
3. 导出：固定样例可通过 smoke compile，且运行截图可复现。
4. 持久化：local/server 模式切换后行为一致，错误有用户可读反馈。

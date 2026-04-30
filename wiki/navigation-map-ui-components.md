# Navigation Map UI 组件索引

本文记录导航图界面相关的文件和功能，供 AI 代理和协作者参考。

---

## 顶层布局

### IDELayout.tsx

路径: src/app/components/IDELayout.tsx

功能: 整个编辑器的顶层布局组件，组合所有面板和画布。

关键职责:
- 管理 navMapProject (v2 项目快照) 和 navMapSelection 状态
- 管理 v2 的 undo/redo 历史
- 通过 ZoomRouter 切换 Navigation Map (level=map) 和 StateBoard (level=board)
- 根据当前 zoom level 决定 surfaceMode (navmap 或 ui)
- 持久化: localStorage + IndexedDB

子组件组合:
- TopToolbar (顶部工具栏)
- 左侧栏: ScreensPanel + HierarchyPanel (仅在 board 模式下显示)
- WidgetsPanel (组件面板, 可折叠)
- 中心: ZoomRouter (路由到 NavigationMap 或 StateBoardShell)
- 右侧栏: RightSidebar
- 底部面板: BottomPanel

---

## 顶部工具栏

### TopToolbar.tsx

路径: src/app/components/TopToolbar.tsx

功能: 编辑器顶部工具栏，包含所有全局操作。

功能模块:
- 左侧: 项目名称编辑、面板折叠按钮 (左/底/右)
- 中心: undo/redo、Grid、Pixel Snap、Magnet Snap、Style Tokens、Maximize、UI/NavMap 切换
- 右侧: Open、Save、Simulate (placeholder)、Export、Settings

数据来源:
- 优先使用 projectControls prop (v2 模式)
- 回退到 useEditorBackend() (旧版模式)

---

## 左侧栏

### ScreensPanel.tsx

路径: src/app/components/ScreensPanel.tsx

功能: 左侧栏上部，显示项目的 states/screens 列表。支持:
- 列出所有 StateNode
- 点击钻入对应 StateBoard
- 添加/删除 states

### HierarchyPanel.tsx

路径: src/app/components/HierarchyPanel.tsx

功能: 左侧栏下部，显示选中 state 的 widget 树层级。

路由逻辑:
- 有 stateHierarchyContext -> 渲染 StateHierarchyPanel (v2 state board 模式)
- 无 stateHierarchyContext -> 渲染 LegacyHierarchyPanel (旧版 widget 树，在 nav map 模式下为空/无意义)

LegacyHierarchyPanel 功能:
- 从旧项目构建 widget 树
- 支持展开/折叠节点
- 单选/多选 (Ctrl+Click, Shift+Click 范围选择)
- 拖拽重排/复制 (Alt 拖拽复制)
- 可见性切换 (Eye/EyeOff)

### StateHierarchyPanel.tsx

路径: src/app/components/stateBoard/StateHierarchyPanel.tsx

功能: v2 版本层级面板，显示:
- Screen Sections 树
- Canonical 和 Draft Frame
- Widget 节点树
- 支持拖拽排序、跨容器移动、添加/删除 states、复制 frame

---

## 右侧栏

### RightSidebar.tsx

路径: src/app/components/RightSidebar.tsx

功能: 右侧属性/检查器面板。根据 surfaceMode 路由:
- navmap 模式 -> NavMapInspectorHost
- ui/board 模式 -> 属性编辑面板

---

## 底部面板

### BottomPanel.tsx

路径: src/app/components/BottomPanel.tsx

功能: 底部面板，显示 StateBoard 设置 (如画板分辨率)。

---

## 导航画布核心

### NavigationMap.container.tsx

路径: src/app/components/navigationMap/NavigationMap.container.tsx

功能: Navigation Map 的有状态容器。管理:
- 相机状态 (平移/缩放)
- 拖拽状态
- 选中状态同步
- 事件处理器组装

组合的子组件:
- NavMapToolbar
- NavMapContextMenu
- NavMapCanvas
- NavMapInspectorHost

### NavMapCanvas.tsx

路径: src/app/components/navigationMap/canvas/NavMapCanvas.tsx

功能: HTML5 Canvas 的 React 包装器。负责:
- ResizeObserver 监听尺寸变化
- requestAnimationFrame 渲染循环
- 鼠标/键盘事件监听
- 画布尺寸自适应

### NavMapToolbar.tsx

路径: src/app/components/navigationMap/toolbar/NavMapToolbar.tsx

功能: 悬浮在导航图画布上的水平工具栏。包含:
- 放大/缩小
- 重置相机
- 自动整理布局
- 创建新 StateNode

### NavMapContextMenu.tsx

路径: src/app/components/navigationMap/contextMenu/NavMapContextMenu.tsx

功能: 导航图右键菜单 (Radix UI)。菜单项:
- Enter board (钻入编辑)
- Mark as initial (标记为初始状态)
- Add to screen group
- Delete

### NavMapInspectorHost.tsx

路径: src/app/components/navigationMap/inspector/NavMapInspectorHost.tsx

功能: 右侧栏导航图检查器，根据选中类型路由:
- StateNode -> StateNodeInspector (状态节点属性)
- Transition -> TransitionInspector (转移属性)

### NavMapMiniOverlay.tsx

路径: src/app/components/navigationMap/NavMapMiniOverlay.tsx

功能: board 模式下左下角小地图覆盖层。显示:
- 简化版导航图
- "Back" 按钮返回完整地图

### NavigationMap.tsx

路径: src/app/components/navigationMap/NavigationMap.tsx

功能: 重新导出 NavigationMap 组件的公共入口文件。

---

## 导航主题

### types.ts (canvas)

路径: src/app/components/navigationMap/canvas/types.ts

功能: 定义 NavMapRendererTheme 接口和 NAV_MAP_DARK_THEME 常量 (默认暗色方案)。

---

## 设计令牌

### designTokens.ts

路径: src/app/constants/designTokens.ts

功能: 定义 DESIGN_TOKENS (色阶) 和 THEME_CONFIG.dark (语义色映射)。注释标注 "Light mode reserved for future implementation"。

---

## Zoom 路由

### ZoomRouter.tsx

路径: src/app/components/zoomNavigator/ZoomRouter.tsx

功能: 根据 zoom level 渲染 Navigation Map (level 0) 或 StateBoard (level 1)，带渐入动画。

### useZoomRouter.ts

路径: src/app/components/zoomNavigator/useZoomRouter.ts

功能: 管理 zoom level 状态、历史栈、zoomInto/goToMap/replaceVariant 函数。

---

## 布局管理

### layoutContext.tsx

路径: src/app/components/layoutContext.tsx

功能: React Context，管理面板折叠状态:
- leftSidebarCollapsed / rightSidebarCollapsed / bottomPanelCollapsed / widgetsPanelCollapsed
- 对应的 toggle 函数

---

## StateBoard

### StateBoardShell.tsx

路径: src/app/components/stateBoard/StateBoardShell.tsx

功能: 钻入 StateNode 后的状态面板视图。包含面包屑导航和画板画布。


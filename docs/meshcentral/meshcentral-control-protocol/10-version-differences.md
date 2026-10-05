# 10 - 版本演进与客户端形态差异 (Version Differences)

本文档归纳当前 MeshCentral `1.2.5` 版本与历史版本、经典 UI、现代 UI (v3) 以及 CLI 客户端在控制通道协议使用上的演进差异。

---

## 一、服务端架构演进：`serverCommands` 注册表重构

- **历史版本实现**：
  早期版本在 `meshuser.js` 的 `processWebSocketData` 中使用了一个超过 5000 行的庞大 `switch (command.action)` 语句处理所有客户端指令。
- **当前版本 (v1.2.5) 架构**：
  - 引入了 `serverCommands` 函数指针字典（`meshuser.js:5781-5835`）：
    ```js
    const serverCommands = {
        'adddeviceuser': serverCommandAddDeviceUser,
        'adduser': serverCommandAddUser,
        'meshes': serverCommandMeshes,
        'serverversion': serverCommandServerVersion,
        ...
    };
    ```
  - 当收到客户端报文时，首先检查 `serverCommands[command.action]`，若存在直接调用对应拆分函数；未迁移的旧指令继续向下 fallback 穿透至 `switch (command.action)`。
  - 这导致在协议逆向时，**必须同时检索 `serverCommands` 注册表与 `switch` 分支**，否则会遗漏 50% 以上的核心处理逻辑。

---

## 二、经典 UI (`default.handlebars`) 与 现代 UI (`default3.handlebars`) 差异

| 比较维度 | 经典 UI (`default.handlebars`) | 现代 UI (`default3.handlebars`) | 协议层影响 |
| :--- | :--- | :--- | :--- |
| **UI 架构定位** | 经典模式 (v2)，稳定维护 | 现代模式 (v3)，基于全新卡片流与响应式布局 | 控制通道报文**完全相同** |
| **`onMessage` 事件监听** | 位于第 2598 行 | 位于第 3500+ 行 | 事件派发结构保持一致 |
| **桌面通知提示** | 依赖 `notifications` 本地存储掩码 | 统一复用相同位掩码与提示逻辑 | 客户端本地持久化规范一致 |
| **内部事件伪动作** | 较少 | 包含 `small`, `large`, `toggle-night` 等内部 DOM 刷新虚拟事件 | **这些内部事件不通过控制通道发送或接收**，仅为前端内部总线使用 |

---

## 三、CLI 客户端 (`meshctrl.js`) 与 Web 端交互差异

- **自动化响应关联**：
  - `meshctrl.js` 在向控制通道下发请求时，统一将 `responseid` 设定为固定字符串 `'meshctrl'`（如 `{ action: 'serverversion', responseid: 'meshctrl' }`）。
  - 对于不支持 `responseid` 的指令（如 `users`, `usergroups`, `meshes`），`meshctrl.js` 不依赖请求 ID，而是在接收端 switch 命中 `action` 时直接退出进程并格式化输出。
- **批量数据输出**：
  - `meshctrl.js` 广泛支持 `args.json` 与 `args.raw` 标志，直接 dump 来自控制通道的原始 JSON 快照，非常适于作为协议测试验证的对比基准。

---

## 四、历史协议废弃与升级对照表

| 历史动作 / 字段 | 当前版本现状 | 替代或演进方案 | 源码位置 / 备注 |
| :--- | :--- | :--- | :--- |
| `eventsMessageId: 4 ~ 8` | 已废弃 | 替换为 `msgid: 143 ~ 147`（桌面多路复用会话专属事件） | `views/default.handlebars:16682-16686` |
| `eventsMessageId: 33, 37-39` | 已废弃 | 替换为 `29`（强制关闭）和 `31`（工具栏激活） | `views/default.handlebars:16711-16717` |
| `createmesh.meshtype: "2"` | 支持兼容 | 历史上作为字符串传递，当前版本通过 `parseInt()` 强转为数字 | `meshuser.js:2159` |
| `action: "serverinfochange"` | 活跃 | 动态推送全局配置变化（如 `lock2factor`） | `views/default.handlebars:3429` |

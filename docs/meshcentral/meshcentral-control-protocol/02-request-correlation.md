# 02 - 请求关联机制与并发控制矩阵 (Request Correlation)

在 MeshCentral 控制通道中，**并不是所有请求都会原样返回 `responseid`**。许多核心查询和状态操作历史上由不同前端视图直接驱动，服务端采用了多种异构的关联范式。

---

## 一、十二项核心机制剖析

### 1. 服务端是否原样返回 `responseid`？
- **部分返回**：只有在请求处理逻辑中显式读取 `command.responseid` 并写入返回包的操作才会回显。
- 绝大多数增删改操作（如 `adduser`, `edituser`, `createmesh`, `runcommands`, `poweraction`）只要请求中携带了 `responseid`，均会回显。
- 但核心快照查询（如 `meshes`, `usergroups`, `events`, `wssessioncount`, `files`）在源码中**完全未回显 `responseid`**，而是使用 `tag`。

### 2. 是否使用 `tag` 关联？
- **是**：快照查询命令广泛采用 `tag`：
  - `meshes`：回传 `{ action: 'meshes', meshes: [...], tag: command.tag }`（`meshuser.js:6480`）。
  - `usergroups`：回传 `{ action: 'usergroups', ugroups: {...}, tag: command.tag }`（`meshuser.js:1577`）。
  - `events`：回传 `{ action: 'events', events: [...], tag: command.tag }`（`meshuser.js:1114`）。
  - `wssessioncount`：回传 `{ action: 'wssessioncount', wssessions: {...}, tag: command.tag }`（`meshuser.js:1260`）。
  - `users`：成功时回传 `{ action: 'users', users: [...], tag: command.tag }`（`meshuser.js:7290`）。

### 3. 是否只能按 `action` 关联？
- **是，针对无 `responseid` 且无 `tag` 的动作**：
  - `authcookie`：仅返回 `{ action: 'authcookie', cookie: '...', rcookie: '...' }`。
  - `servertimelinestats`：仅返回 `{ action: 'servertimelinestats', events: docs }`。
  - `previousLogins`：仅返回 `{ action: 'previousLogins', events: e, userid?: ... }`。
  - `getDeviceDetails`：仅返回 `{ action: 'getDeviceDetails', data: output, type: type }`。
- 对于此类消息，客户端必须保持单队列串行等待，或按 `action` 进行状态分配。

### 4. 是否必须附加 `nodeid`、`meshid` 等作用域才能消除歧义？
- **是**：如 `events` 请求如果同时拉取多个节点的日志，必须检查返回报文中的 `nodeid` 或 `userid`。
- `action: "msg"` 系列由 Agent 返回的消息（如 `ps`, `cpuinfo`, `console`）必须依赖返回包中的 `nodeid` 确定归属。

### 5. 同一 action 是否允许并发请求？
- **支持 `responseid` 或 `tag` 的 Action**：允许并发，客户端维护请求映射表（Promise map）。
- **既无 `responseid` 又无 `tag` 的 Action**（如 `authcookie`, `getDeviceDetails`, `servertimelinestats`）：**必须严格串行化**，否则后发的响应将覆盖前发的请求导致竞态。

### 6. 响应是一次性还是多条流式消息？
- 快照、CRUD 与设置类为**一次性响应**。
- `runcommands`、`serverconsole` 与 `action: "msg", type: "console"` 为**多条流式数据**，直至命令退出。

### 7. 写操作成功是否没有直接响应，而是通过后续 event 确认？
- **混合机制**：
  - 大部分写操作（如 `adduser`, `createmesh`）会返回直接的成功确认 `{ action: '...', result: 'OK' }`，随后由服务端触发全局 `DispatchEvent` 广播 `accountcreate` 或 `createmesh`。
  - **`wakedevices` 成功时没有直接响应报文**！仅在目标设备由于无 MAC 地址等单点失败时返回错误，成功时完全依赖广播的 `turnon` 与 `wakedevices` 事件！

### 8. 超时后是否适合安全重试？
- **幂等只读操作**（`nodes`, `meshes`, `users`, `events`, `getDeviceDetails`）：适合安全重试。
- **写操作**（`adduser`, `runcommands`, `poweraction`, `createmesh`）：**绝不可静默重试**！

### 9. 重试是否可能造成重复创建、重复执行命令或重复发送通知？
- **是**：
  - `runcommands` 重试会导致目标机器重复执行脚本。
  - `adduser` 重试在第一次已落库时会抛出 `User already exists` 报错。
  - `toast` 重试会导致终端用户收到多条气泡提醒。

### 10. 是否必须通过列表回读确认最终状态？
- 对于状态一致性要求极高的场景（例如重连恢复后、或者接收到 `accountchange`/`meshchange` 事件时），**强烈建议触发全量或增量列表回读**。MeshCentral 自身原生前端在收到此类变更时均会触发 `mainUpdate()` 局部或全量回读。

### 11. 错误表达形式？
- 业务错误统一使用 `result` 字符串表达（如 `{ action: 'adduser', result: 'Permission denied', responseid: '...' }`）。
- 致命握手错误使用 `{ action: 'close', cause: '...', msg: '...' }` 并直接关闭连接。
- 服务端异常中断使用 `{ action: 'stopped', msg: '...' }`。

### 12. 权限不足时的表现？
- **显式错误**：如 `users` 会在无权限时回送 `{ action: 'users', responseid: command.responseid, result: 'Access denied' }`。
- **空结果 / 静默忽略**：部分命令（如没有 `MESHRIGHT_AGENTCONSOLE` 权限时发送 `msg`）服务端直接 `return` 或 `break`，客户端将遭遇静默超时。

---

## 二、重点核实的 11 种特殊 Action 实测矩阵

通过静态源码与行号交叉审查，对已知可能不返回 `responseid` 的 11 个关键 Action 形成权威裁决：

| 目标 Action | 是否回显 `responseid` | 是否回显 `tag` | 响应结构特征 | 源码位置 | 客户端处理对策 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`events`** | 否 | **是** | `{ action: 'events', events: [...], tag: command.tag, nodeid?: ... }` | `meshuser.js:1114` | 使用 `tag` 关联请求 Promise |
| **`getDeviceDetails`** | 否 | 否 | `{ action: 'getDeviceDetails', data: output, type: type }` | `meshuser.js:5611` | 必须全局互斥**串行化**调用 |
| **`meshes`** | 否 | **是** | `{ action: 'meshes', meshes: [...], tag: command.tag }` | `meshuser.js:6480` | 使用 `tag` 关联请求 Promise |
| **`poweraction`** | **条件回显** | 否 | 提供时回显 `{ action: 'poweraction', responseid, result: 'ok' }`，未提供时回 `{ action: 'poweraction' }` | `meshuser.js:3319` | 客户端发起时**必须显式提供 `responseid`** |
| **`previousLogins`** | 否 | 否 | `{ action: 'previousLogins', events: [...], userid?: ... }` | `meshuser.js:5121` | 按 `action` + `userid` 关联，建议串行化 |
| **`servertimelinestats`** | 否 | 否 | `{ action: 'servertimelinestats', events: docs }` | `meshuser.js:7136` | 按 `action` 关联，必须串行化 |
| **`usergroups`** | 否 | **是** | `{ action: 'usergroups', ugroups: {...}, tag: command.tag }` | `meshuser.js:1577` | 使用 `tag` 关联请求 Promise |
| **`users`** | **仅错误时** | **成功时回显** | 成功：`{ action: 'users', users: [...], tag }`<br>失败：`{ action: 'users', responseid, result: 'Access denied' }` | `meshuser.js:7280, 7290` | 客户端发起时**同时提供 `tag` 与 `responseid`** |
| **`wakedevices`** | **仅单机报错** | 否 | 成功时不发直接回复；单机错误发 `{ action: 'wakedevices', responseid, result: ... }` | `meshuser.js:2971` | 成功判定必须挂载 `turnon` 事件监听 |
| **`wssessioncount`** | 否 | **是** | `{ action: 'wssessioncount', wssessions: {...}, tag: command.tag }` | `meshuser.js:1260` | 使用 `tag` 关联请求 Promise |
| **`authcookie`** | 否 | 否 | `{ action: 'authcookie', cookie: '...', rcookie: '...' }` | `meshuser.js:6473` | 仅支持按 `action` 关联，必须串行队列化 |

---

## 三、强制串行化清单 (Serialization Required)

以下 Action 由于服务端实现中既不回传 `responseid` 也不回传 `tag`，并发调用时存在严重的响应覆盖与数据混淆风险，**在 TypeScript SDK 中必须设计并发排队锁（Mutex Queue）**：

1. `authcookie`
2. `getDeviceDetails`
3. `servertimelinestats`
4. `previousLogins`
5. `files`

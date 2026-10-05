# 04 - 时间语义、事件排序与一致性机制 (Time & Ordering)

控制通道协议在时间表示上存在**秒级**与**毫秒级**混用的历史情况。本规范严格界定各时间字段的具体语义与度量衡，确保 TypeScript 类型生成与测试断言准确无误。

---

## 一、时间字段度量衡矩阵

| 字段名称 | 所属对象 / 动作 | 真实格式与单位 | 生成方 | 单调性 | 空值含义 | 排序与幂等判定建议 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `serverTime` | `serverinfo` | **Unix 毫秒** (`Date.now()`) | 服务端 | 递增 | 不可缺失 | 用于计算客户端本地与服务端的时钟偏移量（Clock Skew） |
| `time` | `event.*` | **Unix 毫秒** (`Date.now()`) | 服务端 | 递增 | 缺失代表非时间驱动事件 | **推荐用于审计日志与事件流的时序排序** |
| `creation` | `user.*` | **Unix 秒** (`Math.floor(Date.now()/1000)`) | 服务端 | 单调 | 不可缺失 | 用户账号创建时间 |
| `access` | `user.*` | **Unix 秒** (`Math.floor(Date.now()/1000)`) | 服务端 | 递增 (5分钟节流) | 未访问 | 上次访问时间，服务端为降低 DB 写入开销每 5 分钟更新一次 |
| `login` / `pastlogin` | `user.*` | **Unix 秒** | 服务端 | 单调 | 首次登录为 null | 上次登录时间，用于计算登录失败次数 |
| `passchange` | `user.*` | **Unix 秒** 或 `-1` | 服务端 | 单调 | null 为未设 | `-1` 特殊值代表“下次登录强制修改密码” |
| `lastconnect` | `node.*` / `lastconnect` | **Unix 毫秒** | 服务端 | 递增 | null 为从未连线 | 设备上次与服务端建立 Agent 或 AMT 连接的时间 |
| `agct` / `cict` | `node.*` | **Unix 毫秒** | 服务端 | 递增 | null 为离线 | 分别代表当前 Agent 连接与 CIRA 连接的开始时间戳 |
| `startTime` | `relaylog` / `recording` | **Unix 毫秒** | 服务端 | 单调 | null | 会话建立时间 |
| `lengthTime` | `recording` | **秒 (Seconds)** | 服务端 | - | null | 录制会话持续总秒数 |
| `maxtime` | `msg:notify`, `event:notify` | **秒 (Seconds)** | 发送方 | - | null 或 0 代表常驻 | **前端弹窗自动消失倒计时** (`setTimeout(..., maxtime * 1000)`) |
| `expire` | `loginToken`, `inviteLink` | 整数 (小时或时间戳) | 请求方 | - | 0 代表永不过期 | 令牌或邀请码的有效期 |

---

## 二、消息排序与传输保证

### 1. 传输层与分发层顺序保证
- **TCP / WebSocket 层面**：所有消息走单条全双工 WebSocket 长连接，保证了链路级的 FIFO 顺序。
- **`DispatchEvent` 执行顺序**：
  - 服务端 `DispatchEvent(targets, source, event)` 运行在 Node.js 单线程主事件循环中。
  - 对于同一个客户端 WebSocket，只要事件分发到该 session，就会立即调用 `ws.send()`，因此**同一个服务端进程分发的事件到达客户端的顺序严格保持一致**。
  - 在集群部署（MultiServer）模式下，跨节点的会话事件通过 Redis 或内部中继广播，不同节点产生的事件可能存在微量网络交织，但依赖事件体内的 `event.time` 毫秒时间戳进行最终时序重排。

---

## 三、重连补偿与无状态游标 (Reconnection & Cursors)

### 1. 是否存在序列号或游标？
- **不存在**：MeshCentral 协议设计**完全没有全局序列号（Sequence Number）、没有游标（Cursor），也不支持 `last-event-id` 补偿头**。
- WebSocket 断开重连后，服务端**绝不重放离线期间产生的历史事件**。

### 2. 离线期间消息补偿机制
- 任何离线期间发生的设备上下线、权限变更或配置调整，都**必须由客户端在重连成功后发起快照回读（Snapshot Readback）**。
- 标准重连恢复流水线：
  1. 接收重连后的首包 `serverinfo` 与 `userinfo`；
  2. 并行拉取 `meshes`、`nodes`、`usergroups` 与 `users`；
  3. 用拉取到的最新快照全量置换本地状态缓存，抹平断线期间丢失的微事件。

---

## 四、快照与增量事件间的竞态消除 (Race Conditions)

当客户端刚刚发出快照请求（如 `nodes`），但在响应返回之前，服务端正好推送了一条增量事件（如 `nodeconnect`）：

```text
Client                       Server
  |                            |
  |--- 1. {action:"nodes"} --->|
  |                            | (设备 001 上线)
  |<-- 2. event:nodeconnect ---| (先到达客户端)
  |                            |
  |<-- 3. nodes 响应 ----------| (可能携带离线状态的旧快照)
  |                            |
```

### 竞态规避策略：
1. **时间戳比对法**：每个设备维护本地 `lastUpdateTime`。只有当收到数据的更新时间晚于本地记录时才允许覆盖状态。
2. **连接状态原子递增**：在收到快照前挂起事件缓冲区，或以快照返回后的最新增量进行追补覆盖。
3. **原生前端行为**：MeshCentral 原生 Web 前端在收到快照返回时，会直接执行全量渲染覆盖；而对实时到达的 `nodeconnect`，通过 `node.conn = message.event.conn` 直接更新内存节点。

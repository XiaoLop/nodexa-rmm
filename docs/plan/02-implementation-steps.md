# 分阶段实施步骤

## 1. 执行原则

- 每个阶段都应保持仓库可构建、可测试；
- 优先迁移现有行为，不在同一提交中大规模扩展业务功能；
- 新旧接口短期并存时，只允许一个真实实现，旧接口通过转发兼容；
- Web 与 App 分开迁移，避免同时修改两个运行环境；
- 每阶段结束都执行对应包测试和类型检查；
- 完成所有消费者迁移后再删除旧导出。

## 2. 阶段总览

| 阶段 | 目标 | 关键产物 | 可回滚点 |
| --- | --- | --- | --- |
| 0 | 冻结契约和行为 | API 清单、事件清单、基线测试 | 无代码变化 |
| 1 | 创建独立包骨架 | control-client 包、类型、错误、测试工具 | 删除新包 |
| 2 | 迁移连接与请求 | 无 Store 的 Client、Request Manager | 保留旧 Client |
| 3 | 迁移协议和事件 | 标准化数据、事件分发、诊断通道 | 旧 Adapter 仍可使用 |
| 4 | 增加资源 API | devices、groups、events、raw | 通用 request 兜底 |
| 5 | 改造状态包 | Client-Store Binding | 旧 Store 接线可恢复 |
| 6 | 迁移 Web | 新包导入、新绑定生命周期 | 单独回退 Web |
| 7 | 迁移 App | 新包导入、AppState 恢复 | 单独回退 App |
| 8 | 清理旧实现 | 删除旧 Client/Adapter 导出 | 版本或提交回滚 |
| 9 | 全仓验收 | 构建、测试、文档、结果记录 | 发布前回滚 |

---

## 阶段 0：冻结契约与建立基线

### 阶段 0 目标

在移动代码前明确哪些行为必须保持，避免拆分后只验证“能编译”。

### 阶段 0 步骤

1. 列出现有客户端公共能力：
   - connect；
   - disconnect；
   - destroy；
   - send；
   - request；
   - requestSystemInfo；
   - requestSnapshot；
   - refreshDevices；
   - updateDevice；
   - sendPowerAction。
2. 列出消费者：
   - Web Gateway Provider；
   - App Gateway Provider；
   - Device Details；
   - Relay 验证与文件上传；
   - Batch Upload Manager；
   - shared-state Store 和测试。
3. 固定现有协议特殊情况：
   - 初始化信号集合；
   - `authcookie` 串行；
   - `getsysinfo` 降级匹配；
   - `nodeconnect` 在线/离线判定；
   - `changenode` 合并行为；
   - `lastconnects` 时间归一化。
4. 补足基线测试，保证迁移前全部通过。
5. 记录当前全仓验证结果，作为拆分后的比较基线。

### 阶段 0 结果

- 已确认公共 API 和消费者；
- 已确认不能回退的行为；
- 已有可重复执行的基线测试。

---

## 阶段 1：创建 `@meshcentral/control-client` 包骨架

### 阶段 1 目标

建立独立包和稳定的目录边界，但暂不迁移应用。

### 推荐结构

```text
packages/control-client/
├─ package.json
├─ README.md
├─ tsconfig.json
├─ tsconfig.build.json
└─ src/
   ├─ index.ts
   ├─ client/
   │  ├─ ControlClient.ts
   │  ├─ connection.ts
   │  └─ requestManager.ts
   ├─ protocol/
   │  ├─ codec.ts
   │  ├─ connectionMessages.ts
   │  ├─ normalizeDevice.ts
   │  ├─ normalizeGroup.ts
   │  └─ normalizeEvent.ts
   ├─ resources/
   │  ├─ devices.ts
   │  ├─ groups.ts
   │  └─ events.ts
   ├─ events/
   │  └─ dispatcher.ts
   ├─ errors.ts
   ├─ types.ts
   └─ testing/
      └─ FakeWebSocket.ts
```

目录可以在实现时适度简化，但职责边界不应取消。

### 阶段 1 步骤

1. 配置 workspace 包名、构建、测试、lint 和 typecheck；
2. 设置与现有包一致的 TypeScript 目标；
3. 确保运行时依赖不包含 Zustand 和 React；
4. 定义 WebSocket 抽象、连接状态、客户端通知、资源类型和错误类型；
5. 建立 Fake WebSocket 测试基础设施；
6. 添加包级架构测试或依赖检查，防止误引入状态包。

### 阶段 1 结果

- 新包可以独立构建和测试；
- 包入口只导出客户端相关能力；
- 尚未影响现有应用。

---

## 阶段 2：迁移连接生命周期与 Request Manager

### 阶段 2 目标

复制并重构现有可靠连接逻辑，使新 Client 不依赖 Store。

### 阶段 2 步骤

1. 迁移 WebSocket 工厂注入；
2. 迁移连接去重和重复 `connect()` 处理；
3. 迁移鉴权消息发送；
4. 迁移初始化信号判断；
5. 迁移连接超时和鉴权失败关闭码；
6. 迁移心跳；
7. 迁移退避重连；
8. 迁移 `disconnect()` 与 `destroy()`；
9. 把 Store 状态写入替换为连接状态事件；
10. 把 Store 错误写入替换为错误通知；
11. 提取 Request Manager；
12. 保留 `authcookie` 和 `getsysinfo` 特殊匹配；
13. 连接关闭时拒绝全部 pending 请求。

### 必测场景

- 重复连接只创建一个 WebSocket；
- 手动断开不重连；
- 异常关闭按退避序列重连；
- 鉴权失败不进入无限重连；
- 连接超时正确关闭；
- 心跳只在 connected 状态发送；
- 销毁后连接和请求被拒绝；
- pending 请求在断开时全部结束；
- 超时请求不会被迟到响应再次完成。

### 阶段 2 结果

- 新 Client 能独立连接并发送请求；
- 构造参数中没有 Store；
- 所有连接状态都通过事件向外通知。

---

## 阶段 3：迁移协议解析和事件分发

### 阶段 3 目标

让协议层输出业务数据和事件，不再输出状态 Mutation。

### 阶段 3 步骤

1. 将设备、分组、用户和时间归一化函数迁入新包；
2. 将连接消息识别迁入新包；
3. 将实时事件识别改造成标准事件；
4. 把请求响应优先交给 Request Manager；
5. 把未被请求消费的业务推送交给事件分发器；
6. 增加未知消息和无法匹配响应的诊断通知；
7. 为构造默认回调和动态订阅实现统一分发；
8. 捕获监听器异常，保证消息循环继续工作；
9. 保留原始消息字段，便于协议兼容和排查。

### 事件处理策略

| 原始消息 | 控制客户端结果 | 状态层默认策略 |
| --- | --- | --- |
| `nodeconnect, conn>0` | 设备上线事件 | 更新在线状态并保存事件 |
| `nodeconnect, conn=0` | 设备离线事件 | 更新离线状态并保存事件 |
| `changenode` | 设备变化事件 | 合并设备，不进入事件历史 |
| `removenode` | 设备删除事件 | 删除设备，可保存事件 |
| `ifchange` | 网络接口变化或未知诊断 | 默认不保存 |
| `agentlog` | Agent 日志事件 | 保存事件 |
| `relaylog` | Relay 日志事件 | 保存事件 |
| `wssessioncount` | 用户会话计数事件 | 按业务需要保存或更新 |

### 阶段 3 结果

- Protocol 不再依赖 `GatewayMutation`；
- Client 可以把设备离线等事件直接交给构造回调；
- 多个订阅者可同时消费同一事件。

---

## 阶段 4：建立资源 API

### 阶段 4 目标

把常用 action 包装为可理解、可校验、可测试的方法。

### 第一批资源方法

#### Devices

- 获取全部设备；
- 按分组获取设备；
- 获取系统信息；
- 获取网络信息；
- 获取最后连接信息；
- 获取组合设备详情；
- 修改设备；
- 删除设备；
- 唤醒和电源操作。

#### Groups

- 获取分组；
- 创建分组；
- 修改分组；
- 删除分组。

#### Events

- 获取最近事件；
- 按设备获取事件；
- 按用户获取事件。

#### Raw

- 通用 request；
- 单向 send。

### 阶段 4 步骤

1. 为每个资源方法定义输入和返回值；
2. 参数校验在发送前完成；
3. 请求均走同一个 Request Manager；
4. 对服务端错误进行统一转换；
5. 组合设备详情使用并行请求，但单项失败策略要明确；
6. 保留原始响应访问方式，避免丢失暂未标准化字段；
7. 为每类资源增加协议请求和响应测试。

### 阶段 4 结果

- 应用不必直接拼接大多数常用 action；
- Relay 和批量上传仍可使用通用请求能力；
- 资源方法不修改任何 Store。

---

## 阶段 5：改造 `@meshcentral/shared-state`

### 阶段 5 目标

将状态包改为控制客户端的消费者。

### 阶段 5 步骤

1. 把设备、分组、事件、用户和 Connection Status 类型的归属重新分类；
2. 状态包从新包导入共享业务类型，或声明仅属于状态层的扩展类型；
3. 新增 Client-Store Binding；
4. 绑定器订阅连接状态、业务事件和错误；
5. 首次连接后由绑定器拉取设备和分组；
6. 重连成功后由绑定器重新同步；
7. 把事件转换为 Store 操作；
8. 保留当前 Store 合并规则和最多 100 条事件策略；
9. Store 测试改为直接输入标准事件和资源结果；
10. 删除 Store 测试对协议适配器的依赖；
11. 暂时保留旧 Client 导出作为兼容转发，或直接进入应用迁移。

### 状态绑定规则

```text
Client connected
  → 设置 connected
  → 获取设备、分组、最后连接信息
  → 替换 Store 快照

Client deviceOnline/deviceOffline
  → 更新对应设备 online
  → 更新 lastSeenAt
  → 追加事件

Client deviceChanged
  → 合并设备字段
  → 不追加事件

Client deviceRemoved
  → 删除设备
  → 按策略追加事件

Client reconnecting
  → 只更新连接状态
  → 保留当前缓存，避免页面突然清空
```

### 阶段 5 结果

- Store 不知道 WebSocket 和原始 JSON；
- Client 不知道 Store；
- 两者只通过绑定器连接。

---

## 阶段 6：迁移 Web 应用

### 阶段 6 目标

Web Provider 使用新 Client 和状态绑定器。

### 阶段 6 步骤

1. Web 包增加 `@meshcentral/control-client` workspace 依赖；
2. Client 类和客户端错误改从新包导入；
3. Store 和 Hook 继续从状态包导入；
4. Provider 创建 Client 后立即创建 Binding；
5. 替换客户端时先释放旧 Binding，再销毁旧 Client；
6. 登录失败直接使用 Client 错误和连接事件判断；
7. 不再通过 Store 事件历史识别认证关闭消息；
8. Relay、文件上传和批量上传的 Client 类型改从新包导入；
9. 验证浏览器 online 事件触发重连；
10. 验证登录、记住登录、退出和凭据失效行为。

### 阶段 6 结果

- Web 已完全使用新控制客户端；
- 页面状态读取方式基本不变；
- Relay 和批量上传行为保持不变。

---

## 阶段 7：迁移 React Native 应用

### 阶段 7 目标

App Provider 使用新 Client 和状态绑定器，并保持前后台恢复行为。

### 阶段 7 步骤

1. App 包增加新 workspace 依赖；
2. Client 类型和实例改从新包导入；
3. Store 与 Hook 继续从状态包导入；
4. 建立 Binding 生命周期；
5. 登录校验改为监听 Client 连接状态和错误，不再读取 Store 原始关闭事件；
6. 保持 AsyncStorage 凭据行为；
7. 保持 AppState 前后台切换逻辑；
8. 验证 React Native WebSocket 工厂兼容性；
9. 验证路由回到登录页的条件；
10. 验证 App 长时间后台后恢复连接和重新同步。

### 阶段 7 结果

- App 已完全使用新控制客户端；
- 登录和生命周期行为不依赖 Store 中的原始协议消息。

---

## 阶段 8：清理旧实现和导出

### 阶段 8 目标

消除重复实现，确保依赖方向不可逆转。

### 阶段 8 步骤

1. 删除状态包中的旧客户端实现；
2. 删除状态包中的旧协议适配器，或仅保留状态转换所需纯函数；
3. 删除状态包对客户端错误和 WebSocket 类型的导出；
4. 删除公开的 `GatewayMutation`，或改为状态包内部类型；
5. 更新包 README；
6. 更新 docs 导航；
7. 搜索全仓旧导入和旧符号；
8. 检查 package 依赖是否形成循环；
9. 确认 Relay 只依赖控制通道接口；
10. 删除过渡兼容层。

### 阶段 8 结果

- 控制客户端只有一个真实实现；
- 状态包运行时依赖新包；
- 不存在循环依赖；
- 文档与实际代码一致。

---

## 阶段 9：全仓验收与结果记录

### 阶段 9 目标

证明拆包不仅完成编译，而且保持关键业务行为。

### 阶段 9 步骤

1. 执行全仓 lint；
2. 执行全仓 typecheck；
3. 执行全仓 test；
4. 执行全仓 build；
5. 执行 format check；
6. 进行 Web 登录、设备列表、设备离线、详情和 Relay 冒烟测试；
7. 进行 App 登录、前后台恢复、离线事件和退出冒烟测试；
8. 记录包依赖图和验证结果；
9. 确认没有认证信息进入日志和错误对象；
10. 更新迁移完成状态。

### 阶段 9 最终结果

- `@meshcentral/control-client` 可以脱离 Zustand 独立使用；
- `@meshcentral/shared-state` 成为纯状态与框架适配包；
- Web、App 和 Relay 使用同一个控制通道能力；
- 后续新增设备、分组和事件 API 时不再修改 Store 核心。

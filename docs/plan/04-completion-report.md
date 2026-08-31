# Control Client 拆包完成报告

## 已完成变更

- 新增 `@meshcentral/control-client`，公开 `GatewayClient`、专用错误、连接/事件/错误/诊断订阅、WebSocket 工厂和标准业务类型；
- 增加 `devices`、`groups`、`events` 资源模块，并保留 `request`、`send` 和现有平铺兼容方法；
- 将鉴权初始化、连接超时、心跳、退避重连、`authcookie` 串行和 `getsysinfo` 降级匹配迁入新包；
- 新增 `bindGatewayClient()`，负责首次连接及重连后的设备、分组和最后连接信息同步；
- 删除 shared-state 的旧客户端、协议适配器、公开 Mutation 和 `applyMutation()`；
- Web 和 React Native Provider 已改为新 Client + Binding 生命周期；
- Relay 与批量上传继续通过结构化 `request`/`send` 契约工作。

## 最终公共边界

### control-client

- `GatewayClient`
- `client.devices`、`client.groups`、`client.events`
- `connect()`、`disconnect()`、`destroy()`、`request()`、`send()`
- `client.on('connection' | 'event' | 'userInfo' | 'message' | 'error' | 'diagnostic', listener)`
- 客户端错误、WebSocket 抽象和标准业务类型

### shared-state

- `createGatewayStore()`、`gatewaySelectors`、`useGatewayStore()`
- `bindGatewayClient()`
- 状态类型和面向 UI 的业务类型转发

## 设计决策

- 保留 `GatewayClient` 类名以减少消费者迁移风险；
- 客户端连接成功不隐藏拉取业务快照，Binding 显式执行同步；
- 客户端内部增加 `authenticating`、`destroyed` 状态，Binding 映射为现有 UI 状态；
- 现有平铺方法只委托资源模块，不保留第二套协议实现；
- 设备详情组合请求采用并行 fail-fast。

## 自动化结果

- control-client 包测试：9 项通过；
- shared-state 包测试：18 项通过；
- Relay 包测试：25 项通过；
- Web 包测试：4 项通过；App 当前没有测试文件并以 `--passWithNoTests` 通过；
- 全仓 lint：通过；
- 全仓 typecheck：通过；
- 全仓 test：通过；
- 全仓 build：通过；
- 全仓 format check：通过。

Web 生产构建仍有既有的大于 500 kB chunk 警告，但不影响构建成功。

## 人工冒烟

需要在可访问实际 MeshCentral/业务网关的环境中验证 Web、App、Relay 和批量上传。当前实现未改变凭据保存策略或页面视觉设计。

## 已知限制

- 尚未封装全部 MeshCentral action，未覆盖的能力继续使用 `request()` 和 `send()`；
- 本次未重写 Relay，也未实现远程桌面、文件和终端协议；
- 实际网关冒烟结果需由具备测试账号和网络环境的运行者补充。

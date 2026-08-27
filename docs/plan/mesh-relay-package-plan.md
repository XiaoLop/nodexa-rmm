# MeshRelay 子包建设计划

## 1. 定位与命名

建议创建独立子包 `@meshcentral/relay`，目录为 `packages/relay`。

该包统一管理 `meshrelay.ashx` 中继连接，不以文件上传等单一业务命名。它负责中继连接的建立、生命周期、消息传输和协议扩展；设备状态与控制通道仍由 `@meshcentral/shared-state` 管理，页面与交互组件仍保留在应用层。

## 2. 职责边界

### `@meshcentral/shared-state`

- 维护控制 WebSocket、认证状态、设备和分组状态。
- 请求中继认证信息。
- 通过控制通道通知目标设备建立中继连接。
- 不处理 `meshrelay.ashx` 的二进制流和具体会话协议。

### `@meshcentral/relay`

- 创建并管理独立的 `meshrelay.ashx` WebSocket。
- 管理连接状态、握手、超时、关闭、异常和取消。
- 提供文本、JSON、二进制数据的统一传输能力。
- 根据协议编号创建对应类型的中继会话。
- 不保存设备列表，不包含 React、Ant Design 或页面状态。

### 应用层

- 选择设备及具体操作类型。
- 管理上传弹窗、终端视图和远程桌面画布。
- 展示进度、错误和连接状态。
- 调用中继包提供的会话接口，不直接操作底层 WebSocket。

## 3. 初始文件结构

```text
packages/relay/
  package.json
  tsconfig.json
  tsconfig.build.json
  README.md
  src/
    index.ts
    types.ts
    errors.ts
    RelayClient.ts
    RelaySession.ts
    RelayConnection.ts
    relayUrl.ts
    protocols/
      types.ts
      files/
      terminal/
      desktop/
    testing/
```

分层说明：

- `RelayClient`：面向调用方的统一入口，负责申请认证信息、通知设备并创建会话。
- `RelaySession`：表示一次面向某台设备的逻辑中继会话，暴露公共生命周期。
- `RelayConnection`：封装底层 WebSocket、握手、收发、超时与关闭。
- `protocols`：按协议类型隔离文件管理、终端和桌面的状态机。
- `types`：公共配置、连接状态、事件和最小控制通道接口。
- `errors`：统一连接、认证、握手、协议、超时和取消错误。
- `testing`：提供可替换 WebSocket、控制通道和测试夹具，不进入业务代码。

## 4. 建设阶段

### 阶段一：创建空白子包

- 创建 `packages/relay`，沿用 monorepo 现有 TypeScript、ESLint、Vitest 和 Turborepo 规范。
- 建立最小导出入口、类型文件、README 和测试目录。
- 暂不实现任何文件、终端或桌面协议。
- 确认子包可以独立完成 `build`、`lint`、`typecheck` 和 `test`。

### 阶段二：定义中继生命周期

建立与具体协议无关的生命周期模型：

1. 创建会话请求。
2. 获取 `cookie` 与 `rcookie`。
3. 生成唯一中继 ID。
4. 通过控制通道通知目标设备。
5. 连接 `meshrelay.ashx`。
6. 等待浏览器侧与 Agent 侧握手完成。
7. 进入可用状态并传输数据。
8. 正常关闭、主动取消、超时关闭或异常断开。

建议统一连接状态：

- `idle`
- `authorizing`
- `notifying`
- `connecting`
- `handshaking`
- `ready`
- `closing`
- `closed`
- `error`

生命周期层只负责连接与数据通道，不解释文件上传确认、终端输出或桌面帧。

### 阶段三：分析并划分协议能力

在生命周期稳定后，再逐项确认 MeshCentral 实际协议并建设适配层：

| 会话类型 | 常见协议编号 | 主要数据形态 | 首期关注点 |
| --- | ---: | --- | --- |
| 文件管理 | `5` | JSON 控制消息 + 二进制文件块 | 目录浏览、上传、下载、进度、取消、背压 |
| 远程终端 | `1` | 文本或二进制流 + 控制消息 | 输入输出、终端尺寸、编码、断线处理 |
| 远程桌面 | `2` | 二进制图像与输入事件 | 桌面帧、鼠标键盘、剪贴板、质量和尺寸 |
| Web SSH | `11` | 终端流 | 与普通终端的协议差异及认证方式 |
| Web SSH 文件 | `13` | 文件控制与二进制流 | 与 `p=5` 文件协议的差异 |

每种能力作为独立协议模块实现，共享底层连接，但不共享各自的业务状态机。第一项建议先实现文件管理，以验证 JSON 与二进制混合传输、确认机制和批量会话调度。

## 5. 核心抽象原则

- 使用最小控制通道接口接入 `GatewayClient`，避免中继包访问其内部 WebSocket。
- 底层 WebSocket 通过工厂注入，方便 Web、未来 React Native 适配和单元测试。
- 核心层不直接依赖浏览器 `File`、DOM 或 React；浏览器文件应通过数据源适配器接入。
- 一个中继会话对应一台设备和一种协议，批量操作由更高层调度多个会话。
- 公共生命周期与具体协议状态机分离，避免文件、终端和桌面逻辑互相影响。
- 首期不设计自动重连；中继会话断开后由调用方决定重建，避免对非幂等操作进行错误重放。

## 6. 依赖方向

```text
apps/web 或 apps/app
  ├─> @meshcentral/shared-state
  └─> @meshcentral/relay
          └─> 最小控制通道接口（由 GatewayClient 实例满足）
```

`@meshcentral/relay` 不应反向依赖应用层，也不应负责全局设备状态。是否直接声明对 `@meshcentral/shared-state` 的依赖，可在阶段二根据控制通道接口的归属决定；优先采用结构化接口注入，保持两者低耦合。

## 7. 首期完成标准

- 空白子包接入工作区并通过仓库质量检查。
- 中继生命周期和公共状态定义完成。
- 可以使用模拟控制通道与模拟 WebSocket 验证创建、握手、收发、关闭、超时和异常流程。
- 文件、终端和桌面目录只建立协议边界，不提前混入未经验证的实现。
- 对外 API 保持协议无关，为后续逐个实现中继能力预留扩展点。

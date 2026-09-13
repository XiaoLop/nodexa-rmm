# 终端协议

`TerminalSession` 适配 MeshCentral terminal relay 协议 `p=1`。它负责启动配置、终端输入输出、尺寸调整、RTT 测量、消息顺序和待处理输出上限。

## 创建会话

终端启动顺序必须是 `options` 文本消息，然后是 Shell 协议号 `"1"`：

```ts
import {
  RELAY_PROTOCOLS,
  TerminalSession,
  createTerminalOptionsMessage,
} from '@meshcentral/relay';

const initialSize = { cols: 120, rows: 30 };
let recorded = false;

const relay = await relayClient.createSession({
  deviceId,
  protocol: RELAY_PROTOCOLS.terminal,
  onHandshakeMessage: (message) => {
    recorded = message === 'cr';
  },
  createStartupMessages: () => [createTerminalOptionsMessage(1, initialSize), '1'],
});

const terminal = new TerminalSession(relay, {
  initialSize,
  recorded,
  rttIntervalMs: 10_000,
  rttTimeoutMs: 15_000,
});
```

`TerminalSession` 要求底层 relay 的协议为 `1` 且状态已经是 `ready`。`recorded` 仅记录调用方根据 `cr` 握手判断出的状态，本包不自行开启或关闭录制。

## 发送消息

| API 或阶段 | 线上消息 | 目的 | 可获得什么 |
| --- | --- | --- | --- |
| 启动阶段 | `{"type":"options","protocol":1,"cols":120,"rows":30}` 文本 | 配置 Shell 类型和初始尺寸 | Agent 按配置启动终端 |
| 启动阶段 | 文本 `"1"` | 选择终端 relay 协议 | relay 进入终端数据阶段 |
| `write(string)` | UTF-8 编码的二进制帧 | 发送命令、按键或粘贴内容 | 对应终端输出通过 `onData` 返回 |
| `write(Uint8Array)` | 原始二进制帧 | 发送已编码的终端输入 | 对应终端输出通过 `onData` 返回 |
| `resize(size)` | JSON `termsize` 控制消息 | 调整远端伪终端尺寸 | 后续输出按新尺寸生成 |
| 自动 RTT | JSON `rtt` 控制消息 | 探测往返延迟 | `onLatencyChange` 获得毫秒值或 `undefined` |

尺寸范围：列数 `2..500`，行数 `1..200`。与上次相同的尺寸不会重复发送。

`resize({ cols, rows })` 发送：

```json
{
  "ctrlChannel": "102938",
  "type": "termsize",
  "cols": 132,
  "rows": 36
}
```

RTT 探测发送：

```json
{
  "ctrlChannel": "102938",
  "type": "rtt",
  "time": 1720000000000
}
```

## 接收数据与事件

```ts
const removeData = terminal.onData((data) => {
  if (typeof data === 'string') {
    xterm.write(data);
  } else {
    xterm.write(data);
  }
});

const removeLatency = terminal.onLatencyChange((latencyMs) => {
  updateLatencyIndicator(latencyMs);
});

const removeState = terminal.onStateChange((state) => {
  console.log(state);
});
```

| 监听入口 | 载荷 | 触发时机 | 用途 |
| --- | --- | --- | --- |
| `onData` | `string \| Uint8Array` | 收到普通终端输出 | 写入 xterm.js、日志流或命令采集器 |
| `onLatencyChange` | `number \| undefined` | RTT 响应匹配或探测超时 | 显示链路延迟；`undefined` 表示本次无响应 |
| `onStateChange` | `ready \| closed \| error` | 适配器终态变化 | 禁用输入、释放终端 UI、展示错误状态 |
| 构造选项 `onControlMessage` | `TerminalControlMessage` | 收到已确认的 RTT 控制消息 | 记录控制帧或扩展延迟统计 |
| 构造选项 `onUnhandledMessage` | 原始 relay 数据 | 消息处理失败 | 诊断协议不兼容或异常数据 |

Blob 和其他二进制消息会通过串行队列转换为 `Uint8Array`，保留消息到达顺序。ArrayBufferView 会保留原始 `byteOffset` 和 `byteLength` 对应的数据范围。

## 已确认的控制消息边界

当前只把以下入站 JSON 识别为控制消息：

- `ctrlChannel` 转成字符串后等于 `"102938"`。
- `type` 等于 `"rtt"`。
- `time` 与当前待处理探测时间一致时，计算 RTT。

尚未通过当前协议证据确认的 `ping`、`pong`、`metadata`、`disconnect` 等字符串不会被过滤，而是作为普通终端文本交给 `onData`。应用不应依赖本包解释这些消息。

## RTT 行为

- 默认创建会话后立即发送一次 RTT 探测。
- 默认每 10 秒尝试发送一次。
- 同一时间只允许一个待处理 RTT。
- 默认等待 15 秒；超时触发 `onLatencyChange(undefined)`。
- 设置 `rttIntervalMs <= 0` 可关闭自动 RTT。

## 错误与资源上限

`TerminalSessionError.code`：

| code | 含义 |
| --- | --- |
| `protocol` | relay 协议不是 `p=1` |
| `connection-lost` | relay 未 ready、已关闭或已断线 |
| `invalid-size` | 终端尺寸不是整数或超出支持范围 |
| `output-overflow` | 类型保留；当前待处理输出溢出会关闭 relay |

默认最大待处理输出为 4 MiB。超过上限时会将会话置为 `error`，并使用 WebSocket 关闭码 `4009` 关闭底层 relay。处理不支持的数据失败时使用关闭码 `4002`。

## 关闭

```ts
terminal.dispose(); // 释放终端适配器，不关闭 relay
terminal.close();   // 释放适配器并关闭 relay
```

## 实现依据

- `src/protocols/terminal/TerminalSession.ts`
- `src/protocols/terminal/controlMessages.ts`
- `src/protocols/terminal/types.ts`
- `src/protocols/terminal/TerminalSession.test.ts`
- `src/testing/fixtures/terminal/`

# Workspace Tests

这里用于编写跨 `packages` 的集成测试。测试代码可以直接通过包名导入 workspace 包：

```ts
import { GatewayClient } from '@meshcentral/control-client';
import { RelayClient } from '@meshcentral/relay';
import { createGatewayStore } from '@meshcentral/shared-state';
```

在仓库根目录运行：

```sh
pnpm --filter @meshcentral/test test
pnpm --filter @meshcentral/test test:watch
pnpm --filter @meshcentral/test typecheck
```

## 手动采集远程终端数据

复制 `test/.env.example` 为被 Git 忽略的 `test/.env`，填入目标测试环境。真实认证值只能放在 `.env`，不得提交到仓库。

采集器支持三个场景：

```text
CAPTURE_SCENARIO=terminal           双向 WebSocket 帧方向、类型和握手顺序
CAPTURE_SCENARIO=permission-denied  无终端权限账户的拒绝阶段和关闭信息
CAPTURE_SCENARIO=relaylog           正常终端结束后的实时及历史 relaylog
```

运行：

```sh
cd test
pnpm exec vitest run manual/terminal-data.capture.test.ts --reporter=verbose
```

只有设置 `RUN_MANUAL_INTEGRATION=1` 才会连接真实服务端；默认测试会跳过。采集结果写入 `test/captures/`，包含相对时间、方向、帧类型、长度、状态、关闭信息和脱敏后的控制消息。

推荐依次运行：

1. 使用有权限账户设置 `CAPTURE_SCENARIO=terminal`，确认 `c/cr → options → 1` 及输入输出帧类型。
2. 使用无权限账户设置 `CAPTURE_SCENARIO=permission-denied`，并提供 `MESH_DENIED_DEVICE_ID`。
3. 恢复有权限账户，设置 `CAPTURE_SCENARIO=relaylog`，等待会话关闭后的实时和历史事件。

`MANUAL_TERMINAL_INPUT` 默认留空，因此采集器不会自动执行 Shell 命令。若需要确认键盘帧类型，只在隔离测试设备上设置无副作用输入，例如：

```dotenv
MANUAL_TERMINAL_INPUT=ver\r
```

采集器会递归遮蔽 Cookie、Token、认证参数和常见设备/用户/会话 ID，并且不会保存二进制终端内容。提交任何采集文件前仍必须人工检查，确认其中没有用户名、IP 地址、主机名、命令输出或其他业务数据。

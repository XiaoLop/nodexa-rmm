# 远程桌面、终端、文件隧道

远程桌面、终端、上传、下载不只使用 `control.ashx`，还需要创建 `meshrelay.ashx` 中继 WebSocket。控制通道负责通知 Agent 连接中继，中继通道负责传输实时数据。

## 协议编号

常见 `meshrelay.ashx?p=<protocol>`：

- `p=1`：终端 Shell。
- `p=2`：远程桌面。
- `p=5`：文件管理、上传、下载。
- `p=11`：Web SSH。
- `p=13`：Web SSH 文件。

## 通用中继建立流程

1. 控制通道发送 `authcookie`，获取 `cookie` 和 `rcookie`。
2. 生成随机 `tunnelid`。
3. 控制通道向设备发送 `msg type=tunnel`，通知 Agent 连接中继。
4. 客户端打开 `meshrelay.ashx` WebSocket。
5. 中继通道握手成功后按具体协议传输数据。

控制通道请求 Cookie：

```json
{
  "action": "authcookie"
}
```

通知 Agent：

```json
{
  "action": "msg",
  "nodeid": "node//yyyyyyyy",
  "type": "tunnel",
  "usage": 1,
  "value": "*/meshrelay.ashx?p=1&nodeid=node//yyyyyyyy&id=<tunnelid>&rauth=<rcookie>",
  "responseid": "req-tunnel"
}
```

客户端连接：

```text
wss://<server>/<domain>/meshrelay.ashx?browser=1&p=1&nodeid=<urlencoded-nodeid>&id=<tunnelid>&auth=<cookie>
```

## 交互式终端

终端协议使用 `p=1`。握手过程：

1. 中继 WebSocket 打开后等待 Agent 返回 `c` 或录制会话标识 `cr`。
2. 客户端发送包含 Shell 协议及初始尺寸的 `options` 文本帧。
3. 客户端发送字符串 `1`，表示启动普通终端 Shell。
4. 启动帧全部发送成功后中继进入 `ready`。
5. 后续尺寸变化通过 `termsize` 控制消息发送，终端输入按 UTF-8 二进制帧发送。
6. 服务端字符串或二进制输出按接收顺序交给 xterm.js。

初始配置示例：

```json
{
  "type": "options",
  "protocol": 1,
  "cols": 120,
  "rows": 30
}
```

终端大小控制消息示例：

```json
{
  "ctrlChannel": "102938",
  "type": "termsize",
  "cols": 120,
  "rows": 30
}
```

客户端输入：

```text
dir\r
```

服务端输出：普通字符串或 Buffer。收到控制通道消息时应过滤：

```json
{
  "ctrlChannel": "102938",
  "type": "rtt",
  "time": 1786700000000
}
```

仓库通过 `TerminalSession` 暴露事件接口：

```js
terminal.onData(chunk => xterm.write(chunk));
terminal.write('whoami\r');
terminal.resize({ cols: 120, rows: 30 });
terminal.close();
```

Web 工作台使用 `@xterm/xterm`、FitAddon 和 SearchAddon，终端输出不进入 React state。当前实现包含连接、断开、尺寸同步、搜索、复制、粘贴确认、清屏、全屏、延迟和录制提示。目标 MeshCentral 版本的 Linux/macOS、PowerShell、权限失败、主动关闭和 `cr` 行为仍需真实设备兼容验收。

## 远程桌面

远程桌面使用 `p=2`，协议比终端复杂，包含图像帧、鼠标、键盘、剪贴板、屏幕大小、质量控制、WebRTC 切换等消息。

MeshCentral Web UI 使用 `public/scripts/agent-redir-ws-0.1.1.js` 创建远程桌面中继：

```js
CreateAgentRedirect(meshserver, module, serverPublicNamePort, authCookie, rauthCookie, domainUrl)
```

封装策略：

- 如果目标是 Web 前端，建议直接复用 MeshCentral 的前端脚本，并在外层封装连接生命周期。
- 如果目标是服务端自动化，不建议自行解析远程桌面画面协议，除非需要录制或代理。
- 如果只需要打开远控会话，可创建 `p=2` 隧道并把数据转发给浏览器端模块处理。

典型流程与终端相同，只是 `usage` 和 `p` 改为 `2`：

```json
{
  "action": "msg",
  "nodeid": "node//yyyyyyyy",
  "type": "tunnel",
  "usage": 2,
  "value": "*/meshrelay.ashx?p=2&nodeid=node//yyyyyyyy&id=<tunnelid>&rauth=<rcookie>"
}
```

客户端连接：

```text
wss://<server>/<domain>/meshrelay.ashx?browser=1&p=2&nodeid=<nodeid>&id=<tunnelid>&auth=<cookie>
```

## 文件管理、上传、下载

文件隧道使用 `p=5`。

建立中继：

```json
{
  "action": "msg",
  "nodeid": "node//yyyyyyyy",
  "type": "tunnel",
  "usage": 5,
  "value": "*/meshrelay.ashx?p=5&nodeid=node//yyyyyyyy&id=<tunnelid>&rauth=<rcookie>"
}
```

客户端连接：

```text
wss://<server>/<domain>/meshrelay.ashx?browser=1&p=5&nodeid=<nodeid>&id=<tunnelid>&auth=<cookie>
```

### 上传文件

发送上传请求：

```json
{
  "action": "upload",
  "reqid": "up-001",
  "path": "C:\\Temp",
  "name": "demo.txt",
  "size": 12345
}
```

Agent 返回：

```json
{
  "action": "uploadstart",
  "reqid": "up-001"
}
```

之后按块发送文件二进制数据。Agent 每次确认：

```json
{
  "action": "uploadack",
  "reqid": "up-001"
}
```

当前 `@meshcentral/relay` 默认按 `5 MiB`（`5 * 1024 * 1024 = 5,242,880` 字节）分块。最后一块使用剩余长度，每收到一次 `uploadack` 后发送下一块。上传超时按“等待远端活动”的时间计算，收到匹配的 `uploadstart`、`uploadack` 或 `uploaddone` 后会重新计时，而不是限制整个文件必须在固定时间内完成。

完成或取消：

```json
{ "action": "uploaddone", "reqid": "up-001" }
```

```json
{ "action": "uploadcancel", "reqid": "up-001" }
```

### 下载文件

发送下载请求：

```json
{
  "action": "download",
  "sub": "start",
  "id": "C:\\Temp\\demo.txt",
  "path": "C:\\Temp\\demo.txt"
}
```

Agent 返回 `download start` 后，客户端发送：

```json
{
  "action": "download",
  "sub": "startack",
  "id": "C:\\Temp\\demo.txt"
}
```

每收到一块文件数据后发送 ack：

```json
{
  "action": "download",
  "sub": "ack",
  "id": "C:\\Temp\\demo.txt"
}
```

### 文件操作消息传输约定

目标环境中的文件管理控制消息虽然内容为 JSON，但均通过 `p=5` 中继的二进制 WebSocket 帧发送。接收端应先按 UTF-8 解码二进制帧，再解析 JSON；不能假定这些消息一定以 WebSocket 文本帧到达。

目录创建、删除、重命名、复制和移动操作发送后，Agent 不会返回任何响应。客户端应在发送后自动重新读取相关目录，以展示最新的目录内容。由于没有操作响应，`reqid` 不能用于关联结果，目录刷新也不能作为协议层面的成功确认。

### 新建目录

发送完整目标目录路径：

```json
{
  "action": "mkdir",
  "reqid": 1,
  "path": "C:/test"
}
```

Agent 不会返回响应。客户端发送后自动重新读取当前目录。

### 删除目录或文件

`path` 表示父目录，`delfiles` 表示需要删除的名称。删除目录时使用 `rec: true` 递归删除目录内容：

```json
{
  "action": "rm",
  "reqid": 1,
  "path": "C:",
  "delfiles": ["test"],
  "rec": true
}
```

Agent 不会返回响应。客户端发送后自动重新读取 `path` 对应的目录。删除属于高风险操作，调用方必须在发送前完成用户确认，并避免把未经校验的根目录或空名称传给 Agent。

### 重命名

`path` 表示父目录，`oldname` 和 `newname` 分别表示原名称和新名称：

```json
{
  "action": "rename",
  "path": "C:",
  "oldname": "test",
  "newname": "test123"
}
```

Agent 不会返回响应。客户端发送后自动重新读取父目录。

### 复制文件

当前真实协议样本只确认复制文件，不支持据此推断可以复制目录。`scpath` 是源目录，`dspath` 是目标目录，`names` 是源目录中的文件名列表：

```json
{
  "action": "copy",
  "reqid": 1,
  "scpath": "C:",
  "dspath": "C:/test123",
  "names": ["earnings.html"]
}
```

Agent 不会返回响应。客户端发送后自动重新读取当前目录；用户进入目标目录时再读取目标目录的最新内容。

### 移动文件

当前真实协议样本只确认移动文件，不支持据此推断可以移动目录。字段含义与复制一致：

```json
{
  "action": "move",
  "reqid": 1,
  "scpath": "C:",
  "dspath": "C:/test123",
  "names": ["earnings.html"]
}
```

Agent 不会返回响应。客户端发送后自动重新读取当前目录；用户进入目标目录时再读取目标目录的最新内容。

### 压缩为 ZIP

`path` 表示待压缩条目的父目录，`files` 可以包含文件或目录名称，`output` 是输出 ZIP 文件名：

```json
{
  "action": "zip",
  "path": "C:",
  "files": ["test123"],
  "output": "test-123.zip"
}
```

压缩期间 Agent 通过 `dialogmessage` 报告阶段和单文件进度：

```json
{ "action": "dialogmessage", "msg": "zipping" }
{ "action": "dialogmessage", "msg": "zippingFile", "file": "C:\\test123\\earnings.html", "progress": 19 }
{ "action": "dialogmessage", "msg": "zippingFile", "file": "C:\\test123\\earnings.html", "progress": 38 }
{ "action": "dialogmessage", "msg": "zippingFile", "file": "C:\\test123\\earnings.html", "progress": 100 }
{ "action": "dialogmessage", "msg": null }
{ "action": "refresh" }
```

- `msg: "zipping"` 表示压缩开始。
- `msg: "zippingFile"` 携带当前文件和百分比进度。
- `msg: null` 表示进度对话状态结束，但不应单独视为可靠的成功确认。
- `action: "refresh"` 表示客户端应重新读取当前目录；最终结果以目录列表中出现输出 ZIP 为准。

### 解压 ZIP

解压操作只适用于 ZIP 文件。`input` 是 ZIP 文件完整路径，`dest` 是目标目录完整路径：

```json
{
  "action": "unzip",
  "input": "C:\\test-123.zip",
  "dest": "C:\\test-123\\"
}
```

Agent 返回解压阶段和刷新消息：

```json
{ "action": "dialogmessage", "msg": "unzipping" }
{ "action": "dialogmessage", "msg": null }
{ "action": "refresh" }
```

收到 `refresh` 后重新读取目标目录。解压是否成功、是否发生同名覆盖以及是否存在部分失败，应以刷新后的目录内容为准；当前样本没有提供独立的完成结果或逐文件错误响应。

### 当前确认的文件管理能力

| 能力 | 请求 action | 响应与确认方式 |
| --- | --- | --- |
| 读取目录 | `ls` | 返回包含 `dir` 的目录列表 |
| 新建目录 | `mkdir` | Agent 不响应，客户端自动重新读取父目录 |
| 删除文件或目录 | `rm` | Agent 不响应，客户端自动重新读取父目录 |
| 重命名 | `rename` | Agent 不响应，客户端自动重新读取父目录 |
| 复制文件 | `copy` | Agent 不响应，客户端自动重新读取当前目录 |
| 移动文件 | `move` | Agent 不响应，客户端自动重新读取当前目录 |
| 压缩 ZIP | `zip` | `dialogmessage` 进度，随后 `refresh` |
| 解压 ZIP | `unzip` | `dialogmessage` 阶段，随后 `refresh` |
| 上传 | `upload` | `uploadstart`、`uploadack`、`uploaddone` |
| 下载 | `download` | start JSON、二进制数据块和 ack |

当前没有证据表明 `copy` 和 `move` 支持目录，也尚未确认同名目标处理、操作取消、断点续传和逐项批量结果。`mkdir`、`rm`、`rename`、`copy` 和 `move` 均没有 Agent 响应，客户端只能在发送后自动刷新目录，不得根据请求已发送或目录刷新完成直接报告操作成功。

## 远程打开 URL、消息框、Toast

这些不需要中继，只走控制通道。

打开 URL：

```json
{
  "action": "msg",
  "type": "openUrl",
  "nodeid": "node//yyyyyyyy",
  "url": "https://example.com",
  "responseid": "req-open-url"
}
```

消息框：

```json
{
  "action": "msg",
  "type": "messagebox",
  "nodeid": "node//yyyyyyyy",
  "title": "MeshCentral",
  "msg": "Hello",
  "timeout": 120000,
  "responseid": "req-message"
}
```

Toast：

```json
{
  "action": "toast",
  "nodeids": ["node//yyyyyyyy"],
  "title": "MeshCentral",
  "msg": "Hello",
  "responseid": "req-toast"
}
```

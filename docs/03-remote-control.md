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

1. 中继 WebSocket 打开后等待 Agent 返回单字符 `c`。
2. 客户端发送终端大小控制消息，可选。
3. 客户端发送字符串 `1`，表示启动终端。
4. 后续客户端输入直接写入中继 WebSocket，服务端输出从中继 WebSocket 收到。

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

封装建议：终端模块暴露为 Node.js `Duplex` 或事件接口：

```js
terminal.on('data', chunk => process.stdout.write(chunk));
terminal.write('whoami\r');
terminal.resize({ cols: 120, rows: 30 });
terminal.close();
```

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

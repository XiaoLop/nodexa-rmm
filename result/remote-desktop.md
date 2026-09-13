# 远程桌面

## 典型建立流程

```text
Server -> Browser、Agent:
    "c" 或 "cr"

Browser -> Server -> Agent:
    {"type":"options", ...}     // 可选

Browser -> Server -> Agent:
    "2"                         // 文本协议号

Agent -> Server -> Browser:
    {"ctrlChannel":"102938","type":"metadata","users":{...}}

Agent -> Server -> Browser:
    cmd=7                       // 屏幕宽高

Browser -> Server -> Agent:
    cmd=5                       // 图像压缩参数
    cmd=8                       // 恢复图像传输
    cmd=87                      // 查询输入锁
    cmd=1                       // 释放修饰键
    cmd=14                      // 触摸初始化

Agent -> Server -> Browser:
    cmd=3                       // 图像图块
```

这是**典型顺序，不是强制顺序**。浏览器在 WebSocket `onopen` 后还可能立即发送 RTT：

```json
{
  "ctrlChannel": 102938,
  "type": "rtt",
  "time": 1710000000000
}
```

所以 RTT 可能出现在 `c`/`cr` 之前。用户同意提示、`metadata`、屏幕尺寸和图像数据也可能交错。

## 普通二进制消息格式

```text
opcode:u16BE
length:u16BE     // 包含4字节头
payload
```

### 浏览器 → Agent

| Opcode | 含义 |
|---:|---|
| `1` | 键盘按键 |
| `2` | 鼠标、滚轮 |
| `5` | 图像压缩参数 |
| `6` | 刷新 |
| `8` | 暂停/恢复图像 |
| `10` | Ctrl-Alt-Del |
| `11` | 查询显示器 |
| `12` | 切换显示器 |
| `14` | 初始化触摸 |
| `15` | 触摸输入 |
| `17` | KVM 文本消息 |
| `85` | Unicode 输入 |
| `87` | 查询/设置输入锁 |

### Agent → 浏览器

| Opcode | 含义 |
|---:|---|
| `3` | 图像图块 |
| `7` | 屏幕宽高 |
| `11` | 显示器列表 |
| `12` | 切换显示器确认 |
| `14` | 触摸可用 |
| `15` | 触摸状态重置 |
| `17` | KVM 文本消息 |
| `18` | 键盘锁状态 |
| `65` | Alert |
| `82` | 显示器布局 |
| `87` | 输入锁状态 |
| `88` | 鼠标光标类型 |

例如远程屏幕尺寸 `1920×1080`：

```text
00 07 00 08 07 80 04 38
```

例如浏览器发送左键按下，坐标 `(100,200)`：

```text
00 02 00 0A 00 02 00 64 00 C8
```

其中：

```text
00 02       opcode = 2
00 0A       length = 10
00          保留字段
02          左键按下
00 64       X = 100
00 C8       Y = 200
```

## 需要重点区分的三个内容

### `c`/`cr`

这是 Relay 连接就绪通知：

```text
c   = 普通会话
cr  = 正在录制的会话
```

它不是桌面首帧，也不是用户同意结果。

### 文本 `"2"`

这是协议选择消息：

```text
"2"
```

它是文本，不是二进制：

```text
00 02
```

### 命令 opcode `2`

这是后续鼠标命令：

```text
00 02 ...
```

它和前面的文本 `"2"` 完全不同。

## 控制 JSON

连接过程中还可能穿插：

```json
{"ctrlChannel":102938,"type":"rtt","time":...}
```

```json
{"ctrlChannel":"102938","type":"metadata","users":{...}}
```

```json
{"ctrlChannel":"102938","type":"console","msg":"Waiting for user to grant access...","msgid":1}
```

```json
{"ctrlChannel":"102938","type":"ping"}
```

```json
{"ctrlChannel":"102938","type":"pong"}
```

关闭时：

```json
{"ctrlChannel":"102938","type":"close"}
```

如果启用了 WebRTC，还可能有：

```json
{"type":"offer","sdp":"..."}
```

```json
{"ctrlChannel":"102938","type":"answer","sdp":"..."}
```

以及：

```json
{"ctrlChannel":"102938","type":"webrtc0"}
{"ctrlChannel":"102938","type":"webrtc1"}
{"ctrlChannel":"102938","type":"webrtc2"}
```

切换完成后，KVM 二进制可能不再通过 `meshrelay.ashx` WebSocket，而是通过 RTCDataChannel 传输。

## 最终结论

普通模式下可以概括为：

```text
Relay：
    负责配对和转发

Agent：
    负责产生屏幕图像、处理键鼠输入和同意逻辑

Browser：
    负责发送 KVM 控制命令、解码图像和显示桌面
```

如果服务器启用了 `desktopmultiplex`，则 `p=2` 可能改走 `meshdesktopmultiplex.js`，服务端会对多个桌面会话进行图像缓存、输入过滤和参数合并，此时不应再把服务器简单理解为完全透明的 1:1 Relay。
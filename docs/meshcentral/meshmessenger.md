# MeshCentral 用户间实时聊天（MeshMessenger）技术架构与协议全景文档

本文档深入解析 MeshCentral 中基于 `/meshrelay.ashx?id=meshmessenger/...` 实现的 **用户间（User-to-User）实时聊天** 全流程，涵盖 URL 设计与鉴权、通信管道演进、详细交互时序、协议字段定义及完整事件清单。

---

## 1. URL 解析与会话角色

典型的聊天中继请求路径如下：
```http
/meshrelay.ashx?id=meshmessenger/user%2F%2Ftest/user%2F%2Fadmin
```

### 1.1 结构解构
对 URL 解码后，参数格式为：`meshmessenger/{user1_id}/{user2_id}`
* **端点 `/meshrelay.ashx`**：MeshCentral 的全双工中继（Relay）网关，负责承载终端远程桌面、控制台以及 MeshMessenger 等会话。
* **协议标识 `meshmessenger/`**：告知中继模块该通道属于聊天系统。服务端在 `meshrelay.js` 中捕获此特征，并将协议号固定为 `p = 200`（MeshMessenger 协议代号）。
* **用户 ID 格式**：MeshCentral 内部用户唯一标识为 `user/{domain}/{username}`：
  * `user//test`：默认域名（Domain 为空）下的用户 `test`。
  * `user//admin`：默认域名下的用户 `admin`。

### 1.2 鉴权与安全校验
`webserver.js` 和 `meshrelay.js` 对该 URL 执行严格的边界鉴权：
1. **登录态校验**：用户必须持有有效的 Session Cookie。未登录用户直接被重定向至登录页（附带 `?meshmessengerid=...` 用于登录后跳转）。
2. **身份闭环验证**：当前连接的发起者 ID 必须严格匹配 `{user1_id}` 或 `{user2_id}` 之一，非法用户访问直接响应 `404 Not Found` 或强制断开。
3. **协议隔离保护**：双方未连通前，TCP 读取暂停，并开启 15 秒配对超时。两端均认证通过后，数据管道才正式连通。

---

## 2. 通信机制与传输流程

MeshMessenger 采用 **“WebSocket 服务器中继握手 + 可选 WebRTC P2P 直连降级/升级”** 的双层混合传输架构：

```
[客户端 A]                               [MeshCentral 服务端]                              [客户端 B]
    |                                            |                                           |
    |===== 1. WebSocket 中继建立 (Relay Mode) =====|===== 1. WebSocket 中继建立 (Relay Mode) =====|
    |     • 发送信标、互换头像                      |     • 发送信标、互换头像                      |
    |     • 交换 WebRTC 随机数与 SDP/ICE 候选      |     • 交换 WebRTC 随机数与 SDP/ICE 候选      |
    |                                            |                                           |
    + - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -+
    : [场景分支 A: WebRTC 协商成功 & 未开启会话录制]                                              :
    :                                                                                        :
    : 2. 三次握手 (rtcSwitch 0 -> 1 -> 2) 迁移到 WebRTC                                        :
    : 3. 双方建立 WebRTC DataChannel (P2P 直连) ==========================================> :
    :    • 文本聊天、打字状态、文件传输不经过服务端，0 服务器带宽占用                                :
    + - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -+
    : [场景分支 B: NAT 打洞失败 / 防火墙阻断 / 服务端强制开启 sessionrecording]                   :
    :                                                                                        :
    : 2. 保持 WebSocket 中继转发 (Relay 回退)                                                  :
    :    • 客户端通过 socket.send 发送 JSON                                                  :
    :    • 服务端中继并按需将文本写入 relaysession-*.txt 文件以供审计合规                          :
    + - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -+
```

1. **服务端中继（WebSocket Relay）**：
   * 所有连接的起点。服务端负责对等体（Peer）配对、在线态感知、离线 WebPush 推送及会话录制。
2. **P2P 数据直连（WebRTC DataChannel）**：
   * 一旦双方通过 WebSocket 交换 SDP 和 ICE 候选成功，且服务端未强制录制会话，系统无缝切入 WebRTC 直连，减轻服务器负载。
3. **录制模式回退（Audit Recording）**：
   * 若域配置启用了 Messenger 录制（`domain.sessionrecording` 包含协议 `200`），服务端下发 `'cr'` 指标，禁止两端启用 WebRTC 直连，强行保持中继传输并将聊天记录流式落盘保存。

---

## 3. 完整时序流向图

```text
  [客户端 A: admin]             [MeshCentral 服务端]             [客户端 B: test]
         |                                |                               |
======== 阶段 1：会话邀请与页面拉起 ================================================
         | 1. { action: 'meshmessenger',  |                               |
         |      userid: 'user//test' }    |                               |
         +------------------------------->|                               |
         |                                | 2. 检查权限并推送系统通知     |
         |                                |    { action: 'msg', ... }     |
         |                                +------------------------------>|
         | 3. 打开 /messenger 弹窗        | 4. 点击弹窗打开 /messenger 弹窗 |
         |                                |                               |
======== 阶段 2：WebSocket 中继配对与信标下发 ======================================
         | 5. WS 连接 /meshrelay.ashx     |                               |
         |    (TCP 挂起，等待配对)        |                               |
         +------------------------------->|                               |
         |                                | 6. WS 连接 /meshrelay.ashx    |
         |                                |<------------------------------+
         |                                | (配对成功，解除挂起)          |
         | 7. 下发单字符 'c' (或 'cr')    | 7. 下发单字符 'c' (或 'cr')    |
         |<-------------------------------+------------------------------>|
         | 8. 推送对方头像 (若有)         | 8. 推送对方头像 (若有)         |
         |    { ctrlChannel: '102938' }   |    { ctrlChannel: '102938' }   |
         |<-------------------------------+------------------------------>|
         |                                |                               |
======== 阶段 3：WebRTC P2P 协商与无缝迁移 =========================================
         | 9. 交换随机数: { action: 'random', random: 0.82 }              |
         |<========================= 随机数互换 ===========================>|
         |                                |                               |
         | (假设 admin 随机数较大，担任 WebRTC Offer 发起端)              |
         | 10. { action: 'webRtcSdp', sdp: offer, id: 0 }                 |
         +--------------------------------------------------------------->|
         | 11. { action: 'webRtcSdp', sdp: answer, id: 0 }                |
         |<---------------------------------------------------------------+
         | 12. 交换 ICE: { action: 'webRtcIce', ice: candidate, id: 0 }   |
         |<======================= 互换候选地址 ==========================>|
         |                                |                               |
         | (DataChannel.onopen 触发，执行 rtcSwitch 迁移协议)             |
         | 13. { action: 'rtcSwitch', v: 0 }                              |
         +--------------------------------------------------------------->|
         | 14. { action: 'rtcSwitch', v: 1 }                              |
         |<---------------------------------------------------------------+
         | 15. { action: 'rtcSwitch', v: 2 }                              |
         +--------------------------------------------------------------->|
         |                                |                               |
======== 阶段 4：实时聊天与状态交互 (优先 WebRTC，失败走 WS) =======================
         | 16. 键入中: { action: 'outtext', value: true }                 |
         +--------------------------------------------------------------->| (展示打字动图)
         | 17. 发送消息: { action: 'chat', msg: 'Hello' }                 |
         +--------------------------------------------------------------->| (展示文本气泡)
         | 18. 清空输入: { action: 'outtext', value: false }                |
         +--------------------------------------------------------------->| (隐藏打字动图)
```

---

## 4. 具体流程与消息协议详解

### 阶段 1：会话邀请与通知
1. **客户端 A 发起邀请**：
   通过已有的主控制 WebSocket 连接（`meshuser.js`）发送请求：
   ```json
   {
     "action": "meshmessenger",
     "userid": "user//test"
   }
   ```
2. **服务端向客户端 B 推送通知**：
   * **在线场景**：若用户 `test` 在线，服务端直接向其所有关联 Session 推送即时弹窗：
     ```json
     {
       "action": "msg",
       "type": "notify",
       "id": 0.81726,
       "title": "admin",
       "username": "admin",
       "userid": "user//admin",
       "value": "Chat Request, Click here to accept.",
       "tag": "meshmessenger/user%2F%2Ftest/user%2F%2Fadmin",
       "msgid": 11
     }
     ```
   * **离线场景**：若无活跃长连接但配置了 Web Push，服务端调用 `performWebPush` 唤醒浏览器 ServiceWorker。
3. **拉起会话窗口**：
   客户端点击弹窗后，通过原生窗口打开页面：
   `/messenger?id=meshmessenger/user%2F%2Ftest/user%2F%2Fadmin&title=admin`

---

### 阶段 2：WebSocket 中继配对与信标下发
页面加载完成后，客户端自动向 `/meshrelay.ashx?id=...` 建立 WebSocket：
1. **服务端中继状态流转**：
   * 首个用户进入时，将其存入 `wsrelays[id]`，将 TCP 读流挂起（`ws._socket.pause()`），等待对端连入。
   * 对端用户进入后，服务端校验双方凭据，确认匹配后恢复数据流（`ws._socket.resume()`）。
2. **服务端广播连接标志**：
   * 发送 `'c'`：连接建立，未开启录制（允许升级 WebRTC）。
   * 发送 `'cr'`：连接建立且开启审计录制。服务端在后台打开 `.txt` 录制文件，并强行阻断客户端向 WebRTC 切换。
3. **头像分发**：
   若数据库中存在用户头像，服务端下发控制帧：
   ```json
   {
     "ctrlChannel": "102938",
     "type": "image",
     "image": "data:image/png;base64,iVBORw0KGgo..."
   }
   ```

---

### 阶段 3：WebRTC P2P 协商与通道切换（`rtcSwitch`）
两端收到 `'c'` 标志后，进入 P2P 协商：
1. **角色裁决（Random 协商）**：
   双方同时发送随机数：
   ```json
   { "action": "random", "random": 0.74129 }
   ```
   **规则**：数值较大的一方充当 WebRTC 发起端（Caller），负责调用 `createOffer` 并建立 `DataChannel`。
2. **信令透明中继**：
   两端通过已建立的 WebSocket 交换 SDP 与 ICE Candidate：
   * Offer/Answer: `{"action": "webRtcSdp", "sdp": {...}, "id": 0}`
   * ICE Candidate: `{"action": "webRtcIce", "ice": {...}, "id": 0}`
3. **无缝迁移协议（`rtcSwitch` 状态机）**：
   为避免通道切换期间丢失正在发送的消息，MeshCentral 实现了三阶段平滑切换：
   * **Step 0（发起方）**：DataChannel 开启后，发送 `{"action": "rtcSwitch", "v": 0}`。
   * **Step 1（接收方）**：回复 `{"action": "rtcSwitch", "v": 1}`，通知发送方停止在 WebSocket 发送业务数据，将后续数据写入发送缓冲数组 `webchannel.xoutBuffer`。
   * **Step 2（发起方）**：发送 `{"action": "rtcSwitch", "v": 2}`，确认收到终止标记，将缓冲队列的数据通过 WebRTC DataChannel 一并发出，此后全量业务切换为 WebRTC 传输。

---

### 阶段 4：实时聊天与状态交互
通道正式建立后，所有业务数据遵循以下规范：

1. **输入状态指示（Typing Indicator）**：
   * 正在输入：
     ```json
     { "action": "outtext", "value": true }
     ```
   * 停止输入或清空：
     ```json
     { "action": "outtext", "value": false }
     ```
2. **文本消息**：
   ```json
   {
     "action": "chat",
     "msg": "你好，这是一条测试消息。"
   }
   ```
   * 接收端将消息转义渲染为对话气泡。
   * 当页面不可见（`document.visibilityState === 'hidden'`）时，触发 HTML5 桌面通知。

---

## 5. 聊天涉及的完整事件清单

### 5.1 业务交互事件
| 事件 action / 标识 | 承载通道 | 方向 | 载荷字段 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `chat` | WebRTC / WS | 双向 | `msg`: 消息文本内容 | **发送/接收聊天文本**。 |
| `outtext` | WebRTC / WS | 双向 | `value`: `true` \| `false` | **打字状态指示**。控制对端三点动图（`typingIndicator`）的显示与隐藏。 |
| `ctrl` | WS | 服务端 $\to$ 客户端 | `value`: 1(成功) \| 2(失败), `msg`: 文本 | **通知发送回执**（如移动推送结果通知）。 |

### 5.2 WebRTC 控制与多媒体事件
| 事件 action / 标识 | 承载通道 | 方向 | 载荷字段 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `random` | WS | 双向 | `random`: 0~1 浮点数 | **主从仲裁**。较大方启动 WebRTC 并建数据通道。 |
| `webRtcSdp` | WS | 双向 | `sdp`: RTCSessionDescription, `id`: 通道编号 | **SDP 交换**。`id=0` 表示数据通道，`id=1/2` 表示音视频通道。 |
| `webRtcIce` | WS | 双向 | `ice`: RTCIceCandidate, `id`: 通道编号 | **ICE 候选地址交换**。 |
| `rtcSwitch` | WS | 双向 | `v`: 0 \| 1 \| 2 | **通道平滑迁移握手**。 |
| `videoStop` | WebRTC / WS | 双向 | `id`: 通道编号 | **挂断音视频通话**。停止摄像头或麦克风 Stream。 |

### 5.3 文件分块传输事件
MeshMessenger 内置基于 Stop-and-Wait 滑动窗口的文件切片传输协议（单文件上限 100MB，块大小通常为 4KB~64KB）：
| 事件 action / 标识 | 承载通道 | 方向 | 载荷字段 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `file` | WebRTC / WS | 发送端 $\to$ 接收端 | `id`, `name`, `size`, `type` | **文件元数据宣告**。接收端初始化文件卡片。 |
| `fileUploadStart` | WebRTC / WS | 发送端 $\to$ 接收端 | `id`, `name`, `size`, `type` | **开始切片传输**。 |
| `fileData` | WebRTC / WS | 发送端 $\to$ 接收端 | `id`, `data`: Base64/二进制切片 | **传输具体文件数据块**。 |
| `fileUploadAck` | WebRTC / WS | 接收端 $\to$ 发送端 | `id` | **分块应答确认（ACK）**。发送端收到后驱动下一块发送。 |
| `fileUploadEnd` | WebRTC / WS | 发送端 $\to$ 接收端 | `id`, `size`, `name` | **文件传输完成标记**。接收端组装 Blob 并触发下载。 |
| `fileUploadCancel`| WebRTC / WS | 双向 | `id` | **取消或中断文件传输**。 |

### 5.4 底层信标与控制帧
| 事件 action / 标识 | 承载通道 | 方向 | 载荷字段 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `'c'` | WS | 服务端 $\to$ 客户端 | 单字符文本 | **中继就绪信标**（未录制，允许 WebRTC）。 |
| `'cr'` | WS | 服务端 $\to$ 客户端 | 双字符文本 | **录制中继信标**（已开启会话审计，强制走中继）。 |
| `ctrlChannel: '102938'` | WebRTC / WS | 双向 | `type`: `'image'` \| `'ping'` \| `'pong'` | **系统保留控制信道**：分发头像图片或执行保活探测。 |

### 5.5 服务端系统审计事件
服务端在连接建立时，通过内部总线派发以下审计日志：
* **`etype: 'relay', action: 'relaylog'`**：会话日志事件，`msgid: 162`（*Started messenger session*），记录会话双方的 IP 地址、用户 ID 及协议号（`protocol: 200`）。
* **`etype: 'user', action: 'accountchange'`**：刷新用户的 `last access time` 并向所有管理员客户端广播更新。
# 07 - 通知交付位掩码与数值 16 语义歧义审计 (Notification Bitmasks)

在 MeshCentral 体系中，多个完全不同的配置结构都使用了整型位掩码（Bitmask），**绝不能因为某些字段具有相同的数值就进行概念合并**。

---

## 一、通知位掩码系统全景

### 1. 客户端本地通知配置掩码 (Client LocalStorage `notifications`)
- **存储位置**：浏览器本地存储 `localStorage.getItem('notifications')`（`views/default.handlebars:14568`）。
- **作用域**：当前客户端浏览器环境的表现层行为控制。
- **位定义**：

| 十进制值 | 十六进制值 | 配置项标识 | 语义 | 默认状态 |
| :---: | :---: | :--- | :--- | :---: |
| **1** | `0x0001` | `p2notifyPlayNotifySound` | **播放提示音效**（触发 HTML5 `<audio id="chimes">`） | 关 (0) |
| **2** | `0x0002` | `p2notifyIntelDeviceConnect` | **允许弹出设备上线提示** | 关 (0) |
| **4** | `0x0004` | `p2notifyIntelDeviceDisconnect` | **允许弹出设备离线提示** | 关 (0) |
| **8** | `0x0008` | `p2notifyIntelAmtKvmActions` | **允许弹出 Intel AMT 远程桌面与串口会话事件** | 关 (0) |
| **16** | `0x0010` | `p2notifyGroupName` | **操作系统桌面通知标题中包含设备组名称** | 关 (0) |

---

### 2. 服务端用户通知规则掩码 (`user.links[meshid].notify` / `user.notify[id]`)
- **存储位置**：服务端用户数据库记录对象内：
  - 设备组级：`user.links[meshid].notify`（`meshuser.js:1856`）；
  - 单设备/组级用户覆盖：`user.notify[nodeid]` 或 `user.notify[meshid]`（`meshuser.js:1908`）。
- **作用域**：决定服务端在设备产生上下线或求助事件时，通过何种传输介质向用户投递提醒。
- **继承与覆盖规则**：
  `有效通知掩码 = user.notify[nodeid] || user.notify[meshid] || user.links[meshid].notify || 0`
  单设备覆盖优先于设备组规则。
- **位定义**（源码证据：`meshuser.js:1827-1835`）：

| 十进制值 | 十六进制值 | 配置标识 | 交付介质 | 触发事件场景 |
| :---: | :---: | :--- | :--- | :--- |
| **2** | `0x0002` | WebPageConnect | **网页端 / Web 通道** | 设备连接上线时推流 |
| **4** | `0x0004` | WebPageDisconnect | **网页端 / Web 通道** | 设备连接断开时推流 |
| **8** | `0x0008` | WebPageKvm | **网页端 / Web 通道** | 设备产生桌面/串口远程交互时推流 |
| **16** | `0x0010` | EmailConnect | **电子邮件网关 (Email)** | 设备连线时发送邮件 |
| **32** | `0x0020` | EmailDisconnect | **电子邮件网关 (Email)** | 设备断开时发送邮件 |
| **64** | `0x0040` | EmailHelp | **电子邮件网关 (Email)** | 设备端发起求助请求时发送邮件 |
| **128** | `0x0080` | MsgConnect | **外部消息网关 (SMS/Telegram/Discord)** | 设备连线时发送即时消息 |
| **256** | `0x0100` | MsgDisconnect | **外部消息网关 (SMS/Telegram/Discord)** | 设备断开时发送即时消息 |
| **512** | `0x0200` | MsgHelp | **外部消息网关 (SMS/Telegram/Discord)** | 设备发起求助时发送即时消息 |

---

## 二、数值 16 (0x10) 在不同上下文中的多义性深度审计

在 MeshCentral 协议与源码中，**数值 16 (`0x10`) 出现在至少 7 个完全独立的业务上下文中，各自代表截然不同的含义**。协议实现端切勿混淆：

```text
               ┌── [1] Client LocalStorage: 桌面通知携带设备组名 (p2notifyGroupName)
               ├── [2] Server User Notification: 邮件发送设备连线通知 (EmailConnect)
               ├── [3] User Consent Flags: 终端连接前强制提示本地用户 (TerminalPromptUser)
数值 16 (0x10) ├── [4] Mesh Rights: 查看和操作 Agent 控制台的权限 (MESHRIGHT_AGENTCONSOLE)
               ├── [5] Site Admin Rights: 执行服务器核心热更新的权限 (SITERIGHT_SERVERUPDATE)
               ├── [6] Node Connectivity: 设备通过 MQTT 协议通道保持在线 (node.conn & 16)
               └── [7] Device Power State: 电源管理专用状态标记位
```

1. **客户端通知展现层**（`getstore('notifications') & 16`）：
   - 含义：在调用浏览器或操作系统原生桌面通知时，标题格式拼接设备组名（`MeshCentral - [Group] - [Device]`）。
2. **服务端告警投递层**（`user.notify & 16`）：
   - 含义：设备上线触发邮件发送（`Email device connections`）。
3. **用户知情同意权限**（`USERCONSENT_TerminalPromptUser = 16`）：
   - 含义：远程终端连接前必须在被控机屏幕上弹出确认提示框。
4. **设备组管理授权**（`MESHRIGHT_AGENTCONSOLE = 16`）：
   - 含义：允许管理端用户打开该设备组内主机的 Agent 交互控制台并下发命令。
5. **站点超级权限**（`SITERIGHT_SERVERUPDATE = 16`）：
   - 含义：允许在“我的服务器”页面执行 MeshCentral 服务端版本升级操作。
6. **网络连接状态**（`node.conn & 16`）：
   - 含义：指示当前设备节点通过 MQTT 协议通道处于在线状态。

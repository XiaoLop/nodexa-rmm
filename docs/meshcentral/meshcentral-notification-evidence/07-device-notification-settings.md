# 07 - 设备状态事件与通知订阅掩码协议分析 (`Device Notification Settings`)

## 一、三层订阅存储架构与继承规则

MeshCentral 的设备通知配置由**浏览器本地配置**与**服务端持久化配置**协同构成：

```mermaid
graph TD
    A[账户本地界面配置<br>localStorage.notifications] -->|按位或 累加| D[最终有效掩码 n]
    B[设备组配置<br>user.links[meshid].notify<br>或 user.notify[meshid]] -->|按位或 累加| D
    C[设备级独立配置<br>user.notify[nodeid]] -->|按位或 累加| D
    D --> E{客户端本地过滤}
    E -->|n & 2| F[上线通知: Agent / AMT / CIRA / MQTT]
    E -->|n & 4| G[下线通知: Agent / AMT / CIRA / MQTT]
```

### 1. 存储位置对照表

| 级别 | 存储介质 | 存储键路径 | 读写接口 | 覆盖/继承机制 |
| --- | --- | --- | --- | --- |
| **账户级（本地界面行为）** | 浏览器 `localStorage` | `localStorage["notifications"]` | `getstore('notifications', 0)` / `putstore(...)` | 全局基础配置 |
| **设备组级** | 服务端数据库 `user` 文档 | `user.links[meshid].notify`<br>或 `user.notify[meshid]` | WS 指令：`changemeshnotify` | 累加（通过 `\|=` 按位或合并） |
| **设备级** | 服务端数据库 `user` 文档 | `user.notify[nodeid]` | WS 指令：`changeusernotify` | 累加（通过 `\|=` 按位或合并） |

### 2. 合并求值算法源码证据（`views/default.handlebars:3860`）

```javascript
// 1. 获取账户级本地通知掩码
var n = getstore('notifications', 0);

// 2. 合并设备组通知掩码
if (message.event.meshid && userinfo.links && userinfo.links[message.event.meshid] && userinfo.links[message.event.meshid].notify) {
    n |= userinfo.links[message.event.meshid].notify;
}

// 3. 合并用户跨组/独立设备通知掩码
if (userinfo.notify != null) {
    if (userinfo.notify[message.event.meshid] != null) { n |= userinfo.notify[message.event.meshid]; }
    if (userinfo.notify[message.event.nodeid] != null) { n |= userinfo.notify[message.event.nodeid]; }
}
```

---

## 二、Bitmask 含义与 Bit 16 关键语义分歧

在分析 MeshCentral 掩码时，**必须严格区分“账户本地设置”与“设备/设备组设置”中 Bit 16 的截然不同语义**：

| Bit 权重 | 二进制值 | 【账户本地设置】含义 (`localStorage`) | 【设备/设备组设置】含义 (`user.notify`) | 备注 |
| --- | --- | --- | --- | --- |
| **Bit 0** | `1` | **播放提示音** (`Q('chimes').play()`) | *(未分配)* | 仅在浏览器本地生效 |
| **Bit 1** | `2` | **设备上线（Web 通知）** | **设备上线（Web 通知）** | 两端语义完全一致 |
| **Bit 2** | `4` | **设备下线（Web 通知）** | **设备下线（Web 通知）** | 两端语义完全一致 |
| **Bit 3** | `8` | **Intel AMT 桌面/串口事件** | **Intel AMT 桌面/串口事件** | 两端语义完全一致 |
| **Bit 4** | `16` | **★ 显示设备组名称**<br>`Display device group name` | **★ 邮件通知：设备上线**<br>`Email device connections` | **极其重要的语义差异！** |
| **Bit 5** | `32` | *(未分配)* | **邮件通知：设备下线**<br>`Email device disconnections` | 服务端过滤 |
| **Bit 6** | `64` | *(未分配)* | **邮件通知：终端求助**<br>`Email device help request` | 服务端过滤 |
| **Bit 7** | `128` | *(未分配)* | **即时消息通知：设备上线**<br>`Messaging device connections` | 经短信/第三方机器人推送 |
| **Bit 8** | `256` | *(未分配)* | **即时消息通知：设备下线**<br>`Messaging device disconnections` | 经短信/第三方机器人推送 |
| **Bit 9** | `512` | *(未分配)* | **即时消息通知：终端求助**<br>`Messaging device help request` | 经短信/第三方机器人推送 |

### 证据溯源：

1. **账户本地设置 Bit 16**（`views/default.handlebars:14563`）：
   `x += '<div><label><input id=p2notifyGroupName type=checkbox />Display device group name</label></div>';`
   `Q('p2notifyGroupName').checked = (n & 16);`
   若勾选，桌面通知标题格式变为：`[站点标题] - [设备组名] - [设备名]`。
2. **设备/组设置 Bit 16**（`meshuser.js:1830` 与 `meshcentral.js:2630`）：
   `// 16 = Email device connections`
   `if ((notify & 16) != 0) { mailserver.notifyDeviceConnect(...); }`

---

## 三、服务端过滤 vs 浏览器本地过滤

### 1. Web 页面通知（`nodeconnect`）—— **全量广播，浏览器本地过滤**

- **机制**：
  当设备连接状态变化时，服务端**无差别地向所有对该设备拥有权限的客户端广播 `nodeconnect` 事件**，服务端不在下推时依据用户的 `notify` 字段做剔除。
- **客户端行为**：
  客户端接收到原始事件后，在本地计算出最终 `n`：
  - 若 `n & 2` 为真，且当前事件指示连接建立，执行 `addNotification(abc)`；
  - 若 `n & 4` 为真，且当前事件指示连接断开，执行 `addNotification(abc)`。
- **连接通道细分**：
  - `message.event.conn & 1`：MeshAgent 终端连接
  - `message.event.conn & 2`：Intel AMT CIRA 连接
  - `message.event.conn & 4`：Intel AMT 本地直连
  - `message.event.conn & 16`：MQTT 物联网终端连接

### 2. 邮件与即时消息通知 —— **服务端强制过滤**

- **机制**：
  服务端在 `meshcentral.js:2587`（`NotifyUserOfDeviceStateChange`）与 `meshcentral.js:2669`（`NotifyUserOfDeviceHelpRequest`）中，遍历具备权限的用户集合，直接对 `notify` 掩码进行位与校验：
  - 邮件：检查用户邮箱已验证 (`user.emailVerified == true`) 且 `(notify & 48) != 0`；
  - 短信/即时消息：检查已绑定句柄 (`user.msghandle != null`) 且 `(notify & 384) != 0`；
  - 仅对匹配成功的用户异步分派后台发信任务。

---

## 四、声音提示与 HTML5 桌面通知触发条件

在客户端最终判定需要执行 `addNotification(n)` 后：

1. **声音播放（Chimes Sound）**：
   - 依赖本地配置：`getstore('notifications', 0) & 1`；
   - 若命中，调用 `Q('chimes').play()` 播放自带钟声音频。
2. **HTML5 桌面通知（Desktop Notification）**：
   - 依赖浏览器 API 支持且已授权：`window.Notification && Notification.permission == 'granted'`；
   - 标题拼接策略：
     - 若 `notifySettings & 16`：`decodeURIComponent(extitle) + ' - ' + meshes[node.meshid].name + ' - ' + node.name`；
     - 若未勾选：`decodeURIComponent(extitle) + ' - ' + node.name`。
   - 图标路径策略：`/images/notify/icons128-` + `node.icon` + `.png`。

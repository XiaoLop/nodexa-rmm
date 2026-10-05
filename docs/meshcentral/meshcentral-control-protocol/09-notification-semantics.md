# 09 - 通知体系专题与特有语义 (Notification Semantics)

MeshCentral 的通知系统包含了显式通知、终端用户求助、即时聊天邀请、服务器健康警告以及会话录制审计等多种异构通知形态。

---

## 一、显式通知对比：`msg:notify` 与 `event:notify`

| 判定维度 | `action: "msg", type: "notify"` | `action: "event", event.action: "notify"` |
| :--- | :--- | :--- |
| **主要投递来源** | 服务端直接下发（如登录安全警告、密码过期提醒、求助即时提醒）或 Agent 转发 | 服务端通过 `DispatchEvent` 事件总线异步广播给订阅者的系统级通知 |
| **消息外层结构** | `{ action: "msg", type: "notify", ... }` | `{ action: "event", event: { action: "notify", ... } }` |
| **模板支持** | 完整支持 `titleid`, `msgid`, `args` 动态模板化替换 | 通常直接携带成文 `title`, `value`，附带可选 `icon` 与 `maxtime` |
| **是否播放提示音** | 由客户端 `getstore('notifications') & 1` 统一决定 | 同左 |
| **是否触发 OS 原生桌面通知** | 是，通过 HTML5 Notification API 触发 | 是 |
| **点击交互行为** | 携带 `tag` 时可路由至特定业务视图（如 `meshmessenger/...` 打开聊天） | 依据包含的 `nodeid` 跳转对应设备节点 |
| **驻留与清除** | 若指定 `maxtime`（秒），客户端倒计时自动清除；未指定则常驻通知抽屉 | 同左 |

---

## 二、终端用户求助机制深度逆向 (Help Request & `msgid: 98`)

MeshCentral 内置了桌面用户的“呼叫运维协助”功能，全链路时序与数据流向如下：

### 1. 发起与中继
1. 终端用户在被控机桌面 MeshAgent 托盘菜单点击“求助 (Help)”并输入用户名与说明；
2. MeshAgent 发送 JSON 报文至服务端：
   ```json
   {
     "action": "log",
     "msg": "Help Requested, user: alice, details: Network issue",
     "msgid": 98,
     "msgArgs": ["alice", "Network issue"]
   }
   ```
3. 服务端 `meshagent.js:1353` 捕获后包装为审计事件并广播：
   `targets = parent.CreateMeshDispatchTargets(obj.dbMeshKey, [obj.dbNodeKey])`；
4. 同时触发服务端邮件通知检查（`NotifyUserOfDeviceHelpRequest`，依据通知位 64）。

### 2. 管理员接收与展现
所有对该设备拥有查看权限（`GetNodeRights(nodeid) > 0`）的在线管理员收到事件：
```json
{
  "action": "event",
  "event": {
    "etype": "node",
    "action": "agentlog",
    "nodeid": "node//target_machine_id",
    "domain": "",
    "msgid": 98,
    "msgArgs": ["alice", "Network issue"],
    "msg": "Help Requested, user: alice, details: Network issue"
  }
}
```
- 原生前端（`views/default.handlebars:3441`）拦截该事件并生成高亮求助通知：
  `"Help requested from alice: Network issue"`。
- 点击该通知直接选中目标设备节点，管理员可一键发起远程桌面连接以接管。

### 3. 多管理员协同状态一致性
- 求助本身是一个瞬态事件（Event），MeshCentral 目前在核心服务端**不维护求助的生命周期状态机**（即不跟踪已接单、处理中、已解决等状态）。
- 多名管理员会同时收到该气泡提醒，谁先发起远程桌面谁接管。

---

## 三、即时聊天与会话邀请 (Chat / Messenger)

1. **发起方式**：
   - 用户间聊天：向服务端发送 `{ action: 'meshmessenger', userid: 'user//...' }`；
   - 用户与设备聊天：向服务端发送 `{ action: 'meshmessenger', nodeid: 'node//...' }`（需要 `MESHRIGHT_CHATNOTIFY = 16384` 权限）。
2. **报文投递**：
   - 服务端直接向被邀请用户 WebSocket 发送：
     ```json
     {
       "action": "msg",
       "type": "notify",
       "id": 0.38491823,
       "title": "发起人姓名",
       "value": "Chat Request, Click here to accept.",
       "tag": "meshmessenger/<my_userid>/<target_userid>",
       "msgid": 11
     }
     ```
3. **传输协议通道**：
   - 聊天文字传输**不通过 `/control.ashx` 主通道进行**！
   - 点击聊天通知后，双方浏览器或被控端会弹出独立聊天窗口，接入 `/messenger` 页面，底层建立专属的 `/meshrelay.ashx?p=200`（协议 200 即 `PROTOCOL_MESSENGER`）数据中继通道。

---

## 四、服务器健康告警机制 (`serverwarnings`)

1. **快照 vs 增量**：
   - `serverwarnings` 是**全量快照（Full Snapshot）**，非增量。
   - 仅在具有 `SITERIGHT_ADMIN` 权限的用户连线时推送一次（`meshuser.js:675`）。
2. **告警标识定义 (`warnings[].id`, 1 ~ 27)**：
   - `warnings` 数组元素包含 `{ id: number, msg: string, args?: array }`。
   - 客户端依据 `id` 查找本地化模板（如 ID 9: "Agent hash checking is being skipped, this is unsafe."；ID 21: "Backup path can't be set within meshcentral-data folder"）。
3. **清除与刷新**：
   - 警告状态由服务端根据实际配置文件与运行态（如 Let's Encrypt 证书有效性、Node 版本兼容性）动态计算。消除警告需要修复配置并重启或重载服务端，不支持客户端在控制通道中直接单项Dismiss。

---

## 五、会话录制完成提醒 (`recording`)

1. **触发时机**：
   - 远程桌面或终端会话结束时，服务端关闭 MCREC 录制文件并完成索引后（`meshrelay.js:845`）触发。
2. **报文结构**：
   ```json
   {
     "action": "event",
     "event": {
       "etype": "relay",
       "action": "recording",
       "domain": "",
       "nodeid": "node//demo_node",
       "meshid": "mesh//demo_group",
       "filename": "recordings/mesh-xxx.mcrec",
       "size": 1048576,
       "protocol": 2,
       "startTime": 1759658000000,
       "lengthTime": 300,
       "userids": ["user//admin"],
       "msg": "Finished recording session, 300 second(s)"
     }
   }
   ```
3. **权限与投递限制**：
   - 仅广播至目标设备、设备组以及订阅了 `'recording'` 频道的审计员会话（要求拥有 `SITERIGHT_RECORDINGS` 权限）。

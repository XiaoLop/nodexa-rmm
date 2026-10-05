# 11 - 待验证问题与已知协议边界缺陷 (Open Questions & Known Limitations)

在对当前版本源码进行深度静态扫描与数据流追踪过程中，发现以下若干处服务端存在的潜在竞态条件或未完成协议特性的待验证项。

---

## 一、已知待验证与潜在缺陷清单

### 1. `getDeviceDetails` 缺乏请求标识与并发碰撞风险
- **代码位置**：`meshuser.js:5266-5616`
- **问题说明**：当客户端请求导出设备全量明细时，服务端生成 CSV 或 JSON 后返回 `{ action: 'getDeviceDetails', data: output, type: type }`，既不回显 `responseid` 也不携带 `tag`。若多个管理页面或自动化任务并发拉取不同过滤范围的设备明细，响应将发生混淆。
- **推荐规避方案**：客户端 SDK 必须对 `getDeviceDetails` 加设互斥排队锁（Mutex），严禁并发调用。

### 2. 终端求助记录中的数据库并发竞态 (Server-side Race Condition)
- **代码位置**：`meshagent.js:1358`
- **源码注释**：`// TODO: THIS IS A BIG RACE CONDITION HERE, WE NEED TO FIX THAT. If this call is made twice at the same time on the same device, data will be missed.`
- **问题说明**：当同一设备短时间内产生重复求助（`msgid: 98`）时，服务端在查询和更新 DB 记录期间存在并发竞争。
- **验证建议**：测试套件应设计针对 `agentlog (msgid: 98)` 的突发连续请求，观察邮件通知与管理端气泡是否能幂等去重。

### 3. 多服务器集群部署下的路由占位 (Multi-Server Routing TODOs)
- **代码位置**：`meshuser.js:2116`, `webserver.js:10327`
- **问题说明**：在即时消息与跨节点控制台中，部分群发分支存在 `// TODO: Add multi-server support` 注释。单节点部署工作正常，但在跨服多活场景下可能存在消息未完全广播至其他节点 session 的边缘情形。

### 4. `serverwarnings` 运行态差量更新机制
- **代码位置**：`meshuser.js:674`
- **问题说明**：目前 `serverwarnings` 仅在管理员首次建立连接的握手阶段作为完整快照推送一次。若在会话存活期间管理员在服务器控制台修复了警告（如配置了 Let's Encrypt 证书），服务端不会主动重新广播 `serverwarnings`，需要刷新浏览器重新建立连接。

### 5. `wakedevices` 成功态无显式 ACK
- **代码位置**：`meshuser.js:2955-3044`
- **问题说明**：`wakedevices` 指令在成功触发 Wake-on-LAN 时，服务端不向发起者返回任何 `{ action: 'wakedevices', result: 'OK' }` 报文，而是仅通过 `turnon` 和 `wakedevices` 事件广播。若设备本身电源状态未能即时改变，客户端难以明确区分是“指令已发送”还是“请求丢失”。

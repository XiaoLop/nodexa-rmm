# 08 - 十五项关键问题终审结论与待验证边界 (`Verification Matrix & Open Questions`)

## 一、十五项核心问题终审结论

| # | 核心关键问题 | 权威结论 | 证据依据与置信度 |
| --- | --- | --- | --- |
| **1** | `event.notify` 和 `msg/notify` 是否都真实存在？ | **是，两者均真实存在且并行运作**。`event.notify` 由 `DispatchEvent` 广播包装；`msg/notify` 由会话控制层或终端命令直接下推。 | `webserver.js:2168`, `meshuser.js:8550`<br>`confirmed` |
| **2** | 两者分别有哪些真实使用场景？ | - `event.notify`：系统后台异步状态通知（邮箱已激活、网盘容量超额等）。<br>- `msg/notify`：操作失败/成功即时反馈（改密/建群/邀请码）、聊天邀请（`msgid: 11`）、历史登录失败告警（`msgid: 12`）、Agent 控制台 `notify` 命令行推送。 | `meshuser.js:682, 1946, 2108`, `webserver.js:5072`<br>`confirmed` |
| **3** | `maxtime` 的单位是什么？ | **秒 (Seconds)**。客户端源码明确使用 `setTimeout(trigger, n.maxtime * 1000)` 设置定时销毁。 | `views/default.handlebars:19688`<br>`confirmed` |
| **4** | `tag` 的替换和去重语义是什么？ | - 在 HTML5 桌面通知中，相同 `tag` 触发**系统级替换覆盖**；<br>- 在 Web 内部列表不阻断去重；<br>- 作为点击路由键（`desktop`, `terminal`, `backupcodes`, `meshmessenger`）。 | `views/default.handlebars:19558, 19667`<br>`confirmed` |
| **5** | `titleid/msgid` 的模板在哪里？ | 位于前端视图模板 `views/default.handlebars` 第 19601~19648 行的 `translatedTitles`（1~6）和 `translatedMessages`（1~34）数组中。 | `views/default.handlebars:19601`<br>`confirmed` |
| **6** | Help Request 的完整生命周期是什么？ | 1. 终端 Assistant 调起 `requesthelp`；<br>2. Agent 派发 `sessions.help` 和 `log`（`msgid: 98`）；<br>3. 服务端向具备权限的管理员广播 `agentlog` 与 `devicesessions`，并根据掩码发送邮件/短信；<br>4. 管理员点击通知打开 General 页，点击 Dismiss 下发 `cancelhelp`；<br>5. Agent 清空求助并上报，服务端广播更新后的 `devicesessions`，各管理员端求助状态同步清除。 | `agents/meshcore.js:584`, `meshagent.js:1356, 1878`, `default.handlebars:3441, 5265`<br>`confirmed` |
| **7** | Chat Request 使用哪些消息？ | 邀请通知使用 `action: "msg"`, `type: "notify"`, `msgid: 11`, `tag: "meshmessenger/..."`。点击后弹出独立 `/messenger` 窗口，在 `/meshrelay.ashx` 隧道中进行实际聊天。 | `meshuser.js:2108`, `default.handlebars:19567`<br>`confirmed` |
| **8** | `serverwarnings` 是快照还是增量？ | **全量快照 (Full Snapshot)**。包含当前时刻服务端全局内存中的告警全集。若无告警则完全不下发。 | `meshuser.js:674`, `meshcentral.js:4068`<br>`confirmed` |
| **9** | `warnings[].id` 的真实类型是什么？ | **`number`（整数）**。对应服务端配置检查的 1~27 号数字索引。 | `meshcentral.js:4272`, `default.handlebars:2627`<br>`confirmed` |
| **10** | 录制完成通知使用什么消息？ | 录制开始无消息；文件关闭并索引就绪后，服务端派发 `action: "event"`, `event.action: "recording"`。 | `meshrelay.js:845`, `webserver.js:5539`, `default.handlebars:3447`<br>`confirmed` |
| **11** | 哪些断开场景禁止自动重连？ | 1. `action: "stopped"`（服务端停止、会话超限、管理员踢出）；<br>2. `action: "close"` 且 `cause` 为 `"noauth"` 或 `"invalidorigin"`；<br>3. 账户被删除或锁定。 | `views/default.handlebars:2356, 4142`, `meshcentral.js:50`<br>`confirmed` |
| **12** | 哪些账户安全变化需要强制退出？ | 1. 账户被标记锁定（`siteadmin & 32`）；<br>2. 账户被管理员删除；<br>3. 当前会话所使用的 `loginToken` 在账户设置中被撤销。 | `meshuser.js:430, 1368, 1562`<br>`confirmed` |
| **13** | 设备通知 bitmask 分别属于哪些配置字段？ | - 账户本地配置：`localStorage["notifications"]`（含声音 1、上线 2、下线 4、AMT 8、显示组名 16）；<br>- 服务端设备/组配置：`user.links[meshid].notify` 与 `user.notify[nodeid]`（含上线 2、下线 4、AMT 8、邮件上线 16、邮件下线 32、邮件求助 64、短信上线 128、短信下线 256、短信求助 512）。 | `meshuser.js:1827`, `meshcentral.js:2619`, `default.handlebars:14569`<br>`confirmed` |
| **14** | 哪些通知由服务端过滤，哪些由浏览器过滤？ | - **浏览器本地过滤**：设备在线/离线（`nodeconnect`）向全权限用户广播，由浏览器依据合并掩码 `n & 2` / `n & 4` 过滤；<br>- **服务端强制过滤**：邮件、短信/即时消息在发信前由服务端严格过滤；用户间消息按域和组关系由服务端过滤。 | `meshcentral.js:2628`, `default.handlebars:3867`<br>`confirmed` |
| **15** | 原生前端在什么条件下播放声音或发送系统桌面通知？ | - **声音**：本地配置 `notifySettings & 1` 为真时调用 `Q('chimes').play()`；<br>- **桌面通知**：浏览器已获用户授权（`Notification.permission == 'granted'`）且触发了 `addNotification(n)`。 | `views/default.handlebars:19657, 19661`<br>`confirmed` |

---

## 二、待验证边界与建议

1. **分布式集群 Multi-Server 广播同步（置信度：`high`）**：
   在 `meshuser.js:2079`、`meshuser.js:2116` 等处存在 `// TODO: Add multi-server support` 注释。在多节点集群环境下，部分跨用户通知若接收方连接在另一节点，当前单机内存路由可能存在丢包风险。构建统一通知系统时，应依赖 Redis 或消息总线进行二次确认。
2. **多端 Dismiss 并发竞争（置信度：`high`）**：
   如果两个管理员同时点击 Dismiss，首个到达的请求通过 `cancelhelp` 关闭终端求助，第二个到达的请求将由于 Agent 端状态已清除而静默忽略，不存在副作用。
3. **`intersession` 跨浏览器标签页同步（置信度：`confirmed`）**：
   用户在单一标签页点击清除通知或通知自然超时，会向服务端派发 `{ action: 'intersession', subaction: 'removeNotify', id }`，服务端精确转发给同用户的其他 WebSocket 会话，实现多端未读数同步清除。

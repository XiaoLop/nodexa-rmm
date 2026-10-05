本次源码调查聚焦于 MeshCentral 服务端主动推送并可能进入**通知中心、系统告警、Toast、桌面通知、声音提示或连接生命周期处理**的核心协议体系。

调查基于 MeshCentral `v1.2.5`（Git Commit: `02eb8f71d2ce48bdbd59e4e4d4844b7edaf0e69d`），对 `meshuser.js`、`meshcentral.js`、`webserver.js`、`meshagent.js`、`meshrelay.js`、`agents/meshcore.js`、`views/default.handlebars` 等核心文件进行了逐行审查与链路闭环追踪。

所有分析报告、数据契约、目录清单及脱敏样本已全部输出至 `meshcentral-notification-evidence/` 目录。

---

## 产出物清单

```text
meshcentral-notification-evidence/
  ├── 00-environment.md                  # 运行环境、置信度评级标准与规范化 TypeScript 通知数据模型
  ├── 01-notification-messages.md        # event.notify 与 msg/notify 显式通知、模板映射与跨会话清除协议
  ├── 02-server-warnings.md              # 27种全局配置警告全量快照、serverinfochange 与证书到期告警分析
  ├── 03-help-and-chat.md                # 终端求助 (msgid: 98 / devicesessions) 与 Messenger 邀请全生命周期
  ├── 04-recording.md                    # 远程桌面/终端会话录制完成事件 (relay.recording) 及就绪通知契机
  ├── 05-security-notifications.md       # 登录失败、2FA 备份码、账户锁定、权限变更与 Token 吊销四级响应
  ├── 06-lifecycle.md                    # stopped/close 指令、断开场景矩阵、自动重连抑制与状态重置原则
  ├── 07-device-notification-settings.md # 账户/设备组/设备三级订阅、位掩码定义与 Bit 16 关键语义分歧
  ├── 08-open-questions.md               # 十五项核心必须确认问题终审结论矩阵与待验证边界
  ├── notification-catalog.json          # 通知及生命周期相关消息机器可读全集规范 Catalog
  └── fixtures/                          # 真实脱敏 WebSocket JSON 样本
      ├── event-notify.json              # 事件包装通知样本 (如邮箱激活)
      ├── msg-notify.json                # 会话直接通知样本 (如登录失败安全警告)
      ├── help-request.json              # 终端求助 agentlog (msgid: 98) 样本
      ├── chat-request.json              # 聊天邀请 notify (msgid: 11) 样本
      ├── serverwarnings.json            # 全局配置警告快照样本
      ├── recording.json                 # 会话录制文件就绪样本
      └── stopped.json                   # 会话超限/服务端停止断开样本
```

---

## 十五项核心问题终审结论摘要

| # | 核心关键问题 | 权威结论与源码证据 | 置信度 |
| :--- | :--- | :--- | :--- |
| **1** | `event.notify` 和 `msg/notify` 是否都真实存在？ | **是，两者均真实存在且并行运作**。<br>• `event.notify` 经由 `DispatchEvent` 广播包装；<br>• `msg/notify` 经由会话控制层或终端命令直接下发。 | `confirmed` |
| **2** | 两者分别用于什么真实场景？ | • `event.notify`：系统后台异步状态通知（如邮箱验证通过、网盘存储超额等）；<br>• `msg/notify`：操作失败/成功即时反馈（改密/建群/邀请码）、聊天邀请（`msgid: 11`）、登录失败次数安全警告（`msgid: 12`）、Agent 控制台 `notify` 命令行推送。 | `confirmed` |
| **3** | `maxtime` 的单位是什么？ | **秒 (Seconds)**。客户端源码明确使用 `setTimeout(trigger, n.maxtime * 1000)` 设置定时销毁。 | `confirmed` |
| **4** | `tag` 的替换和去重语义是什么？ | • **HTML5 桌面通知**：作为 `Notification(..., { tag: n.tag })` 替换键，相同 tag 覆盖系统通知；<br>• **Web 内部列表**：不阻断去重，按时序存留；<br>• **路由键**：用于决定点击跳转目标（`desktop`, `terminal`, `backupcodes`, `meshmessenger`）。 | `confirmed` |
| **5** | `titleid/msgid` 的模板在哪里？ | 位于前端视图模板 `views/default.handlebars` 第 19601~19648 行的 `translatedTitles`（1~6）和 `translatedMessages`（1~34）硬编码数组中。 | `confirmed` |
| **6** | Help Request 的完整生命周期是什么？ | 1. 终端 Assistant 调起 `requesthelp`；<br>2. Agent 派发 `sessions.help` 和 `log`（`msgid: 98`）；<br>3. 服务端向具备权限的管理员广播 `agentlog` 与 `devicesessions`，并根据掩码发送邮件/短信；<br>4. 管理员点击通知打开 General 页，点击 Dismiss 下发 `cancelhelp`；<br>5. Agent 清空求助并上报，服务端广播更新后的 `devicesessions`，各管理员端求助状态同步清除。 | `confirmed` |
| **7** | Chat Request 使用哪些消息？ | 邀请通知使用 `action: "msg"`, `type: "notify"`, `msgid: 11`, `tag: "meshmessenger/..."`。点击后弹出独立 `/messenger` 窗口，在 `/meshrelay.ashx` 隧道中进行实际聊天。 | `confirmed` |
| **8** | `serverwarnings` 是快照还是增量？ | **全量快照 (Full Snapshot)**。包含当前时刻服务端全局内存中的告警全集。若无告警则完全不下发。 | `confirmed` |
| **9** | `warnings[].id` 的真实类型是什么？ | **`number`（整数）**。对应服务端配置检查的 1~27 号数字索引。 | `confirmed` |
| **10** | 录制完成通知使用什么消息？ | 录制开始无外部消息；文件关闭并索引就绪后，服务端派发 `action: "event"`, `event.action: "recording"`。 | `confirmed` |
| **11** | 哪些断开场景禁止自动重连？ | 1. `action: "stopped"`（服务端停止、会话超限、管理员踢出）；<br>2. `action: "close"` 且 `cause` 为 `"noauth"` 或 `"invalidorigin"`；<br>3. 账户被删除或锁定。 | `confirmed` |
| **12** | 哪些账户安全变化需要强制退出？ | 1. 账户被标记锁定（`siteadmin & 32`）；<br>2. 账户被管理员删除；<br>3. 当前会话所使用的 `loginToken` 在账户设置中被撤销。 | `confirmed` |
| **13** | 设备通知 bitmask 分别属于哪些配置字段？ | • 账户本地配置：`localStorage["notifications"]`（含声音 1、上线 2、下线 4、AMT 8、显示组名 16）；<br>• 服务端设备/组配置：`user.links[meshid].notify` 与 `user.notify[nodeid]`（含上线 2、下线 4、AMT 8、邮件上线 16、邮件下线 32、邮件求助 64、短信上线 128、短信下线 256、短信求助 512）。 | `confirmed` |
| **14** | 哪些通知由服务端过滤，哪些由浏览器过滤？ | • **浏览器本地过滤**：设备在线/离线（`nodeconnect`）向全权限用户广播，由浏览器依据合并掩码 `n & 2` / `n & 4` 过滤；<br>• **服务端强制过滤**：邮件、短信/即时消息在发信前由服务端严格过滤；用户间消息按域和组关系由服务端过滤。 | `confirmed` |
| **15** | 原生前端在什么条件下播放声音或发送系统桌面通知？ | • **声音**：本地配置 `notifySettings & 1` 为真时调用 `Q('chimes').play()`；<br>• **桌面通知**：浏览器已获用户授权（`Notification.permission == 'granted'`）且触发了 `addNotification(n)`。 | `confirmed` |

---

## 统一通知模型规范（供 TypeScript 客户端使用）

```typescript
export interface NormalizedNotificationEvidence {
  /** 通知事件来源归类（客户端根据来源消息推断） */
  source:
    | 'event-notify'      // 来自 action: "event", event.action: "notify"
    | 'msg-notify'        // 来自 action: "msg", type: "notify"
    | 'help-request'      // 来自 action: "event", event.action: "agentlog" (msgid: 98) 或 devicesessions
    | 'chat-request'      // 来自 action: "msg", type: "notify" (msgid: 11 / meshmessenger)
    | 'recording'         // 来自 action: "event", event.action: "recording"
    | 'server-warning'    // 来自 action: "serverwarnings"
    | 'security'          // 来自安全相关（密码过期提示/2FA备份提示/登录失败/账户变动）
    | 'device-state';     // 来自 action: "event", event.action: "nodeconnect"

  /** 服务端实例/域标识 */
  domainId?: string;
  serverId?: string;

  /** 消息去重键、系统标签或桌面通知 tag */
  tag?: string;

  /** 国际化本地化 ID (服务端真实字段) */
  titleId?: number;
  messageId?: number;
  args?: unknown[];

  /** 后备纯文本 (服务端真实推送或本地硬编码模板渲染后的字符串) */
  fallbackTitle?: string;
  fallbackMessage?: string;

  /** 关联实体 ID (服务端真实字段) */
  deviceId?: string;       // nodeid, 形如 "node//..."
  groupId?: string;        // meshid, 形如 "mesh//..."
  userId?: string;         // userid, 形如 "user//..."
  sessionId?: string;      // 会话唯一标识

  /** 图标指示符 (0: 默认, 8: 用户图标, 1~n: 设备类型图标) */
  icon?: string | number;

  /** 自动关闭时间（单位：秒，服务端真实字段） */
  maxTime?: number;

  /** 产生时间戳（毫秒 Unix Epoch） */
  occurredAt?: number;

  /** 点击跳转路由或外部 URL (服务端字段或客户端路由策略) */
  targetUrl?: string;
  targetView?: number;     // 如 10: General, 11: Terminal, 12: Desktop, 13: Files

  // -------------------------------------------------------------
  // 以下为【客户端派生字段】，服务端协议中不存在对应的 severity / isRead
  // -------------------------------------------------------------
  clientDerived?: {
    severity: 'info' | 'warning' | 'error' | 'critical';
    isRead: boolean;
    requiresDesktopNotification: boolean;
    requiresAudioChime: boolean;
  };

  /** 服务端原始完整推送 Payload 镜像 */
  raw: unknown;
}
```

详细内容可直接查阅 `meshcentral-notification-evidence/` 下对应的 `.md` 文档与 `.json` 协议规范。

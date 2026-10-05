# MeshCentral 通知系统源码分析报告与协议证据

## 运行与分析环境

| 项目 | 参数 / 取值 |
| --- | --- |
| **MeshCentral 版本** | `1.2.5` |
| **Git Commit** | `02eb8f71d2ce48bdbd59e4e4d4844b7edaf0e69d` |
| **Node.js 运行时** | `v24.9.0` |
| **分析代码路径** | `D:\web\MeshCentral` |
| **核心源码文件** | `meshuser.js`, `meshcentral.js`, `webserver.js`, `meshagent.js`, `meshrelay.js`, `agents/meshcore.js`, `public/scripts/meshcentral.js`, `views/default.handlebars`, `views/default3.handlebars`, `views/messenger.handlebars` |

## 证据置信度评级标准

- `confirmed`: 当前目标版本源码完全匹配，且在实际调用链或客户端消费链得到闭环验证。
- `high`: 当前版本源码定义明确，逻辑完备，尚未进行动态网络抓包验证。
- `medium`: 存在抓包或间接调用片段，但完整链路依赖推断。
- `low`: 来自外部版本比对或历史残留代码，未在当前主干完整走通。

---

## 统一通知模型规范（TypeScript 建议）

针对 MeshCentral 复杂多样的推送协议，通知系统在接入时必须清晰解耦**服务端真实协议字段**与**客户端派生字段**。

```typescript
/**
 * 统一通知证据模型
 */
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

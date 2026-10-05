# 03 - 字段级模式定义与报文样本 (Field Schemas)

本文档定义 MeshCentral 控制通道关键消息的字段类型规范，并提供已脱敏的典型报文样本。

---

## 一、核心消息字段定义表

### 1. `serverinfo` 报文

| 字段路径 | 类型 | 必填性 | 含义 | 单位/格式 | 来源 | 敏感性 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `action` | string | 必填 | 顶层动作标识 | 固定 `"serverinfo"` | 服务端 | 无 | 协议分发主键 |
| `serverinfo.domain` | string | 必填 | 所在域标识 | 空字符串为默认域 | 服务端配置 | 低 | 多租户场景下为域名称 |
| `serverinfo.name` | string | 必填 | 服务器公网主机名 | FQDN | 服务端配置/证书 | 低 | 用于拼接重定向 URL |
| `serverinfo.serverTime` | number | 必填 | 服务端基准时间 | Unix 毫秒时间戳 | `Date.now()` | 无 | 用于客户端校时与偏移计算 |
| `serverinfo.features` | number | 必填 | 站点特性支持位掩码 1 | 32位整型位掩码 | `getDomainUserFeatures` | 低 | 标明终端、桌面、录制等全局特性 |
| `serverinfo.features2` | number | 必填 | 站点特性支持位掩码 2 | 32位整型位掩码 | 同上 | 低 | 标明扩展协议与认证选项 |
| `serverinfo.features3` | number | 必填 | 站点特性支持位掩码 3 | 32位整型位掩码 | 同上 | 低 | 预留与新特性位 |
| `serverinfo.tlshash` | string | 必填 | 服务端 HTTPS 证书 SHA384 指纹 | 96位十六进制大写字符串 | 证书计算 | 高 | 用于 Agent 与客户端防中间人校验 |
| `serverinfo.agentCertHash` | string | 必填 | Agent 根证书 Base64 哈希 | Base64 字符串 | 证书计算 | 高 | 用于 Agent 连接双向校验 |
| `serverinfo.timeout` | number | 可选 | 会话空闲超时时长 | 毫秒 | 域配置 | 无 | 默认 1800000 (30分钟) |
| `serverinfo.logoutonidlesessiontimeout` | boolean | 可选 | 超时是否注销会话 | 布尔值 | 域配置 | 无 | 默认为 `true` |

---

### 2. `userinfo` 报文

| 字段路径 | 类型 | 必填性 | 含义 | 单位/格式 | 来源 | 敏感性 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `action` | string | 必填 | 顶层动作标识 | 固定 `"userinfo"` | 服务端 | 无 | 协议分发主键 |
| `userinfo._id` | string | 必填 | 规范化用户全局主键 | 格式 `user/<domain>/<id>` | 数据库 | 中 | 核心用户唯一标识 |
| `userinfo.name` | string | 必填 | 用户登录账号名 | 纯文本 | 数据库 | 中 | 脱敏处理 |
| `userinfo.siteadmin` | number | 必填 | 站点管理员权限掩码 | 32位无符号整型 | 数据库 | 高 | `0xFFFFFFFF` 为完整 Site Admin |
| `userinfo.email` | string | 可选 | 用户注册邮箱 | 邮箱格式 | 数据库 | 极高 | 必须脱敏 |
| `userinfo.creation` | number | 可选 | 用户注册时间 | **Unix 秒级时间戳** | 数据库 | 低 | 注意为秒，非毫秒 |
| `userinfo.access` | number | 可选 | 上次访问时间 | **Unix 秒级时间戳** | 数据库 | 低 | 注意为秒，非毫秒 |
| `userinfo.links` | object | 可选 | 用户直接拥有的设备组/设备权限 | Map: ID -> `{ rights: number, notify?: number }` | 数据库 | 高 | 包含用户在该组下的通知位掩码 |
| `userinfo.notify` | object | 可选 | 单设备/组级通知覆盖设置 | Map: ID -> notify bitmask | 数据库 | 中 | 优先级高于 links[].notify |

---

### 3. `action: "event"` 报文封装

| 字段路径 | 类型 | 必填性 | 含义 | 单位/格式 | 来源 | 敏感性 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `action` | string | 必填 | 顶层分发动作 | 固定 `"event"` | 服务端 | 无 | 区分普通应答与事件推送 |
| `event.action` | string | 必填 | 具体事件动作名称 | 字符串 | `DispatchEvent` | 无 | 如 `nodeconnect`, `addnode`, `agentlog` |
| `event.etype` | string | 可选 | 业务实体类型 | 枚举: `node`, `mesh`, `user`, `ugrp`, `relay`, `server` | 服务端 | 无 | 辅助客户端分发 |
| `event.time` | number | 可选 | 事件触发时间戳 | **Unix 毫秒时间戳** | 服务端 `Date.now()` | 低 | 适用于时序排列 |
| `event.nodeid` | string | 条件 | 关联的设备节点 ID | 格式 `node/<domain>/<id>` | 服务端/Agent | 中 | 当涉及设备变更时必填 |
| `event.meshid` | string | 条件 | 关联的设备组 ID | 格式 `mesh/<domain>/<id>` | 服务端 | 中 | 组变更或设备归属组时出现 |
| `event.msgid` | number | 可选 | 本地化消息模板 ID | 正整数 (1 ~ 166) | 服务端定义 | 无 | 对应模板定义（详见 05 文档） |
| `event.msgArgs` | array | 可选 | 本地化替换参数数组 | 标量或子数组 | 服务端填充 | 中 | 用于动态填充 `{0}`, `{1}` 占位符 |
| `event.msg` | string | 可选 | 服务端英文默认降级文案 | 字符串 | 服务端生成 | 低 | 前端缺失翻译模板时的 Fallback |
| `event.nolog` | number | 可选 | 是否禁止记录事件日志 | 1 或 undefined | 服务端 | 无 | 为 1 时前端不存入 Events 历史列表 |
| `event.noact` | number | 可选 | 是否禁止更新状态 | 1 或 undefined | 数据库变更流 | 无 | 避免与 ChangeStream 触发的双重刷新冲突 |

---

### 4. `action: "msg", type: "notify"` 报文

| 字段路径 | 类型 | 必填性 | 含义 | 单位/格式 | 来源 | 敏感性 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `action` | string | 必填 | 顶层动作 | 固定 `"msg"` | 服务端/Agent | 无 | 消息封装通道 |
| `type` | string | 必填 | 子类型 | 固定 `"notify"` | 服务端/Agent | 无 | 判定为通知 |
| `value` | string | 必填 | 弹窗展示正文内容 | 纯文本 | 服务端/Agent | 中 | 可含 HTML 代码，需在桌面通知中清洗 |
| `title` | string | 可选 | 通知标题 | 纯文本 | 服务端/Agent | 低 | 缺失时使用默认标题 |
| `titleid` | number | 可选 | 标题本地化模板 ID | 1 ~ 6 | 服务端 | 无 | 优先根据该 ID 本地化标题 |
| `msgid` | number | 可选 | 消息内容本地化模板 ID | 1 ~ 34 | 服务端 | 无 | 优先根据该 ID 本地化正文 |
| `args` | array | 可选 | 本地化动态参数 | 标量数组 | 服务端 | 中 | 配合 `msgid` 使用 |
| `maxtime` | number | 可选 | 弹窗自动销毁倒计时 | **秒 (Seconds)** | 发送方定义 | 无 | 大于 0 时客户端定时自动移除 |
| `tag` | string | 可选 | 业务防重与归类标识 | 字符串 | 发送方 | 低 | 如 `'ServerNotify'`, `'meshmessenger/...'` |

---

## 二、代表性脱敏 JSON 报文样本

### 1. 成功建立连接与初始化推送
```json
{
  "action": "serverinfo",
  "serverinfo": {
    "domain": "",
    "name": "mesh.example.com",
    "mpsname": "mesh.example.com",
    "mpsport": 4433,
    "port": 443,
    "emailcheck": false,
    "domainauth": false,
    "serverTime": 1759658400000,
    "features": 32801,
    "features2": 1024,
    "features3": 0,
    "languages": ["en"],
    "tlshash": "B4F0E8D7C6B5A4938271605F4E3D2C1B0A9F8E7D6C5B4A39281706152433445566778899AABBCCDDEEFF001122334455",
    "agentCertHash": "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
    "magenturl": "mc://mesh.example.com:443",
    "domainsuffix": "",
    "consent": 0,
    "timeout": 1800000,
    "logoutonidlesessiontimeout": true
  }
}
```

### 2. 带有 msgid 与 msgArgs 的求助请求 (`agentlog`)
```json
{
  "action": "event",
  "event": {
    "etype": "node",
    "action": "agentlog",
    "nodeid": "node//target_device_001",
    "domain": "",
    "msgid": 98,
    "msgArgs": [
      "alice",
      "Network printer cannot be connected from this PC"
    ],
    "msg": "Help Requested, user: alice, details: Network printer cannot be connected from this PC"
  }
}
```

### 3. 显式弹窗通知与自动销毁 (`msg:notify`)
```json
{
  "action": "msg",
  "type": "notify",
  "id": 0.482710384,
  "title": "Security Warning",
  "tag": "ServerNotify",
  "value": "There has been 3 failed login attempts on this account since the last login.",
  "titleid": 3,
  "msgid": 12,
  "args": [3],
  "maxtime": 15
}
```

### 4. 权限不足错误响应样本 (`users`)
```json
{
  "action": "users",
  "responseid": "req-user-list-001",
  "result": "Access denied"
}
```

### 5. 阻断性会话结束样本 (`close` 携带 2FA 提示)
```json
{
  "action": "close",
  "cause": "noauth",
  "msg": "tokenrequired",
  "email2fa": true,
  "sms2fa": false,
  "msg2fa": false,
  "email2fasent": true,
  "twoFactorCookieDays": 30
}
```

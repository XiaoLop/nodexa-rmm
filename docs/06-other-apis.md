# 其他常用接口

本文档列出封装 MeshCentral SDK 时常会用到的补充接口。

## 服务器信息

请求：

```json
{
  "action": "serverinfo",
  "responseid": "req-serverinfo"
}
```

响应：

```json
{
  "action": "serverinfo",
  "serverinfo": {
    "name": "MeshCentral",
    "version": "1.1.54",
    "domain": ""
  }
}
```

## 当前用户信息

```json
{
  "action": "userinfo",
  "responseid": "req-userinfo"
}
```

## 用户列表

```json
{
  "action": "users",
  "responseid": "req-users"
}
```

响应：

```json
{
  "action": "users",
  "users": [
    {
      "_id": "user//admin",
      "name": "admin",
      "email": "admin@example.com",
      "siteadmin": 4294967295
    }
  ]
}
```

## 新增用户

```json
{
  "action": "adduser",
  "username": "newuser",
  "pass": "password",
  "email": "newuser@example.com",
  "resetNextLogin": true,
  "siteadmin": 0,
  "responseid": "req-add-user"
}
```

## 编辑用户

```json
{
  "action": "edituser",
  "userid": "user//newuser",
  "email": "user@example.com",
  "realname": "User Name",
  "phone": "123456",
  "siteadmin": 0,
  "responseid": "req-edit-user"
}
```

## 删除用户

```json
{
  "action": "deleteuser",
  "userid": "user//newuser",
  "responseid": "req-delete-user"
}
```

## 用户组列表

```json
{
  "action": "usergroups",
  "responseid": "req-usergroups"
}
```

## 创建用户组

```json
{
  "action": "createusergroup",
  "name": "Operators",
  "desc": "Operators group",
  "responseid": "req-create-usergroup"
}
```

## 删除用户组

```json
{
  "action": "deleteusergroup",
  "ugrpid": "ugrp//xxxxxxxx",
  "responseid": "req-delete-usergroup"
}
```

## 用户与设备组权限

给用户授予设备组权限：

```json
{
  "action": "addmeshuser",
  "meshid": "mesh//xxxxxxxx",
  "usernames": ["operator"],
  "meshadmin": 8,
  "responseid": "req-add-mesh-user"
}
```

移除用户设备组权限：

```json
{
  "action": "removemeshuser",
  "meshid": "mesh//xxxxxxxx",
  "userid": "user//operator",
  "responseid": "req-remove-mesh-user"
}
```

常见设备组权限位：

- `1`：编辑设备组。
- `2`：管理用户。
- `4`：管理设备。
- `8`：远程控制。
- `16`：Agent 控制台。
- `32`：服务端文件。
- `64`：唤醒设备。
- `128`：设置备注。
- `256`：仅查看桌面。
- `512`：禁用终端。
- `1024`：禁用文件。
- `2048`：禁用 Intel AMT。
- `4096`：限制桌面输入。
- `8192`：限制事件。
- `16384`：聊天/通知。
- `32768`：卸载 Agent。
- `4294967295`：完整权限。

## 用户与单设备权限

授权单台设备：

```json
{
  "action": "adddeviceuser",
  "nodeid": "node//yyyyyyyy",
  "usernames": ["operator"],
  "rights": 8,
  "responseid": "req-add-device-user"
}
```

移除单台设备授权：

```json
{
  "action": "adddeviceuser",
  "nodeid": "node//yyyyyyyy",
  "usernames": ["operator"],
  "rights": 0,
  "remove": true,
  "responseid": "req-remove-device-user"
}
```

## 发送 Agent 邀请邮件

```json
{
  "action": "inviteAgent",
  "meshid": "mesh//xxxxxxxx",
  "email": "user@example.com",
  "name": "User",
  "msg": "Please install agent",
  "os": "0",
  "responseid": "req-invite-email"
}
```

## 生成邀请链接

```json
{
  "action": "createInviteLink",
  "meshid": "mesh//xxxxxxxx",
  "expire": 24,
  "flags": 0,
  "responseid": "req-invite-link"
}
```

字段：

- `expire`：有效小时数，`0` 表示不过期。
- `flags`：`0` 两种模式，`1` 仅交互式，`2` 仅后台安装。

## 设备共享链接

查询共享：

```json
{
  "action": "deviceShares",
  "nodeid": "node//yyyyyyyy",
  "responseid": "req-device-shares"
}
```

创建共享链接通常使用 `createDeviceShareLink`，字段会随版本和共享类型变化。常见字段包括：

```json
{
  "action": "createDeviceShareLink",
  "nodeid": "node//yyyyyyyy",
  "p": 1,
  "consent": 0,
  "start": null,
  "end": null,
  "recurring": 0,
  "responseid": "req-create-share"
}
```

## Agent 下载

Agent 下载不是 WebSocket，而是 HTTPS：

```text
https://<server>/<domain>/meshagents?id=<agenttype>&meshid=<meshid>&installflags=<flags>
```

示例：

```text
https://mesh.example.com/meshagents?id=4&meshid=mesh//xxxxxxxx&installflags=0
```

## 报表

```json
{
  "action": "report",
  "type": 1,
  "groupBy": 1,
  "devGroup": null,
  "start": 1786613600,
  "end": 1786700000,
  "tz": "Asia/Shanghai",
  "tf": -480,
  "showTraffic": true,
  "l": "en",
  "responseid": "req-report"
}
```

常见 `type`：

- `1`：流量。
- `2`：登录。
- `3`：数据库。

常见 `groupBy`：

- `1`：按用户。
- `2`：按设备。
- `3`：按天。

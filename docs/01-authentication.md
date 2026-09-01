# 鉴权

MeshCentral 管理接口主要通过 `control.ashx` WebSocket 鉴权。常用方式有账号密码、二次验证令牌、登录 Cookie、登录密钥和登录令牌。

## 使用 cookie 鉴权

### 账号密码登录

登录接口：

```shell
# 请求地址
POST https://<server>/<domain>/login

# Content-Type:
x-www-form-urlencoded

# 请求体
action=login
username=admin
password=password

# 响应cookie
xid=xxx
xid.sig=xxxx
```

将cookie中的 xid 和 xid.sig 携带到 ws 连接中, 就会鉴权成功

## 账号密码鉴权

连接地址：

```text
wss://<server>/<domain>/control.ashx
```

WebSocket 请求头添加 `x-meshauth`：

```text
x-meshauth: base64(username),base64(password)
```

带二次验证令牌：

```text
x-meshauth: base64(username),base64(password),base64(token)
```

Node.js 示例：

```js
import WebSocket from 'ws';

function encode(value) {
  return Buffer.from(String(value)).toString('base64');
}

const ws = new WebSocket('wss://mesh.example.com/control.ashx', {
  rejectUnauthorized: false,
  headers: {
    'x-meshauth': `${encode('admin')},${encode('password')}`
  }
});
```

## 二次验证

如果账号启用了 2FA 且没有传入 token，服务器可能返回：

```json
{
  "action": "close",
  "cause": "noauth",
  "msg": "tokenrequired"
}
```

封装建议：

- 初次连接收到 `tokenrequired` 时抛出 `TwoFactorRequiredError`。
- 调用方提供 TOTP 或其他二次验证 token 后重新连接。
- 不要在 SDK 内部持久化 token。

## 登录 Cookie 鉴权

MeshCentral Web UI 登录后会得到加密 Cookie。浏览器端控制通道会连接：

```text
wss://<server>/<domain>/control.ashx?moreargs=1
```

连接打开后发送：

```json
{
  "action": "urlargs",
  "args": {
    "auth": "<authCookie>"
  }
}
```

如果你在服务端封装 SDK，优先使用 `x-meshauth` 或登录密钥；如果你是在 MeshCentral 页面上下文内扩展功能，可以复用页面注入的 `authCookie`。

## 登录密钥鉴权

`meshctrl` 支持 `--loginkey` 或 `--loginkeyfile`。当传入 80 字节十六进制 key 时，客户端会生成 `auth` 查询参数：

```text
wss://<server>/<domain>/control.ashx?auth=<encoded-cookie>
```

Cookie 内容大致包含：

```json
{
  "userid": "user/<domainid>/<username>",
  "domainid": "<domainid>",
  "time": 1786700000
}
```

加密方式：AES-256-GCM，key 取登录密钥前 32 字节，随机 12 字节 IV，输出为 base64，并把 `+` 替换为 `@`、`/` 替换为 `$`。

这种方式适合后端服务到 MeshCentral 的长期集成，但需要安全保存登录密钥。

## 登录令牌

登录令牌由 `LoginTokens` 相关命令管理。控制通道请求：

查询登录令牌：

```json
{
  "action": "loginTokens",
  "responseid": "req-001"
}
```

创建登录令牌：

```json
{
  "action": "createLoginToken",
  "name": "api-client",
  "expire": 1440,
  "responseid": "req-002"
}
```

返回通常包含临时用户名和密码，可用于后续 `x-meshauth` 登录。

## 获取中继 Cookie

远程终端、文件传输等需要先在控制通道请求认证 Cookie：

```json
{
  "action": "authcookie"
}
```

返回：

```json
{
  "action": "authcookie",
  "cookie": "<browser-relay-cookie>",
  "rcookie": "<agent-relay-cookie>"
}
```

用途：

- `cookie`：客户端连接 `meshrelay.ashx` 时使用 `auth=<cookie>`。
- `rcookie`：通过控制通道通知设备端连接中继时使用 `rauth=<rcookie>`。

## 鉴权成功或失败

### 失败时会返回

```ts
{
  action:"close",
  cause:"noauth",
  msg: string
}
```

> 然后会关闭连接

### 成功时会返回

```Typescript
export interface Serverinfo {
    domain: string;
    name: string;
    mpsname: string;
    mpsport: number;
    port: number;
    emailcheck: boolean;
    domainauth: boolean;
    serverTime: number;
    features: number;
    features2: number;
    languages: string[];
    tlshash: string;
    agentCertHash: string;
    https: boolean;
    redirport: number;
    magenturl: string;
    domainsuffix: string;
    logoutonidlesessiontimeout: boolean;
    certExpire: number;
}

export interface RootObject {
    action: "serverinfo";
    serverinfo: Serverinfo;
}
```

```Typescript

export type Link = Record<string, {rights: number}>;

export interface Userinfo {
    _id: string;
    name: string;
    email: string;
    creation: number;
    login: number;
    access: number;
    siteadmin: number;
    llang: string;
    links: Link;
    passchange: number;
    pastlogin: number;
}

export interface RootObject {
    action: "userinfo";
    userinfo: Userinfo;
}
```

```Typescript
export interface RootObject {
    action: "traceinfo";
    traceSources?: null;
}
```

```Typescript
export interface Warning {
    msg: string;
    id: boolean;
}

export interface RootObject {
    action: "serverwarnings";
    warnings: Warning[];
}
```

鉴权成功后会返回以上4个数据

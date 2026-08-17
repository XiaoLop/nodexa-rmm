# Node.js SDK 封装设计

本设计用于把 MeshCentral `control.ashx` 和 `meshrelay.ashx` 封装成更稳定的业务 API。

## 推荐目录结构

```text
src/
  MeshCentralClient.ts
  auth.ts
  request.ts
  modules/
    devices.ts
    groups.ts
    users.ts
    commands.ts
    events.ts
    tunnels.ts
    files.ts
    terminal.ts
  errors.ts
  types.ts
```

## Client 配置

```ts
export interface MeshCentralClientOptions {
  baseUrl: string;
  domain?: string;
  username?: string;
  password?: string;
  token?: string;
  loginKey?: Buffer | string;
  authCookie?: string;
  rejectUnauthorized?: boolean;
  requestTimeoutMs?: number;
  pingIntervalMs?: number;
}
```

## 核心 Client API

```ts
export class MeshCentralClient {
  connect(): Promise<void>;
  close(): Promise<void>;
  send<T = unknown>(command: Record<string, unknown>): Promise<T>;
  on(event: 'event', listener: (event: MeshCentralEvent) => void): this;
  on(event: 'close', listener: (reason?: unknown) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;

  devices: DevicesModule;
  groups: GroupsModule;
  users: UsersModule;
  commands: CommandsModule;
  events: EventsModule;
  tunnels: TunnelsModule;
}
```

## 请求关联

控制通道通用封装：

```ts
class RequestManager {
  private seq = 0;
  private pending = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }>();

  nextId(prefix = 'sdk') {
    this.seq += 1;
    return `${prefix}-${Date.now()}-${this.seq}`;
  }
}
```

发送请求：

```ts
async function send(command) {
  const responseid = command.responseid ?? requestManager.nextId();
  const payload = { ...command, responseid };
  ws.send(JSON.stringify(payload));
  return requestManager.wait(responseid);
}
```

处理响应：

```ts
function onMessage(raw) {
  const data = JSON.parse(raw.toString());

  if (data.responseid && requestManager.resolve(data.responseid, data)) {
    return;
  }

  emit('event', data.event ?? data);
}
```

## 设备模块

```ts
export class DevicesModule {
  constructor(private client: MeshCentralClient) {}

  list() {
    return this.client.send({ action: 'nodes' });
  }

  listByGroup(meshid: string) {
    return this.client.send({ action: 'nodes', meshid });
  }

  async details(nodeid: string) {
    const [nodes, network, lastconnect, sysinfo] = await Promise.all([
      this.client.send({ action: 'nodes' }),
      this.client.send({ action: 'getnetworkinfo', nodeid }),
      this.client.send({ action: 'lastconnect', nodeid }),
      this.client.send({ action: 'getsysinfo', nodeid, nodeinfo: true })
    ]);
    return { nodes, network, lastconnect, sysinfo };
  }
}
```

## 分组模块

```ts
export class GroupsModule {
  constructor(private client: MeshCentralClient) {}

  list() {
    return this.client.send({ action: 'meshes' });
  }

  create(name: string, options = {}) {
    return this.client.send({ action: 'createmesh', meshname: name, meshtype: 2, ...options });
  }

  update(meshid: string, patch = {}) {
    return this.client.send({ action: 'editmesh', meshid, ...patch });
  }

  remove(meshid: string) {
    return this.client.send({ action: 'deletemesh', meshid });
  }
}
```

## 命令模块

```ts
export class CommandsModule {
  constructor(private client: MeshCentralClient) {}

  run(nodeids: string[], command: string, options = {}) {
    return this.client.send({
      action: 'runcommands',
      nodeids,
      cmds: command,
      type: options.powershell ? 2 : 0,
      runAsUser: options.runAsUser ?? 0,
      reply: options.reply ?? true
    });
  }
}
```

## 事件模块

```ts
export class EventsModule {
  constructor(private client: MeshCentralClient) {}

  list(options = {}) {
    return this.client.send({ action: 'events', ...options });
  }

  onDeviceOffline(listener: (event: MeshCentralEvent) => void) {
    this.client.on('event', (event) => {
      if (event.etype === 'node' && event.action === 'nodedisconnect') {
        listener(event);
      }
    });
  }
}
```

## 隧道模块

```ts
export class TunnelsModule {
  constructor(private client: MeshCentralClient) {}

  async open(nodeid: string, protocol: number) {
    const auth = await this.client.send({ action: 'authcookie' });
    const tunnelid = randomHex(6);

    await this.client.send({
      action: 'msg',
      nodeid,
      type: 'tunnel',
      usage: protocol,
      value: `*/meshrelay.ashx?p=${protocol}&nodeid=${nodeid}&id=${tunnelid}&rauth=${auth.rcookie}`
    });

    return connectRelay({ nodeid, protocol, tunnelid, auth: auth.cookie });
  }
}
```

## 使用示例

```ts
const client = new MeshCentralClient({
  baseUrl: 'https://mesh.example.com',
  username: 'admin',
  password: process.env.MESH_PASSWORD,
  rejectUnauthorized: false
});

await client.connect();

const groups = await client.groups.list();
const devices = await client.devices.list();

client.events.onDeviceOffline((event) => {
  console.log('Device offline:', event.nodeid);
});

await client.commands.run(['node//yyyyyyyy'], 'hostname', { reply: true });
```

## 错误类型

建议定义明确错误类型：

- `AuthenticationError`：账号密码、登录密钥、Cookie 无效。
- `TwoFactorRequiredError`：服务器要求二次验证。
- `PermissionDeniedError`：用户权限不足。
- `RequestTimeoutError`：`responseid` 超时未返回。
- `ConnectionClosedError`：连接关闭导致请求失败。
- `DeviceOfflineError`：目标设备离线。
- `TunnelError`：中继隧道建立或传输失败。

## 安全建议

- SDK 运行在后端服务，不要把 MeshCentral 管理账号密码下发到浏览器。
- 使用最小权限账号或用户组，只授予必要设备组权限。
- 登录密钥、登录令牌、密码使用环境变量或密钥管理服务保存。
- 对批量命令和文件操作增加审计日志。
- 对外暴露 API 时，业务层再做一次权限校验，避免直接把 MeshCentral 管理能力透传给前端。

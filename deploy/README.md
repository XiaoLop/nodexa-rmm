# MeshCentral 部署

当前仅部署 MeshCentral 与 MongoDB，不包含自定义 Web、Nginx 或 Gateway。
MeshCentral 自己提供 HTTPS 和原生管理页面。需要 Docker Engine / Docker Desktop
（Linux 容器模式）以及 Docker Compose v2。以下命令从仓库根目录执行。

## 配置与目录

- `compose/compose.meshcentral.dev.yaml`：开发环境，HTTPS 端口 8443，沿用现有 runtime 数据。
- `compose.meshcentral.prod.yaml`：生产环境，HTTPS 端口 443；MeshCentral 数据绑定到部署目录。
- `config/config.meshcental.dev.yaml`：开发覆盖配置。
- `config/config.meshcental.prod.yaml`：生产模板，不能直接使用占位密码部署。
- `config/config.meshcental.yaml`：可用作本机私有配置，不再作为默认输入。

启动器将 `apps/meshcentral/src/config.default.json` 与挂载的 YAML 递归合并，
YAML 优先，数组整体替换。生成 JSON 保存在容器临时目录，启动 MeshCentral 时使用，
正常退出后清理；不会修改输入文件。`generated/` 不参与当前启动流程。
默认配置里的插件、Agent 品牌和文件路径仍被继承。

配置源只读挂载；相对挂载路径以 `deploy/compose/` 为基准，而非命令所在目录。
不要提交真实密码。启动器不支持通用的 `${ENV}` 任意插值；生产 Compose 将
`MONGODB_ROOT_*` 映射为数据库专用环境变量，启动器自动进行 URL 编码并组装连接串，
覆盖默认开发连接串；不需要在生产 YAML 中重复写数据库密码。

## 品牌资源

`deploy/assets` 只读挂载到容器 `/data`，启动脚本在启动 MeshCentral 前将其中顶层的
小写扩展名 `.png`、`.ico` 文件复制到 `/var/lib/meshcentral/data`。不递归复制目录，
不复制其他类型文件；每次启动覆盖同名资源，源文件删除后不会自动删除目标文件。
此行为独立于 `MESHCENTRAL_SYNC_BUILTIN_PLUGINS`，关闭插件同步不会关闭资源复制。

数据目录仍使用开发 runtime 目录或生产命名卷，证书和插件不会写回 assets。
当前资源为 `logo.png` 和 `favicon.ico`，实际部署 YAML 应设置：

```yaml
domains:
  '':
    agentCustomization:
      image: logo.png
    agentFileInfo:
      icon: favicon.ico
```

文件名不会自动转换为默认配置中的 `myagent.png`、`myagent.ico`。
更新图片后重启容器即可重新复制；首次使用新的启动脚本必须重建镜像。
如果之前曾把整个 assets 作为数据目录运行，请先备份并迁移其中的证书与身份数据到
恢复后的数据目录；本次资源复制不会迁移这些文件，直接使用不同身份可能影响 Agent 重连。

## 开发部署

```powershell
docker compose -f deploy/compose/compose.meshcentral.dev.yaml up -d --build
docker compose -f deploy/compose/compose.meshcentral.dev.yaml ps
docker compose -f deploy/compose/compose.meshcentral.dev.yaml logs --tail 100 meshcentral
```

访问 `https://localhost:8443`。初始自签名证书会触发浏览器警告。
真实设备连接前，将开发 YAML 的 `settings.cert` 改为设备可访问的主机名或 IP；
localhost 不能作为远程设备连接地址。不要把开发密码环境直接暴露到公网。

开发数据继续保存在 `apps/meshcentral/runtime/`。旧数据必须与现有数据库账号一致，
修改初始化密码不会修改已经存在的 MongoDB 用户。默认插件每次启动从镜像同步；
插件源码更改后需要重建镜像。

快捷命令：`pnpm dev:meshcentral:rebuild`、`pnpm dev:meshcentral:status`、
`pnpm dev:meshcentral:logs`、`pnpm dev:meshcentral:down`。

## 生产快速部署

生产部署分为两步：在源码仓库中构建并导出 MeshCentral 镜像，再从仓库 `deploy/` 中选择
生产所需文件，上传并组装成独立的 `meshcentral-deploy/`。不是直接上传或重命名整个
`deploy/` 目录。运行环境不需要源码、pnpm 或 Node.js。

### 1. 构建容器镜像

在源码仓库根目录执行：

```bash
docker build \
  -f apps/meshcentral/Dockerfile \
  --build-arg MESHCENTRAL_VERSION=1.1.54 \
  -t nodexa-rmm:production \
  .
```

导出镜像到部署目录：

```bash
docker save -o nodexa-rmm-production.tar nodexa-rmm:production
```

快捷命令（一键构建并导出 tar）：`pnpm prod:meshcentral:package`；或单独执行 `pnpm prod:meshcentral:build`、`pnpm prod:meshcentral:save`。

如果运行环境可以访问私有镜像仓库，也可以执行 `docker push`，无需生成 tar 文件。

### 2. 上传并组装部署目录

在运行环境创建 `meshcentral-deploy/`，并按下表上传或创建文件：

| 仓库或构建产物                                 | 运行环境目标路径                                             |
| ---------------------------------------------- | ------------------------------------------------------------ |
| `nodexa-rmm-production.tar`                    | `meshcentral-deploy/nodexa-rmm-production.tar`               |
| `deploy/compose/compose.meshcentral.prod.yaml` | `meshcentral-deploy/compose.meshcentral.prod.yaml`           |
| `deploy/config/config.meshcental.prod.yaml`    | `meshcentral-deploy/config/config.meshcental.prod.yaml`      |
| `deploy/environments/.env.example`             | `meshcentral-deploy/.env.production`                         |
| `deploy/assets/logo.png`                       | `meshcentral-deploy/assets/logo.png`                         |
| `deploy/assets/favicon.ico`                    | `meshcentral-deploy/assets/favicon.ico`                      |

在运行环境新建空目录：`data/`、`files/`、`backups/`、`recordings/`。不要上传仓库中的
开发 runtime 数据，也不要上传 `compose.meshcentral.dev.yaml`、`generated/` 或 `secrets/`。

完成后的运行环境目录为：

```text
meshcentral-deploy/
  nodexa-rmm-production.tar
  assets/
    logo.png
    favicon.ico
  compose.meshcentral.prod.yaml
  config/
    config.meshcental.prod.yaml
  data/
  files/
  backups/
  recordings/
  .env.production
```

MongoDB 数据使用 Docker 命名卷；四个宿主机目录分别绑定到 MeshCentral 对应容器目录。
所有后续运行命令都从目标 `meshcentral-deploy/` 根部执行。

文件上传后，在运行环境准备空目录和文件权限：

```bash
mkdir -p data files backups recordings
chmod 600 .env.production config/config.meshcental.prod.yaml
```

编辑 `config/config.meshcental.prod.yaml`，至少修改域名与页面标题：

```yaml
settings:
  cert: mesh.example.com
  port: 8443
  aliasPort: 443
  exactPorts: true
  tlsOffload: false
  trustedProxy: null
  mongoDbName: meshcentral

domains:
  '':
    title: My MeshCentral
    title2: Device management
    newAccounts: false
    agentCustomization:
      image: logo.png
    agentFileInfo:
      icon: favicon.ico
```

`port` 是容器内部端口，`aliasPort` 是客户端看到的公网端口。数据库连接串由启动器根据
环境变量生成，不要在生产 YAML 中填写 `settings.mongoDb`。

编辑根目录的 `.env.production`：

```dotenv
MONGODB_ROOT_PASSWORD='替换为刚生成的强密码'
```

密码填写原始值，不需要 URL 编码；启动器会安全编码后生成 MongoDB URI。MongoDB 在空数据卷
首次启动时创建此管理员账号，MeshCentral 复用该账号。该方案部署简单，但 MeshCentral 持有
MongoDB 管理员权限，因此此 MongoDB 实例不应承载其他无关应用。

环境变量文件不是专用 Secret 存储。不要提交 `.env.production`，不要在日志、工单或命令输出
中公开完整配置。已有数据库不会因修改 env 自动改密，修改密码前必须先在 MongoDB 中更新用户。

### 3. 准备品牌资源

将品牌图片放入 `assets/`：

```text
assets/logo.png
assets/favicon.ico
```

容器启动时会把顶层 `.png`、`.ico` 文件复制到 MeshCentral 持久化数据目录。文件名必须与
YAML 的 `agentCustomization.image` 和 `agentFileInfo.icon` 一致。缺少资源不会自动生成替代文件。

### 4. 加载镜像并启动

将部署目录复制到运行环境后，进入该目录：

```bash
cd /opt/meshcentral-deploy
```

如果使用 tar 文件交付镜像，先加载镜像：

```bash
docker load -i nodexa-rmm-production.tar
```

先校验 Compose；无输出表示通过：

```bash
docker compose \
  --env-file .env.production \
  -f compose.meshcentral.prod.yaml \
  config --quiet
```

启动 MongoDB 和 MeshCentral。生产 Compose 不在运行环境构建镜像：

```bash
docker compose \
  --env-file .env.production \
  -f compose.meshcentral.prod.yaml \
  up -d
```

检查容器状态和启动日志：

```bash
docker compose \
  --env-file .env.production \
  -f compose.meshcentral.prod.yaml \
  ps

docker compose \
  --env-file .env.production \
  -f compose.meshcentral.prod.yaml \
  logs --tail 100 meshcentral mongodb
```

`mongodb` 应显示 healthy，随后 `meshcentral` 应显示 healthy。访问
`https://mesh.example.com`；首次使用自签名证书时，浏览器会报告证书不受信任。

### 5. 创建首个管理员

生产模板默认设置 `newAccounts: false`。全新数据库如没有账号创建入口，应先限制公网访问，
临时将本机 YAML 改为：

```yaml
domains:
  '':
    newAccounts: true
```

重新创建 MeshCentral 容器使配置生效：

```bash
docker compose \
  --env-file .env.production \
  -f compose.meshcentral.prod.yaml \
  up -d --force-recreate meshcentral
```

创建并确认首个管理员后，立即将 `newAccounts` 改回 `false`，再次执行相同命令。不要在开放公网
注册的状态下长期运行。

### 6. 更新镜像

更新时在源码仓库重新构建并导出相同标签的镜像，把新的 tar 文件复制到部署目录，然后执行：

```bash
docker load -i nodexa-rmm-production.tar
docker compose \
  --env-file .env.production \
  -f compose.meshcentral.prod.yaml \
  up -d --force-recreate meshcentral
```

MongoDB 保存在 Docker 命名卷中，MeshCentral 数据保存在部署目录的四个数据目录中。
更新镜像不会删除这些数据。不要执行 `docker compose down -v`，否则会删除 MongoDB 卷。

### 7. 常用运维命令

为避免遗漏参数，以下命令始终携带同一 env 文件和 Compose 文件：

```bash
# 查看状态
docker compose --env-file .env.production -f compose.meshcentral.prod.yaml ps

# 跟踪日志
docker compose --env-file .env.production -f compose.meshcentral.prod.yaml logs -f meshcentral

# 修改 YAML 或品牌资源后重新创建 MeshCentral
docker compose --env-file .env.production -f compose.meshcentral.prod.yaml up -d --force-recreate meshcentral

# 停止服务但保留数据卷
docker compose --env-file .env.production -f compose.meshcentral.prod.yaml down
```

不要执行 `down -v`，该命令会删除生产数据卷。

## 首次管理员与更新

模板默认关闭注册。首次启动应在受限网络中完成管理员引导：如果没有创建账号入口，
临时设置 `domains[''].newAccounts: true` 并重启，创建首个管理员后立即改回 false 并重启。
确认管理员权限后再开放公网；不要在已有数据库中假定新建账号会自动成为管理员。

修改 YAML 后重启 MeshCentral 即可重新合并；修改挂载路径、env 或端口时使用
`up -d --force-recreate`。修改源码、默认 JSON 或插件后使用 `up -d --build`。
所有生产命令都需保留相同的 `--env-file` 和 `-f` 参数。

## 数据与备份

生产 MongoDB 使用命名卷；MeshCentral 的 data、files、backups、recordings 使用部署目录绑定。
它们与开发 runtime 目录隔离，不会自动迁移开发数据。不要执行 `down -v`，它会删除 MongoDB 卷。
MongoDB 初始化变量仅对空数据目录生效，更改密码需在数据库中完成用户密码变更。

升级前备份 MongoDB（使用一致性备份或 mongodump）以及 MeshCentral 的 data 和 files，
按需备份录制内容。不能把运行中的 WiredTiger 文件简单复制当作可靠备份。
仅备份 YAML 不足以恢复设备身份；恢复流程必须验证 Agent 重连。
从旧部署迁移时先停止写入并备份，明确源卷与目标卷后再恢复，不要直接替换数据路径。

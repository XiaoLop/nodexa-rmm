# Secret 文件

本目录只提交说明文件。真实 Secret 已由仓库根部 `.gitignore` 排除，不应提交到 Git。

开发环境至少需要创建：

```text
mongodb-root-username
mongodb-root-password
meshcentral-mongodb-url
meshcentral-session-key
meshcentral-db-encryption-key
meshcentral-backup-password
tls-certificate.pem
tls-private-key.pem
```

示例 MongoDB URL：

```text
mongodb://meshcentral:<password>@mongodb:27017/meshcentral?authSource=admin
```

当 MeshCentral 在宿主机运行、MongoDB 由 `compose.infra.yaml` 暴露时，应使用：

```text
mongodb://127.0.0.1:27017/meshcentral
```

密钥要求：

- Session Key、数据库加密密钥和备份密码应分别生成，不要复用。
- 生产 Secret 应来自密码管理器、Docker Swarm secret、Kubernetes Secret 或其他受控系统。
- TLS 私钥只允许容器运行用户读取。
- 修改数据库加密密钥前必须确认 MeshCentral 的密钥轮换流程并完成备份。

PowerShell 生成开发随机值示例：

```powershell
$bytes = New-Object byte[] 48
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToHexString($bytes).ToLowerInvariant()
```

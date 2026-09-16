# 文件管理功能实施计划

## 1. 目标与范围

基于现有 `GatewayClient`、`@meshcentral/relay` 的 `p=5` 文件中继和设备工作台，实现完整的单设备文件管理页面，并移除设备列表中的文件管理弹窗。

本计划覆盖：

1. 在 `@meshcentral/relay` 中封装已确认的文件管理协议。
2. 保留并完善现有目录读取、单文件上传、单文件下载、进度和取消能力。
3. 新增目录创建、文件与目录删除、重命名、文件复制、文件移动、ZIP 压缩和 ZIP 解压。
4. 新增多选和批量删除、批量复制、批量移动、批量压缩。
5. 在设备工作台“文件管理”标签实现常驻文件管理页面。
6. 将设备列表“文件管理”入口改为直接进入设备工作台文件标签。
7. 删除旧的 `FileUploadModal` 及其页面状态和样式依赖。
8. 补充 Relay 单元测试、Web 组件测试、文档和验证流程。

必须遵守以下约束：

- 所有文件操作继续通过现有 `RelayClient` 和 `RelaySession` 建立的 `p=5` 中继执行，不新增旁路 WebSocket。
- 新文件操作 JSON 的编码和发送方式必须与现有 `ls` 完全一致，不增加额外帧头、前导字节或独立编码器。
- `mkdir`、`rm`、`rename`、`copy` 和 `move` 没有成功或失败响应，API 只能表示消息是否成功写入本地 Relay，不能表示远端操作成功。
- 无响应操作发送后由页面静默自动刷新目录，不显示“操作已发送”“操作成功”“请确认结果”等提示。
- 刷新后目录内容没有变化时，不主动判定远端操作失败。
- 只有客户端可以确定的异常才显示错误状态，例如中继无法建立、消息无法发送、上传或下载明确失败、目录读取失败和连接断开。
- `copy` 和 `move` 当前只开放文件操作，不允许对目录发送请求。
- ZIP 解压只对 `.zip` 文件开放，不根据扩展名以外的信息猜测其他压缩格式。
- 前端权限判断只控制入口和交互，最终授权继续由 MeshCentral 服务端执行。
- 不实现未经真实协议确认的断点续传、哈希校验、远端任务恢复或可信完成回执。

## 2. 非目标与能力边界

本期不实现：

- 复制目录或移动目录。
- 上传和下载断点续传。
- 上传 Range、下载 Range、分块哈希和重连恢复。
- 服务端可靠的覆盖、跳过、自动重命名冲突策略。
- 依赖远端响应确认 `mkdir`、`rm`、`rename`、`copy` 或 `move` 成功。
- 文件在线预览、在线编辑、文本差异比较和媒体播放。
- 跨设备复制或移动文件。
- 跨浏览器、跨登录会话恢复传输任务。
- 将浏览器本地传输历史描述为可信审计日志。
- 在没有真实事件字段时伪造操作者、操作结果或失败原因。

上传冲突首期采用保守策略：

- 上传前读取当前目录，可以在前端实现“跳过同名文件”。
- “覆盖”沿用现有行为，即检测到同名文件后仍发送普通 `upload`；UI 和文档不得宣称 Agent 存在显式覆盖参数。
- “自动重命名”暂不作为稳定能力；若后续实现，只能在前端基于当前目录生成候选名称，并承认并发竞态。

## 3. 已确认协议事实

### 3.1 已有能力

仓库现有 `FilesSession` 已实现：

- `ls` 目录读取和目录项标准化。
- Windows、POSIX 和根目录路径标准化。
- 单文件分块上传。
- 上传 `uploadstart`、`uploadack` 和 `uploaddone` 时序。
- 上传取消 `uploadcancel`。
- 单文件流式下载。
- 下载 `start`、`startack`、`ack` 和 `stop` 时序。
- 上传和下载进度。
- `AbortSignal`、无活动超时、连接断开和本地取消。
- JSON 响应以文本帧或 UTF-8 二进制帧到达时的统一解析。
- 同一个 `FilesSession` 同时只允许一个活动的目录、上传或下载操作。

现有 Web 文件管理弹窗已具备：

- 建立文件 Relay。
- 浏览根目录、磁盘和子目录。
- 返回上一级和手动刷新。
- 上传、下载、进度和取消。
- File System Access API 流式保存和 Blob 回退。

### 3.2 新确认的无响应操作

以下请求使用与现有 `ls` 相同的 JSON 编码和发送路径。

新建目录：

```json
{ "action": "mkdir", "reqid": 1, "path": "C:/test" }
```

删除文件或目录：

```json
{ "action": "rm", "reqid": 1, "path": "C:", "delfiles": ["test"], "rec": true }
```

重命名：

```json
{ "action": "rename", "path": "C:", "oldname": "test", "newname": "test123" }
```

复制文件：

```json
{
  "action": "copy",
  "reqid": 1,
  "scpath": "C:",
  "dspath": "C:/test123",
  "names": ["earnings.html"]
}
```

移动文件：

```json
{
  "action": "move",
  "reqid": 1,
  "scpath": "C:",
  "dspath": "C:/test123",
  "names": ["earnings.html"]
}
```

这些操作均没有成功响应、失败响应或可靠完成信号。实现约束：

- 方法完成只表示 `RelaySession.sendJson()` 没有同步抛错。
- 不为这些方法创建等待远端响应的 Promise。
- 不占用现有 `active` 操作槽位。
- 页面发送后静默重新调用 `listDirectory()`。
- 复制和移动后刷新当前可见目录；目标目录在用户进入时读取最新内容。
- 不根据一次刷新结果推断最终成功或失败。

### 3.3 ZIP 压缩和解压

压缩请求：

```json
{ "action": "zip", "path": "C:", "files": ["test123"], "output": "test-123.zip" }
```

已确认响应：

```json
{ "action": "dialogmessage", "msg": "zipping" }
{ "action": "dialogmessage", "msg": "zippingFile", "file": "C:\\test123\\earnings.html", "progress": 19 }
{ "action": "dialogmessage", "msg": "zippingFile", "file": "C:\\test123\\earnings.html", "progress": 100 }
{ "action": "dialogmessage", "msg": null }
{ "action": "refresh" }
```

解压请求：

```json
{ "action": "unzip", "input": "C:\\test-123.zip", "dest": "C:\\test-123\\" }
```

已确认响应：

```json
{ "action": "dialogmessage", "msg": "unzipping" }
{ "action": "dialogmessage", "msg": null }
{ "action": "refresh" }
```

实现约束：

- `dialogmessage` 是会话级事件，不依赖 `reqid`。
- `msg: "zipping"` 和 `msg: "unzipping"` 表示阶段开始。
- `msg: "zippingFile"` 提供当前文件和进度百分比。
- `msg: null` 只表示对话状态结束，不等于可靠成功。
- `refresh` 触发页面静默刷新当前目录。
- 当前没有 ZIP 失败响应，不显示成功或失败通知。
- ZIP 进行期间禁用会引起目录状态冲突的写操作，但允许用户断开整个文件会话。

## 4. 总体架构

```text
DeviceFilesPanel
  -> useDeviceFilesSession
       -> FilesSession
            -> file message builders / event parser
            -> RelaySession / RelayConnection
                 -> GatewayClient + MeshCentral Agent
```

各层职责：

| 层级                    | 主要职责                                                 | 不承担的职责              |
| ----------------------- | -------------------------------------------------------- | ------------------------- |
| `RelaySession`          | 通用 Relay 建链、握手、收发和关闭                        | 文件业务语义和 React 状态 |
| 文件消息构造器          | 校验并构造 `ls/mkdir/rm/rename/copy/move/zip/unzip` 消息 | 等待不存在的远端确认      |
| `FilesSession`          | 目录、传输、文件命令、ZIP 事件和连接生命周期             | 页面布局、通知和选择状态  |
| `useDeviceFilesSession` | 创建/释放会话、目录导航、静默刷新、错误映射              | 协议字段拼装              |
| `DeviceFilesPanel`      | 工具栏、路径、表格、多选、对话框、进度和响应式布局       | 直接调用底层 WebSocket    |

## 5. Relay 文件协议 API 设计

### 5.1 消息构造器

在 `packages/relay/src/protocols/files/messages.ts` 新增：

```ts
createDirectoryMessage(path, requestId);
createRemoveEntriesMessage(path, names, recursive, requestId);
createRenameEntryMessage(path, oldName, newName);
createCopyFilesMessage(sourcePath, destinationPath, names, requestId);
createMoveFilesMessage(sourcePath, destinationPath, names, requestId);
createZipMessage(path, names, outputName);
createUnzipMessage(inputPath, destinationPath);
```

构造器必须：

- 使用 `normalizeFilePath()` 标准化完整路径。
- 使用统一的单路径段校验函数校验名称。
- 拒绝空名称、`.`、`..`、包含 `/`、包含 `\` 或包含空字节的名称。
- 对名称数组去重，并拒绝空数组。
- `copy` 和 `move` 的 `names` 类型只表达文件名，目录限制由调用方和页面共同执行。
- 保留协议已确认的字段名，不改写为自定义字段。
- 不擅自为 `rename`、`zip` 或 `unzip` 添加 `reqid`。

### 5.2 公共类型

在 `packages/relay/src/protocols/files/types.ts` 新增：

```ts
export interface FileCommandReceipt {
  requestId?: string;
  action: 'mkdir' | 'rm' | 'rename' | 'copy' | 'move' | 'zip' | 'unzip';
}

export type FileDialogMessageType = 'zipping' | 'zipping-file' | 'unzipping' | 'closed' | 'unknown';

export interface FileDialogMessage {
  type: FileDialogMessageType;
  file?: string;
  progress?: number;
  raw: Readonly<Record<string, unknown>>;
}

export interface RemoveEntriesOptions {
  recursive?: boolean;
}
```

`FileCommandReceipt` 仅用于记录本地已经构造并发送的 action，不包含 `success`、`completed` 或 `failed` 字段，避免调用方误用。

### 5.3 `FilesSession` 公共方法

新增 API：

```ts
createDirectory(path: string): FileCommandReceipt;
removeEntries(path: string, names: string[], options?: RemoveEntriesOptions): FileCommandReceipt;
renameEntry(path: string, oldName: string, newName: string): FileCommandReceipt;
copyFiles(sourcePath: string, destinationPath: string, names: string[]): FileCommandReceipt;
moveFiles(sourcePath: string, destinationPath: string, names: string[]): FileCommandReceipt;
createZip(path: string, names: string[], outputName: string): FileCommandReceipt;
extractZip(inputPath: string, destinationPath: string): FileCommandReceipt;
onDialogMessage(listener: (message: FileDialogMessage) => void): () => void;
onRefreshRequested(listener: () => void): () => void;
```

设计说明：

- 无响应命令使用同步方法，准确表达“本地发送完成”。
- `sendJson()` 抛出的连接错误继续同步抛给调用方。
- 方法调用前执行 `assertAvailable()`，但不进入 `active` 状态。
- 当目录读取、上传或下载正在进行时，写命令默认抛出 `busy`，避免消息与当前操作竞争。
- ZIP 和解压发送后设置会话级 `archiveBusy` 状态；收到 `dialogmessage msg: null` 后解除。
- `archiveBusy` 时拒绝新的目录写操作、上传和下载；收到 `refresh` 时发布刷新事件。
- 如果 Relay 断开而没有收到 `msg: null`，清除归档状态并通过现有连接错误路径结束会话。
- 不为 ZIP 建立无法可靠完成的 Promise。

### 5.4 入站消息路由

调整 `FilesSession.handleInbound()` 的路由顺序：

1. 二进制下载数据块仍优先交给活动下载操作。
2. JSON 解码后先识别 `dialogmessage` 和 `refresh` 会话级事件。
3. 会话级事件不得被当前 `active` 操作吞掉，也不参与 `reqid` 匹配。
4. 其余带 `reqid/id` 的消息继续路由到当前目录、上传或下载操作。
5. 未识别消息继续交给 `onUnhandledMessage`。

新增解析函数：

```ts
parseFileDialogMessage(message): FileDialogMessage | undefined;
isFileRefreshMessage(message): boolean;
```

进度字段处理：

- `progress` 只接受有限数字。
- UI 使用前限制在 `0..100`，原始值仍保存在 `raw`。
- `file` 只接受字符串，不解析或记录文件内容。
- 未知 `dialogmessage.msg` 映射为 `unknown` 并保留原始对象。

### 5.5 路径工具

在 `path.ts` 中提取并公开安全名称校验：

```ts
normalizeFileName(name: string): string;
parentFilePath(path: string): string | undefined;
```

要求：

- 页面和协议层不再各自实现不同的父目录算法。
- Windows 根目录、POSIX 根目录和 Relay 根目录必须有测试。
- Windows 路径统一使用现有标准化结果，不在 UI 层手写斜杠转换。
- 解压目标目录通过路径工具构造，禁止字符串直接拼接产生越级路径。

### 5.6 公共导出与文档

同步更新：

- `packages/relay/src/protocols/files/index.ts`
- `packages/relay/src/index.ts`
- `packages/relay/docs/03-files.md`
- `packages/relay/docs/05-events-and-messages.md`
- `packages/relay/docs/06-api-and-testing.md`
- `docs/03-remote-control.md`

文档必须明确：

- 哪些方法有远端响应，哪些方法仅发送消息。
- 无响应命令不会产生成功 Promise。
- ZIP 事件没有可靠结果字段。
- 页面静默刷新不等于远端成功确认。

## 6. Relay 测试计划

### 6.1 消息构造器测试

覆盖：

- 每个 action 的精确 JSON 字段。
- `reqid` 只出现在已确认的消息中。
- Windows 与 POSIX 路径标准化。
- 单名称和多名称数组。
- 名称去重。
- 空名称、路径分隔符、`.`、`..` 和空数组拒绝。
- `zip.output` 和 `unzip.dest` 校验。

### 6.2 `FilesSession` 测试

在 `FilesSession.test.ts` 增加：

1. `mkdir` 使用与 `ls` 相同的 JSON 发送路径。
2. `rm` 正确发送多选名称和 `rec: true`。
3. `rename` 不等待响应并立即返回 receipt。
4. `copy` 和 `move` 发送文件名数组。
5. 无响应命令不会创建超时计时器。
6. 活动目录、上传或下载操作期间拒绝写命令。
7. 解析二进制 JSON `dialogmessage`。
8. ZIP 文件进度按接收顺序发布。
9. `msg: null` 关闭归档忙碌状态。
10. `refresh` 在没有活动操作时发布。
11. `refresh` 在上传或目录读取进行中仍不会被吞掉。
12. Relay 断开会清理归档状态和监听器。
13. `dispose()` 后所有命令拒绝执行。
14. 未知 `dialogmessage` 进入 `unknown`，不会终止会话。

### 6.3 回归测试

必须保留并通过现有测试：

- 目录 `reqid` 匹配。
- 二进制 JSON 目录响应。
- 上传 ACK 背压和 5 MiB 默认分块。
- 上传命令样数据块前导 `0` 转义。
- 下载数据帧 flags 和 sink 背压。
- 取消、超时、断线和不安全路径拒绝。

Relay 阶段验证命令：

```text
pnpm --filter @meshcentral/relay test
pnpm --filter @meshcentral/relay typecheck
pnpm --filter @meshcentral/relay lint
pnpm --filter @meshcentral/relay build
```

## 7. 设备工作台文件管理页面

### 7.1 文件结构

新增：

```text
apps/web/src/components/device-workspace/files/
  DeviceFilesPanel.tsx
  FilesToolbar.tsx
  FilesBreadcrumb.tsx
  FilesTable.tsx
  FileTransferBar.tsx
  CreateDirectoryDialog.tsx
  RenameEntryDialog.tsx
  SelectDestinationDialog.tsx
  CreateZipDialog.tsx
  ExtractZipDialog.tsx
  useDeviceFilesSession.ts
  fileViewModel.ts
  fileViewModel.test.ts
```

组件拆分以职责为准，不要求为了文件数量机械拆分。若对话框逻辑简短，可合并在 `DeviceFilesPanel.tsx`；会话生命周期和协议调用必须保留在 hook 中。

### 7.2 页面布局

文件标签使用一个全宽工作区域，不使用弹窗承载主体验，也不在卡片中嵌套卡片。

布局自上而下：

1. 操作工具栏。
2. 路径栏和面包屑。
3. 文件表格。
4. 固定高度的传输/归档状态栏。

工具栏命令：

- 返回上一级。
- 根目录。
- 刷新。
- 新建目录。
- 上传文件。
- 下载选中文件。
- 重命名。
- 复制。
- 移动。
- 删除。
- 压缩为 ZIP。
- 解压 ZIP。

交互规则：

- 熟悉的命令使用 Ant Design 图标按钮并提供 tooltip。
- 多选操作基于表格 checkbox，不依赖右键菜单才能完成。
- 单击目录行进入目录；文件行只选择，不自动下载。
- 双击目录可作为进入目录的补充方式，但不能成为唯一入口。
- 解压按钮仅在单选 `.zip` 文件时可用。
- 下载仅允许单个文件；多文件下载不打包伪装成批量下载。
- 复制、移动只在全部选择项都是文件时启用。
- 删除支持文件和目录，目录删除明确使用递归语义并要求确认。
- 压缩支持文件和目录多选。
- 当前目录和目标目录选择器复用同一套 Relay 目录读取能力。

### 7.3 文件表格

列定义：

| 列       | 内容                     |
| -------- | ------------------------ |
| 名称     | 类型图标、文件名或目录名 |
| 类型     | 磁盘、文件夹、文件、未知 |
| 大小     | 仅文件显示格式化大小     |
| 修改时间 | 本地化时间，无值显示 `—` |
| 操作     | 单项下载和更多操作入口   |

排序规则：

1. 磁盘。
2. 目录。
3. 文件。
4. 同类型按中文名称自然排序。

稳定性要求：

- 表格区域使用稳定高度，加载、空目录和错误状态不得导致整页明显跳动。
- 选择状态在切换目录时清空。
- 刷新后只保留仍存在且路径一致的选中项，或更保守地全部清空。
- 大目录首期使用 Ant Design 分页或虚拟滚动之一；不得无限渲染全部行。
- 移动端将低优先级列隐藏，操作工具栏允许横向滚动或收纳为菜单。

### 7.4 会话生命周期

`useDeviceFilesSession` 负责：

- 仅在 `tab=files` 激活时建立 Relay。
- 设备、网关客户端或连接状态变化时释放旧会话。
- 组件卸载时取消活动传输并关闭 Relay。
- 连接成功后读取根目录。
- 维护 `connecting`、`ready`、`busy`、`error` 和 `disconnected` 页面状态。
- 网关断开时清理当前目录和活动传输。
- 提供显式重新连接按钮。
- 防止 React StrictMode 的旧异步结果写回新生命周期。

建议 hook 返回：

```ts
interface DeviceFilesController {
  status: FileWorkspaceStatus;
  listing?: DirectoryListing;
  error?: string;
  selectedPaths: string[];
  activeTransfer?: FileTransferView;
  archiveProgress?: FileArchiveProgress;
  connect(): Promise<void>;
  disconnect(): void;
  openDirectory(path: string): Promise<void>;
  refresh(): Promise<void>;
  createDirectory(name: string): Promise<void>;
  removeSelected(): Promise<void>;
  renameSelected(name: string): Promise<void>;
  copySelected(destination: string): Promise<void>;
  moveSelected(destination: string): Promise<void>;
  upload(file: File): Promise<void>;
  download(entry: FileEntry): Promise<void>;
  createZip(outputName: string): void;
  extractZip(destination: string): void;
  cancelTransfer(): void;
}
```

这里返回 `Promise<void>` 的无响应页面命令只用于串行完成“发送 + 自动刷新”的本地流程，不能被 UI 解释为远端操作成功。

### 7.5 静默自动刷新

按照已确认的产品要求：

- `mkdir`、`rm`、`rename`、`copy` 和 `move` 发送后自动调用目录刷新。
- 不显示成功 toast、已发送 toast或“请确认”提示。
- 自动刷新失败时显示目录级错误状态和重试入口，因为这是客户端可确定的错误。
- 刷新成功但内容未变化时保持静默。
- ZIP 和解压收到 `refresh` 事件后刷新当前目录。
- 为避免连续 `refresh` 触发并发 `ls`，使用单次飞行或防抖队列合并刷新请求。
- 如果刷新期间又收到 `refresh`，完成当前读取后再执行一次最新刷新，不丢失最终状态更新。

复制和移动没有完成信号。首期只在发送后刷新当前可见目录，不轮询、不显示结果、不等待目标出现。用户进入目标目录时会读取最新目录内容。

### 7.6 上传和下载

迁移旧弹窗的既有能力：

- 复用 `browserFileSource()`。
- 复用 `calculateBatchUploadChunkSize()`。
- 复用 `createBrowserDownload()`。
- 上传完成后静默刷新当前目录。
- 下载完成可以保留明确完成状态，因为下载协议有最终数据帧和 sink close；是否显示 toast 应与页面整体通知策略保持一致，默认只在状态栏完成，不弹出全局提示。
- 用户可取消当前上传或下载。
- 传输期间禁用目录写操作和目录导航，避免单 `FilesSession` 活动槽位冲突。
- 关闭文件标签或离开工作台时取消活动传输并释放会话。

### 7.7 ZIP 状态

页面对 `dialogmessage` 的展示：

- `zipping`：状态栏显示正在准备压缩。
- `zippingFile`：显示当前文件和进度条。
- `unzipping`：状态栏显示正在解压。
- `msg: null`：清除归档进度状态。
- `refresh`：静默刷新。
- 不显示“压缩成功”或“解压成功”。

ZIP 期间保持稳定状态栏尺寸，进度文本过长时截断并提供 tooltip，不能推动表格布局变化。

### 7.8 加载、空数据、错误、离线和权限状态

必须实现：

- 初次连接骨架或明确加载状态。
- 根目录无磁盘或当前目录为空的空状态。
- 设备离线状态。
- 网关未连接状态。
- Relay 建链失败状态。
- 目录读取失败状态和重试。
- 文件权限不明确时允许服务端最终裁决，但不得宣称已授权。
- 明确无文件权限时不建立 Relay，展示无权限状态。

为此在设备工作台模型中新增：

```ts
filesAllowed?: boolean;
```

计算逻辑复用 `canUseDeviceFiles()`，与终端和桌面权限模型保持一致。

## 8. 设备工作台接入

修改 `DeviceWorkspacePage.tsx`：

- `activeTab === 'files'` 时渲染 `DeviceFilesPanel`。
- 传入 `model.device`、`data.client`、网关连接状态和 `model.filesAllowed`。
- 文件页面内部拥有自己的消息上下文或内联错误，不依赖页面级全局成功通知。
- 切换到其他标签时卸载并释放文件 Relay；首期不在后台保留传输。

修改：

- `apps/web/src/features/device-workspace/deviceWorkspaceModel.ts`
- `apps/web/src/features/device-workspace/deviceWorkspaceModel.test.ts`
- `apps/web/src/features/device-workspace/types.ts`

增加文件权限测试：

- 具有远程控制且没有 `NoFiles` 时允许。
- 存在 `NoFiles` 时拒绝。
- 权限字段缺失时为 `undefined`，由服务端最终裁决。

## 9. 设备列表入口迁移

修改 `DevicesPage.tsx`：

- 文件管理按钮改为：

```ts
navigate(`/devices/${encodeURIComponent(device.id)}/workspace?tab=files`);
```

- 删除 `fileExplorerDevice` 状态。
- 删除 `FileUploadModal` 导入和 JSX。
- 文件入口仍在设备离线或网关未连接时禁用。
- 如果页面已有文件权限信息，明确无权限时禁用；没有信息时允许进入并由服务端裁决。

完成迁移后删除：

```text
apps/web/src/components/FileUploadModal.tsx
```

清理只属于旧弹窗的 CSS：

- `.file-explorer-modal`
- `.file-explorer-location`
- `.file-explorer-toolbar`
- `.file-explorer-table`
- `.file-explorer-upload`

保留批量上传仍使用的 `.batch-upload-*` 样式和功能。

## 10. Web 样式与响应式

在 `apps/web/src/assets/styles/device-workspace.css` 增加文件工作台样式，建议统一使用 `.device-files-*` 前缀。

桌面：

- 工具栏单行优先，次要命令进入更多菜单。
- 表格占据主要可视区域。
- 路径栏保持单行并允许横向滚动或省略。
- 传输状态栏固定在表格下方。

平板：

- 工具栏分组换行。
- 隐藏类型列或将类型并入名称列。
- 目标目录选择器使用 Modal 或 Drawer。

移动：

- 名称列保留，大小和修改时间按宽度隐藏。
- 批量命令进入操作菜单。
- 图标按钮保持稳定点击尺寸。
- 对话框输入不得超出视口。
- 文件名和路径必须可截断，不能遮挡按钮。

可访问性：

- 图标按钮提供 `aria-label` 和 tooltip。
- 表格选择、目录进入和对话框支持键盘操作。
- 删除确认后焦点返回文件表格。
- 加载状态使用 `aria-busy`。
- 连接和错误状态不只依赖颜色表达。
- 遵守 `prefers-reduced-motion`。

## 11. Web 测试计划

### 11.1 纯逻辑测试

`fileViewModel.test.ts` 覆盖：

- 磁盘、目录、文件排序。
- 文件大小和时间格式化。
- ZIP 扩展名识别。
- 单选和多选下的命令可用性。
- 目录存在时禁用复制和移动。
- 父目录计算和根目录边界。
- 刷新后选择清理。

### 11.2 Hook 和组件测试

使用可控的 Relay/Fake WebSocket 覆盖：

1. 激活文件标签后建立 `p=5` 会话并读取根目录。
2. 目录行进入子目录。
3. 新建目录发送后静默刷新，无成功 toast。
4. 删除确认后发送 `rm` 并静默刷新。
5. 重命名发送后静默刷新。
6. 复制和移动目录选择被拒绝。
7. 文件复制和移动发送正确目标路径。
8. `dialogmessage` 更新 ZIP 进度。
9. `refresh` 合并为串行目录刷新。
10. 上传和下载进度展示及取消。
11. 网关断开清理会话。
12. 离开文件标签释放 Relay。
13. 无权限、离线、空目录和目录读取失败状态。
14. 设备列表按钮跳转到 `?tab=files`，不再打开 Modal。

### 11.3 浏览器验收

至少验证：

- 桌面宽屏、窄屏、平板和移动视口无重叠。
- 长路径、长文件名、中文文件名和大量目录项。
- Windows 根目录、磁盘根目录和多级目录导航。
- 上传、下载、取消和浏览器保存文件。
- 新建、删除、重命名后的自动刷新。
- 文件复制和移动后的当前目录刷新。
- ZIP 进度、解压状态和 `refresh`。
- 中继断开、设备离线和网关重连。
- 键盘选择、按钮 tooltip、删除确认焦点和屏幕阅读器标签。

## 12. 实施顺序

### 阶段 1：Relay 消息与类型

1. 增加名称和父目录路径工具。
2. 增加文件命令消息构造器。
3. 增加 dialog/refresh 解析器和公共类型。
4. 增加构造器测试。

完成标准：所有已确认 JSON 可以通过稳定 API 精确构造，非法路径和名称在发送前被拒绝。

### 阶段 2：`FilesSession` API

1. 增加无响应命令同步方法。
2. 增加 ZIP 会话级状态和事件。
3. 调整入站路由顺序。
4. 增加断线、busy、dispose 和未知消息测试。
5. 更新包根导出和 Relay 文档。

完成标准：Relay 包可以独立完成所有已确认文件管理消息的收发，不依赖 React。

### 阶段 3：工作台静态页面

1. 建立 `DeviceFilesPanel` 静态结构。
2. 完成工具栏、路径栏、表格、状态栏和对话框。
3. 完成桌面、平板和移动响应式样式。
4. 使用静态数据验证空状态、加载、错误、无权限和长文本。

完成标准：文件标签不再显示占位页，全部控件和状态布局稳定，但尚不要求真实 Relay 操作。

### 阶段 4：工作台真实接入

1. 实现 `useDeviceFilesSession`。
2. 迁移目录、上传、下载和取消。
3. 接入新建、删除、重命名、复制和移动。
4. 接入 ZIP 和解压事件。
5. 实现静默自动刷新队列。
6. 接入文件权限。

完成标准：目标设备上所有已确认操作均通过工作台执行，页面不对无响应命令显示成功提示。

### 阶段 5：入口迁移和清理

1. 设备列表文件按钮跳转 `?tab=files`。
2. 删除旧弹窗状态和 JSX。
3. 删除 `FileUploadModal.tsx`。
4. 清理旧样式，确认批量上传不受影响。

完成标准：仓库中不再存在单设备文件管理弹窗入口，单设备文件操作统一进入工作台。

### 阶段 6：测试与文档

1. 完成 Relay 和 Web 测试。
2. 更新 `packages/relay` API 文档。
3. 更新 `docs/03-remote-control.md`。
4. 更新 `todo/README.md` 的实际完成状态，不提前勾选未覆盖能力。
5. 完成浏览器手动验收。

## 13. 完成定义

功能完成必须同时满足：

- `@meshcentral/relay` 已公开全部已确认文件管理 API。
- 无响应命令不会暴露虚假的成功结果。
- ZIP 进度和刷新事件不会被活动目录或传输操作吞掉。
- 设备工作台文件标签可浏览、上传、下载、新建、删除、重命名、复制文件、移动文件、压缩和解压。
- 操作后按约定静默自动刷新，不显示成功或已发送提示。
- 复制和移动不会对目录开放。
- 设备列表文件入口已改为工作台路由。
- 旧单设备文件管理弹窗已删除。
- 加载、空目录、错误、无权限、离线和断线状态完整。
- 桌面、平板和移动布局无重叠和文本溢出。
- 关键 Relay 与 Web 测试通过。
- 文档与 TODO 已同步实际状态。

最终验证命令：

```text
pnpm --filter @meshcentral/relay test
pnpm --filter @meshcentral/relay typecheck
pnpm --filter @meshcentral/relay lint
pnpm --filter @meshcentral/relay build
pnpm --filter @meshcentral/web test
pnpm --filter @meshcentral/web typecheck
pnpm --filter @meshcentral/web lint
pnpm --filter @meshcentral/web build
pnpm format:check
```

全仓交付前再执行：

```text
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## 14. 风险与降级策略

### 14.1 无响应操作无法确认结果

风险：消息已发送不代表 Agent 已完成操作。

处理：静默刷新目录，不显示成功提示，不根据一次目录结果判定失败。

### 14.2 复制和移动耗时不可见

风险：大文件操作可能在自动刷新时尚未完成。

处理：不轮询、不伪造进度；用户手动刷新或进入目标目录时读取最新状态。后续只有在采集到真实进度或完成消息后才增强。

### 14.3 ZIP 没有失败响应

风险：`msg: null` 和 `refresh` 不能证明压缩或解压成功。

处理：仅展示阶段和已确认进度，收到 `refresh` 后刷新，不显示成功结论。

### 14.4 单会话单活动操作

风险：目录读取、上传、下载和写命令并发会导致消息竞争。

处理：页面使用单一操作队列；传输和归档期间禁用冲突命令；刷新请求合并串行执行。

### 14.5 权限数据不完整

风险：设备快照可能没有有效权限字段。

处理：明确拒绝时阻止进入；未知时允许请求，由 MeshCentral 服务端最终授权，并正确展示建链或操作错误。

### 14.6 大目录性能

风险：大量目录项导致表格渲染和排序阻塞。

处理：首期增加分页或虚拟滚动；排序和视图模型使用纯函数并测试，不在每个单元格重复解析原始字段。

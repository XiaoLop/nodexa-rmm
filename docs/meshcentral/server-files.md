# MeshCentral 服务端存储文件接口文档

本文档专门介绍 MeshCentral **服务端集中存储（Server Files，网盘存储）**的 WebSocket 接口规范，涵盖获取目录树、读写文件内容及文件管理等所有操作。

---

## 基础信息

- **连接协议与路径**：`wss://<Server-Host>/control.ashx`
- **通信格式**：纯文本 JSON（UTF-8）
- **权限要求**：
  - 用户必须拥有服务端文件管理权限：`user.siteadmin & 8 !== 0`（`SITERIGHT_SERVERFILES`）。
  - 若访问设备组共享网盘，当前用户需具备该设备组的 `MESHRIGHT_SERVERFILES`（权限位 `0x20` / `32`）。
- **路径（`path`）通用规范**：
  - 路径采用**分段字符串数组**表示，数组第 0 项为根空间标识：
    - 用户个人网盘根路径：`["user//<userid>"]`（例如 `["user//admin"]`）
    - 设备组共享网盘根路径：`["mesh//<meshid>"]`（例如 `["mesh//d9P10xYz..."]`）
  - 子目录逐级追加到数组中，例如：`["user//admin", "docs", "scripts"]`。

---

## 接口列表

### 1. 获取完整文件目录树 (`action: "files"`)

向服务端请求当前用户可见的全部服务端存储文件与目录树状结构（包含个人专属网盘及所属设备组的共享网盘）。

#### 发送数据 (Client -> Server)

```json
{
  "action": "files"
}
```

#### 响应数据 (Server -> Client)

```json
{
  "action": "files",
  "filetree": {
    "n": "Root",
    "f": {
      "user//admin": {
        "t": 1,
        "n": "My Files",
        "maxbytes": 104857600,
        "f": {
          "documents": {
            "t": 2,
            "f": {
              "notes.txt": {
                "t": 3,
                "s": 1024,
                "d": 1710500000000
              }
            }
          },
          "readme.md": {
            "t": 3,
            "s": 512,
            "d": 1710400000000
          }
        }
      },
      "mesh//d9P10xYz...": {
        "t": 4,
        "n": "Production Group",
        "maxbytes": 524288000,
        "f": {
          "install.sh": {
            "t": 3,
            "s": 2048,
            "d": 1710300000000
          }
        }
      }
    }
  }
}
```

#### 响应字段说明

| 字段路径 | 类型 | 说明 |
| :--- | :--- | :--- |
| `action` | string | 固定为 `"files"`。 |
| `filetree.n` | string | 根节点显示名，固定为 `"Root"`。 |
| `filetree.f` | object | 根目录包含的空间字典，Key 为空间 ID（`user//<id>` 或 `mesh//<id>`）。 |
| `*.t` | number | **节点类型枚举**：<br>`1`：用户个人空间根目录（"My Files"）<br>`2`：常规子目录（Folder）<br>`3`：普通文件（File）<br>`4`：设备组共享根目录（Mesh Folder） |
| `*.n` | string | 显示名称（根目录时为 `"My Files"` 或设备组名称，子目录下由 Key 直接作为名称）。 |
| `*.maxbytes` | number | 该根空间的存储容量配额上限（字节数，Quota）。 |
| `*.f` | object | 当 `t` 为 `1`、`2`、`4` 时存在，表示该目录下的子项字典（键为文件/目录名）。 |
| `*.s` | number | 当 `t` 为 `3` 时存在，表示文件实际大小（字节数）。 |
| `*.d` | number | 当 `t` 为 `3` 时存在，表示最后修改时间戳（毫秒数，Unix Timestamp * 1000）。 |

> **提示**：该接口**不回显 `responseid`**。客户端发起查询后，通过监听返回的 `action === "files"` 捕获数据。

---

### 2. 获取文件内容 (`fileop: "get"`)

通过 WebSocket 读取服务端的指定文本或小文件内容（**文件大小需小于 200 KB**）。

#### 发送数据 (Client -> Server)

```json
{
  "action": "fileoperation",
  "fileop": "get",
  "path": ["user//admin", "documents"],
  "file": "notes.txt",
  "tag": "editor_req_1"
}
```

#### 请求字段说明

| 字段 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `action` | string | 是 | 固定为 `"fileoperation"`。 |
| `fileop` | string | 是 | 固定为 `"get"`。 |
| `path` | string[] | 是 | 所在目录分段数组。 |
| `file` | string | 是 | 目标文件名（不得包含路径分隔符 `/` 或 `\`）。 |
| `tag` | string | 否 | 自定义透传标记，服务端会原样回显。 |

#### 响应数据 (Server -> Client)

```json
{
  "action": "fileoperation",
  "fileop": "get",
  "path": ["user//admin", "documents"],
  "file": "notes.txt",
  "tag": "editor_req_1",
  "data": "SGVsbG8gV29ybGQh"
}
```

#### 响应字段说明

| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `data` | string | 文件的完整内容经 **Base64 编码** 后的字符串。 |

---

### 3. 保存/写入文件内容 (`fileop: "set"`)

通过 WebSocket 直接将文件内容写入到服务端存储中（适用于新建或修改小于 200 KB 的文件）。

#### 发送数据 (Client -> Server)

```json
{
  "action": "fileoperation",
  "fileop": "set",
  "path": ["user//admin", "documents"],
  "file": "notes.txt",
  "data": "SGVsbG8gV29ybGQh"
}
```

#### 请求字段说明

| 字段 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `action` | string | 是 | 固定为 `"fileoperation"`。 |
| `fileop` | string | 是 | 固定为 `"set"`。 |
| `path` | string[] | 是 | 目标目录分段数组。 |
| `file` | string | 是 | 目标文件名。 |
| `data` | string | 是 | 文件的完整内容（**Base64 编码字符串**）。 |

#### 响应数据 (Server -> Client)

- 该操作**无同名同步应答消息**。
- 文件写入成功后，服务端会在后台派发事件并向当前用户的 WebSocket **主动推送最新的完整文件目录树**：

  ```json
  {
    "action": "files",
    "filetree": { ... }
  }
  ```

---

### 4. 创建文件夹 (`fileop: "createfolder"`)

在指定目录下创建新子目录。

#### 发送数据 (Client -> Server)
```json
{
  "action": "fileoperation",
  "fileop": "createfolder",
  "path": ["user//admin"],
  "newfolder": "backup_docs"
}
```

#### 请求字段说明
| 字段 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `action` | string | 是 | 固定为 `"fileoperation"`。 |
| `fileop` | string | 是 | 固定为 `"createfolder"`。 |
| `path` | string[] | 是 | 父级目录路径数组。 |
| `newfolder` | string | 是 | 新文件夹名称（不能包含非法字符 `\ / : * ? " < > |`，且不能以 `.` 开头）。 |

#### 响应数据 (Server -> Client)
- 创建成功后，服务端主动推送最新的 `{"action": "files", "filetree": ...}`。

---

### 5. 删除文件或文件夹 (`fileop: "delete"`)

删除指定目录下的一个或多个文件/子文件夹。

#### 发送数据 (Client -> Server)
```json
{
  "action": "fileoperation",
  "fileop": "delete",
  "path": ["user//admin", "documents"],
  "delfiles": ["old_notes.txt", "temp_folder"],
  "rec": true
}
```

#### 请求字段说明
| 字段 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `action` | string | 是 | 固定为 `"fileoperation"`。 |
| `fileop` | string | 是 | 固定为 `"delete"`。 |
| `path` | string[] | 是 | 目标所在目录数组。 |
| `delfiles` | string[] | 是 | 要删除的文件或文件夹名称数组。 |
| `rec` | boolean | 否 | 是否递归删除子目录下的所有内容。默认 `false`；删除非空文件夹时需设为 `true`。 |

#### 响应数据 (Server -> Client)
- 删除成功后，服务端主动推送最新的 `{"action": "files", "filetree": ...}`。

---

### 6. 重命名文件或文件夹 (`fileop: "rename"`)

#### 发送数据 (Client -> Server)
```json
{
  "action": "fileoperation",
  "fileop": "rename",
  "path": ["user//admin", "documents"],
  "oldname": "notes.txt",
  "newname": "notes_v2.txt"
}
```

#### 请求字段说明
| 字段 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `action` | string | 是 | 固定为 `"fileoperation"`。 |
| `fileop` | string | 是 | 固定为 `"rename"`。 |
| `path` | string[] | 是 | 目标所在目录数组。 |
| `oldname` | string | 是 | 原文件/文件夹名称。 |
| `newname` | string | 是 | 新文件/文件夹名称。 |

#### 响应数据 (Server -> Client)
- 重命名成功后，服务端主动推送最新的 `{"action": "files", "filetree": ...}`。

---

### 7. 复制与移动文件 (`fileop: "copy"` / `"move"`)

将一个或多个文件从源目录复制或移动到目标目录。

#### 发送数据 (Client -> Server)
```json
{
  "action": "fileoperation",
  "fileop": "copy",
  "scpath": ["user//admin", "documents"],
  "path": ["user//admin", "backup_docs"],
  "names": ["notes_v2.txt"]
}
```

#### 请求字段说明
| 字段 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `action` | string | 是 | 固定为 `"fileoperation"`。 |
| `fileop` | string | 是 | 操作类型：`"copy"`（复制）或 `"move"`（移动）。 |
| `scpath` | string[] | 是 | 源目录路径数组（Source Path）。 |
| `path` | string[] | 是 | 目标目录路径数组（Destination Path）。 |
| `names` | string[] | 是 | 需要复制或移动的文件/目录名称数组。 |

#### 响应数据 (Server -> Client)
- 操作成功后，服务端主动推送最新的 `{"action": "files", "filetree": ...}`。

---

### 8. 获取会话录制文件列表 (`action: "recordings"`)

获取保存在服务端的远程桌面与终端会话录制文件列表（`.mcrec`）。

#### 发送数据 (Client -> Server)
```json
{
  "action": "recordings",
  "limit": 50,
  "tag": "req_rec_1"
}
```

#### 请求字段说明
| 字段 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `action` | string | 是 | 固定为 `"recordings"`。 |
| `limit` | number | 否 | 返回最新记录的数量限制，不传则返回全量记录。 |
| `tag` | string | 否 | 请求标记，服务端会原样回显。 |

#### 响应数据 (Server -> Client)
```json
{
  "action": "recordings",
  "tag": "req_rec_1",
  "events": [
    {
      "time": "2026-03-01T08:30:00.000Z",
      "filename": "rec-nodeid-1710000000.mcrec",
      "nodeid": "node//abc...",
      "meshid": "mesh//xyz...",
      "present": 1
    }
  ]
}
```

#### 响应字段说明
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `events` | object[] | 录制事件数组。 |
| `events[].time` | string | 录制创建时间（ISO 8601）。 |
| `events[].filename` | string | 录制文件名。 |
| `events[].nodeid` | string | 产生录制的设备 ID。 |
| `events[].meshid` | string | 产生录制的设备组 ID。 |
| `events[].present` | number | `1` 表示该录制文件在磁盘上实际存在。 |

---

## 典型使用流程示例

```text
[Client]                                              [MeshCentral Server]
   |                                                           |
   |--- 1. 连接 WebSocket (wss://host/control.ashx) ----------->|
   |<-- (完成身份鉴权与握手) -----------------------------------|
   |                                                           |
   |--- 2. {"action": "files"} -------------------------------->|
   |<-- 3. {"action": "files", "filetree": {...}} -------------|
   |       (客户端解析 filetree 树形目录并展示)                    |
   |                                                           |
   |--- 4. {"action": "fileoperation", "fileop": "get", ...} ->|
   |<-- 5. {"action": "fileoperation", "data": "<base64>"} ----|
   |       (客户端解码 Base64 并在界面中编辑文本)                 |
   |                                                           |
   |--- 6. {"action": "fileoperation", "fileop": "set", ...} ->|
   |<-- 7. {"action": "files", "filetree": {...}} (广播刷新) ---|
   |                                                           |
```

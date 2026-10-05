# 04 - 远程会话录制通知协议分析 (`Recording`)

## 一、录制生命周期消息对照

| 阶段 | 服务端是否主动推送 | 消息特征 | 说明 |
| --- | --- | --- | --- |
| **录制开始** | **否** | 无 WebSocket 外部事件 | 服务端创建 `.mcrec` 文件句柄并写入头块，仅在内部输出 debug 日志（`Relay: Started recording to file: ...`） |
| **录制结束** | 隐式 | 依赖中继连接关闭事件 | 客户端与设备端断开连接，触发 `ws.on('close')`，中继层捕获并启动 5 秒延迟处理流程 |
| **文件就绪/入库** | **是** | `action: "event"`, `event.action: "recording"` | 写入录制尾块（`MeshCentralMCREC`）、关闭文件句柄、完成可选索引加速后，正式派发通知 |

---

## 二、完整脱敏样本与字段定义

### 1. 完整脱敏样本

```json
{
  "action": "event",
  "event": {
    "etype": "relay",
    "action": "recording",
    "domain": "",
    "nodeid": "node//abc123def456",
    "meshid": "mesh//xyz789uvw012",
    "meshname": "Production Servers",
    "name": "Database-Node-01",
    "icon": 2,
    "userids": [
      "user//admin"
    ],
    "protocol": 1,
    "filename": "2026-10-05-10-15-20-node-abc123def456.mcrec",
    "size": 4194304,
    "startTime": 1791202520000,
    "lengthTime": 120,
    "msg": "Finished recording session, 120 second(s)"
  }
}
```

### 2. 字段详细对照表

| 字段路径 | 类型 | 必填 | 含义 | 单位/格式 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `action` | string | 是 | 顶层指令 | 固定为 `"event"` | `confirmed` |
| `event.etype` | string | 是 | 事件大类 | 固定为 `"relay"` | `confirmed` |
| `event.action` | string | 是 | 子事件名称 | 固定为 `"recording"` | `confirmed` |
| `event.domain` | string | 否 | 域标识 | 字符串，如 `""` | `confirmed` |
| `event.nodeid` | string | 是 | 关联受管设备 ID | 形如 `"node//..."` | `confirmed` |
| `event.meshid` | string | 否 | 关联设备组 ID | 形如 `"mesh//..."` | `confirmed` |
| `event.meshname` | string | 否 | 设备组名称 | 纯文本 | `confirmed` |
| `event.name` | string | 否 | 设备主机名 | 纯文本 | `confirmed` |
| `event.icon` | number | 否 | 设备类型图标编号 | 数值 | `confirmed` |
| `event.userids` | Array | 否 | 参与此会话的用户 ID 列表 | `["user//admin"]` | `confirmed` |
| `event.protocol` | number | 否 | 录制协议代码 | 数值枚举 | `1`: 远程桌面 (KVM), `2`: 终端 (Terminal), `100/101`: Intel AMT 重定向, `200`: Messenger 聊天 |
| `event.filename` | string | 是 | 生成的录制文件名 | 纯文件名（非绝对路径） | 后缀通常为 `.mcrec` |
| `event.size` | number | 是 | 最终录制文件字节大小 | 字节 (Bytes) | `confirmed` |
| `event.startTime` | number | 否 | 会话启动时间戳 | 毫秒 Unix Epoch | `confirmed` |
| `event.lengthTime` | number | 否 | 会话实际持续有效时长 | 秒 (Seconds) | 扣除延迟校准后的真实时长 |
| `event.msg` | string | 否 | 英文摘要描述 | 纯文本 | 如 `"Finished recording session, 120 second(s)"` |

---

## 三、关键问题与工程结论

### 1. 谁可以收到此消息？

服务端分发目标为：
`obj.parent.DispatchEvent(['*', 'recording', ws.logfile.nodeid, ws.logfile.meshid], obj, event)`。
所有订阅了该设备、该设备组或拥有全站审核权限（Site Admin）的在线用户，且在 `ws.HandleEvent` 中通过设备组权限校验者，均会收到此推送。

### 2. 是否只推送一次？

**是**。仅在录制文件最终关闭并索引完毕的瞬间派发一次。

### 3. 原生前端的表现行为

源码位置：`views/default.handlebars` 第 3447 行：
```javascript
case 'recording': {
    if ((p52recordings != null) && (typeof p52recordings == 'object')) {
        p52recordings.unshift(message.event);
        message.event.present = 1;
        updateRecordings();
    }
    break;
}
```
原生 Web 前端**仅在管理员正处于或随后进入“录制文件列表”页面时增量更新内存数组，并未调用 `addNotification` 触发桌面通知或声音**。

### 4. 录制通知的最佳工程实践建议

对于现代 Web 通知中心系统：
- **触发时机**：捕获到 `event.action === "recording"` 时；
- **派生标题**：`"会话录制就绪"`；
- **派生文案**：`"设备 {event.name} 的远程会话已完成录制，文件大小: {niceSize(event.size)}，时长: {event.lengthTime} 秒"`；
- **点击行为**：路由导航至该设备的录制文件面板（Recordings tab），并高亮该 `filename`。

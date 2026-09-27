# MeshCentral 插件开发指南

本文档全面梳理了 MeshCentral 插件体系的架构原理、生命周期、目录规范、核心 Hook 及通信机制，帮助开发者快速构建符合规范的扩展插件。

---

## 1. 架构与运行机制

MeshCentral 的插件系统基于 **Node.js (服务端)** 与 **Handlebars / 浏览器原生 JS (前端)** 双端架构：

* **服务端引擎**：由 `pluginHandler.js` 统一管理生命周期。插件拥有对 Express 应用、数据库（NeDB/MongoDB）及底层 WebSocket 消息总线的完整访问权限。
* **前端注入**：服务端可通过 `obj.exports` 将指定的函数序列化并自动注入到浏览器端（运行在 `pluginHandler.<shortName>` 命名空间下）。
* **Agent 端扩展**：支持将 JS 模块打包进 MeshCore，随 Agent 分发到受控客户端执行。

---

## 2. 环境准备与启用

在 MeshCentral 数据配置文件 `meshcentral-data/config.json` 的 `settings` 节点下开启插件支持：

```json
{
  "settings": {
    "plugins": {
      "enabled": true,
      "list": ["myplugin"]
    }
  }
}
```

> **提示**：
>
> * `enabled: true`：全局启用插件系统。
> * `list: [...]`：**本地调试必备**。配置后服务器启动时会直接从本地磁盘加载指定插件，跳过数据库在线安装流程。

---

## 3. 标准目录结构

插件放置在 `meshcentral-data/plugins/<shortName>/` 目录下。**文件夹名、主入口文件名以及 `config.json` 中的 `shortName` 必须保持绝对一致（纯英文/数字）**。

```text
meshcentral-data/
  └── plugins/
      └── myplugin/
          ├── config.json               # [必选] 插件元数据与配置清单
          ├── myplugin.js               # [必选] 插件服务端主入口 (文件名 = shortName.js)
          ├── views/                    # [可选] 插件专属 Handlebars 视图模板
          │   └── admin.handlebars
          └── modules_meshcore/         # [可选] 注入到 Agent 终端执行的 JS 模块
              └── myAgentModule.js
```

---

## 4. 配置文件规范 (`config.json`)

MeshCentral 加载时会严格校验该配置的结构完整性，以下为标准模板：

```json
{
  "name": "My Custom Plugin",
  "shortName": "myplugin",
  "version": "1.0.0",
  "description": "MeshCentral 自定义扩展插件",
  "author": "YourName",
  "homepage": "https://github.com/yourname/myplugin",
  "changelogUrl": "https://raw.githubusercontent.com/yourname/myplugin/master/changelog.txt",
  "configUrl": "https://raw.githubusercontent.com/yourname/myplugin/master/config.json",
  "downloadUrl": "https://github.com/yourname/myplugin/archive/master.zip",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourname/myplugin.git"
  },
  "meshCentralCompat": ">=1.0.0",
  "hasAdminPanel": false
}
```

* 本地开发调试时，`downloadUrl`、`configUrl` 等可填占位地址，但字段必须存在且类型正确。
* `hasAdminPanel: true`：会在服务器“我的服务器 / 插件管理”中显示专属配置入口。

---

## 5. 主入口开发 (`myplugin.js`)

入口文件导出一个工厂函数，接收 `pluginHandler` 上下文。

```javascript
module.exports.myplugin = function (pluginHandler) {
    var obj = {};
    var parent = pluginHandler.parent; // parent 即 MeshCentralServer 核心实例

    // ==========================================
    // 1. 声明需要导出到浏览器前端的函数列表
    // ==========================================
    obj.exports = ['onWebUIStartupEnd', 'callMyAction'];

    // ==========================================
    // 2. 服务端生命周期 Hook
    // ==========================================

    // 服务完全启动就绪
    obj.server_startup = function () {
        console.log('[myplugin] 插件启动成功！');
    };

    // 注册 HTTP 路由（在核心原生路由注册前执行）
    obj.hook_setupHttpHandlers = function (webserver, meshServer) {
        var app = webserver.app;

        // 示例：添加自定义 HTTP API
        app.get('/api/myplugin/status', function (req, res) {
            res.json({ status: 'ok', time: Date.now() });
        });

        // 示例：添加/拦截登录接口
        app.post('/api/custom-login', webserver.bodyParser.json(), function (req, res) {
            var username = req.body.username;
            var domain = meshServer.config.domains[''];
            var userid = 'user/' + domain.id + '/' + username;

            // 写入 Session 视为合法登录
            req.session.userid = userid;
            req.session.ip = req.clientIp;
            webserver.setSessionRandom(req);

            res.json({ success: true });
        });
    };

    // 用户登录完成时触发
    obj.hook_userLoggedIn = function (user) {
        console.log('[myplugin] 用户已登录:', user.name);
    };

    // 处理来自浏览器前端的 WebSocket 消息
    obj.serveraction = function (command, myObject, user) {
        console.log('[myplugin] 收到用户指令:', user.name, command);
        if (command.subAction === 'ping') {
            // 向当前用户回发数据
            myObject.send({
                action: 'plugin',
                plugin: 'myplugin',
                response: 'pong'
            });
        }
    };

    // ==========================================
    // 3. 设备详情页专属面板 (Device Tab)
    // ==========================================
    obj.on_device_header = function () {
        return '<span id="p19ph-mypluginTab" onclick="pluginHandler.callPluginPage(\'mypluginTab\', this);">自定义面板</span>';
    };

    obj.on_device_page = function () {
        return '<div id="mypluginTab" style="display:none;"><h3>设备自定义扩展内容</h3></div>';
    };

    // ==========================================
    // 4. 浏览器前端函数 (由 MeshCentral 注入到客户端执行)
    // ==========================================
    obj.onWebUIStartupEnd = function () {
        console.log('[myplugin-frontend] Web 界面加载完毕');
        // 可使用原生前端 API:
        // pluginHandler.registerPluginTab({ tabId: 'myGlobalTab', tabTitle: '全局扩展' });
    };

    obj.callMyAction = function () {
        // 向服务端发送 WebSocket 命令
        meshserver.send({
            action: 'plugin',
            plugin: 'myplugin',
            subAction: 'ping'
        });
    };

    return obj;
};
```

---

## 6. 核心 Hook 矩阵参考

| Hook / 方法名 | 执行环境 | 触发时机 / 用途 | 常见使用场景 |
| :--- | :--- | :--- | :--- |
| `server_startup` | 服务端 | MeshCentral 完成启动就绪时 | 初始化插件数据库、启动后台定时任务 |
| `hook_setupHttpHandlers` | 服务端 | Web 路由装配时（早于 `/login`） | 添加新 API、对接 SSO、修改/拦截登录 |
| `hook_userLoggedIn` | 服务端 | 用户身份验证成功后 | 登录审计、推送多渠道登录通知 |
| `hook_agentCoreIsStable` | 服务端 | 远程 Agent 建立稳定长连接时 | 自动分发配置、触发资产盘点 |
| `hook_processAgentData` | 服务端 | 收到 Agent 原始上报数据包时 | 拦截/分析自定义 Agent 数据 |
| `serveraction` | 服务端 | 浏览器端通过 `meshserver.send` 通信时 | 处理前后端异步交互业务逻辑 |
| `on_device_header` | 服务端 | 生成设备详情页 Tab 头时 | 向设备详情页添加自定义 Tab 按钮 |
| `on_device_page` | 服务端 | 生成设备详情页 Tab 面板时 | 向设备详情页输出自定义 HTML 面板 |
| `onWebUIStartupEnd` | 前端 | 浏览器端控制台主界面就绪后 | DOM 增强、注册全局导航 Tab、启动前端轮询 |
| `onDeviceRefreshEnd` | 前端 | 设备视图刷新完毕时 | 更新设备自定义面板中的数据 |

---

## 7. 前后端与 Agent 通信机制

### 7.1 Web 前端 ⇄ 服务端交互

* **前端向服务端发送**：

  ```javascript
  meshserver.send({
      action: 'plugin',
      plugin: 'myplugin',
      // 自定义载荷
      op: 'queryData',
      id: 123
  });
  ```

* **服务端接收**：在 `obj.serveraction = function(command, myObject, user)` 中接收。
* **服务端响应前端**：调用 `myObject.send(...)` 或使用 `parent.DispatchEvent(...)` 广播事件。

### 7.2 Agent 客户端模块扩展 (`modules_meshcore/`)

如果插件目录下存在 `modules_meshcore/` 目录，里面的 `.js` 文件会在 Agent 编译核心代码时被自动打包注入。

* 命名规则：
  * `amt-*`：仅下发给支持 Intel AMT 的平台。
  * `win-*`：仅下发给 Windows 平台。
  * `linux-*`：仅下发给 Linux 平台。
  * 其他名称：下发给全平台。
* Agent 端可以直接 `require('模块名')` 执行端侧采集或执行操作。

---

## 8. 开发与调试建议

1. **热加载测试**：
   在配置了 `plugins.list` 的前提下，修改服务端代码后，重启 MeshCentral 进程（`node meshcentral`）即可生效。
2. **Session 必须项**：
   在任何自定义登录逻辑中，设置完 `req.session.userid` 后，务必调用 `webserver.setSessionRandom(req)`，否则后续 WebSocket 握手会因缺少校验串而断开。
3. **数据隔离规范**：
    若需存储插件独有数据，建议利用 `parent.db.Set` / `parent.db.Get` 存取键值，键名前缀统一规范为 `plugin_myplugin_*`，避免键名污染。

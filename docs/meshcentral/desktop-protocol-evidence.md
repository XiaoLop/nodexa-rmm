# MeshCentral 桌面协议资料核查

## 证据范围

本报告是当前 checkout 的静态源码核查，不是成功连接的抓包报告。尚无目标 MeshCentral URL、授权测试设备、运行配置、浏览器版本、真实双向原始负载或截图。下面的示意与建议不代表已实测。

## 1. 版本与环境

- checkout：`D:\web\MeshCentral`。
- package.json:3：版本 `1.1.54`。
- Git HEAD：`02eb8f71d2ce48bdbd59e4e4d4844b7edaf0e69d`。
- Git 提交说明：`Fix: keyboard stops working after desktop reconnect (#8135)`。
- 当前执行环境：Windows AMD64，Node `v24.9.0`；package.json:59–60 要求 Node >=20。这不是部署端或被控端环境证明。
- 工作树已有删除：agents/MeshCmd.exe、MeshCmd64.exe、MeshService.exe、MeshService64.exe；本次未修改或恢复这些文件。
- Windows/Linux/macOS 实际 Agent 版本：未取得。meshagent.js:531–552 从 Agent 认证命令 3 读取 infoVersion、agentId、agentVersion、platformType、capabilities；agentVersion 在偏移 10，是独立于服务器包版本的字段。不能用 1.1.54 代替 Agent 版本。
- meshcentral.js:3232–3283 定义平台/架构映射，例如 Windows x64 service=4，Linux x64=6，macOS Intel=16，macOS ARM64=29。agents/hashagents.json 是打包文件 hash/size/mtime 清单，不是在线 Agent 的版本证据。
- 首期支持范围尚未指定。建议先 Windows 10/11 x64 + Chromium Chrome/Edge + 单屏 + WebSocket + 不录制建立基线，再分别测试录制、同意、多屏和 Linux/macOS。此为建议而非已承诺支持范围；浏览器应记录准确版本，Linux 应区分 X11/Wayland。
- 录制、同意、隐私、多显示器的实际启用状态均未知。sample-config.json 是示例，不能作为运行配置。
- meshcentral-config-schema.json:3025–3085 区分 localSessionRecording 与 sessionRecording；protocols 中 2 为桌面。2436 的 desktopprivacybar 是提示条，不应直接解释为远端黑屏隐私模式。

## 2. 传输层已确认事实

public/scripts/agent-redir-ws-0.1.1.js:

- 59–78：浏览器 relay URL 带 browser=1、p、nodeid、id，可带 auth；Agent tunnel value 为 `*/<domain>/meshrelay.ashx?p=...&nodeid=...&id=...`（具体域路径按 domainUrl 拼接），可带 rauth；消息 action=msg、type=tunnel，usage=obj.protocol。
- 82–96：WebSocket 打开时可发送 ctrlChannel=102938/type=rtt；不能假定握手 c/cr 是整个连接的第一个消息。
- 151–158：收到文本 c 或 cr 后，cr 设置 serverIsRecording=true；有 options 则先发 options JSON，再 socket.send(obj.protocol)，然后切换 state=3。WebSocket 的数字参数会成为文本，不是两字节二进制整数。
- 99–126：文本控制消息包括 console、metadata、rtt、WebRTC 协商、ping/pong。
- 160–189、262–281：可能切换到 RTCDataChannel。首轮关闭 WebRTC，或同时采集 DataChannel；否则只抓 WebSocket 不完整。
- 203–235：二进制普通命令头为大端 uint16 command、uint16 size；命令 27/size=8 是 jumbo 外包头，内部长度使用外包头 5–7 字节，内部命令从偏移 8 开始。
- 226–235：源码说明 Agent 会填充到 8 字节边界；完整命令可能短于消息负载，只在确实不足时累积，完整时去掉填充后交给解码器。必须保留原始消息，不应在抓包阶段去掉填充或外包头。

### 2.1 authcookie、启动顺序与录制

- meshuser.js:6471–6478：主控制通道请求 `{"action":"authcookie"}`，回应 `{"action":"authcookie","cookie":"<opaque>","rcookie":"<opaque>"}`。cookie 加密内容包含 userid/domainid/ip；rcookie 包含 ruserid/x。若用户所谓 Gateway 是另一个自建网关，其额外封装仍未提供。
- public/scripts/agent-desktop-0.0.2.js:37 明确 protocol=2。因此此版本 **Mesh Agent KVM** 的 relay `p=2`、tunnel `usage=2`。这不等于 RDP、AMT 等其它路径都使用 2。
- meshuser.js:1029–1091：服务器核对 tunnel nodeid，补充 TLS hash、同意选项、userid 等再路由。只有请求带 responseid 时才安排 `action:msg, result:OK/Unable to route, responseid, tag` 路由回应；OK 不是 Agent 已出图或用户已同意。不要假设普通 tunnel 请求一定有一条同步成功响应。
- agents/meshcore.js:3473–3489：Agent 先等待 c/cr，再解析 options 与协议数字，受 usages 白名单约束。
- 桌面模块 state=3 本身并不无条件发送一组 KVM 启动二进制（agent-desktop:103–118）。收到 cmd7 屏幕尺寸后，在尺寸变化路径才 SendCompressionLevel、SendUnPause、SendRemoteInputLock(2)（202–216）；该 case 还释放修饰键并发 cmd14 触控初始化（243–251）。应按真实回包重建序列，不写死 c 后直接首帧。
- meshrelay.js:435–579：录制策略选择、打开录制文件；成功写头后发 cr，打开失败可以退回 c，非录制发 c。c/cr 是 relay 就绪标记，不是用户同意或首帧确认。
- 在线 metadata：agents/meshcore.js:3647–3664 广播 ctrlChannel=102938/type=metadata 的用户会话信息；与 meshrelay.js:532–546 写入录制文件的 MeshCentralRelaySession 头（user/session/IP/time/protocol/node 等）是两个概念。

补充认证和路由边界：webserver.js:9218–9229 对 auth 查询参数按60分钟参数解码，多服务器可尝试 serverKey，并检查IP、用户、域；9238–9245 的立即拒绝分支被注释，因此不能声称坏cookie在该处一定直接断开。meshrelay.js:183–190 对 rauth 使用240分钟解码参数。这是源码参数，不是本次实测的有效期。

**普通 relay 分析的适用范围**：webserver.js:7486–7493 在全局或域启用 desktopmultiplex 且 p==2 时，实际选择 meshdesktopmultiplex.js，否则选择 meshrelay.js。因此本报告引用 meshrelay.js 的 c/cr、录制与转发路径不能无条件套用于 multiplex 部署；后者需要独立核查和采集。

### 2.2 画面与输入命令表

下表证据来自 public/scripts/agent-desktop-0.0.2.js，偏移从普通命令头起算，长度含4字节头；多字节数字为大端。它是源码协议说明，不是实测帧。

| 命令 | 源码结构/语义 | 行号 |
| --- | --- | --- |
| 3 图块 | X:u16@4、Y:u16@6，图像负载@8；尺寸由图像解码得到，不单列宽高/codec | 131–161,219–241 |
| 7 屏幕尺寸 | 总长8，width:u16@4、height:u16@6 | 202–216,243–251 |
| 5 编码参数 | 总长10，type:u8、quality:u8、scaling:u16、frameTimer:u16；注释类型1 JPEG/2 PNG/3 TIFF/4 WebP，默认1/50/1024/100 | 52–55,190–195 |
| 6 刷新 | 总长4，无负载 | 198–199 |
| 8 暂停 | 总长5，0恢复/1暂停 | 178–187 |
| 2 鼠标 | 普通总长10，保留0@4、flags@5、X:u16@6、Y:u16@8；移动0，左按/放2/4，右8/16，中32/64；专用双击0x88 | 584–655 |
| 2 滚轮 | 总长12，flags=0，X/Y后追加两字节delta；负值发送实现按逐字节反码，不能未经验证按标准int16补码解释 | 603–623 |
| 1 键盘 | 总长6，flag:u8@4、keycode:u8@5；普通按/放0/1，扩展按/放4/3；包含DOM键码转换 | 404–518 |
| 85 Unicode | 总长7，flag=0按下/1释放，UTF-16代码单元:u16；JS charCodeAt逐单元发送，非UTF-8或32位码点 | 522–534,661–685 |
| 10 CAD | 总长4，无负载；专用命令而非必须模拟三键 | 536–540 |
| 11 显示器列表 | 请求总长4；回复count:u16@4，后接count个ID:u16和selectedID:u16，65535为全部显示器 | 253–265,635 |
| 12 切屏 | 总长6，displayID:u16 | 636 |
| 82 显示器几何 | 每10字节一组id/x/y/w/h，均u16；当前处理只构造局部screenInfo | 298–303 |
| 87 输入锁 | 总长5，0解锁/1锁定/2查询 | 497–498,304–309 |

图块通过 new Image 解码，客户端硬编码 `data:image/jpeg;base64`，drawImage(tile,x,y) 局部覆盖，其余画布保留；异步解码由本地队列保持绘制顺序。没有此路径可见的整帧边界或像素XOR差分。真实图像编码必须检查负载魔数，不能只凭 MIME 或请求类型确认。上述 compression scaling/timer 的单位与各平台 Agent 支持情况未实测。

CopyRect 函数存在（168–175），但当前 ProcessBinaryCommand switch 没有 case4，不能宣称该接收路径已经支持 CopyRect。jumbo 写出用32位长度（953–959），当前 redir 接收却只用低24位；不能据写出格式声称接收支持完整32位长度。

鼠标坐标经 CSS/画布缩放和逆旋转转换，不是相对位移。拖动应关联按下、移动、释放；双击应区分此专用命令和 UI 生成的点击序列。Unicode 注入不能替代中文 IME 实测；代理对、组合输入和安全桌面 CAD 需要按实际 Agent 验证。

### 2.3 控制功能与限制

- 剪贴板走主控制/Agent msg 通道，不是 KVM 图块命令：`{action:'msg',type:'getclip',nodeid,tag}` 与 `{action:'msg',type:'setclip',nodeid,data}`（views/default.handlebars:8677–8691）。meshuser.js:1023–1025 按 domain.clipboardget/clipboardset 拒绝，可能直接不回复。
- agents/meshcore.js:1604–1665：getclip 成功且字符串 truthy 才返回 data；空字符串/拒绝/失败不能简单混为一种状态。setclip 仅处理字符串，pendingSetClip 防并发；写入路径依平台/服务模式不同。此次未确认超大文本的统一字节上限，应逐级测试并检查网关/WS/Agent各层限制，不编造1MB等阈值。
- 用户同意：agents/meshcore.js:3693–3746（位8），含无人登录、锁屏、超时自动接受配置；3134–3198 有 console 等待/拒绝/接受消息，3250–3255 在接受后 pipe/resume。另有同意缓存，不应让缓存污染同意测试。
- 仅查看：agents/meshcore.js:3681–3691 在此路径不接入输入 pipe，非键鼠控制过滤有 TODO。desktopmultiplex 启用时由 multiplexor 执行查看限制（meshuser.js:1042–1043），需要另立测试维度，不能用客户端不发键鼠代替服务端权限校验。
- privacy bar：agents/meshcore.js:3096–3125,3211–3247，consent 0x40；平台可能不支持，关闭提示条可能结束 KVM 会话。不是已经验证的黑屏模式。
- 正常客户端 Stop 可先发 ctrl close 再关闭 WebSocket（agent-redir:307–323）；Agent close 处理在 meshcore:4419–4428。实际异常关闭码、拒绝时序必须抓包。

## 3. 采集器与交付格式

当前 Git 跟踪文件未找到 captureHelpers.ts，也没有跟踪的 TypeScript 文件；不能核实 captureHelpers.ts:88。工具 glob/grep 的 ripgrep 启动失败，因此采用 git ls-files/git grep 定位、read 阅读源码；未穷尽所有未跟踪的嵌套目录。

需要提供该文件实际路径或内容后再修改。原始二进制仅有长度不能恢复画面、输入字段或重放会话。

建议每个 case 交付：

```text
case-id/
  manifest.json          # 服务端/Agent/浏览器/OS、配置、显示器/DPI、传输类型
  connections.json      # 每条连接端点角色、脱敏URL、关联tunnel id
  messages.jsonl        # 顺序、方向、类型、时间、完整负载引用
  payloads/000001.bin    # 原始应用消息二进制，不截断
  actions.jsonl         # 单一操作、坐标系、键值、开始/结束时间和对应seq
  screenshots/          # 被控端截图及浏览器解码结果截图
  closes.jsonl          # close事件、code、reason、wasClean、时间、观察端
```

messages 字段至少包含：sessionId、connectionId、seq、direction（明确 browser->relay / relay->browser / server->agent 等端点）、transport、kind（text/binary）、UTC 时间、单调时钟、byteLength、payloadFile 或完整 base64、SHA-256。文本保留原内容及 UTF-8 字节。截屏记录关联消息 seq、采集时钟、桌面尺寸、DPI/缩放、屏幕选择和操作编号。跨设备时钟记录同步方式/误差，不能凭时间戳伪造严格全局顺序。

不要把应用 WebSocket message 和 RFC6455 wire frame 混称：浏览器 onmessage 通常拿到重组后的应用消息，没有 FIN、mask、continuation、控制帧原字节。解码器开发至少要完整应用消息；如果要求真正 wire frame，还要增加适当的服务端/网络层采集及 TLS 解密条件。浏览器 API 也看不到 server<->agent 认证主连接；该连接需要服务端/Agent 侧观测。

close code 是 close 事件字段，不应在每个数据帧虚填 1000。1006 是本地报告的异常关闭状态，不是对端发来的线上 Close code。错误、拒绝控制消息和 close 事件都保留，不预设不同故障对应固定 code。

安全：只用授权测试设备/账户和合成桌面；authcookie/auth/rauth 是凭据。完整原始包受限保存，共享包脱敏凭据；二进制画面保留原样。录制/剪贴板可能包含私人数据，不上传真实密码、隐私桌面或生产剪贴板。

## 4. 必须补齐的实测矩阵

以下均未采集：

1. c / cr：从 Gateway/control 登录及 authcookie、Agent tunnel、relay 建立，到第一幅完整可见桌面、正常退出的完整双向消息；分别记录不录制/录制，保留 metadata、RTT 和任何额外控制消息。不要只截 c/cr 后几帧。
2. 画面：固定分辨率下首次完整桌面；只改已知小矩形；纯色 RGB/黑白、棋盘格、文字；窗口移动；动态画面；分辨率变更；锁屏/解锁/登录界面。每份抓包对应被控端和解码后截图。首次完整画面可能是多块拼合，不等于第一条二进制消息。
3. 输入：鼠标移动，各按钮按下/释放，双击、拖动、滚轮；普通键、修饰键、功能键、方向键；CAD；中文 IME 和 Unicode 注入分别测试。每个 case 单一已知动作，记录桌面坐标与浏览器显示坐标/DPI转换、物理 key/code、修饰状态、按下/释放及消息 seq。
4. 控制：显示器列表/切换/全部显示器，质量/色深/帧率/压缩，剪贴板读/写/拒绝/边界，客户端仅查看与服务端输入权限分别测试，同意/拒绝/超时/锁屏策略；隐私条与黑屏/本地输入阻断分别验证。
5. 故障：Agent 主动断开、设备离线、网络中断、权限/服务器拒绝；保留所有控制消息、错误、close 事件与服务端日志。测试必须局限于授权设备，避免中断生产用户。

现阶段没有完整帧序列、真实图块样本、截图或测得的关闭码。源码可提供实现依据，但不足以宣称解码器已通过兼容性验证。

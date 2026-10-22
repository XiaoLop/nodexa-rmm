import type { Locale } from "./config";

type TextPair = { title: string; description: string };
type Stat = { value: string; label: string };

export type Dictionary = {
  metadata: { title: string; description: string };
  accessibility: { skipToContent: string; heroTabsLabel: string; showcaseTabsLabel: string; openMenu: string; closeMenu: string };
  header: {
    homeLabel: string;
    navigationLabel: string;
    capabilities: string;
    showcase: string;
    automation: string;
    security: string;
    deployment: string;
    console: string;
    contact: string;
    languageLabel: string;
    languageShort: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    description: string;
    primaryAction: string;
    secondaryAction: string;
    proofLabel: string;
    proofs: [string, string, string];
    consoleAlt: string;
    availability: string;
    latency: string;
    liveWorkspace: string;
    quickViews: {
      workspace: string;
      dashboard: string;
      devices: string;
    };
    stats: [Stat, Stat, Stat, Stat];
  };
  showcase: {
    kicker: string;
    title: string;
    titleAccent: string;
    description: string;
    previewBadge: string;
    tabs: Array<{ id: string; name: string; title: string; subtitle: string; description: string; tag: string; highlights: [string, string, string] }>;
  };
  capabilities: {
    kicker: string;
    title: string;
    titleAccent: string;
    description: string;
    learnMore: string;
    items: TextPair[];
  };
  workflow: {
    kicker: string;
    title: string;
    titleAccent: string;
    description: string;
    link: string;
    steps: [{ label: string; detail: string }, { label: string; detail: string }, { label: string; detail: string }, { label: string; detail: string }];
    commandResult: string;
  };
  mobile: {
    kicker: string;
    title: string;
    titleAccent: string;
    description: string;
    imageAlt: string;
    badgeTitle: string;
    badgeDescription: string;
    features: [TextPair, TextPair, TextPair];
  };
  security: {
    kicker: string;
    title: string;
    titleAccent: string;
    description: string;
    architectureLabel: string;
    encryptedChannel: string;
    architectureNodes: {
      operations: { title: string; detail: string };
      gateway: { title: string; detail: string };
      infrastructure: { title: string; detail: string };
    };
    trustItems: [string, string, string, string];
  };
  deployment: {
    kicker: string;
    title: string;
    description: string;
    options: [string, string, string, string];
  };
  cta: { kicker: string; title: string; titleAccent: string; action: string };
  contact: { kicker: string; title: string; description: string; email: string; telegram: string; wechat: string; empty: string };
  footer: { description: string; copyright: string };
};

const zhCN: Dictionary = {
  metadata: {
    title: "Nodexa RMM | 统一设备运维平台",
    description: "Nodexa RMM 将远程监控、安全访问、自动化和设备运维整合到一个平台。",
  },
  accessibility: {
    skipToContent: "跳到主要内容",
    heroTabsLabel: "产品快速视图",
    showcaseTabsLabel: "控制台产品视图",
    openMenu: "打开导航菜单",
    closeMenu: "关闭导航菜单",
  },
  header: {
    homeLabel: "Nodexa RMM 首页",
    navigationLabel: "主导航",
    capabilities: "产品能力",
    showcase: "产品视图",
    automation: "自动化",
    security: "安全架构",
    deployment: "部署方式",
    console: "进入控制台",
    contact: "联系我们",
    languageLabel: "切换语言",
    languageShort: "EN",
  },
  hero: {
    eyebrow: "Unified Device Operations Platform",
    title: "让每一台设备",
    titleAccent: "都清晰、可控。",
    description: "Nodexa RMM 将监控、远程访问、自动化与安全治理整合到一个工作空间，帮助 IT 团队更快发现问题、更稳妥地完成处置。",
    primaryAction: "了解产品方案",
    secondaryAction: "浏览产品能力",
    proofLabel: "平台特性",
    proofs: ["无需浏览器插件", "支持私有化部署", "跨平台设备接入"],
    consoleAlt: "Nodexa RMM 远程桌面管理工作区",
    availability: "状态示例",
    latency: "交互延迟示例",
    liveWorkspace: "实时工作区",
    quickViews: {
      workspace: "远程桌面",
      dashboard: "运维看板",
      devices: "设备矩阵",
    },
    stats: [
      { value: "一处", label: "管理所有终端" },
      { value: "秒级", label: "状态与事件同步" },
      { value: "全程", label: "会话安全审计" },
      { value: "随时", label: "桌面与移动协同" },
    ],
  },
  showcase: {
    kicker: "IMMERSIVE CONSOLE EXPERIENCE",
    title: "真实控制台视图，",
    titleAccent: "直观驾驭每一项复杂运维",
    description: "无需安装本地客户端，直接在现代浏览器中调度全局资产、穿透受控桌面、执行批量任务与精细权限把控。",
    previewBadge: "系统真机截图",
    tabs: [
      {
        id: "workspace",
        name: "远程桌面",
        title: "免插件远程桌面，像坐在终端前一样操作",
        subtitle: "低延迟画面与原生键鼠",
        description: "浏览器内直接接管桌面，支持剪贴板双向互传，并在同一工作台切换到终端、进程、服务与日志完成排障。",
        tag: "核心控制",
        highlights: ["低延迟画面传输", "剪贴板双向同步", "桌面与终端同屏切换"],
      },
      {
        id: "dashboard",
        name: "运维仪表盘",
        title: "全网在线率与健康趋势，一屏掌握",
        subtitle: "状态趋势与服务器负载",
        description: "汇总在线与异常设备、24 小时至 30 天的状态趋势、平台与分组分布，并同步展示业务网关与服务端资源。",
        tag: "态势感知",
        highlights: ["在线率与异常统计", "多时间范围趋势", "网关与服务器状态"],
      },
      {
        id: "devices",
        name: "设备资产矩阵",
        title: "多层级资产纳管与批量动作",
        subtitle: "分组、筛选与批量下发",
        description: "按分组、状态与平台筛选全网设备，查看 IP、地域与最后在线时间，并对选中设备执行分组迁移、命令与文件任务。",
        tag: "资产与批量",
        highlights: ["树形分组智能筛选", "批量迁移与命令下发", "IP 与地域归属可见"],
      },
      {
        id: "files",
        name: "文件与任务",
        title: "文件分发与任务进度，全程可追踪",
        subtitle: "分片上传与逐台结果",
        description: "在设备文件与服务端文件空间之间搬运文件，支持大文件分片与批量上传，并在任务中心查看每台设备的执行结果。",
        tag: "效率",
        highlights: ["大文件分片传输", "批量上传冲突处理", "逐台任务结果追踪"],
      },
      {
        id: "report",
        name: "事件与报表",
        title: "事件流、通知与运营报表",
        subtitle: "从发现到复盘的证据链",
        description: "实时事件可按类型与设备筛选并查看脱敏详情，通知中心汇总告警与求助，报表覆盖远程会话、用户流量、登录与数据库记录。",
        tag: "洞察",
        highlights: ["事件筛选与详情", "告警与求助通知", "会话登录流量报表"],
      },
      {
        id: "users",
        name: "权限与审计",
        title: "最小权限与完整操作留痕",
        subtitle: "组、设备与功能级授权",
        description: "通过用户组与设备组批量授权，也能对单台设备与单项功能收紧权限；共享设备支撑跨团队协作，关键操作可追溯到账号与 IP。",
        tag: "治理",
        highlights: ["组与设备权限矩阵", "功能级访问限制", "操作记录追溯责任人"],
      },
    ],
  },
  capabilities: {
    kicker: "ONE OPERATIONS LAYER",
    title: "围绕设备全生命周期，",
    titleAccent: "建立统一运维视图",
    description: "从设备首次上线到日常维护与安全审计，每个关键动作都在同一个上下文中完成，减少工具切换和信息断层。",
    learnMore: "了解能力",
    items: [
      { title: "实时监控与健康态势", description: "聚合在线率、状态趋势、系统负载与平台分布，让异常在扩散前被看见。" },
      { title: "免插件远程桌面与终端", description: "浏览器内低延迟接管桌面，并在同一工作台切换终端、进程、服务与日志。" },
      { title: "文件管理与批量分发", description: "设备文件与服务端文件空间统一浏览，支持分片上传、批量下发与冲突处理。" },
      { title: "批量任务与运维编排", description: "把分组迁移、命令执行与文件分发变成可追踪任务，逐台查看进度与失败原因。" },
      { title: "设备接入与部署中心", description: "覆盖 Windows、macOS、Linux 与 Android 的安装包、邀请码与静默部署方式。" },
      { title: "身份、权限与共享", description: "按用户组、设备组与单台设备授予最小权限，并用共享设备支撑跨团队协作。" },
      { title: "事件、审计与报表", description: "实时事件、通知中心与会话、登录、流量报表，让每次处置都可回溯。" },
      { title: "服务端可观测与账号安全", description: "控制台、事件追踪、错误日志与二次验证、登录历史，守住平台自身。" },
    ],
  },
  workflow: {
    kicker: "OPERATION AUTOMATION",
    title: "把处置经验，",
    titleAccent: "沉淀为可靠流程",
    description: "从事件发现到任务执行，把团队经验转化为标准动作。批量命令、文件分发和设备策略可以被统一触发、追踪与复盘。",
    link: "查看部署架构",
    steps: [
      { label: "发现异常", detail: "策略持续检测" },
      { label: "自动响应", detail: "触发预设任务" },
      { label: "远程处置", detail: "一键进入现场" },
      { label: "验证闭环", detail: "全程留痕审计" },
    ],
    commandResult: "24 台设备任务已并行下发",
  },
  mobile: {
    kicker: "SEAMLESS ONBOARDING & ACCESS",
    title: "安全凭据隔离，",
    titleAccent: "极简极速接入",
    description: "通过现代化的安全控制台与凭据治理，管理员可在现代浏览器中直接接入受控网关，免除传统 VPN 和复杂本地客户端的维护成本。",
    imageAlt: "Nodexa RMM 安全身份认证与控制台接入界面",
    badgeTitle: "Zero-Trust Gateway",
    badgeDescription: "端到端加密与凭据隔离",
    features: [
      { title: "全功能工作台", description: "为复杂设备管理与桌面运维提供专业交互" },
      { title: "实时状态感知", description: "设备上线、告警触发与会话建立秒级响应" },
      { title: "统一设备模型", description: "跨平台多架构设备共享一致的分组与属性上下文" },
    ],
  },
  security: {
    kicker: "SECURITY BY ARCHITECTURE",
    title: "安全不是附加项，",
    titleAccent: "而是每次操作的前提",
    description: "Nodexa RMM 通过业务网关建立受控访问边界，敏感凭证不进入浏览器，每次远程会话与管理操作都可被授权和追踪。",
    architectureLabel: "Nodexa 安全连接架构",
    encryptedChannel: "加密通道",
    architectureNodes: {
      operations: { title: "运维工作台", detail: "Web / 移动端" },
      gateway: { title: "安全网关", detail: "认证 / 策略 / 审计" },
      infrastructure: { title: "基础设施", detail: "设备 / 服务" },
    },
    trustItems: ["基于角色的精细权限", "网关隔离核心服务", "完整的操作审计链路", "面向私有化部署设计"],
  },
  deployment: {
    kicker: "DEPLOY YOUR WAY",
    title: "部署在你的边界内",
    description: "支持从单节点开始渐进式部署，并保留对网络、数据与身份体系的控制权。",
    options: ["容器化部署", "反向代理接入", "自动化配置", "平滑升级"],
  },
  cta: {
    kicker: "READY FOR CLEARER OPERATIONS?",
    title: "从下一台设备开始，",
    titleAccent: "重建你的运维视图。",
    action: "联系我们",
  },
  contact: {
    kicker: "TALK TO US",
    title: "准备好了解 Nodexa RMM？",
    description: "告诉我们你的设备规模、运维场景和部署要求，我们会为你介绍适合的产品方案。",
    email: "邮箱",
    telegram: "Telegram",
    wechat: "微信",
    empty: "联系方式即将公布，敬请期待。",
  },
  footer: {
    description: "Unified Device Operations Platform",
    copyright: "Nodexa. 保留所有权利。",
  },
};

const en = {
  metadata: {
    title: "Nodexa RMM | Unified Device Operations Platform",
    description: "Nodexa RMM unifies remote monitoring, secure access, automation, and device operations in one platform.",
  },
  accessibility: {
    skipToContent: "Skip to main content",
    heroTabsLabel: "Product quick views",
    showcaseTabsLabel: "Console product views",
    openMenu: "Open navigation menu",
    closeMenu: "Close navigation menu",
  },
  header: {
    homeLabel: "Nodexa RMM home",
    navigationLabel: "Main navigation",
    capabilities: "Capabilities",
    showcase: "Console Views",
    automation: "Automation",
    security: "Security",
    deployment: "Deployment",
    console: "Contact us",
    contact: "Contact us",
    languageLabel: "Switch language",
    languageShort: "中文",
  },
  hero: {
    eyebrow: "Unified Device Operations Platform",
    title: "Every device.",
    titleAccent: "Clear and under control.",
    description: "Nodexa RMM brings monitoring, secure remote access, automation, and governance into one workspace so IT teams can detect issues sooner and resolve them with confidence.",
    primaryAction: "Learn about the product",
    secondaryAction: "Explore capabilities",
    proofLabel: "Platform benefits",
    proofs: ["No browser plugin", "Private deployment ready", "Cross-platform agents"],
    consoleAlt: "Nodexa RMM remote desktop operations workspace",
    availability: "Status example",
    latency: "Latency example",
    liveWorkspace: "Live workspace",
    quickViews: {
      workspace: "Remote Desktop",
      dashboard: "Dashboard",
      devices: "Fleet Matrix",
    },
    stats: [
      { value: "One", label: "workspace for every endpoint" },
      { value: "Live", label: "device and event updates" },
      { value: "Full", label: "session audit trail" },
      { value: "Any", label: "desktop or mobile workflow" },
    ],
  },
  showcase: {
    kicker: "IMMERSIVE CONSOLE EXPERIENCE",
    title: "Real operations views,",
    titleAccent: "purpose-built for scale and precision",
    description: "Operate across fleets, inspect desktops, run batch remediations, and enforce zero-trust security directly in modern browsers without fat clients.",
    previewBadge: "Production Screenshots",
    tabs: [
      {
        id: "workspace",
        name: "Remote Desktop",
        title: "Plugin-free control, as if you were at the console",
        subtitle: "Low-latency video and native input",
        description: "Take over a desktop directly in the browser with two-way clipboard exchange, then switch to terminal, processes, services, and logs in the same workspace.",
        tag: "Core control",
        highlights: ["Low-latency streaming", "Two-way clipboard", "Desktop and terminal in one view"],
      },
      {
        id: "dashboard",
        name: "Operations Dashboard",
        title: "Fleet availability and health trends on one screen",
        subtitle: "Status trends and server load",
        description: "Track online and abnormal devices, 24-hour to 30-day status trends, platform and group distribution, plus gateway and server resource health.",
        tag: "Observability",
        highlights: ["Availability and incident counts", "24h, 7d, and 30d trends", "Gateway and server health"],
      },
      {
        id: "devices",
        name: "Fleet Matrix",
        title: "Multi-tier asset control with batch actions",
        subtitle: "Groups, filters, and bulk delivery",
        description: "Filter the fleet by group, status, and platform; inspect IP, location, and last-seen time; then run group moves, commands, and file tasks in bulk.",
        tag: "Assets and batch",
        highlights: ["Tree groups and smart filters", "Bulk moves and commands", "IP and location context"],
      },
      {
        id: "files",
        name: "Files and Tasks",
        title: "File delivery and task progress, fully traceable",
        subtitle: "Chunked uploads and per-device results",
        description: "Move files between device storage and server file spaces with chunked and batch uploads, then follow every device outcome in the task center.",
        tag: "Efficiency",
        highlights: ["Chunked large-file transfers", "Batch upload conflict checks", "Per-device task outcomes"],
      },
      {
        id: "report",
        name: "Events and Reports",
        title: "Event stream, notifications, and operations reports",
        subtitle: "An evidence trail from detection to review",
        description: "Filter real-time events by type and device, open redacted details, follow alerts and help requests in the notification center, and report on sessions, traffic, logins, and database records.",
        tag: "Insight",
        highlights: ["Filterable event details", "Alerts and help requests", "Session, login, and traffic reports"],
      },
      {
        id: "users",
        name: "Access and Audit",
        title: "Least privilege with a complete activity trail",
        subtitle: "Group, device, and feature-level grants",
        description: "Authorize in bulk through user and device groups, tighten single-device or single-feature access, enable shared devices for cross-team work, and trace key actions back to an account and IP.",
        tag: "Governance",
        highlights: ["Group and device permission matrix", "Feature-level restrictions", "Actions traced to account and IP"],
      },
    ],
  },
  capabilities: {
    kicker: "ONE OPERATIONS LAYER",
    title: "One view across the",
    titleAccent: "entire device lifecycle",
    description: "From first enrollment to daily maintenance and security review, every critical action stays in the same operational context without tool switching or fragmented data.",
    learnMore: "Explore capability",
    items: [
      { title: "Live monitoring and health", description: "Aggregate availability, status trends, host load, and platform mix so anomalies surface before they spread." },
      { title: "Plugin-free desktop and terminal", description: "Take over a desktop with low latency in the browser, then switch to terminal, processes, services, and logs in one workspace." },
      { title: "File management and distribution", description: "Browse device files and server file spaces together, with chunked uploads, batch delivery, and conflict handling." },
      { title: "Batch tasks and orchestration", description: "Turn group moves, commands, and file delivery into tracked tasks with per-device progress and failure reasons." },
      { title: "Enrollment and deployment center", description: "Distribute installers, invite codes, and silent deployment for Windows, macOS, Linux, and Android from one place." },
      { title: "Identity, access, and sharing", description: "Grant least privilege by user group, device group, or single device, and support cross-team work with shared devices." },
      { title: "Events, audit, and reporting", description: "Real-time events, a notification center, and session, login, and traffic reports keep every action reviewable." },
      { title: "Server observability and account security", description: "Console, trace, error logs, two-factor verification, and login history protect the platform itself." },
    ],
  },
  workflow: {
    kicker: "OPERATION AUTOMATION",
    title: "Turn team experience",
    titleAccent: "into reliable workflows",
    description: "Standardize the path from detection to execution. Commands, file distribution, and device policies can be triggered, tracked, and reviewed from one place.",
    link: "View deployment architecture",
    steps: [
      { label: "Detect", detail: "Continuous policies" },
      { label: "Respond", detail: "Trigger runbooks" },
      { label: "Resolve", detail: "Enter the endpoint" },
      { label: "Verify", detail: "Audit the outcome" },
    ],
    commandResult: "Tasks dispatched to 24 devices",
  },
  mobile: {
    kicker: "SEAMLESS ONBOARDING & ACCESS",
    title: "Isolated credentials,",
    titleAccent: "instant secure onboarding",
    description: "Operate through a modern zero-trust gateway where credentials remain isolated on server side. Access fleets instantly in modern browsers without VPNs or client software overhead.",
    imageAlt: "Nodexa RMM secure authentication and gateway interface",
    badgeTitle: "Zero-Trust Gateway",
    badgeDescription: "End-to-end TLS & credential isolation",
    features: [
      { title: "Full Operations Workspace", description: "Professional views for deep troubleshooting" },
      { title: "Live Telemetry Feed", description: "Instant feedback on availability and alerts" },
      { title: "Unified Device Context", description: "Cross-platform consistency across all fleets" },
    ],
  },
  security: {
    kicker: "SECURITY BY ARCHITECTURE",
    title: "Security is not an add-on.",
    titleAccent: "It is the starting point.",
    description: "Nodexa RMM creates a controlled access boundary through the business gateway. Sensitive credentials stay out of the browser, while every session and management action can be authorized and traced.",
    architectureLabel: "Nodexa secure connection architecture",
    encryptedChannel: "Encrypted channel",
    architectureNodes: {
      operations: { title: "Operations", detail: "Web / Mobile" },
      gateway: { title: "Secure Gateway", detail: "Auth / Policy / Audit" },
      infrastructure: { title: "Infrastructure", detail: "Devices / Services" },
    },
    trustItems: ["Role-based access control", "Gateway-isolated core services", "Complete operations audit trail", "Designed for private deployment"],
  },
  deployment: {
    kicker: "DEPLOY YOUR WAY",
    title: "Operate inside your boundary",
    description: "Scale from one node to a production cluster while retaining control over your network, data, and identity systems.",
    options: ["Container deployment", "Reverse proxy integration", "Automated configuration", "Controlled upgrades"],
  },
  cta: {
    kicker: "READY FOR CLEARER OPERATIONS?",
    title: "Start with the next device.",
    titleAccent: "Rebuild your operations view.",
    action: "Contact us",
  },
  contact: {
    kicker: "TALK TO US",
    title: "Ready to learn about Nodexa RMM?",
    description: "Tell us about your fleet, operations, and deployment needs. We will introduce the right product approach for your team.",
    email: "Email",
    telegram: "Telegram",
    wechat: "WeChat",
    empty: "Contact details will be available soon.",
  },
  footer: {
    description: "Unified Device Operations Platform",
    copyright: "Nodexa. All rights reserved.",
  },
} satisfies Dictionary;

const dictionaries: Record<Locale, Dictionary> = { "zh-CN": zhCN, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

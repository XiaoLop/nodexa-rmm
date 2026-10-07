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
    tabs: [
      { id: string; name: string; title: string; subtitle: string; description: string; tag: string; highlights: [string, string, string] },
      { id: string; name: string; title: string; subtitle: string; description: string; tag: string; highlights: [string, string, string] },
      { id: string; name: string; title: string; subtitle: string; description: string; tag: string; highlights: [string, string, string] },
      { id: string; name: string; title: string; subtitle: string; description: string; tag: string; highlights: [string, string, string] }
    ];
  };
  capabilities: {
    kicker: string;
    title: string;
    titleAccent: string;
    description: string;
    learnMore: string;
    items: [TextPair, TextPair, TextPair, TextPair];
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
        title: "免插件高性能远程桌面与工作台",
        subtitle: "极速接管，像坐在终端机前一样自然",
        description: "高响应流传输结合原生键盘鼠标控制、剪贴板交互与系统指标实时观测，复杂故障排查一步到位。",
        tag: "远程核心",
        highlights: ["低延迟交互式画面传输", "终端与文件系统深度集成", "无须安装浏览器插件"],
      },
      {
        id: "dashboard",
        name: "运维仪表盘",
        title: "全局设备态势与系统健康监控",
        subtitle: "资产与运行状态，一屏了然",
        description: "聚合统计全网在线终端、告警分布、节点资源负载与实时事件流，驱动主动式故障预防与迅速处置。",
        tag: "态势感知",
        highlights: ["全网在线率与健康度大盘", "系统负载预警与动态跟踪", "事件通知流实时秒级推送"],
      },
      {
        id: "devices",
        name: "设备资产矩阵",
        title: "多层级资产纳管与批量任务调度",
        subtitle: "多设备资产，结构化统一分组",
        description: "支持灵活的树形设备分组、操作系统精准识别、多维度标签过滤及批量命令调度，告别逐台重复维护。",
        tag: "资产与批量",
        highlights: ["树形多租户资产分类", "多条件智能筛选与搜索", "批量安全下发运维动作"],
      },
      {
        id: "security",
        name: "权限与用户管理",
        title: "企业级 RBAC 细粒度权限管控与审计",
        subtitle: "最小特权原则，关键操作全程留痕",
        description: "按部门与角色授予精确的设备访问权限与会话能力，所有接入与关键运维动作全程留存合规审计日志。",
        tag: "安全治理",
        highlights: ["RBAC 精细化多角色授权", "会话与指令操作记录", "网关侧凭据访问边界"],
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
      { title: "实时监控", description: "统一掌握设备健康度、在线状态与关键性能指标。" },
      { title: "远程访问", description: "从浏览器安全接入桌面、终端与文件系统。" },
      { title: "批量自动化", description: "将重复任务编排为可审计、可复用的运维流程。" },
      { title: "安全治理", description: "通过权限、会话和操作日志控制每一次访问。" },
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
        title: "Plugin-free High Performance Remote Desktop",
        subtitle: "Direct control as if standing in front of the console",
        description: "Low-latency streaming combined with native keyboard/mouse events, clipboard sharing, and live system vital metrics.",
        tag: "Core Control",
        highlights: ["Responsive low-latency streaming", "Terminal & file browser integrated", "No browser plugin required"],
      },
      {
        id: "dashboard",
        name: "Operations Dashboard",
        title: "Fleet-wide Health Signals & Availability",
        subtitle: "Global status at a single glance",
        description: "Aggregate statistics on online endpoints, alert distribution, host performance loads, and live incident telemetry.",
        tag: "Observability",
        highlights: ["Real-time availability monitoring", "Resource spike threshold alerts", "Real-time system telemetry stream"],
      },
      {
        id: "devices",
        name: "Fleet Matrix",
        title: "Multi-tier Asset Grouping & Batch Actions",
        subtitle: "Structured fleet control at scale",
        description: "Organize nodes with hierarchical groups, OS tagging, and attribute filtering. Run batch commands across fleets in seconds.",
        tag: "Fleet Management",
        highlights: ["Hierarchical tree & tag search", "Batch script execution engine", "Unified cross-platform agent"],
      },
      {
        id: "security",
        name: "User & Access Control",
        title: "Enterprise RBAC & Full Audit Trail",
        subtitle: "Least privilege by default, verified in depth",
        description: "Grant fine-grained endpoint access and action permissions per department, retaining comprehensive activity records for review.",
        tag: "Governance",
        highlights: ["Granular role-based access control", "Complete session and command audit", "Zero-trust credential isolation"],
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
      { title: "Live monitoring", description: "Track device health, availability, and critical performance signals in one place." },
      { title: "Remote access", description: "Securely reach desktops, terminals, and file systems from the browser." },
      { title: "Fleet automation", description: "Turn repetitive tasks into reusable and auditable operations workflows." },
      { title: "Security governance", description: "Control every action through permissions, sessions, and operation logs." },
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

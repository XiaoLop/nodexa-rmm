import type { Locale } from "./config";

type TextPair = { title: string; description: string };
type Stat = { value: string; label: string };

export type Dictionary = {
  metadata: { title: string; description: string };
  header: {
    homeLabel: string;
    navigationLabel: string;
    capabilities: string;
    automation: string;
    security: string;
    deployment: string;
    console: string;
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
    stats: [Stat, Stat, Stat, Stat];
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
    trustItems: [string, string, string, string];
  };
  deployment: {
    kicker: string;
    title: string;
    description: string;
    options: [string, string, string, string];
  };
  cta: { kicker: string; title: string; titleAccent: string; action: string };
  footer: { description: string; copyright: string };
};

const zhCN: Dictionary = {
  metadata: {
    title: "Nodexa RMM | 统一设备运维平台",
    description: "Nodexa RMM 将远程监控、安全访问、自动化和设备运维整合到一个平台。",
  },
  header: {
    homeLabel: "Nodexa RMM 首页",
    navigationLabel: "主导航",
    capabilities: "产品能力",
    automation: "自动化",
    security: "安全架构",
    deployment: "部署方式",
    console: "进入控制台",
    languageLabel: "切换语言",
    languageShort: "EN",
  },
  hero: {
    eyebrow: "Unified Device Operations Platform",
    title: "让每一台设备",
    titleAccent: "都清晰、可控。",
    description: "Nodexa RMM 将监控、远程访问、自动化与安全治理整合到一个工作空间，帮助 IT 团队更快发现问题、更稳妥地完成处置。",
    primaryAction: "打开管理控制台",
    secondaryAction: "浏览产品能力",
    proofLabel: "平台特性",
    proofs: ["无需浏览器插件", "支持私有化部署", "跨平台设备接入"],
    consoleAlt: "Nodexa RMM 远程桌面管理工作区",
    availability: "平台可用性",
    latency: "当前会话延迟",
    liveWorkspace: "实时工作区",
    stats: [
      { value: "一处", label: "管理所有终端" },
      { value: "秒级", label: "状态与事件同步" },
      { value: "全程", label: "会话安全审计" },
      { value: "随时", label: "桌面与移动协同" },
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
    kicker: "DESKTOP TO POCKET",
    title: "运维现场，",
    titleAccent: "不只在办公桌前",
    description: "通过一致的设备模型和事件流，让桌面控制台与移动端自然衔接。无论是快速确认告警，还是进入设备详情，重要上下文始终随手可用。",
    imageAlt: "Nodexa RMM 移动端设备、事件和账户界面",
    badgeTitle: "Anywhere operations",
    badgeDescription: "响应不受位置限制",
    features: [
      { title: "完整工作台", description: "为复杂操作提供专业视图" },
      { title: "移动事件流", description: "及时掌握设备状态变化" },
      { title: "统一设备模型", description: "跨端共享分组与状态上下文" },
    ],
  },
  security: {
    kicker: "SECURITY BY ARCHITECTURE",
    title: "安全不是附加项，",
    titleAccent: "而是每次操作的前提",
    description: "Nodexa RMM 通过业务网关建立受控访问边界，敏感凭证不进入浏览器，每次远程会话与管理操作都可被授权和追踪。",
    architectureLabel: "Nodexa 安全连接架构",
    encryptedChannel: "加密通道",
    trustItems: ["基于角色的精细权限", "网关隔离核心服务", "完整的操作审计链路", "面向私有化部署设计"],
  },
  deployment: {
    kicker: "DEPLOY YOUR WAY",
    title: "部署在你的边界内",
    description: "支持从单节点到生产集群的渐进式部署，保留对网络、数据与身份体系的控制权。",
    options: ["容器化部署", "反向代理接入", "自动化配置", "平滑升级"],
  },
  cta: {
    kicker: "READY FOR CLEARER OPERATIONS?",
    title: "从下一台设备开始，",
    titleAccent: "重建你的运维视图。",
    action: "进入 Nodexa RMM",
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
  header: {
    homeLabel: "Nodexa RMM home",
    navigationLabel: "Main navigation",
    capabilities: "Capabilities",
    automation: "Automation",
    security: "Security",
    deployment: "Deployment",
    console: "Open console",
    languageLabel: "Switch language",
    languageShort: "中文",
  },
  hero: {
    eyebrow: "Unified Device Operations Platform",
    title: "Every device.",
    titleAccent: "Clear and under control.",
    description: "Nodexa RMM brings monitoring, secure remote access, automation, and governance into one workspace so IT teams can detect issues sooner and resolve them with confidence.",
    primaryAction: "Open management console",
    secondaryAction: "Explore capabilities",
    proofLabel: "Platform benefits",
    proofs: ["No browser plugin", "Private deployment ready", "Cross-platform agents"],
    consoleAlt: "Nodexa RMM remote desktop operations workspace",
    availability: "Platform availability",
    latency: "Current session latency",
    liveWorkspace: "Live workspace",
    stats: [
      { value: "One", label: "workspace for every endpoint" },
      { value: "Live", label: "device and event updates" },
      { value: "Full", label: "session audit trail" },
      { value: "Any", label: "desktop or mobile workflow" },
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
    kicker: "DESKTOP TO POCKET",
    title: "Operations happen",
    titleAccent: "beyond the desk",
    description: "A shared device model and event stream keep the desktop console and mobile experience aligned. Critical context remains available whether you are reviewing an alert or opening a device record.",
    imageAlt: "Nodexa RMM mobile device, event, and account screens",
    badgeTitle: "Anywhere operations",
    badgeDescription: "Respond from wherever you are",
    features: [
      { title: "Full operations workspace", description: "A focused view for complex tasks" },
      { title: "Mobile event stream", description: "Stay current on device changes" },
      { title: "Shared device model", description: "Keep groups and status in sync" },
    ],
  },
  security: {
    kicker: "SECURITY BY ARCHITECTURE",
    title: "Security is not an add-on.",
    titleAccent: "It is the starting point.",
    description: "Nodexa RMM creates a controlled access boundary through the business gateway. Sensitive credentials stay out of the browser, while every session and management action can be authorized and traced.",
    architectureLabel: "Nodexa secure connection architecture",
    encryptedChannel: "Encrypted channel",
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
    action: "Open Nodexa RMM",
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

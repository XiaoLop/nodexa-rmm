import Image from "next/image";
import {
  ArrowRight,
  BellRing,
  Boxes,
  Check,
  ChevronRight,
  CircleCheck,
  CloudCog,
  Command,
  FileUp,
  Fingerprint,
  Gauge,
  Globe2,
  Laptop,
  LockKeyhole,
  MonitorSmartphone,
  Network,
  Play,
  Radar,
  ServerCog,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Workflow,
  Zap,
} from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

const capabilityIcons = [Radar, MonitorSmartphone, Workflow, ShieldCheck];
const capabilityAccents = ["blue", "cyan", "violet", "green"];

const workflowIcons = [BellRing, Sparkles, TerminalSquare, CircleCheck];
const mobileIcons = [Laptop, BellRing, Network];
const deploymentIcons = [Boxes, CloudCog, Command, FileUp];

export function ProductHome({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const alternateLocale = locale === "zh-CN" ? "en" : "zh-CN";
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label={dictionary.header.homeLabel}>
          <span className="brand-mark"><Image src="/logo.png" alt="" width={42} height={42} priority /></span>
          <span><strong>Nodexa</strong><small>RMM</small></span>
        </a>
        <nav className="site-nav" aria-label={dictionary.header.navigationLabel}>
          <a href="#capabilities">{dictionary.header.capabilities}</a>
          <a href="#workflow">{dictionary.header.automation}</a>
          <a href="#security">{dictionary.header.security}</a>
          <a href="#deployment">{dictionary.header.deployment}</a>
        </nav>
        <div className="header-actions">
          <a className="language-switch" href={`/${alternateLocale}`} aria-label={dictionary.header.languageLabel}>
            <Globe2 aria-hidden="true" size={15} />{dictionary.header.languageShort}
          </a>
          <a className="header-action" href="http://localhost:5173/login">
            {dictionary.header.console} <ArrowRight aria-hidden="true" size={16} />
          </a>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-atmosphere" aria-hidden="true" />
        <div className="hero-content shell">
          <div className="hero-copy">
            <div className="eyebrow"><span className="status-dot" />{dictionary.hero.eyebrow}</div>
            <h1>{dictionary.hero.title}<span>{dictionary.hero.titleAccent}</span></h1>
            <p>{dictionary.hero.description}</p>
            <div className="hero-actions">
              <a className="button button-primary" href="http://localhost:5173/login">
                {dictionary.hero.primaryAction} <ArrowRight aria-hidden="true" size={18} />
              </a>
              <a className="button button-secondary" href="#product-tour">
                <Play aria-hidden="true" size={17} fill="currentColor" />{dictionary.hero.secondaryAction}
              </a>
            </div>
            <div className="hero-proof" aria-label={dictionary.hero.proofLabel}>
              {dictionary.hero.proofs.map((proof) => <span key={proof}><Check size={15} />{proof}</span>)}
            </div>
          </div>

          <div className="hero-visual" id="product-tour">
            <div className="console-frame">
              <div className="console-bar">
                <span className="console-brand"><Image src="/logo.png" alt="" width={20} height={20} />Nodexa Operations</span>
                <span className="live-indicator"><i />{dictionary.hero.liveWorkspace}</span>
              </div>
              <Image className="console-image" src="/product/remote-desktop.png" alt={dictionary.hero.consoleAlt} width={839} height={613} priority />
            </div>
            <div className="metric-float metric-online">
              <span className="metric-icon"><Gauge size={18} /></span>
              <span><b>99.9%</b><small>{dictionary.hero.availability}</small></span>
            </div>
            <div className="metric-float metric-latency">
              <span className="pulse-ring"><i /></span>
              <span><b>28 ms</b><small>{dictionary.hero.latency}</small></span>
            </div>
          </div>
        </div>
        <div className="hero-stats shell">{dictionary.hero.stats.map((stat) => <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}</div>
      </section>

      <section className="section capabilities-section" id="capabilities">
        <div className="shell">
          <div className="section-heading split-heading">
            <div><span className="section-kicker">{dictionary.capabilities.kicker}</span><h2>{dictionary.capabilities.title}<br />{dictionary.capabilities.titleAccent}</h2></div>
            <p>{dictionary.capabilities.description}</p>
          </div>
          <div className="capability-grid">
            {dictionary.capabilities.items.map(({ title, description }, index) => {
              const Icon = capabilityIcons[index];
              return (
              <article className="capability-item" key={title}>
                <span className={`capability-icon ${capabilityAccents[index]}`}><Icon size={23} /></span>
                <span className="capability-index">0{index + 1}</span>
                <h3>{title}</h3><p>{description}</p>
                <a href="#workflow">{dictionary.capabilities.learnMore} <ChevronRight size={15} /></a>
              </article>
            );})}
          </div>
        </div>
      </section>

      <section className="section workflow-section" id="workflow">
        <div className="shell workflow-layout">
          <div className="workflow-copy">
            <span className="section-kicker">{dictionary.workflow.kicker}</span>
            <h2>{dictionary.workflow.title}<br />{dictionary.workflow.titleAccent}</h2>
            <p>{dictionary.workflow.description}</p>
            <a className="text-link" href="#deployment">{dictionary.workflow.link} <ArrowRight size={17} /></a>
          </div>
          <div className="workflow-board">
            <div className="workflow-path" aria-hidden="true" />
            {dictionary.workflow.steps.map(({ label, detail }, index) => {
              const Icon = workflowIcons[index];
              return (
              <div className="workflow-step" key={label}>
                <span className="step-number">{index + 1}</span><span className="step-icon"><Icon size={22} /></span>
                <strong>{label}</strong><small>{detail}</small>
              </div>
            );})}
            <div className="command-preview">
              <div><span /><span /><span /></div>
              <code>nodexa run patch-security --group production</code>
              <p><Zap size={14} fill="currentColor" />{dictionary.workflow.commandResult}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section mobile-section">
        <div className="shell mobile-layout">
          <div className="mobile-stage">
            <div className="mobile-image-wrap">
              <Image src="/product/mobile-overview.png" alt={dictionary.mobile.imageAlt} width={882} height={1922} />
            </div>
            <div className="mobile-badge"><Globe2 size={20} /><span><b>{dictionary.mobile.badgeTitle}</b><small>{dictionary.mobile.badgeDescription}</small></span></div>
          </div>
          <div className="mobile-copy">
            <span className="section-kicker">{dictionary.mobile.kicker}</span>
            <h2>{dictionary.mobile.title}<br />{dictionary.mobile.titleAccent}</h2>
            <p>{dictionary.mobile.description}</p>
            <div className="feature-list">
              {dictionary.mobile.features.map((feature, index) => {
                const Icon = mobileIcons[index];
                return <div key={feature.title}><Icon size={20} /><span><b>{feature.title}</b><small>{feature.description}</small></span></div>;
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="section security-section" id="security">
        <div className="shell security-layout">
          <div className="security-copy">
            <span className="section-kicker light">{dictionary.security.kicker}</span>
            <h2>{dictionary.security.title}<br />{dictionary.security.titleAccent}</h2>
            <p>{dictionary.security.description}</p>
            <div className="trust-list">{dictionary.security.trustItems.map((item) => <span key={item}><Check size={15} />{item}</span>)}</div>
          </div>
          <div className="architecture" aria-label={dictionary.security.architectureLabel}>
            <div className="architecture-node endpoints"><MonitorSmartphone size={24} /><span><b>Operations</b><small>Web / Mobile</small></span></div>
            <div className="architecture-line"><i /></div>
            <div className="architecture-node gateway"><LockKeyhole size={24} /><span><b>Secure Gateway</b><small>Auth / Policy / Audit</small></span></div>
            <div className="architecture-line"><i /></div>
            <div className="architecture-node infrastructure"><ServerCog size={24} /><span><b>Infrastructure</b><small>Devices / Services</small></span></div>
            <span className="encrypted-label"><Fingerprint size={14} />{dictionary.security.encryptedChannel}</span>
          </div>
        </div>
      </section>

      <section className="section deployment-section" id="deployment">
        <div className="shell deployment-layout">
          <div><span className="section-kicker">{dictionary.deployment.kicker}</span><h2>{dictionary.deployment.title}</h2></div>
          <p>{dictionary.deployment.description}</p>
          <div className="deployment-options">
            {dictionary.deployment.options.map((option, index) => {
              const Icon = deploymentIcons[index];
              return <span key={option}><Icon size={20} /><b>{option}</b></span>;
            })}
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="shell cta-inner">
          <div><span className="section-kicker light">{dictionary.cta.kicker}</span><h2>{dictionary.cta.title}<br />{dictionary.cta.titleAccent}</h2></div>
          <a className="button button-light" href="http://localhost:5173/login">{dictionary.cta.action} <ArrowRight size={18} /></a>
        </div>
      </section>

      <footer className="site-footer">
        <div className="shell footer-inner">
          <a className="brand footer-brand" href="#top"><span className="brand-mark"><Image src="/logo.png" alt="" width={38} height={38} /></span><span><strong>Nodexa</strong><small>RMM</small></span></a>
          <p>{dictionary.footer.description}</p>
          <span>© {new Date().getFullYear()} {dictionary.footer.copyright}</span>
        </div>
      </footer>
    </main>
  );
}

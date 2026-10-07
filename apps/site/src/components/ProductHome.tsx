"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence, type Variants } from "motion/react";
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
  Laptop,
  Layers,
  LockKeyhole,
  Monitor,
  MonitorSmartphone,
  Network,
  Play,
  Radar,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ContactInfo } from "@/config/contact";
import { SiteHeader } from "@/components/SiteHeader";

const capabilityIcons = [Radar, MonitorSmartphone, Workflow, ShieldCheck];
const capabilityAccents = ["blue", "cyan", "violet", "green"];

const workflowIcons = [BellRing, Sparkles, TerminalSquare, CircleCheck];
const mobileIcons = [Laptop, BellRing, Network];
const deploymentIcons = [Boxes, CloudCog, Command, FileUp];

const showcaseIcons = [Monitor, Gauge, Layers, Users];

// Animation variants
const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

export function ProductHome({ locale, dictionary, contact, consoleUrl }: { locale: Locale; dictionary: Dictionary; contact: ContactInfo; consoleUrl?: string }) {
  const alternateLocale = locale === "zh-CN" ? "en" : "zh-CN";
  const imgLocale = locale === "zh-CN" ? "zh-CN" : "en-US";

  const productImages = {
    workspace: `/product/device-workspace-${imgLocale}.png`,
    dashboard: `/product/dashboard-${imgLocale}.png`,
    devices: `/product/devices-${imgLocale}.png`,
    security: `/product/user-management-${imgLocale}.png`,
    login: `/product/login-${imgLocale}.png`,
  };

  const [activeHeroView, setActiveHeroView] = useState<"workspace" | "dashboard" | "devices">("workspace");
  const [activeShowcaseIndex, setActiveShowcaseIndex] = useState<number>(0);

  const heroUrls = {
    workspace: "nodexa://fleet/workstation-01/desktop",
    dashboard: "nodexa://analytics/overview",
    devices: "nodexa://inventory/managed-nodes",
  };

  const showcaseTabs = dictionary.showcase.tabs;
  const currentShowcase = showcaseTabs[activeShowcaseIndex] || showcaseTabs[0];

  const showcaseImageKeys = ["workspace", "dashboard", "devices", "security"] as const;
  const currentShowcaseImg = productImages[showcaseImageKeys[activeShowcaseIndex] || "workspace"];

  const heroQuickTabs: Array<{ id: "workspace" | "dashboard" | "devices"; label: string; icon: typeof Monitor }> = [
    { id: "workspace", label: dictionary.hero.quickViews.workspace, icon: Monitor },
    { id: "dashboard", label: dictionary.hero.quickViews.dashboard, icon: Gauge },
    { id: "devices", label: dictionary.hero.quickViews.devices, icon: Layers },
  ];

  const contactItems = [
    contact.email ? { label: dictionary.contact.email, value: contact.email, href: `mailto:${contact.email}` } : null,
    contact.telegram ? {
      label: dictionary.contact.telegram,
      value: contact.telegram,
      href: contact.telegram.startsWith("http")
        ? contact.telegram
        : `https://t.me/${contact.telegram.replace(/^@/, "")}`,
    } : null,
    contact.wechat ? { label: dictionary.contact.wechat, value: contact.wechat } : null,
  ].filter((item): item is { label: string; value: string; href?: string } => Boolean(item));

  const hasContactDetails = contactItems.length > 0;
  const primaryActionHref = hasContactDetails ? "#contact" : consoleUrl ?? "#showcase";
  const primaryActionLabel = hasContactDetails ? dictionary.hero.primaryAction : consoleUrl ? dictionary.header.console : dictionary.hero.secondaryAction;
  const headerActionHref = hasContactDetails ? "#contact" : consoleUrl ?? "#showcase";
  const headerActionLabel = hasContactDetails ? dictionary.header.contact : consoleUrl ? dictionary.header.console : dictionary.header.showcase;
  const primaryActionExternal = Boolean(consoleUrl && !hasContactDetails);

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number, itemCount: number, selectIndex: (index: number) => void, tabPrefix: string) => {
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % itemCount;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + itemCount) % itemCount;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = itemCount - 1;
    else return;
    event.preventDefault();
    selectIndex(nextIndex);
    document.getElementById(`${tabPrefix}-${nextIndex}`)?.focus();
  };

  return (
    <>
      <a className="skip-link" href="#main-content">{dictionary.accessibility.skipToContent}</a>
      <SiteHeader alternateLocale={alternateLocale} dictionary={dictionary} actionHref={headerActionHref} actionLabel={headerActionLabel} actionExternal={primaryActionExternal} />
      <main id="main-content">
      <section className="hero" id="top">
        <div className="hero-atmosphere" aria-hidden="true" />
        <div className="hero-content shell">
          <motion.div
            className="hero-copy"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.div variants={fadeInUp} className="eyebrow">
              <span className="status-dot" />{dictionary.hero.eyebrow}
            </motion.div>
            <motion.h1 variants={fadeInUp}>
              {dictionary.hero.title}<span>{dictionary.hero.titleAccent}</span>
            </motion.h1>
            <motion.p variants={fadeInUp}>{dictionary.hero.description}</motion.p>
            <motion.div variants={fadeInUp} className="hero-actions">
              <a className="button button-primary" href={primaryActionHref} {...(primaryActionExternal ? { target: "_blank", rel: "noreferrer" } : {})}>
                {primaryActionLabel} <ArrowRight aria-hidden="true" size={18} />
              </a>
              <a className="button button-secondary" href="#showcase">
                <Play aria-hidden="true" size={17} fill="currentColor" />{dictionary.hero.secondaryAction}
              </a>
            </motion.div>
            <motion.div variants={fadeInUp} className="hero-proof" aria-label={dictionary.hero.proofLabel}>
              {dictionary.hero.proofs.map((proof) => <span key={proof}><Check size={15} />{proof}</span>)}
            </motion.div>
          </motion.div>

          <motion.div
            className="hero-visual"
            id="product-tour"
            initial={{ opacity: 0, scale: 0.98, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.15, ease: "easeOut" }}
          >
            <div className="console-quick-switch" role="tablist" aria-label={dictionary.accessibility.heroTabsLabel}>
              {heroQuickTabs.map((item, index) => {
                const Icon = item.icon;
                const isActive = activeHeroView === item.id;
                return (
                  <button
                    key={item.id}
                    id={`hero-tab-${index}`}
                    type="button"
                    className={`console-quick-btn relative ${isActive ? "active" : ""}`}
                    role="tab"
                    aria-selected={isActive}
                    aria-controls="hero-product-panel"
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => setActiveHeroView(item.id)}
                    onKeyDown={(event) => handleTabKeyDown(event, index, heroQuickTabs.length, (nextIndex) => setActiveHeroView(heroQuickTabs[nextIndex].id), "hero-tab")}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="hero-tab-pill"
                        className="absolute inset-0 rounded-[20px] border border-[#3b7cff] bg-[#3b7cff]/20 shadow-[0_0_16px_rgba(59,124,255,0.28)]"
                        transition={{ type: "spring", stiffness: 450, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <Icon size={14} />{item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="console-frame" id="hero-product-panel" role="tabpanel" aria-labelledby={`hero-tab-${heroQuickTabs.findIndex((item) => item.id === activeHeroView)}`}>
              <div className="console-bar">
                <div className="console-brand">
                  <div className="console-window-dots" aria-hidden="true">
                    <span className="console-dot console-dot-close" />
                    <span className="console-dot console-dot-min" />
                    <span className="console-dot console-dot-max" />
                  </div>
                  <Image src="/logo.png" alt="" width={18} height={18} />
                  <span>Nodexa Console</span>
                </div>
                <div className="console-address-bar" aria-hidden="true">
                  <LockKeyhole size={10} />
                  <motion.span
                    key={heroUrls[activeHeroView]}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {heroUrls[activeHeroView]}
                  </motion.span>
                </div>
                <span className="live-indicator"><i />{dictionary.hero.liveWorkspace}</span>
              </div>
              <div className="console-image-wrapper">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeHeroView}
                    initial={{ opacity: 0, scale: 0.985, filter: "blur(3px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 1.015, filter: "blur(3px)" }}
                    transition={{ duration: 0.26, ease: "easeOut" }}
                    className="w-full h-full"
                  >
                    <Image
                      className="console-image"
                      src={productImages[activeHeroView]}
                      alt={dictionary.hero.consoleAlt}
                      width={1920}
                      height={1080}
                      priority
                      loading="eager"
                      sizes="(max-width: 820px) calc(100vw - 32px), (max-width: 1100px) calc(100vw - 48px), 650px"
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
            <motion.div
              className="metric-float metric-online"
              initial={{ opacity: 0, scale: 0.88, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
              <span className="metric-icon"><Gauge size={18} /></span>
              <span><b>Live</b><small>{dictionary.hero.availability}</small></span>
            </motion.div>
            <motion.div
              className="metric-float metric-latency"
              initial={{ opacity: 0, scale: 0.88, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.4 }}
            >
              <span className="pulse-ring"><i /></span>
              <span><b>Low</b><small>{dictionary.hero.latency}</small></span>
            </motion.div>
          </motion.div>
        </div>

        <motion.div
          className="hero-stats shell"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-30px" }}
          variants={staggerContainer}
        >
          {dictionary.hero.stats.map((stat) => (
            <motion.div key={stat.label} variants={fadeInUp}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section className="section capabilities-section" id="capabilities">
        <div className="shell">
          <motion.div
            className="section-heading split-heading"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5 }}
          >
            <div><span className="section-kicker">{dictionary.capabilities.kicker}</span><h2>{dictionary.capabilities.title}<br />{dictionary.capabilities.titleAccent}</h2></div>
            <p>{dictionary.capabilities.description}</p>
          </motion.div>
          <motion.div
            className="capability-grid"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            variants={staggerContainer}
          >
            {dictionary.capabilities.items.map(({ title, description }, index) => {
              const Icon = capabilityIcons[index];
              return (
              <motion.article
                className="capability-item"
                key={title}
                variants={fadeInUp}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
              >
                <span className={`capability-icon ${capabilityAccents[index]}`}><Icon size={23} /></span>
                <span className="capability-index">0{index + 1}</span>
                <h3>{title}</h3><p>{description}</p>
                <a href="#showcase" onClick={() => setActiveShowcaseIndex(index)}>
                  {dictionary.capabilities.learnMore} <ChevronRight size={15} />
                </a>
              </motion.article>
            );})}
          </motion.div>
        </div>
      </section>

      {/* Showcase Section: Interactive Product Viewers */}
      <section className="showcase-section" id="showcase">
        <div className="shell">
          <motion.div
            className="showcase-header"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5 }}
          >
            <span className="section-kicker">{dictionary.showcase.kicker}</span>
            <h2>{dictionary.showcase.title}<span>{dictionary.showcase.titleAccent}</span></h2>
            <p>{dictionary.showcase.description}</p>
          </motion.div>

          <div className="showcase-tabs-nav" role="tablist" aria-label={dictionary.accessibility.showcaseTabsLabel}>
            {showcaseTabs.map((tab, idx) => {
              const TabIcon = showcaseIcons[idx] || Monitor;
              const isActive = activeShowcaseIndex === idx;
              return (
                <button
                  key={tab.id}
                  id={`showcase-tab-${idx}`}
                  type="button"
                  className={`showcase-tab-btn relative ${isActive ? "active" : ""}`}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="showcase-product-panel"
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveShowcaseIndex(idx)}
                  onKeyDown={(event) => handleTabKeyDown(event, idx, showcaseTabs.length, setActiveShowcaseIndex, "showcase-tab")}
                >
                  {isActive && (
                    <motion.div
                      layoutId="showcase-tab-pill"
                      className="absolute inset-0 rounded-[10px] border border-blue-500/80 bg-blue-600/15 shadow-[0_10px_28px_rgba(40,108,255,0.25)] pointer-events-none"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    />
                  )}
                  <div className="showcase-tab-top relative z-10">
                    <TabIcon size={18} />
                    <span className="showcase-tab-tag">{tab.tag}</span>
                  </div>
                  <strong className="showcase-tab-title relative z-10">{tab.name}</strong>
                  <span className="showcase-tab-sub relative z-10">{tab.subtitle}</span>
                </button>
              );
            })}
          </div>

          <motion.div
            className="showcase-window"
            id="showcase-product-panel"
            role="tabpanel"
            aria-labelledby={`showcase-tab-${activeShowcaseIndex}`}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <div className="showcase-window-bar">
              <div className="showcase-window-left">
                <div className="console-window-dots" aria-hidden="true">
                  <span className="console-dot console-dot-close" />
                  <span className="console-dot console-dot-min" />
                  <span className="console-dot console-dot-max" />
                </div>
                <div className="showcase-window-url">
                  <LockKeyhole size={11} />
                  <motion.span
                    key={currentShowcase.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    https://console.nodexa.internal/{currentShowcase.id}
                  </motion.span>
                </div>
              </div>
              <span className="showcase-badge-pill">
                <i />{dictionary.showcase.previewBadge}
              </span>
            </div>

            <div className="showcase-content-area">
              <div className="showcase-image-holder">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentShowcase.id}
                    initial={{ opacity: 0, scale: 0.985, filter: "blur(3px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 1.015, filter: "blur(3px)" }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className="w-full h-full"
                  >
                    <Image
                      className="showcase-img"
                      src={currentShowcaseImg}
                      alt={currentShowcase.title}
                      width={1920}
                      height={1080}
                      sizes="(max-width: 820px) calc(100vw - 32px), (max-width: 1240px) calc(100vw - 48px), 1180px"
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentShowcase.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
                className="showcase-footer-meta"
              >
                <div className="showcase-meta-copy">
                  <h4>{currentShowcase.title}</h4>
                  <p>{currentShowcase.description}</p>
                </div>
                <div className="showcase-highlights-list">
                  {currentShowcase.highlights.map((item) => (
                    <span className="showcase-hl-chip" key={item}>
                      <Sparkles size={13} />
                      {item}
                    </span>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </section>

      <section className="section workflow-section" id="workflow">
        <div className="shell workflow-layout">
          <motion.div
            className="workflow-copy"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.55 }}
          >
            <span className="section-kicker">{dictionary.workflow.kicker}</span>
            <h2>{dictionary.workflow.title}<br />{dictionary.workflow.titleAccent}</h2>
            <p>{dictionary.workflow.description}</p>
            <a className="text-link" href="#deployment">{dictionary.workflow.link} <ArrowRight size={17} /></a>
          </motion.div>
          <motion.div
            className="workflow-board"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            variants={staggerContainer}
          >
            <div className="workflow-path" aria-hidden="true" />
            {dictionary.workflow.steps.map(({ label, detail }, index) => {
              const Icon = workflowIcons[index];
              return (
              <motion.div
                className="workflow-step"
                key={label}
                variants={fadeInUp}
                whileHover={{ scale: 1.025, transition: { duration: 0.2 } }}
              >
                <span className="step-number">{index + 1}</span><span className="step-icon"><Icon size={22} /></span>
                <strong>{label}</strong><small>{detail}</small>
              </motion.div>
            );})}
            <motion.div
              className="command-preview"
              variants={fadeInUp}
              whileHover={{ scale: 1.01 }}
            >
              <div><span /><span /><span /></div>
              <code>nodexa run patch-security --group production</code>
              <p><Zap size={14} fill="currentColor" />{dictionary.workflow.commandResult}</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="section mobile-section">
        <div className="shell mobile-layout">
          <motion.div
            className="access-stage"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <div className="access-stage-backdrop" aria-hidden="true" />
            <div className="access-window">
              <div className="access-bar">
                <div className="console-window-dots" aria-hidden="true">
                  <span className="console-dot console-dot-close" />
                  <span className="console-dot console-dot-min" />
                  <span className="console-dot console-dot-max" />
                </div>
                <span>https://console.nodexa.internal/login</span>
                <span className="live-indicator"><i />Protected</span>
              </div>
              <div className="access-image-wrap">
                <Image
                  className="access-image"
                  src={productImages.login}
                  alt={dictionary.mobile.imageAlt}
                  width={1920}
                  height={1080}
                  sizes="(max-width: 820px) calc(100vw - 32px), 620px"
                />
              </div>
            </div>
            <motion.div
              className="access-badge"
              initial={{ scale: 0.9, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.4 }}
            >
              <ShieldAlert size={22} />
              <span><b>{dictionary.mobile.badgeTitle}</b><small>{dictionary.mobile.badgeDescription}</small></span>
            </motion.div>
          </motion.div>
          <motion.div
            className="mobile-copy"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <span className="section-kicker">{dictionary.mobile.kicker}</span>
            <h2>{dictionary.mobile.title}<br />{dictionary.mobile.titleAccent}</h2>
            <p>{dictionary.mobile.description}</p>
            <motion.div
              className="feature-list"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
            >
              {dictionary.mobile.features.map((feature, index) => {
                const Icon = mobileIcons[index];
                return (
                  <motion.div key={feature.title} variants={fadeInUp}>
                    <Icon size={20} />
                    <span><b>{feature.title}</b><small>{feature.description}</small></span>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="section security-section" id="security">
        <div className="shell security-layout">
          <motion.div
            className="security-copy"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5 }}
          >
            <span className="section-kicker light">{dictionary.security.kicker}</span>
            <h2>{dictionary.security.title}<br />{dictionary.security.titleAccent}</h2>
            <p>{dictionary.security.description}</p>
            <div className="trust-list">
              {dictionary.security.trustItems.map((item) => (
                <span key={item}><Check size={15} />{item}</span>
              ))}
            </div>
          </motion.div>
          <motion.div
            className="architecture"
            aria-label={dictionary.security.architectureLabel}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            variants={staggerContainer}
          >
            <motion.div variants={fadeInUp} className="architecture-node endpoints">
              <MonitorSmartphone size={24} />
                <span><b>{dictionary.security.architectureNodes.operations.title}</b><small>{dictionary.security.architectureNodes.operations.detail}</small></span>
            </motion.div>
            <div className="architecture-line"><i /></div>
            <motion.div variants={fadeInUp} className="architecture-node gateway">
              <LockKeyhole size={24} />
                <span><b>{dictionary.security.architectureNodes.gateway.title}</b><small>{dictionary.security.architectureNodes.gateway.detail}</small></span>
            </motion.div>
            <div className="architecture-line"><i /></div>
            <motion.div variants={fadeInUp} className="architecture-node infrastructure">
              <ServerCog size={24} />
              <span><b>{dictionary.security.architectureNodes.infrastructure.title}</b><small>{dictionary.security.architectureNodes.infrastructure.detail}</small></span>
            </motion.div>
            <span className="encrypted-label"><Fingerprint size={14} />{dictionary.security.encryptedChannel}</span>
          </motion.div>
        </div>
      </section>

      <section className="section deployment-section" id="deployment">
        <motion.div
          className="shell deployment-layout"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.55 }}
        >
          <div><span className="section-kicker">{dictionary.deployment.kicker}</span><h2>{dictionary.deployment.title}</h2></div>
          <p>{dictionary.deployment.description}</p>
          <motion.div
            className="deployment-options"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {dictionary.deployment.options.map((option, index) => {
              const Icon = deploymentIcons[index];
              return (
                <motion.span
                  key={option}
                  variants={fadeInUp}
                  whileHover={{ scale: 1.05, transition: { duration: 0.15 } }}
                >
                  <Icon size={20} /><b>{option}</b>
                </motion.span>
              );
            })}
          </motion.div>
        </motion.div>
      </section>

      <section className="section contact-section" id="contact">
        <div className="shell contact-layout">
          <div>
            <span className="section-kicker">{dictionary.contact.kicker}</span>
            <h2>{dictionary.contact.title}</h2>
            <p>{dictionary.contact.description}</p>
          </div>
          {hasContactDetails ? (
            <div className="contact-list">
              {contactItems.map((item) => {
                const content = <><span>{item.label}</span><strong>{item.value}</strong></>;
                return item.href ? <a key={item.label} href={item.href}>{content}<ArrowRight size={17} /></a> : <div key={item.label}>{content}</div>;
              })}
            </div>
          ) : (
            <p className="contact-empty">{dictionary.contact.empty}</p>
          )}
        </div>
      </section>

      <section className="final-cta">
        <motion.div
          className="shell cta-inner"
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-30px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div><span className="section-kicker light">{dictionary.cta.kicker}</span><h2>{dictionary.cta.title}<br />{dictionary.cta.titleAccent}</h2></div>
          <a className="button button-light" href={primaryActionHref} {...(primaryActionExternal ? { target: "_blank", rel: "noreferrer" } : {})}>{hasContactDetails ? dictionary.cta.action : primaryActionLabel} <ArrowRight size={18} /></a>
        </motion.div>
      </section>

      <footer className="site-footer">
        <div className="shell footer-inner">
          <a className="brand footer-brand" href="#top"><span className="brand-mark"><Image src="/logo.png" alt="" width={38} height={38} /></span><span><strong>Nodexa</strong><small>RMM</small></span></a>
          <p>{dictionary.footer.description}</p>
          <span>© {new Date().getFullYear()} {dictionary.footer.copyright}</span>
        </div>
      </footer>
      </main>
    </>
  );
}

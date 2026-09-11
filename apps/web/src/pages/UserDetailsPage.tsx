import {
  ApartmentOutlined,
  AuditOutlined,
  ClockCircleFilled,
  CopyOutlined,
  DesktopOutlined,
  EditOutlined,
  KeyOutlined,
  LaptopOutlined,
  LockOutlined,
  MailOutlined,
  SafetyCertificateFilled,
  SafetyOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, Tag, message } from 'antd';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

type DetailTab = 'overview' | 'device-groups' | 'user-groups' | 'shared-devices' | 'logs';

const tabs: Array<{ key: DetailTab; label: string; icon: ReactNode }> = [
  { key: 'overview', label: '概览', icon: <LaptopOutlined /> },
  { key: 'device-groups', label: '设备组', icon: <ApartmentOutlined /> },
  { key: 'user-groups', label: '用户组', icon: <TeamOutlined /> },
  { key: 'shared-devices', label: '共用设备', icon: <DesktopOutlined /> },
  { key: 'logs', label: '操作日志', icon: <AuditOutlined /> },
];

const deviceGroups = [
  ['云平台公司', '全部权限'],
  ['云服务小组', '全部权限'],
  ['测试机房707', '全部权限'],
];

const userGroups = [
  ['IT运维组', '继承权限：查看、控制、管理'],
  ['开发组', '继承权限：查看、控制'],
];

const sharedDevices = [
  ['研发主机 01', '查看 / 控制'],
  ['测试服务器', '查看 / 控制 / 管理'],
  ['办公电脑 03', '查看 / 控制'],
];

const logs = [
  ['2025-09-08 14:32', '登录', '用户登录成功', '-', '192.168.1.20', 'green'],
  ['2025-09-08 13:45', '远程控制', '连接到 研发主机 01', '研发主机 01', '192.168.1.20', 'blue'],
  ['2025-09-08 11:20', '权限变更', '添加设备组权限：生产服务器组', '-', '192.168.1.20', 'purple'],
  ['2025-09-08 09:15', '文件管理', '访问文件：/data/config', '测试服务器', '192.168.1.15', 'geekblue'],
  ['2025-09-08 08:52', '登出', '用户主动登出', '-', '192.168.1.20', 'gold'],
];

function SummaryCard({ icon, title, value, tone }: { icon: ReactNode; title: string; value: number; tone: string }) {
  return (
    <article className="user-detail-summary-card">
      <span className={`user-detail-summary-icon ${tone}`}>{icon}</span>
      <span>
        <small>{title}</small>
        <strong>{value}</strong>
      </span>
      <span className="user-detail-chevron">›</span>
    </article>
  );
}

function AccessCard({ icon, title, rows, total, tone }: { icon: ReactNode; title: string; rows: string[][]; total: number; tone: string }) {
  return (
    <article className="user-detail-access-card">
      <header>
        <h2><span className={tone}>{icon}</span>{title}</h2>
        <button onClick={() => void message.info(`${title}列表为静态演示数据。`)}>查看全部 {total} ›</button>
      </header>
      <div className="user-detail-access-head"><span>名称</span><span>权限</span></div>
      {rows.map(([name, permission]) => (
        <button className="user-detail-access-row" key={name} onClick={() => void message.info(`${name}为静态演示数据。`)}>
          <span>{name}</span><span>{permission}</span><b>›</b>
        </button>
      ))}
    </article>
  );
}

export function UserDetailsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  return (
    <main className="user-details-page page-stack">
      <nav className="user-detail-breadcrumb" aria-label="面包屑">
        <button onClick={() => navigate('/admin/users')}>用户管理</button><span>›</span><strong>用户详情</strong>
      </nav>

      <section className="user-detail-hero">
        <div className="user-detail-profile">
          <span className="user-detail-avatar"><UserOutlined /></span>
          <div className="user-detail-name">
            <div><h1>zhangsan</h1><Tag color="success">● 在线</Tag></div>
            <p>张三</p>
            <small><MailOutlined /> zhangsan@company.com</small>
            <div className="user-detail-actions">
              <Button size="small" icon={<EditOutlined />} onClick={() => void message.info('编辑功能暂未接入。')}>编辑</Button>
              <Button size="small" icon={<KeyOutlined />} onClick={() => void message.info('重置密码功能暂未接入。')}>重置密码</Button>
              <Button size="small" danger icon={<LockOutlined />} onClick={() => void message.info('禁用功能暂未接入。')}>禁用账户</Button>
            </div>
          </div>
        </div>

        <dl className="user-detail-meta">
          <div><dt><UserOutlined /> 用户ID</dt><dd>1001</dd></div>
          <div><dt><ClockCircleFilled /> 创建时间</dt><dd>2025-01-15 10:24</dd></div>
          <div><dt><ClockCircleFilled /> 最后登录</dt><dd>2025-09-08 14:32</dd></div>
          <div><dt><SafetyOutlined /> 登录IP</dt><dd>192.168.1.20 <CopyOutlined /></dd></div>
          <div><dt><SafetyOutlined /> MFA</dt><dd className="enabled">● 已启用</dd></div>
        </dl>

        <div className="user-detail-sessions">
          <span><SafetyCertificateFilled /></span>
          <div><strong>3 个活跃会话</strong><small>当前有 3 个设备正在登录</small></div>
          <Button size="small" onClick={() => void message.info('会话列表为静态演示数据。')}>查看会话</Button>
          <b>›</b>
        </div>
      </section>

      <nav className="user-detail-tabs">
        {tabs.map((tab) => (
          <button key={tab.key} className={activeTab === tab.key ? 'active' : ''} onClick={() => setActiveTab(tab.key)}>
            {tab.icon}<span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {activeTab === 'overview' ? (
        <>
          <section className="user-detail-summary-grid">
            <SummaryCard icon={<TeamOutlined />} title="设备组" value={3} tone="blue" />
            <SummaryCard icon={<TeamOutlined />} title="用户组" value={2} tone="purple" />
            <SummaryCard icon={<DesktopOutlined />} title="共用设备" value={5} tone="green" />
          </section>
          <section className="user-detail-access-grid">
            <AccessCard icon={<TeamOutlined />} title="设备组" rows={deviceGroups} total={3} tone="blue-text" />
            <AccessCard icon={<TeamOutlined />} title="用户组" rows={userGroups} total={2} tone="purple-text" />
            <AccessCard icon={<DesktopOutlined />} title="共用设备" rows={sharedDevices} total={5} tone="blue-text" />
          </section>
          <section className="user-detail-log-card">
            <h2><ClockCircleFilled /> 最近操作日志</h2>
            <div className="user-detail-log-table">
              <div className="user-detail-log-head"><span>时间</span><span>操作类型</span><span>操作内容</span><span>设备/资源</span><span>IP 地址</span></div>
              {logs.map(([time, type, content, resource, ip, color]) => (
                <div className="user-detail-log-row" key={`${time}-${type}`}>
                  <span>{time}</span><span><Tag color={color}>{type}</Tag></span><span>{content}</span><span>{resource}</span><span>{ip}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="user-detail-placeholder">
          <span>{tabs.find((tab) => tab.key === activeTab)?.icon}</span>
          <h2>{tabs.find((tab) => tab.key === activeTab)?.label}</h2>
          <p>此区域为静态页面占位，真实数据将在后续接入。</p>
        </section>
      )}
    </main>
  );
}

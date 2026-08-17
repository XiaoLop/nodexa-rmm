import { DashboardOutlined, DesktopOutlined, MenuFoldOutlined } from '@ant-design/icons';
import { Button, Layout, Menu, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useConnectionSummary } from '../features/gateway/useGatewayData';

const { Header, Sider, Content } = Layout;

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { status, color } = useConnectionSummary();

  return (
    <Layout className="app-shell">
      <Sider collapsed={collapsed} width={248} className="app-sider">
        <div className="brand">
          <div className="brand-mark">M</div>
          {!collapsed && <span>Mesh Console</span>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          onClick={({ key }) => navigate(key)}
          items={[
            { key: '/dashboard', icon: <DashboardOutlined />, label: '运行概览' },
            { key: '/devices', icon: <DesktopOutlined />, label: '设备管理' },
          ]}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <Button
            type="text"
            icon={<MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Space>
            <Typography.Text type="secondary">业务网关</Typography.Text>
            <Tag color={color}>{status}</Tag>
          </Space>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

import {
  CheckCircleOutlined,
  DesktopOutlined,
  DisconnectOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Col, Empty, List, Row, Space, Statistic, Typography } from 'antd';
import { useGatewayData } from '../features/gateway/useGatewayData';

export function DashboardPage() {
  const { devices, events, configured, client, status, error } = useGatewayData();
  const online = devices.filter((device) => device.online).length;

  return (
    <Space orientation="vertical" size={24} className="page-stack">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>运行概览</Typography.Title>
          <Typography.Text type="secondary">来自业务 WebSocket 网关的实时设备状态</Typography.Text>
        </div>
        <Button
          type="primary"
          icon={<SyncOutlined />}
          disabled={!configured || status === 'connecting'}
          onClick={() => void client?.connect().catch(() => undefined)}
        >
          重新连接
        </Button>
      </div>

      {!configured && (
        <Alert
          type="warning"
          showIcon
          title="尚未配置业务网关"
          description="请在 apps/web/.env.local 中配置 VITE_GATEWAY_WS_URL。"
        />
      )}
      {error && <Alert type="error" showIcon title={error} />}

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="设备总数" value={devices.length} prefix={<DesktopOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="在线设备"
              value={online}
              prefix={<CheckCircleOutlined />}
              styles={{ content: { color: '#5eead4' } }}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="离线设备"
              value={devices.length - online}
              prefix={<DisconnectOutlined />}
              styles={{ content: { color: '#fb7185' } }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="最近事件" className="event-card">
        {events.length === 0 ? (
          <Empty description="等待网关推送事件" />
        ) : (
          <List
            dataSource={events.slice(0, 8)}
            renderItem={(event) => (
              <List.Item>
                <List.Item.Meta
                  title={event.message || event.type}
                  description={`${event.deviceId ?? '系统'} · ${new Date(event.occurredAt).toLocaleString()}`}
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </Space>
  );
}

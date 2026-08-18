import {
  CheckCircleOutlined,
  DesktopOutlined,
  DisconnectOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { formatEventMessage, getEventTargetName } from '@meshcentral/shared-state';
import { Alert, Button, Card, Col, Empty, List, Row, Space, Statistic, Typography } from 'antd';
import { useGatewayData } from '../features/gateway/useGatewayData';

export function DashboardPage() {
  const { devices, groups, events, configured, client, status, error } = useGatewayData();
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
            size="small"
            dataSource={events.slice(0, 8)}
            renderItem={(event) => {
              const time = new Date(event.occurredAt);
              const timeStr = isNaN(time.getTime())
                ? '00:00:00'
                : `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}:${String(time.getSeconds()).padStart(2, '0')}`;
              const targetDevice = getEventTargetName(event, devices);
              const displayMsg = formatEventMessage(event, devices, groups);

              return (
                <List.Item style={{ padding: '8px 0', fontSize: '13px' }}>
                  <Space size={6} wrap>
                    <Typography.Text type="secondary" style={{ fontFamily: 'monospace' }}>
                      {timeStr}
                    </Typography.Text>
                    <Typography.Text type="secondary">-</Typography.Text>
                    {event.user ? (
                      <>
                        <Typography.Link style={{ fontWeight: 600 }}>
                          {event.user}
                        </Typography.Link>
                        <Typography.Text type="secondary">→</Typography.Text>
                      </>
                    ) : null}
                    {targetDevice ? (
                      <>
                        <Typography.Link style={{ fontWeight: 600 }}>
                          {targetDevice}
                        </Typography.Link>
                        <Typography.Text type="secondary">→</Typography.Text>
                      </>
                    ) : null}
                    <Typography.Text>{displayMsg}</Typography.Text>
                    {event.ip ? (
                      <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                        ({event.ip})
                      </Typography.Text>
                    ) : null}
                  </Space>
                </List.Item>
              );
            }}
          />
        )}
      </Card>
    </Space>
  );
}

import { isFullAdministrator, type ManagedUser } from '@meshcentral/control-client';
import { Descriptions, Drawer, Tag } from 'antd';

interface UserDetailsDrawerProps {
  user?: ManagedUser;
  sessionCount?: number;
  sessionsKnown: boolean;
  onClose: () => void;
}

function formatDateTime(value?: string, missing = '未提供') {
  if (!value) return missing;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return missing;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function UserDetailsDrawer({
  user,
  sessionCount,
  sessionsKnown,
  onClose,
}: UserDetailsDrawerProps) {
  return (
    <Drawer
      title={user ? `用户详情：${user.name}` : '用户详情'}
      open={Boolean(user)}
      width="min(620px, 100vw)"
      onClose={onClose}
      destroyOnHidden
    >
      {user ? (
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="用户 ID">{user.id}</Descriptions.Item>
          <Descriptions.Item label="用户名">{user.name}</Descriptions.Item>
          <Descriptions.Item label="真实姓名">{user.realName || '未提供'}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{user.email || '未提供'}</Descriptions.Item>
          <Descriptions.Item label="电话">{user.phone || '未提供'}</Descriptions.Item>
          <Descriptions.Item label="账户状态">
            <Tag color={user.locked ? 'error' : 'success'}>{user.locked ? '已锁定' : '正常'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="账户类型">
            {isFullAdministrator(user.siteRights) ? '全站管理员' : '普通用户'}
          </Descriptions.Item>
          <Descriptions.Item label="当前在线">
            {sessionsKnown ? (
              <Tag color={sessionCount ? 'success' : 'default'}>
                {sessionCount ? `在线（${sessionCount} 个会话）` : '离线'}
              </Tag>
            ) : (
              <Tag>未知</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">{formatDateTime(user.createdAt)}</Descriptions.Item>
          <Descriptions.Item label="最近登录">
            {formatDateTime(user.lastLoginAt, '从未登录')}
          </Descriptions.Item>
          <Descriptions.Item label="上次登录">
            {formatDateTime(user.previousLoginAt, '从未登录')}
          </Descriptions.Item>
          <Descriptions.Item label="最近访问">
            {formatDateTime(user.lastAccessAt)}
          </Descriptions.Item>
          <Descriptions.Item label="密码最近修改">
            {formatDateTime(user.passwordChangedAt)}
          </Descriptions.Item>
        </Descriptions>
      ) : null}
    </Drawer>
  );
}

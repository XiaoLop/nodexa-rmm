import { BellOutlined } from '@ant-design/icons';
import { Badge, Button } from 'antd';

interface NotificationBellProps {
  unreadCount: number;
  label: string;
  unreadLabel: string;
  onOpen: () => void;
}

export function NotificationBell({
  unreadCount,
  label,
  unreadLabel,
  onOpen,
}: NotificationBellProps) {
  return (
    <Badge count={unreadCount} size="small" overflowCount={99} className="notification-trigger">
      <Button
        type="text"
        icon={<BellOutlined />}
        aria-label={unreadCount > 0 ? `${label}, ${unreadLabel}` : label}
        onClick={onOpen}
      />
    </Badge>
  );
}

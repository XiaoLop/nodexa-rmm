import { UserOutlined } from '@ant-design/icons';
import { Avatar, type AvatarProps } from 'antd';
import { useEffect, useState } from 'react';

interface UserAvatarProps extends Omit<AvatarProps, 'icon' | 'src'> {
  username?: string;
  refreshKey?: string | number;
  src?: string;
}

export function getUserAvatarUrl(username: string, refreshKey: string | number = Date.now()): string {
  const query = new URLSearchParams({
    id: username,
    rnd: String(refreshKey),
  });
  return `/api/userimage.ashx?${query.toString()}`;
}

export function UserAvatar({ username, refreshKey, src, ...props }: UserAvatarProps) {
  const [generatedRefreshKey] = useState(() => Date.now());
  const remoteSrc = username
    ? getUserAvatarUrl(username, refreshKey ?? generatedRefreshKey)
    : undefined;
  const resolvedSrc = src ?? remoteSrc;
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
  }, [resolvedSrc]);

  return (
    <Avatar
      {...props}
      src={loadFailed ? undefined : resolvedSrc}
      icon={<UserOutlined />}
      onError={() => {
        setLoadFailed(true);
        return false;
      }}
    />
  );
}
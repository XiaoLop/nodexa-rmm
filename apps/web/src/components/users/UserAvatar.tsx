import { UserOutlined } from '@ant-design/icons';
import { Avatar, type AvatarProps } from 'antd';
import { useEffect, useState } from 'react';

interface UserAvatarProps extends Omit<AvatarProps, 'icon' | 'src'> {
  username?: string;
  refreshKey?: string | number;
  src?: string;
  hasImage?: boolean;
}

export function getUserAvatarUrl(username: string, refreshKey: string | number = Date.now()): string {
  const query = new URLSearchParams({
    id: username,
    rnd: String(refreshKey),
  });
  return `/api/userimage.ashx?${query.toString()}`;
}

export function UserAvatar({ username, refreshKey, src, hasImage = true, ...props }: UserAvatarProps) {
  const [generatedRefreshKey] = useState(() => Date.now());
  const remoteSrc = username && hasImage
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
      src={
        loadFailed || !resolvedSrc ? undefined : (
          <img
            src={resolvedSrc}
            alt=""
            width="100%"
            height="100%"
            loading="lazy"
            decoding="async"
            style={{ objectFit: 'cover' }}
            onError={() => setLoadFailed(true)}
          />
        )
      }
      icon={<UserOutlined />}
    />
  );
}
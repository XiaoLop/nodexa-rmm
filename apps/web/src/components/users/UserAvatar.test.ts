import { describe, expect, it } from 'vitest';
import { getUserAvatarUrl } from './UserAvatar';

describe('getUserAvatarUrl', () => {
  it('builds the proxied MeshCentral user image URL', () => {
    expect(getUserAvatarUrl('root', 1034526898)).toBe(
      '/api/userimage.ashx?id=root&rnd=1034526898',
    );
  });

  it('encodes usernames before adding them to the query string', () => {
    expect(getUserAvatarUrl('domain/user name', 'refresh')).toBe(
      '/api/userimage.ashx?id=domain%2Fuser+name&rnd=refresh',
    );
  });
});
import { useEffect } from 'react';
import type { DesktopCompressionOptions, DesktopSession } from '@meshcentral/relay';
import { desktopCompression } from './desktopSettings';

export function useDesktopCompression(
  session: Pick<DesktopSession, 'setCompression'> | undefined,
  screenKnown: boolean,
  settings: DesktopCompressionOptions,
  onError: (error: unknown) => void,
): void {
  const { imageFormat, quality, frameTimer } = settings;
  useEffect(() => {
    if (!session || !screenKnown) return;
    const timer = window.setTimeout(() => {
      try {
        session.setCompression(desktopCompression({ imageFormat, quality, frameTimer }));
      } catch (error) {
        onError(error);
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [session, screenKnown, imageFormat, quality, frameTimer, onError]);
}

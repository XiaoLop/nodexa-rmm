import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';

export function deleteDeviceConfirmationContent(t: TFunction, name: string): ReactNode {
  return (
    <div>
      <p>{t('devices.confirm.deleteContent', { name })}</p>
      <p>{t('devices.confirm.deleteAgentNotice')}</p>
    </div>
  );
}

export function batchPowerConfirmationContent(
  t: TFunction,
  count: number,
  skippedCount: number,
  action: string,
): ReactNode {
  return (
    <div>
      <p>{t('devices.confirm.batchPowerContent', { count, action })}</p>
      {skippedCount > 0 && (
        <p>{t('devices.confirm.batchPowerSkipped', { count: skippedCount })}</p>
      )}
      <p>{t('devices.confirm.batchPowerNotice')}</p>
    </div>
  );
}

export function batchUninstallConfirmationContent(
  t: TFunction,
  count: number,
  skippedCount: number,
): ReactNode {
  return (
    <div>
      <p>{t('devices.confirm.batchUninstallAgentContent', { count })}</p>
      {skippedCount > 0 && (
        <p>{t('devices.confirm.batchUninstallAgentSkipped', { count: skippedCount })}</p>
      )}
      <p>{t('devices.confirm.batchUninstallAgentNotice')}</p>
    </div>
  );
}

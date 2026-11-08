import { CopyOutlined } from '@ant-design/icons';
import type { RmmResult } from '@meshcentral/control-client';
import { Alert, Button, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../../assets/styles/tasks.css';

export function ResultOutput({ result }: { result: RmmResult }) {
  const { t } = useTranslation();
  const [copyState, setCopyState] = useState<'success' | 'error'>();
  const output = result.output;
  return (
    <div className="task-command-output-box">
      <Space orientation="vertical" style={{ width: '100%' }}>
        <Space wrap>
          <Typography.Text strong>
            {result.name} · {t('rmm.outputTitle')}
          </Typography.Text>
          {result.truncated && <Tag color="warning">{t('rmm.truncated')}</Tag>}
          {output !== null && output !== '' && (
            <Button
              icon={<CopyOutlined />}
              size="small"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(output);
                  setCopyState('success');
                } catch {
                  setCopyState('error');
                }
              }}
            >
              {t('common.actions.copy')}
            </Button>
          )}
        </Space>
        {result.truncated && <Alert type="warning" message={t('rmm.outputTruncatedNotice')} />}
        {copyState && (
          <Alert
            type={copyState}
            message={t(copyState === 'success' ? 'rmm.outputCopied' : 'rmm.copyFailed')}
          />
        )}
        {result.output === null ? (
          <Typography.Text type="secondary">{t('rmm.outputUnavailable')}</Typography.Text>
        ) : result.output === '' ? (
          <Typography.Text type="secondary">{t('rmm.outputEmpty')}</Typography.Text>
        ) : (
          <pre className="task-command-pre">{result.output}</pre>
        )}
      </Space>
    </div>
  );
}

import { ClockCircleOutlined } from '@ant-design/icons';
import { Button, Result } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export function ComingSoonPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="placeholder-card">
      <Result
        icon={<ClockCircleOutlined />}
        title={t('comingSoon.title')}
        subTitle={t('comingSoon.subTitle')}
        extra={
          <Button type="primary" onClick={() => navigate('/dashboard')}>
            {t('common.actions.backToDashboard')}
          </Button>
        }
      />
    </div>
  );
}

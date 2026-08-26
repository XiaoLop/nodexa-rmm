import { ClockCircleOutlined } from '@ant-design/icons';
import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

export function ComingSoonPage() {
  const navigate = useNavigate();
  return (
    <div className="placeholder-card">
      <Result
        icon={<ClockCircleOutlined />}
        title="功能正在接入"
        subTitle="当前已完成统一控制台框架。此模块将在业务网关开放对应 API 后启用。"
        extra={
          <Button type="primary" onClick={() => navigate('/dashboard')}>
            返回仪表盘
          </Button>
        }
      />
    </div>
  );
}

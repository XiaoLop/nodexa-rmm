import {
  ClockCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { MeshCentralClient } from '@meshcentral/control-client';
import { Alert, Button, Empty, Form, Input, Modal, Select, Spin, Tag, message } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createLoginToken,
  listLoginTokens,
  removeLoginToken,
  type CreatedLoginToken,
  type LoginToken,
} from './loginTokens';

interface LoginTokensSectionProps {
  client?: MeshCentralClient;
  connected: boolean;
  formatDateTime: (value: string | number | Date) => string;
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function LoginTokensSection({
  client,
  connected,
  formatDateTime,
}: LoginTokensSectionProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<{ name: string; expire: number }>();
  const [tokens, setTokens] = useState<LoginToken[]>([]);
  const [createdToken, setCreatedToken] = useState<CreatedLoginToken>();
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [removingTokenUser, setRemovingTokenUser] = useState<string>();
  const [error, setError] = useState<string>();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();

  const loadTokens = async (signal?: AbortSignal) => {
    if (!client || !connected) return;
    setLoading(true);
    setError(undefined);
    try {
      const nextTokens = await listLoginTokens(client);
      if (!signal?.aborted) setTokens(nextTokens);
    } catch (loadError) {
      if (!signal?.aborted) setError(errorDetail(loadError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    if (!client || !connected) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    void loadTokens(controller.signal);
    return () => controller.abort();
  }, [client, connected]);

  const copyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      void messageApi.success(t('profile.loginTokens.copied'));
    } catch {
      void messageApi.error(t('profile.loginTokens.copyFailed'));
    }
  };

  const createToken = async () => {
    if (!client) return;
    const { name, expire } = await form.validateFields();
    setCreating(true);
    try {
      const token = await createLoginToken(client, name.trim(), expire);
      setCreatedToken(token);
      setTokens((current) => [token, ...current.filter((item) => item.tokenUser !== token.tokenUser)]);
      form.resetFields();
      void messageApi.success(t('profile.loginTokens.created'));
    } catch (createError) {
      void messageApi.error(
        t('profile.loginTokens.createFailed', { detail: errorDetail(createError) }),
      );
    } finally {
      setCreating(false);
    }
  };

  const confirmRemoveToken = (token: LoginToken) => {
    if (!client) return;
    modalApi.confirm({
      title: t('profile.loginTokens.removeTitle'),
      content: t('profile.loginTokens.removeDescription', { name: token.name }),
      okText: t('profile.loginTokens.remove'),
      okButtonProps: { danger: true },
      cancelText: t('common.actions.cancel'),
      async onOk() {
        setRemovingTokenUser(token.tokenUser);
        try {
          setTokens(await removeLoginToken(client, token.tokenUser));
          void messageApi.success(t('profile.loginTokens.removed'));
        } catch (removeError) {
          void messageApi.error(
            t('profile.loginTokens.removeFailed', { detail: errorDetail(removeError) }),
          );
          throw removeError;
        } finally {
          setRemovingTokenUser(undefined);
        }
      },
    });
  };

  return (
    <section className="console-card profile-section profile-token-section">
      {messageContextHolder}
      {modalContextHolder}
      <header>
        <span>
          <KeyOutlined />
        </span>
        <div>
          <h2>{t('profile.loginTokens.title')}</h2>
          <p>{t('profile.loginTokens.description')}</p>
        </div>
        <Button
          type="text"
          icon={<ReloadOutlined />}
          loading={loading}
          disabled={!connected}
          title={t('profile.loginTokens.refresh')}
          aria-label={t('profile.loginTokens.refresh')}
          onClick={() => void loadTokens()}
        />
      </header>

      <Form
        form={form}
        className="profile-token-form"
        initialValues={{ expire: 0 }}
        onFinish={() => void createToken()}
      >
        <Form.Item
          name="name"
          rules={[
            { required: true, whitespace: true, message: t('profile.loginTokens.nameRequired') },
          ]}
        >
          <Input
            maxLength={64}
            placeholder={t('profile.loginTokens.namePlaceholder')}
            prefix={<KeyOutlined />}
          />
        </Form.Item>
        <Form.Item name="expire">
          <Select
            aria-label={t('profile.loginTokens.expiration')}
            prefix={<ClockCircleOutlined />}
            options={[
              { value: 0, label: t('profile.loginTokens.expirationOptions.never') },
              { value: 1440, label: t('profile.loginTokens.expirationOptions.oneDay') },
              { value: 10080, label: t('profile.loginTokens.expirationOptions.sevenDays') },
              { value: 43200, label: t('profile.loginTokens.expirationOptions.thirtyDays') },
              { value: 129600, label: t('profile.loginTokens.expirationOptions.ninetyDays') },
            ]}
          />
        </Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          icon={<PlusOutlined />}
          loading={creating}
          disabled={!connected}
        >
          {t('profile.loginTokens.create')}
        </Button>
      </Form>

      {!connected ? (
        <Alert type="warning" showIcon message={t('profile.loginTokens.disconnected')} />
      ) : error ? (
        <Alert
          type="error"
          showIcon
          message={t('profile.loginTokens.loadFailed')}
          description={error}
          action={<Button size="small" onClick={() => void loadTokens()}>{t('common.actions.retry')}</Button>}
        />
      ) : loading ? (
        <div className="profile-token-loading">
          <Spin size="small" />
          {t('profile.loginTokens.loading')}
        </div>
      ) : tokens.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('profile.loginTokens.empty')} />
      ) : (
        <div className="profile-token-list">
          {tokens.map((token) => (
            <div className="profile-token-row" key={token.tokenUser}>
              <div className="profile-token-main-info">
                <div className="profile-token-name-row">
                  <span className="profile-token-icon">
                    <KeyOutlined />
                  </span>
                  <strong>{token.name}</strong>
                </div>
                <code>{token.tokenUser}</code>
              </div>
              <div className="profile-token-meta">
                <span className="profile-token-time">{formatDateTime(token.created)}</span>
                <div className="profile-token-actions">
                  <Tag color={token.expire === 0 ? 'cyan' : 'default'} className="profile-token-expire-tag">
                    {token.expire === 0 ? t('profile.loginTokens.neverExpires') : formatDateTime(token.expire)}
                  </Tag>
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    loading={removingTokenUser === token.tokenUser}
                    disabled={!connected || Boolean(removingTokenUser)}
                    title={t('profile.loginTokens.remove')}
                    aria-label={t('profile.loginTokens.remove')}
                    onClick={() => confirmRemoveToken(token)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(createdToken)}
        title={t('profile.loginTokens.createdTitle')}
        okText={t('common.actions.close')}
        cancelButtonProps={{ style: { display: 'none' } }}
        onOk={() => setCreatedToken(undefined)}
        onCancel={() => setCreatedToken(undefined)}
      >
        <Alert type="warning" showIcon message={t('profile.loginTokens.passwordNotice')} />
        <div className="profile-token-credentials">
          <label>{t('profile.loginTokens.tokenUser')}</label>
          <Input
            readOnly
            value={createdToken?.tokenUser}
            suffix={<Button type="text" icon={<CopyOutlined />} aria-label={t('common.actions.copy')} onClick={() => void copyValue(createdToken?.tokenUser ?? '')} />}
          />
          <label>{t('profile.loginTokens.tokenPass')}</label>
          <Input.Password
            readOnly
            value={createdToken?.tokenPass}
            suffix={<Button type="text" icon={<CopyOutlined />} aria-label={t('common.actions.copy')} onClick={() => void copyValue(createdToken?.tokenPass ?? '')} />}
          />
        </div>
      </Modal>
    </section>
  );
}
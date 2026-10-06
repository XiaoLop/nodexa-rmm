import {
  ClockCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
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
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
      setCreateModalOpen(false);
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

  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const filteredTokens = normalizedSearch
    ? tokens.filter(
        (token) =>
          token.name.toLocaleLowerCase().includes(normalizedSearch) ||
          token.tokenUser.toLocaleLowerCase().includes(normalizedSearch),
      )
    : tokens;

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
    <section className="profile-content-card profile-token-section">
      {messageContextHolder}
      {modalContextHolder}
      <div className="profile-card-header">
        <div className="profile-card-title-group">
          <span className="profile-card-icon">
            <KeyOutlined />
          </span>
          <div>
            <h3>{t('profile.loginTokens.title')}</h3>
            <p>{t('profile.loginTokens.description')}</p>
          </div>
        </div>
        <div className="profile-token-header-actions">
          <Input
            allowClear
            className="profile-token-search"
            prefix={<SearchOutlined />}
            placeholder="搜索令牌名称或账号"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!connected}
            onClick={() => setCreateModalOpen(true)}
          >
            {t('profile.loginTokens.create')}
          </Button>
          <Button
            type="text"
            className="profile-token-refresh-btn"
            icon={<ReloadOutlined />}
            loading={loading}
            disabled={!connected}
            title={t('profile.loginTokens.refresh')}
            aria-label={t('profile.loginTokens.refresh')}
            onClick={() => void loadTokens()}
          />
        </div>
      </div>

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
      ) : filteredTokens.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到匹配的登录令牌" />
      ) : (
        <div className="profile-token-list">
          {filteredTokens.map((token) => (
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
                <div className="profile-token-created-meta">
                  <ClockCircleOutlined />
                  <span className="profile-token-time">{formatDateTime(token.created)}</span>
                </div>
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
        open={createModalOpen}
        title={t('profile.loginTokens.create')}
        okText={t('profile.loginTokens.create')}
        cancelText={t('common.actions.cancel')}
        confirmLoading={creating}
        okButtonProps={{ disabled: !connected }}
        onOk={() => void createToken()}
        onCancel={() => {
          setCreateModalOpen(false);
          form.resetFields();
        }}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ expire: 0 }}
          className="profile-token-modal-form"
        >
          <Form.Item
            name="name"
            label={t('profile.loginTokens.namePlaceholder')}
            rules={[
              { required: true, whitespace: true, message: t('profile.loginTokens.nameRequired') },
            ]}
          >
            <Input
              autoFocus
              maxLength={64}
              placeholder={t('profile.loginTokens.namePlaceholder')}
              prefix={<KeyOutlined />}
              onPressEnter={() => void createToken()}
            />
          </Form.Item>
          <Form.Item name="expire" label={t('profile.loginTokens.expiration')}>
            <Select
              options={[
                { value: 0, label: t('profile.loginTokens.expirationOptions.never') },
                { value: 1440, label: t('profile.loginTokens.expirationOptions.oneDay') },
                { value: 10080, label: t('profile.loginTokens.expirationOptions.sevenDays') },
                { value: 43200, label: t('profile.loginTokens.expirationOptions.thirtyDays') },
                { value: 129600, label: t('profile.loginTokens.expirationOptions.ninetyDays') },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

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
# 架构与可维护性护栏

本文把 `docs/plan/README.md` 中的分层规范落成可执行的约束，并记录 2026-10 这次重构的
结构与剩余债务。改动涉及以下四个方向。

## 1. 分层边界（ESLint 强制）

根 `eslint.config.mjs` 现在会拦截下列越界依赖，违反时 `pnpm lint` 直接失败：

| 包                        | 禁止依赖                                                                                   | 原因                                         |
| ------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------- |
| `packages/control-client` | `react`、`react-dom`、`antd`、`zustand`、`@meshcentral/shared-state`、`@meshcentral/relay` | 纯协议/传输层，可被 Node、测试和其他前端复用 |
| `packages/shared-state`   | `react-dom`、`antd`、`@meshcentral/relay`、`expo`、`react-native`                          | 状态绑定层，只允许 React 绑定，不承载 DOM UI |
| `packages/relay`          | `@meshcentral/control-client`、`@meshcentral/shared-state`、`react`、`react-dom`、`antd`   | 独立中继客户端，不感知应用状态               |
| `apps/web`                | `@meshcentral/app`、`expo`、`react-native`                                                 | 两个交付目标互不引用                         |
| `apps/app`                | `@meshcentral/web`                                                                         | 同上                                         |

另外，`control-client`、`shared-state`、`relay` 的 `src`（测试与 `testing/` 除外）禁止出现
汉字字面量。这是把“SDK 只产出结构化数据，文案留在应用层”从约定变成失败门禁。

## 2. 页面模块规范

三个千行页面按同一形状拆分，后续新页面照此办理：

```
pages/FooPage.tsx                路由参数 + 装配，目标 < 250 行
features/<domain>/useFoo.ts      数据加载、变更、错误归一，无 JSX
features/<domain>/<pure>.ts      过滤/排序/展示映射，可单测
components/<domain>/Foo*.tsx     视图、Tab、弹窗，props in / events out
```

约定：

- Hook 返回单个对象（`{ data, loading, error, actions }`），不返回 JSX，不直接操作 DOM。
- 弹窗只通过 `open` / `onSubmit` / `onCancel` / `submitting` 通信，不读取页面 state。
- 列定义跟随所属 Tab，不集中在页面顶层。
- 纯函数优先，单测覆盖边界（空查询、缺失资源、权限位组合）。
- 拆分前先补行为测试，拆分中不改 CSS 类名、i18n key 和 URL 参数语义。

已完成的拆分（本次）：

| 页面                   | 之前    | 之后   | 新增模块                                                                                                                      |
| ---------------------- | ------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `DevicesPage`          | 1180 行 | 148 行 | `features/devices`（列表查询、动作、展示映射、批量上传管理器）、`components/devices`（表头动作、工具栏、列、表格、弹窗）      |
| `UserGroupDetailsPage` | 1334 行 | 220 行 | `features/user-groups`（详情 Hook、过滤纯函数）、`components/user-groups`（头部、概览、三个 Tab、三个弹窗、权限弹窗、骨架屏） |
| `UserDetailsPage`      | 902 行  | 200 行 | `features/users`（详情 Hook、访问行、权限摘要）、`components/users`（头部、概要、访问 Tab、概览、日志、状态页）               |

仍超标的页面（下一步）：`ProfilePage`（1217 行）、`FilesPage`（1331 行）、
`DashboardPage`（812 行）。暂未加 `max-lines` 门禁，避免存量页面立即失败；等这三页拆完后
再对 `apps/web/src/pages/**` 启用 400 行上限。

## 3. 文案与 i18n

- `@meshcentral/shared-state` 的 `redactEventMessage()` 只做三件事：分类事件
  （`deviceOnline` / `raw` / `unknown` …）、把 `node//` `mesh//` `user//` 换成名称、
  无法解析时用 `…` 占位。它不再返回任何中文或英文文案。
- 文案映射在 `apps/web/src/features/events/eventPresentation.ts`，键为
  `events.messages.*`。新增事件类型时同时补 `events.types.*`。
- `apps/web/src/i18n/localeParity.test.ts` 保证中英字典键集合一致、没有空值，并校验事件
  文案键存在。
- `formatEventMessage()` / `getGreetingTime()` 保留为 `@deprecated` 兼容层，返回英文或中性
  占位，供尚未迁移的 `apps/app` 使用；迁移完成后删除。
- 仍待处理：`apps/web/src/features/users/meshPermissions.ts` 与 `sitePermissions.ts` 在未传
  `t` 时仍回退到中文 `label`/`description`（目前只被测试触发）。下一步把数据层收敛为纯
  `labelKey`/`descriptionKey`，测试改用 `testI18n`。

## 4. 版本与构建

- 根 `pnpm-workspace.yaml` 用 `catalog:` 统一共享依赖；`apps/site` 因跟随 Next.js 平台，
  单独使用 `catalogs.next`。改版本只改 catalog，再跑一次 `pnpm install`。
- 已移除废弃的 `apps/site/pnpm-workspace.yaml`；`sharp` / `unrs-resolver` 的
  构建策略统一放在根 `allowBuilds`。
- `meshcentral` 依赖必须是精确版本（当前 `1.1.54`）。Dockerfile 从
  `apps/meshcentral/package.json` 读取版本并与已安装包断言，不再从 GitHub 拉取
  `exeHandler.js`（该文件随 npm 包发布），构建可离线复现。

## 5. 资源 API 增补模板

阶段功能（Console、Trace、ErrorLog、录像、共享、部署、AMT）统一按下面顺序落地，先 SDK 后 UI：

1. 在 `packages/control-client/src/resources/<area>.ts` 增加方法，参数先校验，非法时抛
   `MeshCentralValidationError`。
2. 响应交给 `protocol/normalizers.ts`（或同目录新文件）归一化，未知结构返回 `undefined`
   而不是猜测字段。
3. 在 `resources/resources.test.ts` 增加一条请求构造断言 + 一条归一化断言。
4. 在 `packages/control-client/docs/messages-and-resources.md` 补一行：action、参数、返回、
   失败方式、验证版本。
5. 最后才在 `apps/web` 接入，禁止页面里直接 `client.request()` / `client.send()`。

```ts
// 示意：新增资源方法
async getConsoleTail(lines: number): Promise<string[]> {
  if (!Number.isInteger(lines) || lines < 1 || lines > 500) {
    throw new MeshCentralValidationError('Console tail lines must be an integer from 1 to 500.');
  }
  const response = await this.client.request<unknown>({ action: 'console', lines });
  return normalizeConsoleResponse(response);
}
```

尚未封装、但仍以裸 `send()` 调用的位置（应随下一次改动收口）：`features/profile/twoFactorManagement.ts`、
`features/profile/loginTokens.ts`、`components/device-workspace/SystemManagementPanels.tsx`、
`components/device-workspace/desktop/desktopClipboard.ts`。

# control-client 文档

本目录记录 `@meshcentral/control-client` 的公开 API、控制通道消息、事件语义和扩展约定。包根目录的 README 用于快速了解和上手，本目录用于实现、调试和维护时查阅。

## 文档目录

- [资源 API 与消息清单](messages-and-resources.md)：每个公开方法发送的 action、返回内容和适用场景。
- [事件、订阅通道与诊断](events.md)：六个订阅通道、领域事件类型、字段和处理建议。
- [原始 request/send 消息指南](raw-messages.md)：尚未封装 action 的调用方式、响应关联、兼容和安全要求。

## 如何选择文档位置

| 内容 | 放置位置 |
| --- | --- |
| 包定位、安装、最小示例、能力导航 | 根目录 `README.md` |
| 一个资源的完整方法清单和协议 action | `messages-and-resources.md` |
| 推送事件、订阅通道或诊断行为 | `events.md` |
| 原始协议调用、抓包证据和新 action 接入原则 | `raw-messages.md` 或独立主题文档 |
| 较大的独立功能 | 新建 kebab-case 文件，并在本页加入链接 |

## 新文档模板

```md
# 功能名称

一句话说明功能解决什么问题，以及不负责什么。

## 使用前提

- 所需连接状态、权限、服务端版本或设备条件。

## 公开 API

### `resource.method()`

- 参数：字段、类型、必填条件和默认值。
- 发送：底层 action 和关键字段。
- 返回：标准化类型或原始响应结构。
- 用途：调用方可以据此完成什么。
- 失败：参数校验、超时、断线和服务端错误。

## 示例

提供可以直接放进项目的 TypeScript 示例。

## 协议证据

注明测试、抓包、MeshCentral/网关版本和仍未确认的字段。
```

## 编写规则

1. 以 `src/types.ts`、资源实现和测试为准，不根据字段名猜测行为。
2. 同时写清“发送了什么”“得到什么”“能用来做什么”。只罗列 action 不足以描述 API。
3. 区分请求已提交、服务端已确认和远端任务已完成。例如 `commands.run()` 的响应不等同于每台设备都执行成功。
4. 标准化返回值应链接或写出公开类型；未标准化结果应明确标记为 `unknown` 或 `raw`。
5. 原始响应示例必须删除令牌、Cookie、密码、IP、邮箱和其他敏感信息。
6. 版本相关行为应注明验证环境。无法确认的字段写成“未验证”，不要写成稳定契约。
7. 新增公开资源、事件类型或错误类型时，同步更新包根 README 和本目录索引。
8. Markdown 文件使用 UTF-8，文件名使用小写 kebab-case，代码示例默认使用 TypeScript。

## 术语

| 术语 | 含义 |
| --- | --- |
| 控制通道 | 承载鉴权、查询、管理命令和事件推送的 WebSocket 连接 |
| action | MeshCentral 控制消息中的操作名，例如 `nodes` 或 `runcommands` |
| 资源 API | `devices`、`commands` 等对 action 的类型化封装 |
| 标准化 | 把不同服务端形态转换为稳定的公开 TypeScript 结构 |
| 原始响应 | 未承诺稳定字段结构的服务端消息，通常通过 `raw` 保留 |
| 提交 | 网关接受或收到请求，不保证目标设备已完成操作 |
| 确认 | 收到匹配响应、事件，或经过后续查询验证操作结果 |

## 维护检查表

修改协议相关代码后至少确认：

- README 的能力列表和代码公开导出一致。
- action 表中的请求字段与资源实现一致。
- 事件表中的映射条件与 `normalizeEvent()` 一致。
- 示例不依赖私有方法，不把泛型误写成运行时校验。
- 新的响应形态有测试或可追溯的协议证据。
- 运行 `pnpm --filter @meshcentral/control-client test`。
- 运行 `pnpm --filter @meshcentral/control-client typecheck`。
- 运行 `pnpm --filter @meshcentral/control-client lint`。
- 运行 `pnpm exec prettier --check packages/control-client/README.md packages/control-client/docs/*.md`。

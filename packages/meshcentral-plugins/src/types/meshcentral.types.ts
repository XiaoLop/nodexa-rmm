export type MeshCentralCommand = Record<string, unknown> & {
  action?: string;
  plugin?: string;
  subAction?: string;
  userid?: string;
};

export interface MeshCentralConnection {
  send(message: Record<string, unknown> | string): void;
  user?: MeshCentralUser;
  domain?: MeshCentralDomain;
}

export interface MeshCentralUser {
  _id?: string;
  name?: string;
  domain?: string;
  siteadmin?: number;
  email?: string;
  emailVerified?: boolean;
  phone?: string;
  msghandle?: string;
  otpsecret?: string;
  otpduo?: unknown;
  otpdev?: unknown;
  otpekey?: unknown;
  otphkeys?: Array<{ type?: number; keyId?: string; keyid?: string }>;
  otpkeys?: { keys?: Array<{ p?: number; u?: boolean }> };
  passchange?: number;
  login?: number;
  pastlogin?: number;
  access?: number;
  groups?: string[];
  [key: string]: unknown;
}

export interface MeshCentralDomain {
  id: string;
  url: string;
  dns?: string;
  auth?: string;
  authstrategies?: Record<string, unknown>;
  loginkey?: string[];
  mailserver?: unknown;
  duo2factor?: {
    integrationkey?: string;
    secretkey?: string;
    apihostname?: string;
  };
  newaccounts?: boolean | number;
  newaccountsrights?: number;
  newaccountemaildomains?: string[];
  newaccountspass?: unknown;
  newaccountscaptcha?: unknown;
  limits?: { maxuseraccounts?: number };
  twofactorcookiedurationdays?: number;
  passwordrequirements?: {
    reset?: number;
    skip2factor?: string[];
    lock2factor?: boolean;
    force2factor?: boolean;
    otp2factor?: boolean;
    email2factor?: boolean;
    sms2factor?: boolean;
    msg2factor?: boolean;
    push2factor?: boolean;
    duo2factor?: boolean;
    backupcode2factor?: boolean;
    maxfidokeys?: number;
  };
  [key: string]: unknown;
}

export interface MeshCentralSession extends Record<string, unknown> {
  userid?: string;
  ip?: string;
  x?: string;
}

export interface MeshCentralHttpRequest {
  body?: unknown;
  clientIp?: string;
  connection?: { remotePort?: number };
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, unknown>;
  session: MeshCentralSession;
  xdomain?: MeshCentralDomain;
}

export interface MeshCentralHttpResponse {
  cookie?(name: string, value: string, options: Record<string, unknown>): void;
  clearCookie?(name: string, options?: Record<string, unknown>): void;
  json(body: unknown): unknown;
  set(headers: Record<string, string>): unknown;
  status(code: number): MeshCentralHttpResponse;
}

export type MeshCentralHttpHandler = (
  request: MeshCentralHttpRequest,
  response: MeshCentralHttpResponse,
) => void;

export interface MeshCentralDatabase {
  Get?(id: string, callback: (error: unknown, documents: unknown[]) => void): void;
  Set?(document: Record<string, unknown>): void;
  Remove?(id: string, callback?: (error?: unknown) => void): void;
  SetUser?(user: MeshCentralUser): void;
  isMaxType?(
    maximum: number | undefined,
    type: string,
    domainId: string,
    callback: (maximumExceeded: boolean) => void,
  ): void;
  changeStream?: unknown;
  [key: string]: unknown;
}

export interface MeshCentralServer {
  config?: {
    settings?: Record<string, unknown>;
    domains?: Record<string, MeshCentralDomain>;
  };
  datapath?: string;
  db?: MeshCentralDatabase;
  common?: {
    validateUsername?(value: string, minimum: number, maximum: number): boolean;
    validateEmail?(value: string, minimum: number, maximum: number): boolean;
    checkPasswordRequirements?(
      password: string,
      requirements: MeshCentralDomain['passwordrequirements'],
    ): boolean;
  };
  loginCookieEncryptionKey?: unknown;
  certificates?: { CommonName?: string };
  smsserver?: unknown;
  msgserver?: { providers?: number };
  firebase?: unknown;
  webserver?: MeshCentralWebServer;
  decodeCookie?(
    value: string,
    key: unknown,
    maxAgeMinutes?: number,
  ): Record<string, unknown> | null;
  encodeCookie?(value: Record<string, unknown>, key: unknown): string;
  authLog?(category: string, message: string, details?: Record<string, unknown>): void;
  DispatchEvent?(
    targets: string[],
    source: unknown,
    event: Record<string, unknown> | string,
  ): void;
  debug?(category: string, message: string): void;
  [key: string]: unknown;
}

export interface MeshCentralHttpApplication {
  get(path: string, ...handlers: Array<unknown | MeshCentralHttpHandler>): unknown;
  post(path: string, ...handlers: Array<unknown | MeshCentralHttpHandler>): unknown;
  put(path: string, ...handlers: Array<unknown | MeshCentralHttpHandler>): unknown;
  delete(path: string, ...handlers: Array<unknown | MeshCentralHttpHandler>): unknown;
  use(...handlers: Array<unknown | MeshCentralHttpHandler>): unknown;
}

export interface MeshCentralWebServer {
  app: MeshCentralHttpApplication;
  bodyParser?: {
    json(...args: unknown[]): unknown;
    urlencoded(...args: unknown[]): unknown;
  };
  CloneSafeNode?(node: Record<string, unknown>): Record<string, unknown>;
  CreateMeshDispatchTargets?(meshId: string, nodeIds?: string[]): string[];
  setSessionRandom?(request: unknown): void;
  args?: { lanonly?: boolean; nousers?: boolean; sessionsamesite?: string };
  users?: Record<string, MeshCentralUser>;
  destroyedSessions?: Record<string, number>;
  clearDestroyedSessions?(): void;
  authenticate?(
    username: string,
    password: string,
    domain: MeshCentralDomain,
    callback: (
      error: unknown,
      userId?: string,
      passwordHint?: string,
      loginOptions?: Record<string, unknown>,
    ) => void,
  ): void;
  checkAllowLogin?(request: MeshCentralHttpRequest): boolean;
  setbadLogin?(request: MeshCentralHttpRequest): void;
  checkAllow2Fa?(request: MeshCentralHttpRequest): boolean;
  setbad2Fa?(request: MeshCentralHttpRequest): void;
  CloneSafeUser?(user: MeshCentralUser): Record<string, unknown>;
  getLanguageCodes?(request: MeshCentralHttpRequest): string[];
  getUserAgentInfo?(request: MeshCentralHttpRequest): {
    browserStr?: string;
    osStr?: string;
  };
  [key: string]: unknown;
}

export interface MeshCentralAgentConnection extends MeshCentralConnection {
  dbMeshKey?: string;
  dbNodeKey?: string;
  remoteaddrport?: string;
  [key: string]: unknown;
}

export interface MeshCentralAgentServer {
  parent?: MeshCentralServer;
  CloneSafeNode?(node: Record<string, unknown>): Record<string, unknown>;
  CreateMeshDispatchTargets?(meshId: string, nodeIds?: string[]): string[];
  [key: string]: unknown;
}

export interface MeshCentralUserServer {
  parent?: MeshCentralServer;
  [key: string]: unknown;
}

export type MeshCentralServerActionContext =
  | MeshCentralAgentServer
  | MeshCentralUserServer;

export interface MeshCentralPluginTabRegistration {
  tabId: string;
  tabTitle: string;
}

export interface MeshCentralPluginHandler {
  parent: MeshCentralServer;
  pluginPath: string;
  plugins: Record<string, MeshCentralPlugin>;
  exports: Record<string, string[]>;
  loadList: string[];
  callHook(hookName: string, ...args: unknown[]): void;
  addMeshCoreModules(modules: Record<string, string[]>): void;
  deviceViewPanel(): Record<string, { header: string; content: string }>;
}

export interface MeshCentralPlugin {
  exports: string[];
  server_startup?: () => void;
  hook_setupHttpHandlers?: (
    webServer: MeshCentralWebServer,
    meshServer: MeshCentralServer,
  ) => void;
  hook_userLoggedIn?: (user: MeshCentralUser) => void;
  hook_agentCoreIsStable?: (
    agent: MeshCentralAgentConnection,
    agentServer: MeshCentralAgentServer,
  ) => void;
  hook_processAgentData?: (
    command: MeshCentralCommand,
    agent: MeshCentralAgentConnection,
    agentServer: MeshCentralAgentServer,
  ) => void;
  serveraction?: (
    command: MeshCentralCommand,
    connection: MeshCentralConnection,
    server: MeshCentralServerActionContext,
  ) => void;
  uiCustomEvent?: (
    command: MeshCentralCommand,
    connection: MeshCentralConnection,
  ) => void;
  on_device_header?: () => string;
  on_device_page?: () => string;
  onWebUIStartupEnd?: () => void;
  onDeviceRefreshEnd?: (...args: unknown[]) => void;
  [method: string]: unknown;
}

export type MeshCentralPluginFactory = (
  pluginHandler: MeshCentralPluginHandler,
) => MeshCentralPlugin;
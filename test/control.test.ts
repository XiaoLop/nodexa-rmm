import process from 'node:process';
import readline from 'node:readline';

import WebSocket, { type RawData } from 'ws';

const gatewayBaseUrl = process.env.GATEWAY_WS_URL?.trim();

if (!gatewayBaseUrl) {
  console.error('缺少 GATEWAY_WS_URL，请在 .env 中配置网关 WebSocket 地址。');
  process.exit(1);
}

function buildControlUrl(baseUrl: string): string {
  const url = new URL(baseUrl);

  if (!url.pathname || url.pathname === '/') {
    url.pathname = '/control';
  }

  return url.toString();
}

function formatMessage(data: RawData): string {
  const message = data.toString();

  try {
    return JSON.stringify(JSON.parse(message), null, 2);
  } catch {
    return message;
  }
}

const controlUrl = buildControlUrl(gatewayBaseUrl);
const socket = new WebSocket(controlUrl);
const terminal = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> ',
});

socket.on('open', () => {
  console.log(`已连接到 ${controlUrl}`);
  console.log('输入消息并按 Enter 发送，输入 /exit 断开连接。');
  terminal.prompt();
});

socket.on('message', (data) => {
  console.log(`\n< ${formatMessage(data)}`);
  terminal.prompt();
});

socket.on('error', (error) => {
  console.error(`\nWebSocket 错误: ${error.message}`);
});

socket.on('close', (code, reason) => {
  const detail = reason.length > 0 ? `，原因: ${reason.toString()}` : '';
  console.log(`\n连接已关闭，状态码: ${code}${detail}`);
  terminal.close();
});

terminal.on('line', (line) => {
  const message = line.trim();

  if (message === '/exit') {
    socket.close(1000, 'Console closed');
    return;
  }

  if (!message) {
    terminal.prompt();
    return;
  }

  if (socket.readyState !== WebSocket.OPEN) {
    console.error('WebSocket 尚未连接，消息未发送。');
    terminal.prompt();
    return;
  }

  socket.send(message);
  console.log(`> ${message}`);
  terminal.prompt();
});

terminal.on('SIGINT', () => {
  socket.close(1000, 'Console interrupted');
});

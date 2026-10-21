import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Alert } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useServerConnection } from '../../features/server-admin/hooks';
import { boundedAppend, editLine, safeTerminalText, type LineState } from '../../features/server-admin/model';
import '@xterm/xterm/css/xterm.css';

export function ServerConsole() {
  const { t } = useTranslation();
  const { client, connected, generation } = useServerConnection();
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    const terminal = new Terminal({ scrollback: 2000, convertEol: false, cursorBlink: true });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(container.current);
    const resize = new ResizeObserver(() => fit.fit());
    resize.observe(container.current);
    fit.fit();
    let line: LineState = { text: '', cursor: 0 };
    let history: string[] = [];
    let position = 0;
    let draft = '';
    let pending = '';
    let sending = false;
    let active = true;
    const prompt = () => {
      const width = Math.max(1, terminal.cols - 3);
      const start = Math.max(0, line.cursor - width + 1);
      terminal.write('\r\x1b[2K> ' + safeTerminalText(line.text.slice(start, start + width)));
      terminal.write('\r' + `\x1b[${2 + line.cursor - start}C`);
    };
    prompt();
    const output = client?.server.subscribeConsole(packet => {
      pending = (pending + safeTerminalText(packet.text.slice(-65536)) + '\r\n').slice(-131072);
    });
    const timer = setInterval(() => {
      if (!pending) return;
      terminal.write('\r\x1b[2K' + pending);
      pending = '';
      prompt();
    }, 100);
    const input = terminal.onData(data => {
      if (!connected || client?.connectionStatus !== 'connected' || sending) return;
      if (data === '\r') {
        const command = line.text.trim();
        if (!command) return;
        terminal.write('\r\x1b[2K> ' + safeTerminalText(command) + '\r\n');
        history = boundedAppend(history, [command], 100);
        position = history.length;
        draft = '';
        line = { text: '', cursor: 0 };
        sending = true;
        setFailed(false);
        void client.server.sendConsoleCommand(command).catch(() => { if (active) setFailed(true); })
          .finally(() => { sending = false; });
      } else if (data === '\x03') {
        line = { text: '', cursor: 0 };
      } else if (data === '\x1b[A' || data === '\x1b[B') {
        if (position === history.length) draft = line.text;
        position = Math.max(0, Math.min(history.length, position + (data === '\x1b[A' ? -1 : 1)));
        const text = history[position] ?? draft;
        line = { text, cursor: text.length };
      } else line = editLine(line, data);
      prompt();
    });
    return () => {
      active = false;
      clearInterval(timer);
      output?.();
      input.dispose();
      resize.disconnect();
      terminal.dispose();
    };
  }, [client, connected, generation]);
  return <>
    <Alert type={connected ? 'info' : 'warning'} showIcon title={t(connected ? 'serverAdmin.consoleHint' : 'serverAdmin.disconnected')} />
    {failed && <Alert type="error" title={t('serverAdmin.failed')} />}
    <div ref={container} aria-label={t('serverAdmin.console')} style={{ height: 460, marginTop: 16 }} />
  </>;
}

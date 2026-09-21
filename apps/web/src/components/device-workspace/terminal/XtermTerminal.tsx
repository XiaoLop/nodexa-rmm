import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { Terminal } from '@xterm/xterm';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { TerminalSession, TerminalSize } from '@meshcentral/relay';
import '@xterm/xterm/css/xterm.css';

export interface XtermTerminalHandle {
  clear(): void;
  focus(): void;
  getSelection(): string;
  getSize(): TerminalSize;
  searchNext(query: string): boolean;
  writeLocal(data: string): void;
}

interface XtermTerminalProps {
  session?: TerminalSession;
  onPasteShortcut: () => void;
  onSizeChange: (size: TerminalSize) => void;
}

export const XtermTerminal = forwardRef<XtermTerminalHandle, XtermTerminalProps>(
  function XtermTerminal({ session, onPasteShortcut, onSizeChange }, ref) {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<Terminal | undefined>(undefined);
    const fitRef = useRef<FitAddon | undefined>(undefined);
    const searchRef = useRef<SearchAddon | undefined>(undefined);
    const onPasteShortcutRef = useRef(onPasteShortcut);
    const onSizeChangeRef = useRef(onSizeChange);
    onPasteShortcutRef.current = onPasteShortcut;
    onSizeChangeRef.current = onSizeChange;

    useImperativeHandle(ref, () => ({
      clear: () => terminalRef.current?.clear(),
      focus: () => terminalRef.current?.focus(),
      getSelection: () => terminalRef.current?.getSelection() ?? '',
      getSize: () => ({
        cols: terminalRef.current?.cols ?? 80,
        rows: terminalRef.current?.rows ?? 24,
      }),
      searchNext: (query) => searchRef.current?.findNext(query) ?? false,
      writeLocal: (data) => terminalRef.current?.write(data),
    }));

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const terminal = new Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        convertEol: false,
        disableStdin: false,
        scrollback: 10_000,
        screenReaderMode: false,
        minimumContrastRatio: 4.5,
        allowProposedApi: false,
        fontFamily: '"Cascadia Mono", "SFMono-Regular", Consolas, monospace',
        fontSize: 13,
        theme: {
          background: '#070c12',
          foreground: '#dbe6f3',
          cursor: '#63d7a4',
          selectionBackground: '#315d7f99',
        },
      });
      const fit = new FitAddon();
      const search = new SearchAddon();
      terminal.loadAddon(fit);
      terminal.loadAddon(search);
      terminal.open(container);
      terminal.attachCustomKeyEventHandler((event) => {
        const paste = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v';
        if (!paste || event.type !== 'keydown') return true;
        onPasteShortcutRef.current();
        return false;
      });
      terminalRef.current = terminal;
      fitRef.current = fit;
      searchRef.current = search;

      let resizeTimer: ReturnType<typeof setTimeout> | undefined;
      const fitAndReport = () => {
        fit.fit();
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          onSizeChangeRef.current({ cols: terminal.cols, rows: terminal.rows });
        }, 120);
      };
      const observer = new ResizeObserver(fitAndReport);
      observer.observe(container);
      fitAndReport();

      return () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        observer.disconnect();
        terminal.dispose();
        terminalRef.current = undefined;
        fitRef.current = undefined;
        searchRef.current = undefined;
      };
    }, []);

    useEffect(() => {
      const terminal = terminalRef.current;
      if (!terminal || !session) return;
      const input = terminal.onData((data) => session.write(data));
      const removeData = session.onData((data) => terminal.write(data));
      terminal.focus();
      return () => {
        input.dispose();
        removeData();
      };
    }, [session]);

    return <div ref={containerRef} className="terminal-xterm" aria-label={t('deviceWorkspace.terminal.ariaLabel')} />;
  },
);
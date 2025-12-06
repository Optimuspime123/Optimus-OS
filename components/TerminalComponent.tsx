import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { Shell } from '../services/Shell';
import { fileSystem } from '../services/FileSystem';
import { processManager } from '../services/ProcessManager';

interface TerminalProps {
  onOpenApp: (type: string, arg?: string) => void;
}

export const TerminalComponent: React.FC<TerminalProps> = React.memo(({ onOpenApp }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<Shell>(new Shell());
  
  // Terminal State
  const inputBuffer = useRef<string>('');
  const cursorIdx = useRef<number>(0);
  const historyIdx = useRef<number>(-1);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 14,
      theme: {
        background: '#0c0c14',
        foreground: '#00ff9d',
        cursor: '#00ff9d',
        selectionBackground: 'rgba(0, 255, 157, 0.3)',
      },
      allowProposedApi: true,
      scrollback: 5000
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    
    // Small delay to ensure container is sized correctly before fitting
    setTimeout(() => fitAddon.fit(), 50);

    const promptStr = () => {
        // Only show prompt if NOT waiting for input in a program
        if (shellRef.current.foregroundPID !== null) return '';
        return `\r\n\x1b[1;34moptimus\x1b[0m:\x1b[1;32m${fileSystem.getCurrentPathString()}\x1b[0m$ `;
    };

    const isProgramInputMode = () => {
      const pid = shellRef.current.foregroundPID;
      if (pid === null) return false;
      const proc = processManager.getProcess(pid);
      return !!proc && proc.state === 'WAITING_INPUT';
    };

    const refreshLine = () => {
      // Clear current line and move to start
      term.write('\x1b[2K\r');
      
      const pRaw = promptStr();
      const prompt = pRaw ? pRaw.trim() : '';

      // Write prompt and input
      if (prompt) {
          term.write(prompt + ' ' + inputBuffer.current);
      } else {
          term.write(inputBuffer.current);
      }

      // Calculate cursor position by stripping invisible ANSI codes AND control chars
      const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, '').replace(/[\r\n]/g, '');
      const promptVisualLen = prompt ? stripAnsi(prompt).length + 1 : 0; // +1 for the space after prompt
      const targetX = promptVisualLen + cursorIdx.current;

      if (targetX > 0) {
        term.write(`\r\x1b[${targetX}C`);
      } else {
        term.write('\r');
      }
    };

    term.writeln('Welcome to \x1b[1;35mOptimus-OS\x1b[0m Kernel v2.0');
    term.writeln('Type \x1b[1;33mhelp\x1b[0m for commands.');
    term.write(promptStr());

    term.onData(async (data) => {
      const code = data.charCodeAt(0);
      const programInput = isProgramInputMode();

      // Enter
      if (code === 13) {
        term.write('\r\n');
        const cmd = inputBuffer.current;
        inputBuffer.current = '';
        cursorIdx.current = 0;
        historyIdx.current = -1;

        if (cmd.trim() === 'clear') {
          term.clear();
          term.write(promptStr());
          return;
        }

        // Pass everything to shell handleInput
        shellRef.current.handleInput(
            cmd,
            (out) => {
               term.write(out.replace(/\n/g, '\r\n'));
               // Only scroll to bottom if we are outputting data to ensure visibility of long loops
               term.scrollToBottom();
            },
            (err) => {
               term.writeln(`\x1b[31m${err}\x1b[0m`);
               term.scrollToBottom();
            },
            onOpenApp
        );

        // Only write prompt if process finished or no process was running
        if (shellRef.current.foregroundPID === null) {
            term.write(promptStr());
        }
      }
      // Backspace
      else if (code === 127) {
        if (cursorIdx.current > 0) {
          const left = inputBuffer.current.slice(0, cursorIdx.current - 1);
          const right = inputBuffer.current.slice(cursorIdx.current);
          inputBuffer.current = left + right;
          cursorIdx.current--;
          if (programInput) {
            term.write('\b \b');
          } else {
            refreshLine();
          }
        }
      }
      // Ctrl+C
      else if (code === 3) {
          term.write('^C\r\n');
          inputBuffer.current = '';
          cursorIdx.current = 0;
          
          if (shellRef.current.foregroundPID !== null) {
              const pid = shellRef.current.foregroundPID;
              // Kill process
              import('../services/ProcessManager').then(m => m.processManager.killProcess(pid));
              term.writeln('Process ended by user.');
              shellRef.current.foregroundPID = null;
          }
          term.write(promptStr());
      }
      // Arrows (ANSI)
      else if (code === 27) {
         if (programInput) return;
         if (data === '\x1b[A') { // Up
           const history = shellRef.current.history;
           if (history.length > 0) {
             historyIdx.current = historyIdx.current === -1 ? history.length - 1 : Math.max(0, historyIdx.current - 1);
             inputBuffer.current = history[historyIdx.current];
             cursorIdx.current = inputBuffer.current.length;
             refreshLine();
           }
        } else if (data === '\x1b[B') { // Down
           const history = shellRef.current.history;
           if (historyIdx.current !== -1) {
             historyIdx.current = Math.min(history.length - 1, historyIdx.current + 1);
             if (historyIdx.current === history.length - 1 && inputBuffer.current === history[historyIdx.current]) {
               inputBuffer.current = '';
               historyIdx.current = -1;
             } else {
               inputBuffer.current = history[historyIdx.current];
             }
             cursorIdx.current = inputBuffer.current.length;
             refreshLine();
           }
        } else if (data === '\x1b[D') { // Left
           if (cursorIdx.current > 0) {
             cursorIdx.current--;
             refreshLine(); // We must refresh because we use relative moves in refreshLine
           }
        } else if (data === '\x1b[C') { // Right
           if (cursorIdx.current < inputBuffer.current.length) {
             cursorIdx.current++;
             refreshLine();
           }
        }
      }
      // Tab
      else if (code === 9) {
        if (programInput) return;
        const match = shellRef.current.complete(inputBuffer.current);
        if (match) {
           inputBuffer.current = match;
           cursorIdx.current = match.length;
           refreshLine();
        }
      }
      // Regular Char
      else if (code >= 32 && code <= 126) {
        const left = inputBuffer.current.slice(0, cursorIdx.current);
        const right = inputBuffer.current.slice(cursorIdx.current);
        inputBuffer.current = left + data + right;
        cursorIdx.current++;
        if (programInput) {
          term.write(data);
        } else {
          refreshLine();
        }
      }
    });

    const resizeObserver = new ResizeObserver(() => fitAddon.fit());
    resizeObserver.observe(terminalRef.current);
    
    const handleFocus = () => term.focus();
    terminalRef.current.addEventListener('click', handleFocus);
    term.focus();

    return () => {
      term.dispose();
      resizeObserver.disconnect();
      if (terminalRef.current) terminalRef.current.removeEventListener('click', handleFocus);
    };
  }, [onOpenApp]);

  return <div className="w-full h-full p-1 bg-[#0c0c14]" ref={terminalRef} />;
});
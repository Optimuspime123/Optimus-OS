import React, { useState, useEffect, useRef, useMemo } from 'react';
import { fileSystem } from '../services/FileSystem';

interface EditorProps {
  filePath: string;
  onClose: () => void;
}

function findBracketMatch(text: string, start: number, dir: number, open: string, close: string) {
    let depth = 1;
    let i = start + dir;
    while(i >= 0 && i < text.length) {
        if (text[i] === open) depth++;
        else if (text[i] === close) depth--;
        
        if (depth === 0) return i;
        i += dir;
    }
    return -1;
}

export const Editor: React.FC<EditorProps> = ({ filePath, onClose }) => {
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const existing = fileSystem.readFile(filePath);
      setContent(existing);
    } catch (e) {
      setContent('// New file: ' + filePath + '\n#include <stdio.h>\n\nint main() {\n  printf("Hello world!\\n");\n  return 0;\n}');
    }
  }, [filePath]);

  const save = () => {
    try {
      fileSystem.writeFile(filePath, content);
      setStatus('Saved ' + new Date().toLocaleTimeString());
      setTimeout(() => setStatus(''), 2000);
    } catch (e: any) {
      setStatus('Error: ' + e.message);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      save();
    }
    
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current!;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;
      const newVal = val.substring(0, start) + '  ' + val.substring(end);
      setContent(newVal);
      // Need to defer cursor update slightly as React render will reset it otherwise
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
        setCursorPos(start + 2);
      });
    }
  };
  
  const syncScroll = () => {
    if (textareaRef.current) {
      const { scrollTop, scrollLeft } = textareaRef.current;
      if (preRef.current) {
        preRef.current.scrollTop = scrollTop;
        preRef.current.scrollLeft = scrollLeft;
      }
      if (lineNumbersRef.current) {
        lineNumbersRef.current.scrollTop = scrollTop;
      }
    }
  };

  const handleScroll = () => {
    syncScroll();
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setContent(e.target.value);
      setCursorPos(e.target.selectionStart);
  };

  const handlePaste = () => {
    // After a paste, the textarea may resize/scroll before the next paint
    requestAnimationFrame(syncScroll);
  };

  useEffect(() => {
    // Keep background layers in sync when content changes (e.g., paste large text)
    syncScroll();
  }, [content]);
  
  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      setCursorPos(e.currentTarget.selectionStart);
  }

  // Syntax Highlighting & Tokenization
  const highlightedHTML = useMemo(() => {
    // Optimization for very long files to prevent UI freeze
    if (content.length > 50000) {
        return content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '<br/>';
    }

    // 1. Identify Bracket at Cursor (Look at char before and at cursor)
    let matchedIndices = new Set<number>();
    const checkIndices = [cursorPos, cursorPos - 1];
    const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
    const revPairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
    
    for (let idx of checkIndices) {
        if (idx < 0 || idx >= content.length) continue;
        const char = content[idx];
        if (pairs[char]) {
            const match = findBracketMatch(content, idx, 1, char, pairs[char]);
            if (match !== -1) { matchedIndices.add(idx); matchedIndices.add(match); break; }
        } else if (revPairs[char]) {
            const match = findBracketMatch(content, idx, -1, char, revPairs[char]);
            if (match !== -1) { matchedIndices.add(idx); matchedIndices.add(match); break; }
        }
    }

    // 2. Tokenize
    let html = '';
    let i = 0;
    while (i < content.length) {
        const char = content[i];
        let tokenClass = 'text-gray-300';
        let tokenVal = char;
        let isSymbol = false;
        
        // Check for matching bracket
        const isMatched = matchedIndices.has(i);
        const bgClass = isMatched ? 'bg-white/20 ring-1 ring-white/50 rounded-[1px]' : '';

        // Comments
        if (content.substr(i, 2) === '//') {
            const end = content.indexOf('\n', i);
            const actualEnd = end === -1 ? content.length : end;
            tokenVal = content.substring(i, actualEnd);
            tokenClass = 'text-gray-500 italic';
            i = actualEnd - 1; 
        } 
        // Strings
        else if (char === '"' || char === "'") {
             let end = i + 1;
             while(end < content.length) {
                 if (content[end] === char && content[end-1] !== '\\') break;
                 end++;
             }
             tokenVal = content.substring(i, end + 1);
             tokenClass = 'text-green-400';
             i = end;
        }
        // Preprocessor
        else if (char === '#') {
             let end = i + 1;
             while(end < content.length && /[a-zA-Z]/.test(content[end])) end++;
             tokenVal = content.substring(i, end);
             tokenClass = 'text-yellow-500 font-bold';
             i = end - 1;
        }
        // Numbers
        else if (/\d/.test(char) && (i===0 || !/[a-zA-Z_]/.test(content[i-1]))) {
             let end = i;
             while(end < content.length && /[\d\.]/.test(content[end])) end++;
             tokenVal = content.substring(i, end);
             tokenClass = 'text-purple-400';
             i = end - 1;
        }
        // Keywords / Identifiers
        else if (/[a-zA-Z_]/.test(char)) {
             let end = i;
             while(end < content.length && /[a-zA-Z0-9_]/.test(content[end])) end++;
             const word = content.substring(i, end);
             
             if (['int','float','char','void','double','struct','long','unsigned'].includes(word)) tokenClass = 'text-blue-400 font-bold';
             else if (['return','if','else','while','for','break','continue','switch','case'].includes(word)) tokenClass = 'text-pink-400 font-bold';
             else if (['printf','scanf','malloc','free','sizeof','sqrt','pow','sin','cos','tan'].includes(word)) tokenClass = 'text-yellow-200';
             else tokenClass = 'text-gray-200';
             
             tokenVal = word;
             i = end - 1;
        } else {
            isSymbol = true;
        }
        
        // Escape HTML
        const escaped = tokenVal.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        if (!isSymbol && tokenVal.length > 0) {
             html += `<span class="${tokenClass}">${escaped}</span>`;
        } else {
             html += `<span class="${tokenClass} ${bgClass}">${escaped}</span>`;
        }
        
        i++;
    }
    
    // Add extra newline to ensure scrolling allows reaching bottom comfortably
    if (content.endsWith('\n')) html += '<br/>';
    
    return html;
  }, [content, cursorPos]);

  const lineNumbers = content.split('\n').map((_, i) => i + 1);

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-[#d4d4d4]">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-2 bg-[#252526] border-b border-[#3e3e3e] select-none z-20">
        <div className="flex items-center gap-2">
            <span className="text-blue-400">📄</span>
            <span className="text-sm font-mono text-gray-300">{filePath}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-green-400 font-mono transition-opacity duration-300" style={{ opacity: status ? 1 : 0 }}>
            {status || 'Saved'}
          </span>
          <div className="h-4 w-px bg-[#3e3e3e]"></div>
          <button 
            onClick={save}
            className="text-xs hover:text-white text-gray-400 transition-colors"
            title="Ctrl+S"
          >
            Save
          </button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Line Numbers */}
        <div 
            ref={lineNumbersRef}
            className="w-12 bg-[#1e1e1e] border-r border-[#3e3e3e] text-right pr-3 pt-4 text-[#6e7681] select-none overflow-hidden font-mono text-sm leading-6 z-20"
        >
           {lineNumbers.map(n => <div key={n} className="leading-6">{n}</div>)}
        </div>

        {/* Editor Container */}
        <div className="flex-1 relative font-mono text-sm h-full bg-[#1e1e1e]">
            
            {/* Syntax Highlighted Layer (Background) */}
            <pre 
                ref={preRef}
                className="absolute inset-0 p-4 m-0 bg-transparent whitespace-pre overflow-hidden pointer-events-none leading-6 font-mono"
                dangerouslySetInnerHTML={{ __html: highlightedHTML }}
            />

            {/* Editable Layer (Foreground) */}
            <textarea
                ref={textareaRef}
                className="absolute inset-0 w-full h-full p-4 m-0 bg-transparent text-transparent caret-white resize-none outline-none border-none whitespace-pre overflow-auto leading-6 font-mono z-10"
                value={content}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onScroll={handleScroll}
                onSelect={handleSelect}
                onClick={handleSelect}
                onKeyUp={handleSelect}
                onPaste={handlePaste}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
            />
        </div>
      </div>
      
      {/* Footer */}
      <div className="h-6 bg-[#007acc] flex items-center px-4 text-xs text-white select-none justify-between z-20">
          <div className="flex gap-4">
            <span>NORMAL</span>
            <span>C</span>
          </div>
          <div className="flex gap-4">
             <span>Ln {content.substr(0, cursorPos).split('\n').length}, Col {cursorPos - content.lastIndexOf('\n', cursorPos - 1)}</span>
             <span>UTF-8</span>
          </div>
      </div>
    </div>
  );
};
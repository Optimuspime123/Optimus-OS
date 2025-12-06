import React, { useState, useEffect, useRef } from 'react';
import { fileSystem } from '../services/FileSystem';

interface EditorProps {
  filePath: string;
  onClose: () => void;
}

export const Editor: React.FC<EditorProps> = ({ filePath, onClose }) => {
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      const start = textareaRef.current!.selectionStart;
      const end = textareaRef.current!.selectionEnd;
      const val = textareaRef.current!.value;
      textareaRef.current!.value = val.substring(0, start) + '  ' + val.substring(end);
      textareaRef.current!.selectionStart = textareaRef.current!.selectionEnd = start + 2;
      setContent(textareaRef.current!.value);
    }
  };

  const lineNumbers = content.split('\n').map((_, i) => i + 1);

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-[#d4d4d4]">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-2 bg-[#252526] border-b border-[#3e3e3e] select-none">
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
      <div className="flex-1 flex overflow-hidden relative font-mono text-sm leading-6">
        {/* Line Numbers */}
        <div className="w-12 bg-[#1e1e1e] border-r border-[#3e3e3e] text-right pr-3 pt-4 text-[#858585] select-none overflow-hidden">
           {lineNumbers.map(n => <div key={n}>{n}</div>)}
        </div>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          className="flex-1 w-full h-full p-4 bg-[#1e1e1e] text-[#d4d4d4] resize-none outline-none border-none whitespace-pre"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
        />
      </div>
      
      {/* Footer */}
      <div className="h-6 bg-[#007acc] flex items-center px-4 text-xs text-white select-none justify-between">
          <span>NORMAL</span>
          <span>Ln {content.substr(0, textareaRef.current?.selectionStart || 0).split('\n').length}, Col {textareaRef.current?.selectionStart || 0}</span>
          <span>UTF-8</span>
      </div>
    </div>
  );
};
import React, { useState, useEffect, useRef } from 'react';
import { WindowState } from '../types';
import { X, Minus, Square, Copy } from 'lucide-react';

interface WindowProps {
  window: WindowState;
  onClose: (id: string) => void;
  onFocus: (id: string) => void;
  onUpdate: (id: string, updates: Partial<WindowState>) => void;
  children: React.ReactNode;
}

export const Window: React.FC<WindowProps> = ({ window, onClose, onFocus, onUpdate, children }) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const windowStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      if (window.isMaximized) return;
      
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      
      onUpdate(window.id, {
        x: windowStart.current.x + dx,
        y: windowStart.current.y + dy
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, window.isMaximized, window.id, onUpdate]);

  const handleMouseDown = (e: React.MouseEvent) => {
    onFocus(window.id);
    if (e.target instanceof Element && e.target.closest('button')) return;
    
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    windowStart.current = { x: window.x, y: window.y };
  };

  if (window.isMinimized) return null;

  const style = window.isMaximized 
    ? { top: 0, left: 0, width: '100%', height: 'calc(100% - 48px)', borderRadius: 0 } 
    : { top: window.y, left: window.x, width: window.width, height: window.height, borderRadius: '0.5rem' };

  return (
    <div 
      className="absolute flex flex-col glass-panel overflow-hidden transition-all duration-200 pointer-events-auto shadow-2xl border border-white/10"
      style={{
        ...style,
        zIndex: window.zIndex,
        transform: isDragging ? 'scale(1.002)' : 'scale(1)',
        boxShadow: isDragging ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)' : '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
      }}
      onMouseDown={() => onFocus(window.id)}
    >
      {/* Title Bar */}
      <div 
        className={`h-10 flex items-center justify-between px-4 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${window.isMaximized ? 'bg-black/40' : 'bg-white/5'} border-b border-white/5 transition-colors`}
        onMouseDown={handleMouseDown}
        onDoubleClick={() => onUpdate(window.id, { isMaximized: !window.isMaximized })}
      >
        <div className="flex items-center gap-3 opacity-80 hover:opacity-100 transition-opacity">
          <div className={`w-3 h-3 rounded-full ${onFocus ? 'bg-blue-500' : 'bg-gray-500'} shadow-[0_0_8px_rgba(59,130,246,0.5)]`}></div>
          <span className="text-xs font-bold text-gray-200 font-mono tracking-widest uppercase shadow-black drop-shadow-sm flex items-center gap-2">
             {window.title}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={(e) => { e.stopPropagation(); onUpdate(window.id, { isMinimized: true }); }}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <Minus size={14} strokeWidth={3} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onUpdate(window.id, { isMaximized: !window.isMaximized }); }}
            className="text-gray-500 hover:text-white transition-colors"
          >
            {window.isMaximized ? <Copy size={12} strokeWidth={3} /> : <Square size={12} strokeWidth={3} />}
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(window.id); }}
            className="text-gray-500 hover:text-red-400 transition-colors"
          >
            <X size={14} strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative bg-[#0c0c14]/90 backdrop-blur-3xl">
        {children}
      </div>
    </div>
  );
};
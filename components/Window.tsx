
import React, { useState } from 'react';
import { WindowState } from '../types';
import { X, Minus, Square } from 'lucide-react';

interface WindowProps {
  window: WindowState;
  onClose: (id: string) => void;
  onFocus: (id: string) => void;
  onUpdate: (id: string, updates: Partial<WindowState>) => void;
  children: React.ReactNode;
}

export const Window: React.FC<WindowProps> = ({ window, onClose, onFocus, onUpdate, children }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    onFocus(window.id);
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - window.x,
      y: e.clientY - window.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && !window.isMaximized) {
      onUpdate(window.id, {
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (window.isMinimized) return null;

  const style = window.isMaximized 
    ? { top: 0, left: 0, width: '100%', height: 'calc(100% - 48px)' } 
    : { top: window.y, left: window.x, width: window.width, height: window.height };

  return (
    <div 
      className="absolute flex flex-col glass-panel rounded-lg overflow-hidden transition-shadow duration-200 pointer-events-auto"
      style={{
        ...style,
        zIndex: window.zIndex,
        boxShadow: isDragging ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)' : undefined
      }}
      onMouseDown={() => onFocus(window.id)}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Title Bar */}
      <div 
        className="h-9 bg-white/5 border-b border-white/10 flex items-center justify-between px-3 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-white/20"></div>
          <span className="text-xs font-semibold text-gray-300 font-mono tracking-wide uppercase">{window.title}</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={(e) => { e.stopPropagation(); onUpdate(window.id, { isMinimized: true }); }}
            className="text-gray-400 hover:text-white"
          >
            <Minus size={14} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onUpdate(window.id, { isMaximized: !window.isMaximized }); }}
            className="text-gray-400 hover:text-white"
          >
            <Square size={12} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(window.id); }}
            className="text-red-400 hover:text-red-300"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative bg-black/40 backdrop-blur-md">
        {children}
      </div>
    </div>
  );
};

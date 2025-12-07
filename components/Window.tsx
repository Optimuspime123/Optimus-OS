import React, { useState, useRef, useEffect } from 'react';
import { WindowState } from '../types';
import { X, Minus, Square, Copy } from 'lucide-react';

interface WindowProps {
  window: WindowState;
  isActive?: boolean;
  onClose: (id: string) => void;
  onFocus: (id: string) => void;
  onUpdate: (id: string, updates: Partial<WindowState>) => void;
  children: React.ReactNode;
}

const MIN_WIDTH = 420;
const MIN_HEIGHT = 260;

export const Window: React.FC<WindowProps> = ({ window: win, isActive = false, onClose, onFocus, onUpdate, children }) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number; dx: number; dy: number } | null>(null);
  const resizeState = useRef<{ startX: number; startY: number; width: number; height: number; nextWidth: number; nextHeight: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const applyDragTransform = (dx: number, dy: number) => {
    if (!frameRef.current) return;
    frameRef.current.style.setProperty('--window-dx', `${dx}px`);
    frameRef.current.style.setProperty('--window-dy', `${dy}px`);
  };

  const resetDragTransform = () => {
    if (!frameRef.current) return;
    frameRef.current.style.setProperty('--window-dx', '0px');
    frameRef.current.style.setProperty('--window-dy', '0px');
  };

  const clampPosition = (x: number, y: number, width: number, height: number) => {
    const viewportWidth = globalThis.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = globalThis.innerHeight || document.documentElement.clientHeight;
    const maxX = Math.max(0, viewportWidth - width - 24);
    const maxY = Math.max(0, viewportHeight - height - 48);
    return {
      x: Math.min(Math.max(12, x), maxX),
      y: Math.min(Math.max(48, y), maxY)
    };
  };

  const stopGlobalListeners = () => {
    document.removeEventListener('mousemove', handlePointerMove);
    document.removeEventListener('mouseup', handlePointerUp);
    document.body.style.userSelect = '';
  };

  const handlePointerMove = (event: MouseEvent) => {
    if (dragState.current) {
      const dx = event.clientX - dragState.current.startX;
      const dy = event.clientY - dragState.current.startY;
      dragState.current.dx = dx;
      dragState.current.dy = dy;
      applyDragTransform(dx, dy);
    }

    if (resizeState.current && frameRef.current) {
      const dx = event.clientX - resizeState.current.startX;
      const dy = event.clientY - resizeState.current.startY;
      const nextWidth = Math.max(MIN_WIDTH, resizeState.current.width + dx);
      const nextHeight = Math.max(MIN_HEIGHT, resizeState.current.height + dy);
      resizeState.current.nextWidth = nextWidth;
      resizeState.current.nextHeight = nextHeight;
      frameRef.current.style.width = `${nextWidth}px`;
      frameRef.current.style.height = `${nextHeight}px`;
    }
  };

  const handlePointerUp = () => {
    stopGlobalListeners();

    if (dragState.current) {
      const { originX, originY, dx, dy } = dragState.current;
      const next = clampPosition(originX + dx, originY + dy, win.width, win.height);
      resetDragTransform();
      setIsDragging(false);
      dragState.current = null;
      onUpdate(win.id, { x: next.x, y: next.y });
    }

    if (resizeState.current) {
      const { nextWidth, nextHeight } = resizeState.current;
      resizeState.current = null;
      setIsResizing(false);
      if (frameRef.current) {
        frameRef.current.style.removeProperty('width');
        frameRef.current.style.removeProperty('height');
      }
      onUpdate(win.id, { width: Math.round(nextWidth), height: Math.round(nextHeight) });
    }
  };

  useEffect(() => {
    return () => stopGlobalListeners();
  }, []);

  const beginDrag = (event: React.MouseEvent) => {
    if (win.isMaximized || event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest('button')) return;
    onFocus(win.id);
    setIsDragging(true);
    dragState.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: win.x,
      originY: win.y,
      dx: 0,
      dy: 0
    };
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handlePointerMove);
    document.addEventListener('mouseup', handlePointerUp);
  };

  const beginResize = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (win.isMaximized) return;
    onFocus(win.id);
    setIsResizing(true);
    resizeState.current = {
      startX: event.clientX,
      startY: event.clientY,
      width: win.width,
      height: win.height,
      nextWidth: win.width,
      nextHeight: win.height
    };
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handlePointerMove);
    document.addEventListener('mouseup', handlePointerUp);
  };

  if (win.isMinimized) return null;

  const frameStyle: React.CSSProperties = win.isMaximized
    ? { top: 0, left: 0, width: '100%', height: 'calc(100% - 56px)', borderRadius: 0, zIndex: win.zIndex }
    : { top: win.y, left: win.x, width: win.width, height: win.height, zIndex: win.zIndex };

  return (
    <div
      ref={frameRef}
      className={`window-frame absolute flex flex-col glass-panel overflow-hidden ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''} ${win.isMaximized ? 'maximized' : ''}`}
      style={frameStyle}
      onMouseDown={() => onFocus(win.id)}
    >
      <div
        className={`h-11 flex items-center justify-between px-4 select-none border-b border-white/10 transition-colors ${win.isMaximized ? 'bg-black/40' : 'bg-white/5'} ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={beginDrag}
        onDoubleClick={() => onUpdate(win.id, { isMaximized: !win.isMaximized })}
      >
        <div className="flex items-center gap-3">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--accent)] shadow-[0_0_12px_rgba(125,211,252,0.8)]" />
          <span className="text-xs font-semibold tracking-[0.2em] text-gray-100 uppercase">
            {win.title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(event) => { event.stopPropagation(); onUpdate(win.id, { isMinimized: true }); }}
            className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={(event) => { event.stopPropagation(); onUpdate(win.id, { isMaximized: !win.isMaximized }); }}
            className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            {win.isMaximized ? <Copy size={14} /> : <Square size={14} />}
          </button>
          <button
            onClick={(event) => { event.stopPropagation(); onClose(win.id); }}
            className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative bg-[#05070f]/85 text-[var(--text-secondary)]">
        {children}
      </div>

      {!win.isMaximized && (
        <span className="window-resize-handle" onMouseDown={beginResize} />
      )}
    </div>
  );
};

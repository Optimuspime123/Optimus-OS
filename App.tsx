
import React, { useState, useCallback } from 'react';
import { WindowState } from './types';
import { Window } from './components/Window';
import { TerminalComponent } from './components/TerminalComponent';
import { Editor } from './components/Editor';
import { TaskManager } from './components/TaskManager';
import { Terminal, Code, Cpu, Power, HardDrive, FileText, Trash2, Moon, Settings, Upload } from 'lucide-react';

const App: React.FC = () => {
  const [isSleeping, setIsSleeping] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop');
  const [windows, setWindows] = useState<WindowState[]>([
    {
      id: 'term-1',
      title: 'TERMINAL',
      type: 'TERMINAL',
      x: 100,
      y: 80,
      width: 800,
      height: 500,
      zIndex: 10,
      isMinimized: false,
      isMaximized: false
    }
  ]);

  const createWindow = useCallback((type: string, arg?: string) => {
    setWindows(prev => {
      const id = `${type.toLowerCase()}-${Date.now()}`;
      const newWindow: WindowState = {
        id,
        title: type === 'EDITOR' ? `EDIT: ${arg || 'untitled'}` : type,
        type: type as any,
        x: 150 + (prev.length * 30),
        y: 100 + (prev.length * 30),
        width: type === 'TASK_MANAGER' ? 500 : (type === 'SETTINGS' ? 400 : 700),
        height: type === 'TASK_MANAGER' ? 400 : (type === 'SETTINGS' ? 350 : 500),
        zIndex: Date.now(),
        isMinimized: false,
        isMaximized: false,
        filePath: arg
      };
      return [...prev, newWindow];
    });
  }, []);

  const closeWindow = useCallback((id: string) => {
    setWindows(prev => prev.filter(w => w.id !== id));
  }, []);
  
  const focusWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, zIndex: Date.now() } : w));
  }, []);

  const updateWindow = useCallback((id: string, updates: Partial<WindowState>) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
  }, []);

  const toggleSleep = () => setIsSleeping(!isSleeping);

  const DesktopIcon = ({ label, icon: Icon, action }: any) => (
    <div 
      onClick={action}
      className="flex flex-col items-center gap-1 p-2 rounded hover:bg-white/10 cursor-pointer w-24 group transition-colors select-none"
    >
      <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-400/30 group-hover:bg-blue-500/30 shadow-lg backdrop-blur-sm transition-transform group-active:scale-95">
        <Icon className="text-blue-300" size={24} />
      </div>
      <span className="text-xs text-white drop-shadow-md font-medium text-center bg-black/20 rounded px-1">{label}</span>
    </div>
  );

  if (isSleeping) {
    return (
      <div 
        className="w-screen h-screen bg-black flex flex-col items-center justify-center text-white cursor-pointer"
        onClick={toggleSleep}
      >
        <Moon size={64} className="text-blue-500 mb-4 animate-pulse" />
        <h1 className="text-4xl font-light mb-2">ZZZ</h1>
        <p className="text-gray-500">System is sleeping. Click to wake.</p>
      </div>
    );
  }

  return (
    <div 
      className="w-screen h-screen relative bg-cover bg-center overflow-hidden selection:bg-pink-500/30"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"></div>

      {/* Desktop Icons - High Z-Index to be clickable */}
      <div className="absolute top-4 left-4 flex flex-col gap-4 z-10 pointer-events-auto">
        <DesktopIcon label="Terminal" icon={HardDrive} action={() => createWindow('TERMINAL')} />
        <DesktopIcon label="Editor" icon={FileText} action={() => createWindow('EDITOR', 'untitled.c')} />
        <DesktopIcon label="Task Mgr" icon={Cpu} action={() => createWindow('TASK_MANAGER')} />
        <DesktopIcon label="Settings" icon={Settings} action={() => createWindow('SETTINGS')} />
        <DesktopIcon label="Recycle Bin" icon={Trash2} action={() => {}} />
      </div>

      {/* Windows Layer - Pointer events none allows clicking through empty space */}
      <div className="absolute inset-0 pointer-events-none z-20">
        <div className="w-full h-full relative">
          {windows.map(win => (
            <Window 
              key={win.id} 
              window={win} 
              onClose={closeWindow} 
              onFocus={focusWindow}
              onUpdate={updateWindow}
            >
              {win.type === 'TERMINAL' && <TerminalComponent onOpenApp={createWindow} />}
              {win.type === 'EDITOR' && <Editor filePath={win.filePath || 'untitled'} onClose={() => closeWindow(win.id)} />}
              {win.type === 'TASK_MANAGER' && <TaskManager />}
              {win.type === 'SETTINGS' && (
                  <div className="p-6 text-white h-full flex flex-col">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Settings size={20} className="text-blue-400"/> System Settings
                    </h2>
                    
                    <div className="mb-6">
                      <label className="block text-sm text-gray-400 mb-2 font-mono">DESKTOP WALLPAPER</label>
                      <div className="flex flex-col gap-3">
                          <div className="w-full h-32 rounded overflow-hidden border border-white/20 relative group">
                            <img src={backgroundImage} className="w-full h-full object-cover" alt="Current Wallpaper" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-xs font-mono">CURRENT</span>
                            </div>
                          </div>
                          
                          <label className="flex items-center gap-2 cursor-pointer bg-white/5 hover:bg-white/10 hover:text-blue-300 transition-colors p-3 rounded border border-white/10 justify-center group">
                            <Upload size={16} className="text-gray-400 group-hover:text-blue-400" />
                            <span className="text-sm font-medium">Upload Image...</span>
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (ev) => {
                                    if(ev.target?.result) setBackgroundImage(ev.target.result as string);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                          <p className="text-xs text-gray-500 text-center">Supports JPG, PNG, WEBP</p>
                      </div>
                    </div>
                  </div>
              )}
            </Window>
          ))}
        </div>
      </div>

      {/* Taskbar */}
      <div className="absolute bottom-0 left-0 right-0 h-12 glass-panel border-t border-white/10 flex items-center px-4 justify-between z-50 pointer-events-auto">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => createWindow('TASK_MANAGER')}
            className="p-2 rounded hover:bg-white/10 transition-colors text-blue-400 hover:text-blue-300"
            title="Task Manager"
          >
             <Cpu size={20} />
          </button>
          
          <div className="h-6 w-px bg-white/20 mx-2"></div>

          <button 
            onClick={() => createWindow('TERMINAL')}
            className="p-2 rounded hover:bg-white/10 transition-colors text-gray-300 hover:text-green-400 relative"
            title="New Terminal"
          >
            <Terminal size={20} />
          </button>
          
          {windows.map(win => (
             <button
                key={win.id}
                onClick={() => {
                  if (win.isMinimized) updateWindow(win.id, { isMinimized: false });
                  focusWindow(win.id);
                }}
                className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-mono border transition-all ${
                   !win.isMinimized
                  ? 'bg-white/15 border-white/40 text-white shadow-[0_0_10px_rgba(255,255,255,0.1)]' 
                  : 'bg-transparent border-white/10 text-gray-400 hover:bg-white/5'
                }`}
             >
                {win.type === 'TERMINAL' && <Terminal size={12}/>}
                {win.type === 'EDITOR' && <Code size={12}/>}
                {win.type === 'TASK_MANAGER' && <Cpu size={12}/>}
                {win.type === 'SETTINGS' && <Settings size={12}/>}
                <span className="max-w-[100px] truncate">{win.title}</span>
             </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
           <div className="text-xs font-mono text-gray-400 hover:text-white transition-colors cursor-default select-none">
             {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
           </div>
           <button 
             onClick={toggleSleep}
             className="text-red-400 hover:text-red-300 transition-transform hover:scale-110 p-2"
             title="Sleep Mode"
           >
             <Power size={18} />
           </button>
        </div>
      </div>
    </div>
  );
};

export default App;
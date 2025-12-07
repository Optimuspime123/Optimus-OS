import React, { useState, useCallback, useEffect } from 'react';
import { WindowState } from './types';
import { Window } from './components/Window';
import { TerminalComponent } from './components/TerminalComponent';
import { Editor } from './components/Editor';
import { TaskManager } from './components/TaskManager';
import { Terminal, Code, Cpu, Power, HardDrive, FileText, Trash2, Moon, Settings, Upload, Monitor, Box, Search, Grid } from 'lucide-react';

const App: React.FC = () => {
  const [isSleeping, setIsSleeping] = useState(false);
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
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
  const [activeWindowId, setActiveWindowId] = useState<string>('term-1');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const createWindow = useCallback((type: string, arg?: string) => {
    setStartMenuOpen(false);
    const id = `${type.toLowerCase()}-${Date.now()}`;
    setWindows(prev => {
      const newWindow: WindowState = {
        id,
        title: type === 'EDITOR' ? `EDIT: ${arg || 'untitled'}` : type,
        type: type as any,
        x: 150 + (prev.length * 40) % 300,
        y: 100 + (prev.length * 40) % 300,
        width: type === 'TASK_MANAGER' ? 600 : (type === 'SETTINGS' ? 500 : 800),
        height: type === 'TASK_MANAGER' ? 450 : (type === 'SETTINGS' ? 400 : 550),
        zIndex: Date.now(),
        isMinimized: false,
        isMaximized: false,
        filePath: arg
      };
      return [...prev, newWindow];
    });
    setActiveWindowId(id);
  }, []);

  const closeWindow = useCallback((id: string) => {
    setWindows(prev => {
      const next = prev.filter(w => w.id !== id);
      if (next.length === 0) {
        setActiveWindowId('');
        return next;
      }
      if (id === activeWindowId) {
        const top = next.reduce((acc, curr) => curr.zIndex > acc.zIndex ? curr : acc, next[0]);
        setActiveWindowId(top.id);
      }
      return next;
    });
  }, [activeWindowId]);
  
  const focusWindow = useCallback((id: string) => {
    setActiveWindowId(id);
    setWindows(prev => prev.map(w => w.id === id ? { ...w, zIndex: Date.now() } : w));
  }, []);

  const updateWindow = useCallback((id: string, updates: Partial<WindowState>) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
  }, []);

  const toggleSleep = () => setIsSleeping(!isSleeping);

  const DesktopIcon = ({ label, icon: Icon, action }: any) => (
    <div 
      onClick={action}
      className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-white/5 cursor-pointer w-28 group transition-all select-none active:scale-95"
    >
      <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl flex items-center justify-center border border-white/10 group-hover:border-blue-400/50 shadow-lg backdrop-blur-md transition-all group-hover:shadow-[0_0_15px_rgba(59,130,246,0.3)]">
        <Icon className="text-blue-200 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" size={28} />
      </div>
      <span className="text-xs text-white/90 drop-shadow-lg font-medium text-center tracking-wide">{label}</span>
    </div>
  );

  if (isSleeping) {
    return (
      <div 
        className="w-screen h-screen bg-black flex flex-col items-center justify-center text-white cursor-pointer overflow-hidden relative"
        onClick={toggleSleep}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black"></div>
        <div className="z-10 flex flex-col items-center animate-pulse">
            <Power size={64} className="text-blue-500 mb-6 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
            <h1 className="text-5xl font-thin tracking-[0.5em] mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">SLEEP</h1>
            <p className="text-gray-500 font-mono text-sm">SYSTEM HALTED. TOUCH TO RESUME.</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="w-screen h-screen relative bg-cover bg-center overflow-hidden selection:bg-cyan-500/30 font-sans"
      style={{ backgroundImage: `url(${backgroundImage})` }}
      onClick={() => setStartMenuOpen(false)}
    >
      {/* Background Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[0.5px]"></div>
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>

      {/* Desktop Icons */}
      <div className="absolute top-6 left-6 flex flex-col gap-4 z-10 pointer-events-auto">
        <DesktopIcon label="Terminal" icon={HardDrive} action={() => createWindow('TERMINAL')} />
        <DesktopIcon label="Editor" icon={FileText} action={() => createWindow('EDITOR', 'untitled.c')} />
        <DesktopIcon label="System" icon={Cpu} action={() => createWindow('TASK_MANAGER')} />
        <DesktopIcon label="Recycle Bin" icon={Trash2} action={() => {}} />
      </div>

      {/* Windows Layer */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        <div className="w-full h-full relative">
          {windows.map(win => (
            <Window 
              key={win.id} 
              window={win}
              isActive={win.id === activeWindowId}
              onClose={closeWindow} 
              onFocus={focusWindow}
              onUpdate={updateWindow}
            >
              {win.type === 'TERMINAL' && <TerminalComponent onOpenApp={createWindow} />}
              {win.type === 'EDITOR' && <Editor filePath={win.filePath || 'untitled'} onClose={() => closeWindow(win.id)} />}
              {win.type === 'TASK_MANAGER' && <TaskManager />}
              {win.type === 'SETTINGS' && (
                  <div className="p-6 text-white h-full flex flex-col bg-[#0c0c14] overflow-y-auto custom-scrollbar">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-blue-400">
                        <Settings size={24} /> System Preferences
                    </h2>
                    
                    <div className="space-y-6 pb-6">
                      <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                          <label className="block text-xs font-mono text-gray-400 mb-3 uppercase tracking-wider">Desktop Wallpaper</label>
                          <div className="flex flex-col gap-4">
                              <div className="w-full h-40 rounded-lg overflow-hidden border border-white/20 relative group shadow-lg">
                                <img src={backgroundImage} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Current Wallpaper" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="text-xs font-mono bg-black/50 px-3 py-1 rounded backdrop-blur-md border border-white/20">CURRENT</span>
                                </div>
                              </div>
                              
                              <label className="flex items-center gap-2 cursor-pointer bg-blue-600/20 hover:bg-blue-600/30 hover:text-blue-300 transition-all p-3 rounded border border-blue-500/30 justify-center group">
                                <Upload size={16} className="text-blue-400 group-hover:scale-110 transition-transform" />
                                <span className="text-sm font-medium">Upload Image</span>
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
                          </div>
                      </div>
                      
                      <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                        <label className="block text-xs font-mono text-gray-400 mb-2 uppercase tracking-wider">System Info</label>
                        <div className="text-sm text-gray-300 font-mono space-y-1">
                            <div className="flex justify-between"><span>Kernel</span> <span className="text-green-400">Optimus-v2.2</span></div>
                            <div className="flex justify-between"><span>Memory</span> <span className="text-yellow-400">64KB / Proc</span></div>
                            <div className="flex justify-between"><span>Display</span> <span className="text-blue-400">1920x1080 (Sim)</span></div>
                        </div>
                      </div>

                      <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                        <label className="block text-xs font-mono text-gray-400 mb-2 uppercase tracking-wider">About</label>
                         <p className="text-xs text-gray-400 leading-5">
                            Optimus-OS is an experimental React-based operating system simulation. It features a complete recursive descent C compiler and a stack-based virtual machine running entirely in your browser.
                         </p>
                      </div>
                    </div>
                  </div>
              )}
            </Window>
          ))}
        </div>
      </div>

      {/* Start Menu */}
      {startMenuOpen && (
        <div 
          className="absolute bottom-14 left-4 w-[360px] glass-panel rounded-xl border border-white/10 flex flex-col shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-5 duration-200 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
            <div className="p-4 bg-white/5 border-b border-white/5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                    <Monitor size={16} className="text-white" />
                </div>
                <div>
                    <div className="text-sm font-bold text-white">Guest User</div>
                    <div className="text-[10px] text-cyan-400 font-mono">ID: 0x1A4F</div>
                </div>
                <div className="ml-auto">
                    <button onClick={toggleSleep} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-red-400 transition-colors">
                        <Power size={18} />
                    </button>
                </div>
            </div>

            <div className="p-2">
                <div className="relative mb-3 px-2 pt-2">
                    <Search className="absolute left-5 top-4.5 text-gray-500" size={14} />
                    <input 
                        type="text" 
                        placeholder="Search apps..." 
                        className="w-full bg-black/40 border border-white/10 rounded px-8 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-gray-600"
                    />
                </div>
                
                <div className="px-2 pb-2 text-xs font-mono text-gray-500 uppercase tracking-widest mb-2">Applications</div>
                
                <div className="grid grid-cols-4 gap-2 p-2">
                    {[
                        { name: 'Terminal', icon: Terminal, action: () => createWindow('TERMINAL') },
                        { name: 'Editor', icon: Code, action: () => createWindow('EDITOR', 'new_file.c') },
                        { name: 'Monitor', icon: Cpu, action: () => createWindow('TASK_MANAGER') },
                        { name: 'Settings', icon: Settings, action: () => createWindow('SETTINGS') },
                    ].map((app, i) => (
                        <button 
                            key={i} 
                            onClick={app.action}
                            className="flex flex-col items-center gap-2 p-3 rounded hover:bg-white/10 transition-colors group"
                        >
                            <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-blue-500/30 group-hover:bg-blue-500/10 transition-all">
                                <app.icon size={20} className="text-gray-300 group-hover:text-blue-300" />
                            </div>
                            <span className="text-[10px] text-gray-400 group-hover:text-white">{app.name}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* Taskbar */}
      <div className="absolute bottom-0 left-0 right-0 h-14 bg-black/35 backdrop-blur-2xl border-t border-white/10 flex items-center px-4 justify-between z-50 pointer-events-auto">
        <div className="flex items-center gap-3 h-full">
          {/* Start Button */}
          <button 
            onClick={(e) => { e.stopPropagation(); setStartMenuOpen(!startMenuOpen); }}
            className={`h-9 w-9 flex items-center justify-center rounded transition-all ml-1 ${startMenuOpen ? 'bg-blue-500/20 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'hover:bg-white/10 text-white'}`}
            title="Start"
          >
             <Box size={20} strokeWidth={2.5} />
          </button>

          <div className="h-5 w-px bg-white/10 mx-1"></div>

          {/* Windows */}
          <div className="flex items-center gap-2">
            {windows.map(win => {
              const isWindowActive = !win.isMinimized && win.id === activeWindowId;
              return (
                <button
                  key={win.id}
                  onClick={() => {
                    if (win.isMinimized) updateWindow(win.id, { isMinimized: false });
                    focusWindow(win.id);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold transition-all border ${
                    isWindowActive
                      ? 'bg-white/15 border-white/30 text-white shadow-[0_5px_20px_rgba(0,0,0,0.3)]'
                      : 'bg-transparent border-transparent text-gray-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {win.type === 'TERMINAL' && <Terminal size={14} className={isWindowActive ? 'text-emerald-300' : ''} />}
                  {win.type === 'EDITOR' && <Code size={14} className={isWindowActive ? 'text-sky-300' : ''} />}
                  {win.type === 'TASK_MANAGER' && <Cpu size={14} className={isWindowActive ? 'text-rose-300' : ''} />}
                  {win.type === 'SETTINGS' && <Settings size={14} className={isWindowActive ? 'text-slate-200' : ''} />}
                  <span className="max-w-[120px] truncate hidden md:inline">{win.title}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${!win.isMinimized ? 'bg-[var(--accent)] glow' : 'bg-transparent'}`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* System Tray */}
        <div className="flex items-center gap-4 px-3 h-full">
           <div className="flex flex-col items-end leading-none cursor-default select-none group">
             <div className="text-xs font-bold text-gray-200 group-hover:text-blue-300 transition-colors">
                {currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
             </div>
             <div className="text-[10px] text-gray-500 font-mono">
                {currentTime.toLocaleDateString([], { month: 'short', day: 'numeric' })}
             </div>
           </div>
           
           <button 
             onClick={() => setStartMenuOpen(!startMenuOpen)}
             className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded"
           >
             <Grid size={18} />
           </button>
        </div>
      </div>
    </div>
  );
};

export default App;
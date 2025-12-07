
import React, { useEffect, useState } from 'react';
import { processManager } from '../services/ProcessManager';
import { Process } from '../types';
import { Activity, XCircle } from 'lucide-react';

export const TaskManager: React.FC = () => {
  const [processes, setProcesses] = useState<Process[]>([]);

  useEffect(() => {
    const update = () => setProcesses(processManager.getProcessList());
    update();
    const unsub = processManager.subscribe(update);
    const interval = setInterval(update, 1000);
    return () => { unsub(); clearInterval(interval); };
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-white">
      <div className="p-4 border-b border-white/10 bg-[#252525] flex items-center gap-2">
         <Activity className="text-blue-400" size={20} />
         <span className="font-bold">System Monitor</span>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="text-gray-400 border-b border-white/10">
              <th className="pb-2">PID</th>
              <th className="pb-2">Name</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Memory</th>
              <th className="pb-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {processes.map(p => (
              <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-2 font-mono text-gray-300">{p.pid}</td>
                <td className="py-2">{p.name}</td>
                <td className="py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${p.state === 'RUNNING' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {p.state}
                  </span>
                </td>
                <td className="py-2 text-gray-400">{p.memoryUsage} KB</td>
                <td className="py-2">
                  <button 
                    onClick={() => processManager.killProcess(p.pid)}
                    className="text-red-400 hover:text-white transition-colors"
                  >
                    <XCircle size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {processes.length === 0 && (
           <div className="text-center text-gray-500 mt-10">No active user processes</div>
        )}
      </div>
      <div className="p-2 bg-[#111] text-xs text-gray-500 border-t border-white/10 text-center">
        Optimus-OS VM Kernel v2.0 - Heap Available: 64KB per process
      </div>
    </div>
  );
};
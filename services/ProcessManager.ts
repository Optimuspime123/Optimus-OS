import { Process } from '../types';
import { ProcessVM } from './VirtualMachine';

class ProcessManager {
  private processes: Map<number, ProcessVM> = new Map();
  private nextPid = 100;
  private listeners: (() => void)[] = [];

  public createProcess(name: string, bytecode: any[], data: Uint8Array, stdout: (s: string) => void): number {
    const pid = this.nextPid++;
    const vm = new ProcessVM(pid, bytecode, data, stdout);
    this.processes.set(pid, vm);
    this.notify();
    return pid;
  }

  public killProcess(pid: number) {
    const proc = this.processes.get(pid);
    if (proc) {
      proc.state = 'TERMINATED';
      this.processes.delete(pid);
      this.notify();
    }
  }

  public getProcessList(): Process[] {
    return Array.from(this.processes.values()).map(vm => ({
      id: vm.pid,
      pid: vm.pid,
      name: `proc_${vm.pid}`,
      state: vm.state as any,
      memoryUsage: 64, // KB
      startTime: Date.now()
    }));
  }

  public getProcess(pid: number) {
    return this.processes.get(pid);
  }
  
  public subscribe(cb: () => void) {
    this.listeners.push(cb);
    return () => { this.listeners = this.listeners.filter(l => l !== cb); }
  }

  private notify() {
    this.listeners.forEach(l => l());
  }
}

export const processManager = new ProcessManager();
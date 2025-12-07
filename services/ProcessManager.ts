import { Process } from '../types';
import { ProcessVM } from './VirtualMachine';

interface ProcessEntry {
  vm: ProcessVM;
  name: string;
  startTime: number;
  memoryUsage: number;
  windowId?: string;
}

class ProcessManager {
  private processes: Map<number, ProcessEntry> = new Map();
  private nextPid = 100;
  private listeners: (() => void)[] = [];

  public createProcess(name: string, bytecode: any[], data: Uint8Array, stdout: (s: string) => void): number {
    const pid = this.nextPid++;
    const vm = new ProcessVM(pid, bytecode, data, stdout);
    this.processes.set(pid, {
      vm,
      name,
      startTime: Date.now(),
      memoryUsage: 64,
    });
    this.notify();
    return pid;
  }

  public registerSystemProcess(name: string, memoryUsage = 16, windowId?: string): number {
    const pid = this.nextPid++;
    // System processes don't execute bytecode but we still represent them with a VM for state tracking
    const vm = new ProcessVM(pid, [], new Uint8Array(), () => {});
    this.processes.set(pid, {
      vm,
      name,
      startTime: Date.now(),
      memoryUsage,
      windowId,
    });
    this.notify();
    return pid;
  }

  public killProcessByWindow(windowId: string) {
    let removed = false;
    for (const [pid, proc] of this.processes.entries()) {
      if (proc.windowId === windowId) {
        proc.vm.state = 'TERMINATED';
        this.processes.delete(pid);
        removed = true;
      }
    }
    if (removed) this.notify();
  }

  public killProcess(pid: number) {
    const proc = this.processes.get(pid);
    if (proc) {
      proc.vm.state = 'TERMINATED';
      this.processes.delete(pid);
      this.notify();
    }
  }

  private cleanupTerminated() {
    let removed = false;
    for (const [pid, proc] of this.processes.entries()) {
      if (proc.vm.state === 'TERMINATED') {
        this.processes.delete(pid);
        removed = true;
      }
    }
    if (removed) this.notify();
  }

  public getProcessList(): Process[] {
    this.cleanupTerminated();
    return Array.from(this.processes.entries()).map(([pid, entry]) => ({
      id: pid,
      pid,
      name: entry.name,
      state: entry.vm.state as any,
      memoryUsage: entry.memoryUsage,
      startTime: entry.startTime,
      windowId: entry.windowId,
    }));
  }

  public getProcess(pid: number) {
    return this.processes.get(pid)?.vm;
  }

  public subscribe(cb: () => void) {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }
}

export const processManager = new ProcessManager();
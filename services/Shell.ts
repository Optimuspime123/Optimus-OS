
import { fileSystem } from './FileSystem';
import { compiler } from './Compiler';
import { processManager } from './ProcessManager';
import { FileType } from '../types';

export class Shell {
  public history: string[] = [];
  public foregroundPID: number | null = null;
  
  private commands: Record<string, (args: string[], stdout: (s:string)=>void, stderr: (s:string)=>void) => Promise<void> | void> = {
    'ls': (args, out) => {
      try {
        const path = args[0] || '.';
        const items = fileSystem.listDirectory(path);
        out(items.join('  '));
      } catch (e: any) { out(e.message); }
    },
    'pwd': (_, out) => out(fileSystem.getCurrentPathString()),
    'cd': (args, out) => {
      const res = fileSystem.changeDirectory(args[0] || '/home/user');
      if (res) out(res);
    },
    'cat': (args, out, err) => {
      if (!args[0]) return err('cat: missing operand');
      try { out(fileSystem.readFile(args[0])); } catch (e: any) { err(e.message); }
    },
    'echo': (args, out) => out(args.join(' ')),
    'clear': () => {}, 
    'mkdir': (args, out, err) => {
      if (!args[0]) return err('mkdir: missing operand');
      try { fileSystem.mkdir(args[0]); } catch (e: any) { err(e.message); }
    },
    'rm': (args, out, err) => {
      if (!args[0]) return err('rm: missing operand');
      try { fileSystem.rm(args[0]); } catch (e: any) { err(e.message); }
    },
    'touch': (args, out, err) => {
      if (!args[0]) return err('touch: missing operand');
      try { fileSystem.writeFile(args[0], ''); } catch (e: any) { err(e.message); }
    },
    'ps': (_, out) => {
      const procs = processManager.getProcessList();
      out('PID  STATE       NAME');
      procs.forEach(p => out(`${p.pid.toString().padEnd(4)} ${p.state.padEnd(11)} ${p.name}`));
    },
    'kill': (args, out, err) => {
      if (!args[0]) return err('kill: missing pid');
      processManager.killProcess(parseInt(args[0]));
      out(`Process ${args[0]} killed.`);
    },
    'gcc': async (args, out, err) => {
      if (!args[0]) return err('gcc: no input files');
      try {
        const source = fileSystem.readFile(args[0]);
        out(`Compiling ${args[0]}...\n`);
        const { bytecode, data, warnings } = compiler.compile(source);
        if (warnings && warnings.length > 0) warnings.forEach(w => out(`\x1b[33m${w}\x1b[0m`));
        fileSystem.writeExecutable('a.out', bytecode, data);
        out('Compilation finished. Output: a.out');
      } catch (e: any) {
        err(`Compiler Error: ${e.message}`);
      }
    },
    'help': (_, out) => {
      out(`Optimus-OS Shell v2.2\n\nCommands:\n  edit <file>  - Open file in editor\n  gcc <file>   - Compile C source file\n  ./a.out      - Run compiled program\n  ls, cd, cat  - File operations\n  ps, kill     - Process management\n  top          - Task Manager\n  clear, help  - Utilities\n\nC Language Support:\n  - Control: if/else, while, for, do-while, switch/case\n  - Loop control: break, continue\n  - Math: sin, cos, tan, sqrt, pow, abs\n  - Multi-var decls: int a=1, b=2, c;`);
    }
  };
  
  public handleInput(input: string, stdout: (s: string) => void, stderr: (s: string) => void, openApp: any) {
      if (this.foregroundPID !== null) {
          const proc = processManager.getProcess(this.foregroundPID);
          if (proc && proc.state === 'WAITING_INPUT') {
              stdout(input + '\r\n'); // Echo input
              proc.resolveInput(input);
              
              // Resume execution loop
              this.resumeExecution(proc, stdout);
              return;
          } else if (!proc || proc.state === 'TERMINATED') {
              this.foregroundPID = null;
          }
      }
      
      // If no foreground process, execute as command
      this.execute(input, stdout, stderr, openApp);
  }

  public async execute(input: string, stdout: (text: string) => void, stderr: (text: string) => void, openApp: (type: string, arg?: string) => void): Promise<void> {
    if (!input.trim()) return;
    this.history.push(input);

    const [cmdName, ...args] = input.trim().split(/\s+/);

    if (cmdName.startsWith('./')) {
      const execName = cmdName.substring(2);
      const node = fileSystem.resolvePath(execName);
      if (node && node.type === FileType.EXECUTABLE && node.bytecode) {
        const pid = processManager.createProcess(execName, node.bytecode, node.dataSegment || new Uint8Array(), stdout);
        this.foregroundPID = pid;
        const vm = processManager.getProcess(pid)!;
        this.resumeExecution(vm, stdout);
      } else {
        stderr(`bash: ${cmdName}: command not found or not executable`);
      }
      return;
    }

    if (cmdName === 'edit') {
        if (!args[0]) return stderr('edit: missing filename');
        openApp('EDITOR', args[0]);
        return;
    }
    
    if (cmdName === 'top') { openApp('TASK_MANAGER'); return; }

    if (this.commands[cmdName]) {
      await this.commands[cmdName](args, stdout, stderr);
    } else {
      stderr(`bash: ${cmdName}: command not found`);
    }
  }

  private resumeExecution(vm: any, stdout: (s: string) => void) {
      const runChunk = () => {
          if (!vm || vm.state === 'TERMINATED') {
              this.foregroundPID = null;
              return;
          }
          if (vm.state === 'WAITING_INPUT') return; // Pause loop
          
          const keepGoing = vm.step(5000); 
          if (keepGoing) {
            setTimeout(runChunk, 0);
          } else {
              if (vm.state === 'WAITING_INPUT') {
                  // Wait for user input (Loop stops here, resumed by handleInput)
              } else {
                  this.foregroundPID = null;
              }
          }
        };
        runChunk();
  }

  public complete(partial: string): string | null {
    const options = fileSystem.listDirectory('.');
    const matches = options.filter(n => n.startsWith(partial));
    if (matches.length === 1) return matches[0];
    return null;
  }
}
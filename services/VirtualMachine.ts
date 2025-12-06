

import { Instruction, OpCode } from '../types';

export class ProcessVM {
  public pid: number;
  public memory: Uint8Array;
  public dataView: DataView;
  public stack: number[] = [];
  public pc: number = 0; // Program Counter
  public fp: number = 0; // Frame Pointer
  public heapPointer: number; 
  public state: 'RUNNING' | 'TERMINATED' | 'WAITING_INPUT' = 'RUNNING';
  
  private code: Instruction[];
  private stdout: (s: string) => void;
  private dataSegmentSize: number = 0;
  
  // Context for waiting input
  private scanContext: {
      fmt: string;
      args: number[]; // Pointers to variables
  } | null = null;

  constructor(pid: number, code: Instruction[], data: Uint8Array, stdout: (s: string) => void) {
    this.pid = pid;
    this.code = code;
    this.stdout = stdout;
    
    // 64KB RAM
    this.memory = new Uint8Array(65536);
    this.dataView = new DataView(this.memory.buffer);
    
    // Load Static Data at the beginning of memory
    if (data && data.length > 0) {
       this.memory.set(data, 0);
       this.dataSegmentSize = data.length;
    }
    
    // Heap starts after data segment (aligned to 4)
    this.heapPointer = Math.ceil((this.dataSegmentSize + 1024) / 4) * 4; 
    
    // Stack starts at end of memory
    this.fp = 60000; 
  }

  // Execute a number of steps
  public step(cycles: number = 100): boolean {
    if (this.state === 'TERMINATED' || this.state === 'WAITING_INPUT') return false;

    for (let i = 0; i < cycles; i++) {
      if (this.pc >= this.code.length) {
        this.state = 'TERMINATED';
        return false;
      }

      const instr = this.code[this.pc++];
      
      try {
        this.executeInstruction(instr);
      } catch (e: any) {
        this.stdout(`\nSegmentation Fault (Core Dumped): ${e.message}\n`);
        this.state = 'TERMINATED';
        return false;
      }

      if ((this.state as string) === 'TERMINATED' || (this.state as string) === 'WAITING_INPUT') return false;
    }
    return true;
  }
  
  public resolveInput(input: string) {
      if (this.state !== 'WAITING_INPUT' || !this.scanContext) return;
      
      const { fmt, args } = this.scanContext;
      const inputs = input.trim().split(/\s+/);
      
      let typeIdx = 0;
      let inputIdx = 0;
      
      for (let i = 0; i < fmt.length; i++) {
          if (fmt[i] === '%') {
              i++;
              while (i < fmt.length && ' +-#0'.includes(fmt[i])) i++; // flags
              while (i < fmt.length && /[0-9]/.test(fmt[i])) i++; // width
              if (fmt[i] === '.') { i++; while (i < fmt.length && /[0-9]/.test(fmt[i])) i++; }

              let lengthMod = '';
              if (fmt[i] === 'l') { lengthMod = 'l'; i++; }

              const type = fmt[i];
              if (inputIdx >= inputs.length || typeIdx >= args.length) break;

              const raw = inputs[inputIdx++];
              const addr = args[typeIdx++];

              if (type === 'd') {
                  this.setMemory(addr, parseInt(raw) || 0);
              } else if (type === 'f') {
                  const val = parseFloat(raw) || 0;
                  if (lengthMod === 'l') this.setMemory64(addr, val);
                  else this.setMemory(addr, val);
              } else if (type === 'c') {
                  this.setMemory(addr, raw.charCodeAt(0));
              } else if (type === 's') {
                   for(let k=0; k<raw.length; k++) {
                     this.setMemoryByte(addr + k, raw.charCodeAt(k));
                   }
                   this.setMemoryByte(addr + raw.length, 0);
              }
          }
      }
      
      this.scanContext = null;
      this.state = 'RUNNING';
  }

  private executeInstruction(instr: Instruction) {
    switch (instr.op) {
      case OpCode.HALT: this.state = 'TERMINATED'; break;
      case OpCode.LIT: this.stack.push(Number(instr.arg)); break;
      case OpCode.POP: this.stack.pop(); break;
      
      case OpCode.ADD: {
        const b = this.stack.pop()!;
        const a = this.stack.pop()!;
        this.stack.push(a + b);
        break;
      }
      case OpCode.SUB: {
        const b = this.stack.pop()!;
        const a = this.stack.pop()!;
        this.stack.push(a - b);
        break;
      }
      case OpCode.MUL: {
        const b = this.stack.pop()!;
        const a = this.stack.pop()!;
        this.stack.push(a * b);
        break;
      }
      case OpCode.DIV: {
        const b = this.stack.pop()!;
        const a = this.stack.pop()!;
        if (b === 0) throw new Error("Divide by zero");
        this.stack.push(a / b);
        break;
      }
      case OpCode.MOD: {
        const b = this.stack.pop()!;
        const a = this.stack.pop()!;
        this.stack.push(a % b);
        break;
      }
      case OpCode.EQ: this.stack.push(this.stack.pop() === this.stack.pop() ? 1 : 0); break;
      case OpCode.NEQ: this.stack.push(this.stack.pop() !== this.stack.pop() ? 1 : 0); break;
      case OpCode.LT: {
         const b = this.stack.pop()!;
         const a = this.stack.pop()!;
         this.stack.push(a < b ? 1 : 0);
         break;
      }
      case OpCode.GT: {
         const b = this.stack.pop()!;
         const a = this.stack.pop()!;
         this.stack.push(a > b ? 1 : 0);
         break;
      }
      
      case OpCode.JMP: this.pc = Number(instr.arg); break;
      case OpCode.JZ: {
        const val = this.stack.pop()!;
        if (val === 0) this.pc = Number(instr.arg);
        break;
      }
      
      case OpCode.PRINT: {
        const fmtAddr = this.stack.pop()!;
        const fmt = this.readString(fmtAddr);
        const numArgs = Number(instr.arg || 0);
        const args: any[] = [];
        for(let i=0; i<numArgs; i++) {
           args.push(this.stack.pop()!);
        }
        args.reverse(); 
        
        let argIndex = 0;
        let output = "";
        let i = 0;
        
        while(i < fmt.length) {
            if (fmt[i] === '%') {
                i++;
                // Specifier parsing: % [flags] [width] [.precision] type
                let spec = "";
                while(i < fmt.length && /[-+ #0-9.]/.test(fmt[i])) {
                    spec += fmt[i];
                    i++;
                }
                
                if (i >= fmt.length) break;
                const type = fmt[i];
                const val = args[argIndex++];
                
                let part = "";
                
                // Parse precision (and simplistic width)
                let precision = 6;
                const precMatch = spec.match(/\.(\d+)/);
                if (precMatch) precision = parseInt(precMatch[1]);
                
                if (val === undefined) {
                    part = `%{spec}${type}`;
                } else {
                    if (type === 'd') part = Math.floor(val).toString();
                    else if (type === 'f') part = val.toFixed(precision);
                    else if (type === 'x') part = Math.floor(val).toString(16);
                    else if (type === 'c') part = String.fromCharCode(Math.floor(val));
                    else if (type === 's') part = this.readString(val);
                    else part = `%${spec}${type}`;
                }
                output += part;
            } else {
                output += fmt[i];
            }
            i++;
        }
        
        this.stdout(output);
        break;
      }

      case OpCode.SCANF: {
          const fmtAddr = this.stack.pop()!;
          const fmt = this.readString(fmtAddr);
          const numArgs = Number(instr.arg || 0);
          const args: any[] = [];
          
          // Pop addresses
          for(let i=0; i<numArgs; i++) {
             args.push(this.stack.pop()!);
          }
          args.reverse(); // Standard C Order

          // Suspend execution and wait for input from shell
          this.state = 'WAITING_INPUT';
          this.scanContext = { fmt, args };
          break;
      }
      
      case OpCode.STORE: {
        const val = this.stack.pop()!;
        const offset = Number(instr.arg);
        this.setMemory(this.fp + offset, val);
        break;
      }
      case OpCode.LOAD: {
        const offset = Number(instr.arg);
        const val = this.getMemory(this.fp + offset);
        this.stack.push(val);
        break;
      }
      case OpCode.STORE64: {
        const val = this.stack.pop()!;
        const offset = Number(instr.arg);
        this.setMemory64(this.fp + offset, val);
        break;
      }
      case OpCode.LOAD64: {
        const offset = Number(instr.arg);
        const val = this.getMemory64(this.fp + offset);
        this.stack.push(val);
        break;
      }
      case OpCode.P_PUSH: {
        const offset = Number(instr.arg);
        this.stack.push(this.fp + offset);
        break;
      }
      case OpCode.S_IND: {
        const val = this.stack.pop()!;
        const addr = this.stack.pop()!;
        this.setMemory(addr, val);
        break;
      }
      case OpCode.L_IND: {
        const addr = this.stack.pop()!;
        const val = this.getMemory(addr);
        this.stack.push(val);
        break;
      }
      case OpCode.S_IND64: {
        const val = this.stack.pop()!;
        const addr = this.stack.pop()!;
        this.setMemory64(addr, val);
        break;
      }
      case OpCode.L_IND64: {
        const addr = this.stack.pop()!;
        const val = this.getMemory64(addr);
        this.stack.push(val);
        break;
      }
      case OpCode.MALLOC: {
        const size = this.stack.pop()!;
        const ptr = this.heapPointer;
        this.heapPointer += size;
        this.stack.push(ptr);
        break;
      }
      // Math
      case OpCode.SIN: this.stack.push(Math.sin(this.stack.pop()!)); break;
      case OpCode.COS: this.stack.push(Math.cos(this.stack.pop()!)); break;
      case OpCode.TAN: this.stack.push(Math.tan(this.stack.pop()!)); break;
      case OpCode.SQRT: this.stack.push(Math.sqrt(this.stack.pop()!)); break;
      case OpCode.ABS: this.stack.push(Math.abs(this.stack.pop()!)); break;
      case OpCode.POW: {
          const exp = this.stack.pop()!;
          const base = this.stack.pop()!;
          this.stack.push(Math.pow(base, exp));
          break;
      }
    }
  }

  private readString(addr: number): string {
    let str = "";
    let i = addr;
    while (i < this.memory.length) {
      const charCode = this.memory[i];
      if (charCode === 0) break;
      str += String.fromCharCode(charCode);
      i++;
    }
    return str;
  }

  private setMemory(addr: number, val: number) {
    if (addr < 0 || addr >= this.memory.length - 4) throw new Error(`Segfault: Write ${addr}`);
    this.dataView.setFloat32(addr, val, true); 
  }
  
  private setMemory64(addr: number, val: number) {
    if (addr < 0 || addr >= this.memory.length - 8) throw new Error(`Segfault: Write ${addr}`);
    this.dataView.setFloat64(addr, val, true); 
  }
  
  private setMemoryByte(addr: number, val: number) {
      if (addr < 0 || addr >= this.memory.length) throw new Error(`Segfault: Write Byte ${addr}`);
      this.memory[addr] = val;
  }

  private getMemory(addr: number): number {
    if (addr < 0 || addr >= this.memory.length - 4) throw new Error(`Segfault: Read ${addr}`);
    return this.dataView.getFloat32(addr, true);
  }

  private getMemory64(addr: number): number {
    if (addr < 0 || addr >= this.memory.length - 8) throw new Error(`Segfault: Read ${addr}`);
    return this.dataView.getFloat64(addr, true);
  }
}
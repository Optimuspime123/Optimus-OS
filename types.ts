

export enum FileType {
  FILE = 'FILE',
  DIRECTORY = 'DIRECTORY',
  EXECUTABLE = 'EXECUTABLE'
}

export interface FileNode {
  name: string;
  type: FileType;
  content?: string; // Text content for files
  bytecode?: Instruction[]; // For executables (compiled C)
  dataSegment?: Uint8Array; // Static data (strings, globals)
  children?: { [name: string]: FileNode }; // For directories
  parent?: FileNode | null;
}

export interface Process {
  id: number;
  pid: number;
  name: string;
  state: 'RUNNING' | 'SLEEPING' | 'TERMINATED' | 'ZOMBIE' | 'WAITING_INPUT';
  memoryUsage: number;
  startTime: number;
  windowId?: string; // If attached to a GUI window
}

export interface WindowState {
  id: string;
  title: string;
  type: 'TERMINAL' | 'EDITOR' | 'TASK_MANAGER' | 'BROWSER' | 'SETTINGS';
  content?: any;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  isMinimized: boolean;
  isMaximized: boolean;
  filePath?: string; 
}

// VM Types
export enum OpCode {
  HALT = 'HALT',
  LIT = 'LIT',       // Push literal
  LOAD = 'LOAD',     // Load from address relative to FP
  STORE = 'STORE',   // Store to address relative to FP
  LOAD64 = 'LOAD64', // Load 64-bit float
  STORE64 = 'STORE64', // Store 64-bit float
  GLOAD = 'GLOAD',   // Load global
  GSTORE = 'GSTORE', // Store global
  CALL = 'CALL',     // Call function
  RET = 'RET',       // Return
  JMP = 'JMP',       // Jump
  JZ = 'JZ',         // Jump if zero
  ADD = 'ADD',
  SUB = 'SUB',
  MUL = 'MUL',
  DIV = 'DIV',
  MOD = 'MOD',       // Modulo
  EQ = 'EQ',
  NEQ = 'NEQ',
  LT = 'LT',
  GT = 'GT',
  LE = 'LE',
  GE = 'GE',
  PRINT = 'PRINT',   // Syscall: printf (variadic)
  SCANF = 'SCANF',   // Syscall: scanf
  MALLOC = 'MALLOC', // Syscall: malloc
  FREE = 'FREE',     // Syscall: free
  P_PUSH = 'P_PUSH', // Pointer Push (LEA)
  L_IND = 'L_IND',   // Load Indirect (*p)
  S_IND = 'S_IND',   // Store Indirect (*p = x)
  L_IND64 = 'L_IND64', // Load Indirect 64-bit
  S_IND64 = 'S_IND64', // Store Indirect 64-bit
  FRAME = 'FRAME',   // Setup stack frame
  ITOF = 'ITOF',     // Int to Float
  POP = 'POP',       // Pop stack (discard value)
  DUP = 'DUP',       // Duplicate top of stack
  
  // Math
  SIN = 'SIN',
  COS = 'COS',
  TAN = 'TAN',
  SQRT = 'SQRT',
  POW = 'POW',
  ABS = 'ABS'
}

export interface Instruction {
  op: OpCode;
  arg?: number | string;
}
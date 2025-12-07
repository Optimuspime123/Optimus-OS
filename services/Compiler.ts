

import { Instruction, OpCode } from '../types';

interface Token {
  type: 'KEYWORD' | 'ID' | 'NUMBER' | 'STRING' | 'CHAR' | 'SYMBOL' | 'EOF';
  value: string;
  line: number;
}

interface SymbolInfo {
  offset: number; 
  type: string;   
  isArray: boolean;
  arraySize?: number;
  elementSize: number;
}

type ControlContext =
  | { type: 'loop'; breakJumps: number[]; continueTarget?: number; pendingContinues: number[] }
  | { type: 'switch'; breakJumps: number[] };

export class Compiler {
  private tokens: Token[] = [];
  private pos: number = 0;
  private instructions: Instruction[] = [];
  private locals: Map<string, SymbolInfo> = new Map();
  private localOffset: number = 0;
  private dataSegment: number[] = []; 
  private macros: Map<string, string> = new Map();
  private warnings: string[] = [];
  private controlStack: ControlContext[] = [];

  constructor() {}

  private error(msg: string) {
    const t = this.tokens[this.pos] || this.tokens[this.tokens.length - 1];
    throw new Error(`Line ${t?.line || '?'}: ${msg}`);
  }

  private warning(msg: string, line?: number) {
      this.warnings.push(`Warning line ${line || '?'}: ${msg}`);
  }

  // --- Preprocessor & Lexer ---
  private preprocess(source: string): string {
    const lines = source.split('\n');
    const outLines: string[] = [];
    const stack: boolean[] = []; 
    const isEmitting = () => stack.every(x => x);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      if (trimmed.startsWith('#')) {
        outLines.push(''); 
        const parts = trimmed.substring(1).split(/\s+/);
        const cmd = parts[0];
        const arg1 = parts[1];
        const argRest = parts.slice(2).join(' ');

        if (cmd === 'define') {
            if (isEmitting()) {
                if (arg1) this.macros.set(arg1, argRest !== undefined && argRest !== '' ? argRest : '1');
            }
        } 
        else if (cmd === 'ifdef') {
            stack.push(isEmitting() ? this.macros.has(arg1) : false);
        }
        else if (cmd === 'ifndef') {
            stack.push(isEmitting() ? !this.macros.has(arg1) : false);
        }
        else if (cmd === 'endif') {
            if (stack.length > 0) stack.pop();
        }
      } else {
          outLines.push(isEmitting() ? line : '');
      }
    }
    if (stack.length > 0) throw new Error("Unterminated #ifdef/#ifndef block");
    return outLines.join('\n');
  }

  private tokenizeString(source: string, startLine: number): Token[] {
    const tokens: Token[] = [];
    let line = startLine;
    let i = 0;
    const isAlpha = (c: string) => /[a-zA-Z_]/.test(c);
    const isNum = (c: string) => /[0-9.]/.test(c);
    
    while (i < source.length) {
      let c = source[i];
      if (c === '\n') { line++; i++; continue; }
      if (/\s/.test(c)) { i++; continue; }
      
      // Comments
      if (c === '/' && source[i+1] === '/') {
        while (i < source.length && source[i] !== '\n') i++;
        continue;
      }
      
      // String Literals
      if (c === '"') {
        let val = ""; 
        i++; // Skip opening quote
        while (i < source.length && source[i] !== '"') {
            if (source[i] === '\\') {
                i++;
                if (i >= source.length) break;
                const next = source[i];
                switch(next) {
                    case 'n': val += '\n'; break;
                    case 't': val += '\t'; break;
                    case 'r': val += '\r'; break;
                    case '\\': val += '\\'; break;
                    case '"': val += '"'; break;
                    case '0': val += '\0'; break;
                    default: val += next; break;
                }
            } else {
                val += source[i];
            }
            i++;
        }
        if (i < source.length) i++; // Skip closing quote
        tokens.push({ type: 'STRING', value: val, line }); 
        continue;
      }

      // Char Literals
      if (c === "'") {
          i++; // Skip opening quote
          if (i >= source.length) { this.error("Unexpected EOF in char literal"); }
          
          let val = source[i];
          if (val === '\\') {
              i++;
              if (i >= source.length) this.error("Unexpected EOF in char literal escape");
              const next = source[i];
              switch(next) {
                  case 'n': val = '\n'; break;
                  case 't': val = '\t'; break;
                  case 'r': val = '\r'; break;
                  case '\\': val = '\\'; break;
                  case "'": val = "'"; break;
                  case '0': val = '\0'; break;
                  default: val = next; break;
              }
          }
          i++; // Move past char
          if (i >= source.length || source[i] !== "'") this.error("Expected closing single quote");
          i++; // Skip closing quote
          tokens.push({ type: 'CHAR', value: val, line }); 
          continue;
      }

      // Keywords / IDs
      if (isAlpha(c)) {
        let val = "";
        while (i < source.length && (isAlpha(source[i]) || isNum(source[i]))) val += source[i++];
        const kw = ['int', 'void', 'char', 'float', 'double', 'return', 'if', 'else', 'while', 'for', 'do', 'switch', 'case', 'default', 'break', 'continue', 'printf', 'scanf', 'malloc', 'free', 'sin', 'cos', 'tan', 'sqrt', 'pow', 'abs'];
        tokens.push({ type: kw.includes(val) ? 'KEYWORD' : 'ID', value: val, line });
        continue;
      }

      // Numbers
      if (isNum(c)) {
        let val = "";
        while (i < source.length && isNum(source[i])) val += source[i++];
        tokens.push({ type: 'NUMBER', value: val, line });
        continue;
      }

      // Multi-char symbols
      if (['==', '!=', '<=', '>='].includes(source.substr(i, 2))) {
         tokens.push({ type: 'SYMBOL', value: source.substr(i, 2), line }); i += 2; continue;
      }

      // Single-char symbols
      if (['+', '-', '*', '/', '%', '=', '(', ')', '{', '}', ';', ',', '<', '>', '&', '[', ']', ':'].includes(c)) {
        tokens.push({ type: 'SYMBOL', value: c, line }); i++; continue;
      }
      
      i++;
    }
    return tokens;
  }

  private expandMacros() {
      const newTokens: Token[] = [];
      for (let i = 0; i < this.tokens.length; i++) {
          const t = this.tokens[i];
          if (t.type === 'ID' && this.macros.has(t.value)) {
              const macroVal = this.macros.get(t.value)!;
              const expanded = this.tokenizeString(macroVal, t.line);
              newTokens.push(...expanded);
          } else {
              newTokens.push(t);
          }
      }
      this.tokens = newTokens;
  }

  public compile(source: string): { bytecode: Instruction[], data: Uint8Array, warnings: string[] } {
    this.warnings = [];
    this.macros.clear();
    this.instructions = [];
    this.dataSegment = [];
    this.locals.clear();
    this.localOffset = 0;
    this.controlStack = [];
    
    const preprocessed = this.preprocess(source);
    this.tokens = this.tokenizeString(preprocessed, 1);
    this.expandMacros();
    this.tokens.push({ type: 'EOF', value: 'EOF', line: this.tokens.length > 0 ? this.tokens[this.tokens.length-1].line : 1 });
    this.pos = 0;

    while (this.peek().type !== 'EOF') this.parseFunction();

    return { bytecode: this.instructions, data: new Uint8Array(this.dataSegment), warnings: this.warnings };
  }

  private emit(op: OpCode, arg?: number | string) {
    this.instructions.push({ op, arg });
    return this.instructions.length - 1;
  }

  private addStringLiteral(s: string): number {
    const offset = this.dataSegment.length;
    for (let i = 0; i < s.length; i++) this.dataSegment.push(s.charCodeAt(i));
    this.dataSegment.push(0);
    return offset;
  }

  private peek() { return this.tokens[this.pos]; }
  
  private consume(type?: string, val?: string) {
    const t = this.tokens[this.pos];
    if (type === 'SYMBOL' && val === ';') {
        if (t.type === 'KEYWORD' || (t.type === 'ID' && ['printf', 'main'].includes(t.value))) {
             this.error(`Did you forget a semicolon before '${t.value}'?`);
        }
    }
    if (type && t.type !== type) this.error(`Expected ${type}, got ${t.type} '${t.value}'`);
    if (val && t.value !== val) this.error(`Expected '${val}', got '${t.value}'`);
    this.pos++;
    return t;
  }

  private parseFunction() {
    this.consume('KEYWORD'); // Return type
    this.consume('ID'); // Name
    this.consume('SYMBOL', '(');
    while (this.peek().value !== ')') this.pos++;
    this.consume('SYMBOL', ')');
    this.consume('SYMBOL', '{');
    while (this.peek().value !== '}') this.parseStatement();
    this.consume('SYMBOL', '}');
    this.emit(OpCode.HALT);
  }

  private parseStatement() {
    const t = this.peek();

    // Variable Decl
    if (['int', 'float', 'char', 'double'].includes(t.value)) {
      const baseType = this.consume().value;
      this.parseDeclarationList(baseType, true);
    }
    // Control Flow
    else if (t.value === 'if') {
      this.consume(); this.consume('SYMBOL', '(');
      this.parseExpression();
      this.consume('SYMBOL', ')');
      const jzIdx = this.emit(OpCode.JZ, 0); 
      this.consume('SYMBOL', '{');
      while (this.peek().value !== '}') this.parseStatement();
      this.consume('SYMBOL', '}');
      
      if (this.peek().value === 'else') {
        const jmpIdx = this.emit(OpCode.JMP, 0);
        this.instructions[jzIdx].arg = this.instructions.length;
        this.consume(); this.consume('SYMBOL', '{');
        while (this.peek().value !== '}') this.parseStatement();
        this.consume('SYMBOL', '}');
        this.instructions[jmpIdx].arg = this.instructions.length;
      } else {
        this.instructions[jzIdx].arg = this.instructions.length;
      }
    }
    else if (t.value === 'while') {
      this.consume();
      const condIdx = this.instructions.length;
      const loopCtx = this.pushLoopContext(condIdx);
      this.consume('SYMBOL', '('); this.parseExpression(); this.consume('SYMBOL', ')');
      const jzIdx = this.emit(OpCode.JZ, 0);
      this.consume('SYMBOL', '{');
      while (this.peek().value !== '}') this.parseStatement();
      this.consume('SYMBOL', '}');
      this.emit(OpCode.JMP, condIdx);
      const endIdx = this.instructions.length;
      this.instructions[jzIdx].arg = endIdx;
      this.patchBreaks(loopCtx, endIdx);
      this.patchPendingContinues(loopCtx, condIdx);
      this.popContext('loop');
    }
    else if (t.value === 'do') {
      this.consume();
      const bodyIdx = this.instructions.length;
      const loopCtx = this.pushLoopContext();
      this.consume('SYMBOL', '{');
      while (this.peek().value !== '}') this.parseStatement();
      this.consume('SYMBOL', '}');
      this.consume('KEYWORD', 'while');
      const condIdx = this.instructions.length;
      loopCtx.continueTarget = condIdx;
      this.patchPendingContinues(loopCtx, condIdx);
      this.consume('SYMBOL', '('); this.parseExpression(); this.consume('SYMBOL', ')');
      this.consume('SYMBOL', ';');
      const jzIdx = this.emit(OpCode.JZ, 0);
      this.emit(OpCode.JMP, bodyIdx);
      const endIdx = this.instructions.length;
      this.instructions[jzIdx].arg = endIdx;
      this.patchBreaks(loopCtx, endIdx);
      this.popContext('loop');
    }
    else if (t.value === 'for') {
      this.consume(); this.consume('SYMBOL', '(');
      if (['int', 'float', 'char', 'double'].includes(this.peek().value)) {
          const baseType = this.consume().value;
          this.parseDeclarationList(baseType, true);
      } else if (this.peek().value !== ';') {
          this.parseExpression();
          this.emit(OpCode.POP);
          this.consume('SYMBOL', ';');
      } else {
          this.consume('SYMBOL', ';');
      }
      
      const condIdx = this.instructions.length;
      if (this.peek().value !== ';') this.parseExpression();
      else this.emit(OpCode.LIT, 1);
      
      const jzIdx = this.emit(OpCode.JZ, 0);
      this.consume('SYMBOL', ';');
      
      const bodyJmp = this.emit(OpCode.JMP, 0);
      const incIdx = this.instructions.length;
      const loopCtx = this.pushLoopContext(incIdx);
      if (this.peek().value !== ')') {
          this.parseExpression();
          this.emit(OpCode.POP);
      }
      this.consume('SYMBOL', ')');
      this.emit(OpCode.JMP, condIdx);
      
      const bodyIdx = this.instructions.length;
      this.instructions[bodyJmp].arg = bodyIdx;
      
      this.consume('SYMBOL', '{');
      while (this.peek().value !== '}') this.parseStatement();
      this.consume('SYMBOL', '}');
      
      this.emit(OpCode.JMP, incIdx);
      const endIdx = this.instructions.length;
      this.instructions[jzIdx].arg = endIdx;
      this.patchBreaks(loopCtx, endIdx);
      this.patchPendingContinues(loopCtx, incIdx);
      this.popContext('loop');
    }
    else if (t.value === 'switch') {
      this.parseSwitchStatement();
    }
    else if (t.value === 'break') {
      this.consume();
      this.consume('SYMBOL', ';');
      const ctx = this.controlStack[this.controlStack.length - 1];
      if (!ctx) this.error("'break' not inside loop or switch");
      ctx.breakJumps.push(this.emit(OpCode.JMP, 0));
    }
    else if (t.value === 'continue') {
      this.consume();
      this.consume('SYMBOL', ';');
      const loopCtx = this.findNearestLoopContext();
      if (!loopCtx) this.error("'continue' not inside loop");
      if (loopCtx.continueTarget !== undefined) {
          this.emit(OpCode.JMP, loopCtx.continueTarget);
      } else {
          const idx = this.emit(OpCode.JMP, 0);
          loopCtx.pendingContinues.push(idx);
      }
    }
    // Syscalls
    else if (t.value === 'printf') {
      this.consume(); this.consume('SYMBOL', '(');
      const fmtStr = this.consume('STRING').value;
      
      // Improved Regex for Argument Counting: % [flags] [width] [.precision] type
      const matches = fmtStr.match(/%[-+ #0-9.]*[dfcsx]/g) || [];
      const numArgs = matches.length;
      
      for (let i = 0; i < numArgs; i++) { this.consume('SYMBOL', ','); this.parseExpression(); }
      this.emit(OpCode.LIT, this.addStringLiteral(fmtStr));
      this.emit(OpCode.PRINT, numArgs);
      this.consume('SYMBOL', ')'); this.consume('SYMBOL', ';');
    }
    else if (t.value === 'scanf') {
        this.consume(); this.consume('SYMBOL', '(');
        const fmtStr = this.consume('STRING').value;
        const matches = fmtStr.match(/%[-+ #0-9.]*l?[dfcsx]/g) || [];
        const numArgs = matches.length;
        
        for (let i = 0; i < numArgs; i++) { this.consume('SYMBOL', ','); this.parseExpression(); }
        this.emit(OpCode.LIT, this.addStringLiteral(fmtStr));
        this.emit(OpCode.SCANF, numArgs);
        this.consume('SYMBOL', ')'); this.consume('SYMBOL', ';');
    }
    else if (t.value === 'return') {
      this.consume();
      if (this.peek().value !== ';') this.parseExpression();
      this.consume('SYMBOL', ';');
      this.emit(OpCode.HALT);
    }
    // Expression Statement
    else {
      this.parseExpression();
      this.consume('SYMBOL', ';');
      this.emit(OpCode.POP); // Expression statements must pop result
    }
  }

  private parseDeclarationList(baseType: string, consumeSemicolon: boolean) {
    while (true) {
      let ptrDepth = 0;
      while (this.peek().value === '*') { this.consume(); ptrDepth++; }

      const name = this.consume('ID').value;
      let isArray = false;
      let arraySize = 0;

      if (this.peek().value === '[') {
        this.consume();
        arraySize = parseInt(this.consume('NUMBER').value);
        this.consume('SYMBOL', ']');
        isArray = true;
      }

      const isPtr = ptrDepth > 0;
      const isDouble = baseType === 'double' && !isPtr;
      const elementSize = isPtr ? 4 : (isDouble ? 8 : 4);
      const sizeBytes = isArray ? arraySize * elementSize : elementSize;

      const offset = this.localOffset;
      this.localOffset += sizeBytes;

      const typeStr = isPtr ? baseType + '*'.repeat(ptrDepth) : baseType;
      this.locals.set(name, { offset, type: typeStr, isArray, arraySize, elementSize });

      if (this.peek().value === '=') {
        if (isArray) this.error("Array init not supported.");
        this.consume();
        this.parseExpression();
        if (elementSize === 8 && !isPtr) this.emit(OpCode.STORE64, offset);
        else this.emit(OpCode.STORE, offset);
      }

      if (this.peek().value === ',') { this.consume(); continue; }
      break;
    }

    if (consumeSemicolon) this.consume('SYMBOL', ';');
  }

  private pushLoopContext(continueTarget?: number) {
    const ctx: Extract<ControlContext, { type: 'loop' }> = {
      type: 'loop',
      breakJumps: [],
      continueTarget,
      pendingContinues: []
    };
    this.controlStack.push(ctx);
    return ctx;
  }

  private pushSwitchContext() {
    const ctx: ControlContext = { type: 'switch', breakJumps: [] };
    this.controlStack.push(ctx);
    return ctx;
  }

  private popContext<T extends ControlContext['type']>(expected: T): Extract<ControlContext, { type: T }> {
    const ctx = this.controlStack.pop();
    if (!ctx || ctx.type !== expected) this.error('Invalid control flow structure');
    return ctx as Extract<ControlContext, { type: T }>;
  }

  private findNearestLoopContext(): Extract<ControlContext, { type: 'loop' }> | null {
    for (let i = this.controlStack.length - 1; i >= 0; i--) {
      const ctx = this.controlStack[i];
      if (ctx.type === 'loop') return ctx;
    }
    return null;
  }

  private patchBreaks(ctx: ControlContext, target: number) {
    ctx.breakJumps.forEach(idx => this.instructions[idx].arg = target);
  }

  private patchPendingContinues(ctx: Extract<ControlContext, { type: 'loop' }>, target: number) {
    ctx.pendingContinues.forEach(idx => this.instructions[idx].arg = target);
    ctx.pendingContinues = [];
  }

  private parseCaseConstant(): number {
    const t = this.peek();
    if (t.type === 'NUMBER') {
      return parseFloat(this.consume().value);
    } else if (t.type === 'CHAR') {
      return this.consume().value.charCodeAt(0);
    } else if (t.value === '-') {
      this.consume();
      const num = this.consume('NUMBER');
      return -parseFloat(num.value);
    } else {
      this.error(`Expected constant in case label, got ${t.value}`);
      return 0;
    }
  }

  private parseSwitchStatement() {
    this.consume(); // 'switch'
    this.consume('SYMBOL', '(');
    this.parseExpression(); // leave value on stack
    this.consume('SYMBOL', ')');

    const skipBodiesJmp = this.emit(OpCode.JMP, 0);
    const switchCtx = this.pushSwitchContext();
    const caseEntries: Array<{ value: number; target: number }> = [];
    let defaultTarget: number | null = null;

    this.consume('SYMBOL', '{');
    while (this.peek().value !== '}') {
      const next = this.peek();
      if (next.value === 'case') {
        this.consume();
        const caseValue = this.parseCaseConstant();
        this.consume('SYMBOL', ':');
        caseEntries.push({ value: caseValue, target: this.instructions.length });
      } else if (next.value === 'default') {
        this.consume();
        this.consume('SYMBOL', ':');
        defaultTarget = this.instructions.length;
      } else {
        this.parseStatement();
      }
    }
    this.consume('SYMBOL', '}');

    const exitJump = this.emit(OpCode.JMP, 0);

    const dispatchStart = this.instructions.length;
    this.instructions[skipBodiesJmp].arg = dispatchStart;

    for (const entry of caseEntries) {
      this.emit(OpCode.DUP);
      this.emit(OpCode.LIT, entry.value);
      this.emit(OpCode.EQ);
      const skipIdx = this.emit(OpCode.JZ, 0);
      this.emit(OpCode.POP);
      this.emit(OpCode.JMP, entry.target);
      this.instructions[skipIdx].arg = this.instructions.length;
    }

    if (defaultTarget !== null) {
      this.emit(OpCode.POP);
      this.emit(OpCode.JMP, defaultTarget);
    } else {
      this.emit(OpCode.POP);
    }

    const switchExit = this.instructions.length;
    this.instructions[exitJump].arg = switchExit;
    this.patchBreaks(switchCtx, switchExit);
    this.popContext('switch');
  }

  // --- Expression Parser (Precedence Climbing) ---
  
  private parseExpression() { this.parseAssignment(); }

  private parseAssignment() {
    // Check for L-Value (ID = ...) or (*ID = ...)
    const t = this.peek();
    const next = this.tokens[this.pos + 1];

    if (t.type === 'ID' && next?.value === '=') {
         const name = this.consume().value;
         const sym = this.locals.get(name);
         if (!sym) this.error(`Undefined variable '${name}'`);
         this.consume('SYMBOL', '=');
         this.parseAssignment(); // Right Associative
         
         if (sym.elementSize === 8) {
             this.emit(OpCode.STORE64, sym.offset);
             this.emit(OpCode.LOAD64, sym.offset);
         } else {
             this.emit(OpCode.STORE, sym.offset);
             // Expression result is the value stored, leave on stack
             this.emit(OpCode.LOAD, sym.offset); 
         }
    }
    else if (t.type === 'ID' && next?.value === '[') {
        this.parseEquality();
    } 
    else {
        this.parseEquality();
    }
  }

  private parseEquality() {
      this.parseRelational();
      while (['==', '!='].includes(this.peek().value)) {
          const op = this.consume().value;
          this.parseRelational();
          if (op === '==') this.emit(OpCode.EQ);
          else this.emit(OpCode.NEQ);
      }
  }

  private parseRelational() {
      this.parseAdditive();
      while (['<', '>', '<=', '>='].includes(this.peek().value)) {
          const op = this.consume().value;
          this.parseAdditive();
          if (op === '<') this.emit(OpCode.LT);
          else if (op === '>') this.emit(OpCode.GT);
          else if (op === '<=') this.emit(OpCode.LE);
          else if (op === '>=') this.emit(OpCode.GE);
      }
  }

  private parseAdditive() {
      this.parseMultiplicative();
      while (['+', '-'].includes(this.peek().value)) {
          const op = this.consume().value;
          this.parseMultiplicative();
          this.emit(op === '+' ? OpCode.ADD : OpCode.SUB);
      }
  }

  private parseMultiplicative() {
      this.parseUnary();
      while (['*', '/', '%'].includes(this.peek().value)) {
          const op = this.consume().value;
          this.parseUnary();
          this.emit(op === '*' ? OpCode.MUL : (op === '/' ? OpCode.DIV : OpCode.MOD));
      }
  }

  private parseUnary() {
    const t = this.peek();
    if (t.value === '!') {
        this.consume();
        this.parseUnary();
        this.emit(OpCode.LIT, 0);
        this.emit(OpCode.EQ);
        return;
    }
    if (t.value === '-') {
        this.consume();
        this.parseUnary();
        this.emit(OpCode.LIT, -1);
        this.emit(OpCode.MUL);
        return;
    }
    if (t.value === '+') {
        this.consume();
        this.parseUnary();
        return;
    }
    this.parseTerm();
  }

  private parseTerm() {
    const t = this.peek();
    
    // Parenthesis
    if (t.value === '(') {
        this.consume();
        this.parseExpression();
        this.consume('SYMBOL', ')');
        return;
    }

    // Math Functions
    const mathOps: Record<string, OpCode> = {
        'sin': OpCode.SIN, 'cos': OpCode.COS, 'tan': OpCode.TAN, 
        'sqrt': OpCode.SQRT, 'pow': OpCode.POW, 'abs': OpCode.ABS
    };
    if (t.type === 'KEYWORD' && mathOps[t.value]) {
        const op = mathOps[t.value];
        this.consume(); this.consume('SYMBOL', '(');
        this.parseExpression();
        if (op === OpCode.POW) { this.consume('SYMBOL', ','); this.parseExpression(); }
        this.consume('SYMBOL', ')');
        this.emit(op);
        return;
    }

    // Literals
    if (t.type === 'NUMBER') { this.emit(OpCode.LIT, parseFloat(this.consume().value)); return; }
    if (t.type === 'CHAR') { this.emit(OpCode.LIT, this.consume().value.charCodeAt(0)); return; }
    if (t.type === 'STRING') { this.emit(OpCode.LIT, this.addStringLiteral(this.consume().value)); return; }

    // Identifiers (Variables, Arrays)
    if (t.type === 'ID') {
        const name = this.consume().value;
        const sym = this.locals.get(name);
        if (!sym) this.error(`Undefined '${name}'`);

        // Array Access or Assignment?
        if (this.peek().value === '[') {
            this.consume();
            // Calculate Address
            this.emit(OpCode.P_PUSH, sym!.offset);
            this.parseExpression(); // Index
            this.emit(OpCode.LIT, sym!.elementSize); this.emit(OpCode.MUL); this.emit(OpCode.ADD);
            this.consume('SYMBOL', ']');

            // Check if this is an assignment: arr[i] = val
            if (this.peek().value === '=') {
                this.consume();
                this.parseExpression(); // Value
                if (sym!.elementSize === 8) this.emit(OpCode.S_IND64);
                else this.emit(OpCode.S_IND);
                this.emit(OpCode.LIT, 0); // Result is void/0 for now
            } else {
                if (sym!.elementSize === 8) this.emit(OpCode.L_IND64);
                else this.emit(OpCode.L_IND); // Load value
            }
        } 
        else {
             if (sym.elementSize === 8) this.emit(OpCode.LOAD64, sym!.offset);
             else this.emit(OpCode.LOAD, sym!.offset);
        }
        return;
    }

    // Pointers
    if (t.value === '*') {
        this.consume();
        this.parseTerm(); // Address
        this.emit(OpCode.L_IND);
        return;
    }
    if (t.value === '&') {
        this.consume();
        const name = this.consume('ID').value;
        const sym = this.locals.get(name);
        if (!sym) this.error(`Undefined '${name}'`);
        this.emit(OpCode.P_PUSH, sym.offset);
        return;
    }

    this.error(`Unexpected token ${t.value}`);
  }
}

export const compiler = new Compiler();
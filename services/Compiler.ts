

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

export class Compiler {
  private tokens: Token[] = [];
  private pos: number = 0;
  private instructions: Instruction[] = [];
  private locals: Map<string, SymbolInfo> = new Map();
  private localOffset: number = 0;
  private dataSegment: number[] = []; 
  private macros: Map<string, string> = new Map();
  private warnings: string[] = [];

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
        const kw = ['int', 'void', 'char', 'float', 'double', 'return', 'if', 'else', 'while', 'for', 'printf', 'scanf', 'malloc', 'free', 'sin', 'cos', 'tan', 'sqrt', 'pow', 'abs'];
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
      if (['+', '-', '*', '/', '%', '=', '(', ')', '{', '}', ';', ',', '<', '>', '&', '[', ']'].includes(c)) {
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
      const typeStr = this.consume().value;
      let isPtr = false;
      if (this.peek().value === '*') { isPtr = true; this.consume(); }

      const name = this.consume('ID').value;
      let isArray = false;
      let arraySize = 0;
      
      if (this.peek().value === '[') {
        this.consume();
        arraySize = parseInt(this.consume('NUMBER').value);
        this.consume('SYMBOL', ']');
        isArray = true;
      }
      
      const isDouble = typeStr === 'double' && !isPtr;
      const elementSize = isDouble ? 8 : 4;
      const sizeBytes = isArray ? arraySize * elementSize : elementSize;
      
      const offset = this.localOffset;
      this.localOffset += sizeBytes;
      
      this.locals.set(name, { offset, type: isPtr ? typeStr + '*' : typeStr, isArray, arraySize, elementSize });
      
      if (this.peek().value === '=') {
        if (isArray) this.error("Array init not supported.");
        this.consume();
        this.parseExpression(); 
        if (isDouble) {
             this.emit(OpCode.STORE64, offset);
        } else {
             this.emit(OpCode.STORE, offset);
        }
      }
      this.consume('SYMBOL', ';');
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
      const startIdx = this.instructions.length;
      this.consume('SYMBOL', '('); this.parseExpression(); this.consume('SYMBOL', ')');
      const jzIdx = this.emit(OpCode.JZ, 0);
      this.consume('SYMBOL', '{');
      while (this.peek().value !== '}') this.parseStatement();
      this.consume('SYMBOL', '}');
      this.emit(OpCode.JMP, startIdx); 
      this.instructions[jzIdx].arg = this.instructions.length; 
    }
    else if (t.value === 'for') {
      this.consume(); this.consume('SYMBOL', '(');
      if (this.peek().value !== ';') {
          this.parseExpression();
          this.emit(OpCode.POP); // Consume initializer result
      }
      this.consume('SYMBOL', ';');
      
      const condIdx = this.instructions.length;
      if (this.peek().value !== ';') this.parseExpression();
      else this.emit(OpCode.LIT, 1);
      
      const jzIdx = this.emit(OpCode.JZ, 0);
      this.consume('SYMBOL', ';');
      
      const bodyJmp = this.emit(OpCode.JMP, 0); 
      const incIdx = this.instructions.length;
      if (this.peek().value !== ')') {
          this.parseExpression();
          this.emit(OpCode.POP); // Consume increment result
      }
      this.consume('SYMBOL', ')');
      this.emit(OpCode.JMP, condIdx);
      
      const bodyIdx = this.instructions.length;
      this.instructions[bodyJmp].arg = bodyIdx;
      
      this.consume('SYMBOL', '{');
      while (this.peek().value !== '}') this.parseStatement();
      this.consume('SYMBOL', '}');
      
      this.emit(OpCode.JMP, incIdx); 
      this.instructions[jzIdx].arg = this.instructions.length; 
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
      while (['==', '!=', '<=', '>='].includes(this.peek().value)) {
          const op = this.consume().value;
          this.parseRelational();
          this.emit(OpCode.EQ); // Simplified, specific opcode logic in parseRelational
      }
  }

  private parseRelational() {
      this.parseAdditive();
      while (['<', '>', '<=', '>='].includes(this.peek().value)) {
          const op = this.consume().value;
          this.parseAdditive();
          if (op === '<') this.emit(OpCode.LT);
          if (op === '>') this.emit(OpCode.GT);
          // TODO: LE, GE (Needs new OpCodes or synthesis)
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
      this.parseTerm();
      while (['*', '/', '%'].includes(this.peek().value)) {
          const op = this.consume().value;
          this.parseTerm();
          this.emit(op === '*' ? OpCode.MUL : (op === '/' ? OpCode.DIV : OpCode.MOD));
      }
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
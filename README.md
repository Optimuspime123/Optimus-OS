
# Optimus-OS v2.1

**A futuristic, browser-based Linux-like environment featuring a custom C Compiler, Stack Machine VM, and Glassmorphism Desktop UI.**

Optimus-OS is a technological exploration into bringing low-level computing concepts to the high-level React sandbox. It simulates a complete Operating System environment entirely within the browser memory, requiring no backend or external APIs.

## 🚀 Key Features

### 1. Custom C Compiler (`gcc`)
A fully hand-written **Recursive Descent Compiler** written in TypeScript.
- **Language Support**: Subset of C (C99 style).
- **Features**:
  - `int`, `float`, `char` types.
  - Pointers (`int *p`) and Arrays (`int arr[5]`).
  - Control Flow: `if`, `else`, `while`, `for`.
  - **Preprocessor**: `#define`, `#ifdef`, `#ifndef`, `#endif`.
  - **Memory**: Pointer arithmetic, `malloc`, `free`.
  - **String Literals**: Automatically extracted to a static Data Segment.

### 2. Stack-Based Virtual Machine
Compiled code runs on a custom 32-bit Stack VM (`ProcessVM`).
- **Memory Model**: 64KB `Uint8Array` RAM per process.
- **Architecture**:
  - `PC` (Program Counter)
  - `FP` (Frame Pointer)
  - `SP` (Stack Pointer - implicitly handled by JS arrays for performance)
  - **Heap**: Dynamic memory allocation growing upwards.
  - **Stack**: Call stack growing downwards.
- **Instruction Set**: Custom OpCodes (`LOAD`, `STORE`, `ADD`, `JZ`, `PRINT`, etc.).

### 3. Virtual File System
In-memory hierarchical file system (`VirtualFileSystem`).
- **Commands**: `ls`, `cd`, `pwd`, `cat`, `mkdir`, `rm`, `touch`.
- **Paths**: Absolute (`/home/user`) and Relative (`../bin`) resolution.
- **Executables**: Stores compiled Bytecode + Data Segment directly in file nodes.

### 4. Desktop Environment
- **Window Manager**: Draggable, resizable, minimizable windows with z-index layering.
- **Apps**:
  - **Terminal**: `xterm.js` integration with custom shell glue code.
  - **Editor**: Graphical text editor with syntax highlighting (basic), line numbers, and shortcuts.
  - **Task Manager**: Real-time process monitoring (`ps`, `kill`).
  - **Settings**: Wallpaper customization.

---

## 🛠️ Usage Guide

### Getting Started
1. Click the **Terminal** icon on the desktop or taskbar.
2. Type `help` to see available commands.

### Compiling C Code
Optimus-OS comes with `hello.c`, `macros.c`, and `loops.c` examples.

1. **Edit code**:
   ```bash
   edit mycode.c
   ```
   *Tip: Use `Ctrl+S` to save inside the editor.*

2. **Write C code**:
   ```c
   #define MAX 5
   int main() {
     int i;
     for(i=0; i<MAX; i=i+1) {
       printf("Counting: %d\n", i);
     }
     return 0;
   }
   ```

3. **Compile**:
   ```bash
   gcc mycode.c
   ```
   *The compiler will output warnings/errors and generate `a.out` if successful.*

4. **Run**:
   ```bash
   ./a.out
   ```

### Process Management
1. Run an infinite loop program (e.g., `while(1) {}`).
2. Open **Task Manager** (click the CPU icon in the taskbar).
3. Find the PID and click the **Kill** (X) button, or type `kill [PID]` in the terminal.

### System Control
- Click the **Power Button** in the bottom right to enter Sleep Mode.
- Click anywhere to wake up.

---

## 🏗️ Technical Architecture

### The Compiler Pipeline
1. **Lexer**: Tokenizes source string into `KEYWORD`, `ID`, `NUMBER`, `STRING`, etc.
2. **Preprocessor**: Expands macros and handles conditional compilation blocks.
3. **Parser**: Recursive descent parser constructs the logic.
4. **Code Gen**: Emits Bytecode instructions directly during parsing (Single-pass compiler).
5. **Linking**: Resolves static data (strings) into a data segment.

### The Virtual Machine Loop
The VM runs in chunks to avoid freezing the browser UI thread.
```typescript
// Shell.ts
const runChunk = () => {
  const keepGoing = vm.step(1000); // Run 1000 cycles
  if (keepGoing) setTimeout(runChunk, 0); // Yield to React event loop
};
```

---

## 🎨 Aesthetics
- **Font**: JetBrains Mono (Terminal/Code) & Inter (UI).
- **Theme**: Dark Mode Glassmorphism (Blur 20px).
- **Background**: Unsplash Abstract Tech.

---

**Created by Optimus-OS**

import { FileNode, FileType, Instruction } from '../types';

class VirtualFileSystem {
  private root: FileNode;
  private currentPath: string[] = [];

  constructor() {
    this.root = {
      name: '/',
      type: FileType.DIRECTORY,
      children: {
        'home': {
          name: 'home',
          type: FileType.DIRECTORY,
          parent: null,
          children: {
            'user': {
              name: 'user',
              type: FileType.DIRECTORY,
              parent: null,
              children: {
                'hello.c': {
                   name: 'hello.c',
                   type: FileType.FILE,
                   content: `#include <stdio.h>\n\nint main() {\n  printf("Hello, Optimus-OS!\\n");\n  return 0;\n}`,
                   parent: null
                },
                'macros.c': {
                   name: 'macros.c',
                   type: FileType.FILE,
                   content: `#define PI 3.14159\n#define MAX 5\n#define GREET "Hello Macros"\n\nint main() {\n  printf("%s\\n", GREET);\n  \n  #ifdef PI\n    printf("PI is defined: %f\\n", PI);\n  #endif\n  \n  #ifndef FOO\n    printf("FOO is not defined\\n");\n  #endif\n  \n  int i;\n  for(i=0; i<MAX; i=i+1) {\n     printf("%d ", i);\n  }\n  printf("\\n");\n}`,
                   parent: null
                },
                'loop.c': {
                   name: 'loop.c',
                   type: FileType.FILE,
                   content: `#include <stdio.h>\n\nint main() {\n  printf("Counting to 5:\\n");\n  int i;\n  for(i=1; i<=5; i=i+1) {\n    printf("Num: %d\\n", i);\n  }\n}`,
                   parent: null
                },
                'arrays.c': {
                  name: 'arrays.c',
                  type: FileType.FILE,
                  content: `int main() {\n  int arr[5];\n  printf("Filling array...\\n");\n  int i;\n  for(i=0; i<5; i=i+1) {\n    arr[i] = i * 10;\n  }\n  printf("arr[3] = %d\\n", arr[3]);\n}`,
                  parent: null
                },
                'math_test.c': {
                  name: 'math_test.c',
                  type: FileType.FILE,
                  content: `#include <math.h>\n#include <stdio.h>\n\nint main() {\n  float a = 9.0;\n  float s = sqrt(a);\n  printf("sqrt(9) = %f\\n", s);\n\n  float b = 3.14159 / 2.0;\n  float c = sin(b);\n  printf("sin(PI/2) = %f\\n", c);\n  \n  float p = pow(2.0, 3.0);\n  printf("pow(2, 3) = %f\\n", p);\n}`,
                  parent: null
                },
                'input_test.c': {
                  name: 'input_test.c',
                  type: FileType.FILE,
                  content: `#include <stdio.h>\n\nint main() {\n  int age;\n  printf("Enter your age: ");\n  scanf("%d", &age);\n  printf("You entered: %d\\n", age);\n  \n  if (age < 18) {\n     printf("You are a minor.\\n");\n  } else {\n     printf("You are an adult.\\n");\n  }\n}`,
                  parent: null
                }
              }
            }
          }
        },
        'bin': { name: 'bin', type: FileType.DIRECTORY, children: {}, parent: null },
      }
    };
    
    this.linkParents(this.root);
    this.currentPath = ['home', 'user'];
  }

  private linkParents(node: FileNode) {
    if (node.children) {
      Object.values(node.children).forEach(child => {
        child.parent = node;
        this.linkParents(child);
      });
    }
  }

  public getRoot(): FileNode { return this.root; }

  public getCurrentPathString(): string {
    return '/' + this.currentPath.join('/');
  }

  public resolvePath(path: string): FileNode | null {
    if (path === '/') return this.root;
    let parts = path.split('/').filter(p => p.length > 0);
    let current = path.startsWith('/') ? this.root : this.resolvePath(this.getCurrentPathString());
    if (!current) return null;

    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') {
        if (current.parent) current = current.parent;
        continue;
      }
      if (current.type === FileType.DIRECTORY && current.children && current.children[part]) {
        current = current.children[part];
      } else {
        return null;
      }
    }
    return current;
  }

  public changeDirectory(path: string): string {
    const node = this.resolvePath(path);
    if (node && node.type === FileType.DIRECTORY) {
      const newPath: string[] = [];
      let temp = node;
      while (temp.parent) {
        newPath.unshift(temp.name);
        temp = temp.parent;
      }
      this.currentPath = newPath;
      return '';
    }
    return `cd: no such file or directory: ${path}`;
  }

  public listDirectory(path: string = '.'): string[] {
    const node = this.resolvePath(path);
    if (!node || node.type !== FileType.DIRECTORY || !node.children) {
      throw new Error(`ls: cannot access '${path}': No such file or directory`);
    }
    return Object.keys(node.children).map(name => {
      const child = node.children![name];
      return child.type === FileType.DIRECTORY ? name + '/' : (child.type === FileType.EXECUTABLE ? name + '*' : name);
    });
  }

  public readFile(path: string): string {
    const node = this.resolvePath(path);
    if (!node || node.type !== FileType.FILE) {
      throw new Error(`cat: ${path}: No such file or directory`);
    }
    return node.content || '';
  }

  public writeFile(path: string, content: string) {
    const dirPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '.';
    const fileName = path.split('/').pop()!;
    const dirNode = this.resolvePath(dirPath);
    if (!dirNode || dirNode.type !== FileType.DIRECTORY || !dirNode.children) throw new Error('Write failed');
    
    dirNode.children[fileName] = {
      name: fileName,
      type: FileType.FILE,
      content: content,
      parent: dirNode
    };
  }

  public writeExecutable(name: string, bytecode: Instruction[], data: Uint8Array) {
    const dirNode = this.resolvePath('.');
    if (!dirNode || !dirNode.children) return;
    dirNode.children[name] = {
      name: name,
      type: FileType.EXECUTABLE,
      bytecode: bytecode,
      dataSegment: data,
      parent: dirNode
    };
  }

  public mkdir(name: string) {
    const dirNode = this.resolvePath('.');
    if (!dirNode || !dirNode.children) return;
    if (dirNode.children[name]) throw new Error(`mkdir: cannot create directory '${name}': File exists`);
    dirNode.children[name] = {
      name: name,
      type: FileType.DIRECTORY,
      children: {},
      parent: dirNode
    };
  }

  public rm(path: string) {
    const node = this.resolvePath(path);
    if (!node) throw new Error(`rm: cannot remove '${path}': No such file or directory`);
    if (node === this.root) throw new Error("rm: cannot remove root");
    if (node.parent && node.parent.children) delete node.parent.children[node.name];
  }
}

export const fileSystem = new VirtualFileSystem();
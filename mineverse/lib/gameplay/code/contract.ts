/**
 * The function contract a coding question exposes, LeetCode style.
 *
 * Teams used to write the whole program: the includes, `main`, the stdin
 * parsing and the printing. Most of a 70-minute round went on boilerplate that
 * is not what the question is testing, and a team that got the logic right but
 * misread the input format scored zero.
 *
 * A question now declares a function — its name, its parameters and what it
 * returns — and the platform generates two things from that: the starter the
 * team edits, and a hidden wrapper that reads stdin, calls the function and
 * prints the result. The team only ever writes the body.
 *
 * The wrapper is what makes this safe to introduce late: it reads the same
 * stdin and prints the same stdout the old programs did, so every existing
 * sample and hidden test case keeps working untouched. Nothing about grading
 * changes — only who writes the plumbing.
 */

export type ParamType = 'int' | 'string' | 'int[]' | 'string[]';
export type ReturnType = ParamType;

export interface FnParam {
  name: string;
  type: ParamType;
}

export interface FnContract {
  /** camelCase. Python gets the snake_case form of the same name. */
  name: string;
  params: FnParam[];
  returns: ReturnType;
  /**
   * How a list return is printed. Space for a single line of values, newline
   * for a question whose answer is several lines.
   */
  join?: ' ' | '\n';
}

export type LanguageId = 'cpp' | 'python' | 'java' | 'javascript' | 'c';

/** `secondHighest` → `second_highest`, for Python only. */
export function snake(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

/* ------------------------------------------------------------------ C++ */

const CPP_TYPES: Record<ParamType, string> = {
  int: 'int',
  string: 'string',
  'int[]': 'vector<int>',
  'string[]': 'vector<string>',
};

function cppSignature(fn: FnContract): string {
  const args = fn.params.map((p) => `${CPP_TYPES[p.type]}& ${p.name}`).join(', ');
  return `    ${CPP_TYPES[fn.returns]} ${fn.name}(${args.replace(/int& /g, 'int ')}) {`;
}

function cppStarter(fn: FnContract): string {
  return ['class Solution {', 'public:', cppSignature(fn), '        // Write your logic here', '    }', '};', ''].join('\n');
}

function cppHarness(fn: FnContract): { prelude: string; main: string } {
  const reads = fn.params.map((p, i) => cppRead(p, i)).join('\n');
  const call = `    auto __r = __sol.${fn.name}(${fn.params.map((p) => p.name).join(', ')});`;
  return {
    prelude: [
      '#include <bits/stdc++.h>',
      'using namespace std;',
      'static vector<int> __ints(const string& s){vector<int> v;stringstream ss(s);int x;while(ss>>x)v.push_back(x);return v;}',
      'static vector<string> __words(const string& s){vector<string> v;stringstream ss(s);string x;while(ss>>x)v.push_back(x);return v;}',
      'static string __line(){string s;getline(cin,s);return s;}',
      '',
    ].join('\n'),
    main: [
      '',
      'int main(){',
      '    ios::sync_with_stdio(false);',
      '    Solution __sol;',
      reads,
      call,
      cppPrint(fn),
      '    return 0;',
      '}',
      '',
    ].join('\n'),
  };
}

function cppRead(p: FnParam, i: number): string {
  const src = `__line()`;
  switch (p.type) {
    case 'int[]': return `    vector<int> ${p.name} = __ints(${src});`;
    case 'string[]': return `    vector<string> ${p.name} = __words(${src});`;
    case 'int': return `    int ${p.name} = stoi(${src});`;
    default: return `    string ${p.name} = ${src};`;
  }
}

function cppPrint(fn: FnContract): string {
  const sep = fn.join === '\n' ? '\\n' : ' ';
  if (fn.returns === 'int[]' || fn.returns === 'string[]') {
    return `    for(size_t i=0;i<__r.size();i++){ if(i) cout << "${sep}"; cout << __r[i]; }`;
  }
  return '    cout << __r;';
}

/* --------------------------------------------------------------- Python */

const PY_TYPES: Record<ParamType, string> = {
  int: 'int',
  string: 'str',
  'int[]': 'list[int]',
  'string[]': 'list[str]',
};

function pyStarter(fn: FnContract): string {
  const args = fn.params.map((p) => `${p.name}: ${PY_TYPES[p.type]}`).join(', ');
  return [
    'class Solution:',
    `    def ${snake(fn.name)}(self${args ? ', ' + args : ''}) -> ${PY_TYPES[fn.returns]}:`,
    '        # Write your logic here',
    '        pass',
    '',
  ].join('\n');
}

function pyHarness(fn: FnContract): { prelude: string; main: string } {
  const reads = fn.params.map((p) => {
    switch (p.type) {
      case 'int[]': return `${p.name} = [int(__t) for __t in __line().split()]`;
      case 'string[]': return `${p.name} = __line().split()`;
      case 'int': return `${p.name} = int(__line())`;
      default: return `${p.name} = __line()`;
    }
  }).join('\n');

  const print = fn.returns === 'int[]' || fn.returns === 'string[]'
    ? `print(${JSON.stringify(fn.join ?? ' ')}.join(str(__x) for __x in __r), end="")`
    : 'print(__r, end="")';

  return {
    prelude: ['import sys', 'def __line():', '    return sys.stdin.readline().rstrip("\\n")', '', ''].join('\n'),
    main: ['', 'if __name__ == "__main__":', ...reads.split('\n').map((l) => '    ' + l),
      `    __r = Solution().${snake(fn.name)}(${fn.params.map((p) => p.name).join(', ')})`,
      '    ' + print, ''].join('\n'),
  };
}

/* ----------------------------------------------------------------- Java */

const JAVA_TYPES: Record<ParamType, string> = {
  int: 'int',
  string: 'String',
  'int[]': 'int[]',
  'string[]': 'String[]',
};

function javaStarter(fn: FnContract): string {
  const args = fn.params.map((p) => `${JAVA_TYPES[p.type]} ${p.name}`).join(', ');
  const stub = fn.returns === 'int' ? '        return 0;' : '        return null;';
  return ['import java.util.*;', '', 'class Solution {',
    `    public ${JAVA_TYPES[fn.returns]} ${fn.name}(${args}) {`,
    '        // Write your logic here', stub, '    }', '}', ''].join('\n');
}

function javaHarness(fn: FnContract): { prelude: string; main: string } {
  const reads = fn.params.map((p) => {
    switch (p.type) {
      case 'int[]': return `        int[] ${p.name} = __ints(__line(__in));`;
      case 'string[]': return `        String[] ${p.name} = __words(__line(__in));`;
      case 'int': return `        int ${p.name} = Integer.parseInt(__line(__in).trim());`;
      default: return `        String ${p.name} = __line(__in);`;
    }
  }).join('\n');

  const sep = fn.join === '\n' ? '\\n' : ' ';
  const print = fn.returns === 'int[]'
    ? `        StringBuilder __sb = new StringBuilder();\n        for (int i = 0; i < __r.length; i++) { if (i > 0) __sb.append("${sep}"); __sb.append(__r[i]); }\n        System.out.print(__sb);`
    : fn.returns === 'string[]'
      ? `        StringBuilder __sb = new StringBuilder();\n        for (int i = 0; i < __r.length; i++) { if (i > 0) __sb.append("${sep}"); __sb.append(__r[i]); }\n        System.out.print(__sb);`
      : '        System.out.print(__r);';

  return {
    prelude: 'import java.util.*;\nimport java.io.*;\n\n',
    main: ['', 'public class Main {',
      '    static String __line(BufferedReader r) throws IOException { String s = r.readLine(); return s == null ? "" : s; }',
      '    static int[] __ints(String s) { if (s.trim().isEmpty()) return new int[0]; String[] p = s.trim().split("\\\\s+"); int[] v = new int[p.length]; for (int i = 0; i < p.length; i++) v[i] = Integer.parseInt(p[i]); return v; }',
      '    static String[] __words(String s) { if (s.trim().isEmpty()) return new String[0]; return s.trim().split("\\\\s+"); }',
      '    public static void main(String[] args) throws IOException {',
      '        BufferedReader __in = new BufferedReader(new InputStreamReader(System.in));',
      reads,
      `        ${JAVA_TYPES[fn.returns]} __r = new Solution().${fn.name}(${fn.params.map((p) => p.name).join(', ')});`,
      print, '    }', '}', ''].join('\n'),
  };
}

/* ----------------------------------------------------------- JavaScript */

function jsStarter(fn: FnContract): string {
  return ['class Solution {', `    ${fn.name}(${fn.params.map((p) => p.name).join(', ')}) {`,
    '        // Write your logic here', '    }', '}', ''].join('\n');
}

function jsHarness(fn: FnContract): { prelude: string; main: string } {
  const reads = fn.params.map((p) => {
    switch (p.type) {
      case 'int[]': return `const ${p.name} = __line().split(/\\s+/).filter(Boolean).map(Number);`;
      case 'string[]': return `const ${p.name} = __line().split(/\\s+/).filter(Boolean);`;
      case 'int': return `const ${p.name} = Number(__line());`;
      default: return `const ${p.name} = __line();`;
    }
  }).join('\n');

  const print = fn.returns === 'int[]' || fn.returns === 'string[]'
    ? `process.stdout.write(__r.join(${JSON.stringify(fn.join ?? ' ')}));`
    : 'process.stdout.write(String(__r));';

  return {
    prelude: [
      'const __all = require("fs").readFileSync(0, "utf8").split("\\n");',
      'let __i = 0;',
      'const __line = () => (__i < __all.length ? __all[__i++] : "");',
      '',
    ].join('\n'),
    main: ['', reads, `const __r = new Solution().${fn.name}(${fn.params.map((p) => p.name).join(', ')});`, print, ''].join('\n'),
  };
}

/* -------------------------------------------------------------------- C */

function cStarter(fn: FnContract): string {
  const args = fn.params.flatMap((p) =>
    p.type === 'int[]' ? [`int* ${p.name}`, `int ${p.name}Size`]
      : p.type === 'string[]' ? [`char** ${p.name}`, `int ${p.name}Size`]
        : p.type === 'int' ? [`int ${p.name}`] : [`char* ${p.name}`]).join(', ');
  const ret = fn.returns === 'int' ? 'int'
    : fn.returns === 'string' ? 'char*'
      : fn.returns === 'string[]' ? 'char**' : 'int*';
  // A list return has no length of its own in C, so the caller is handed one.
  const extra = fn.returns === 'int[]' || fn.returns === 'string[]' ? ', int* returnSize' : '';
  return [`${ret} ${fn.name}(${args}${extra}) {`, '    // Write your logic here', '}', ''].join('\n');
}

function cHarness(fn: FnContract): { prelude: string; main: string } {
  const reads = fn.params.map((p) => {
    switch (p.type) {
      case 'int[]': return `    int ${p.name}Size = 0; int* ${p.name} = __ints(__line(), &${p.name}Size);`;
      case 'string[]': return `    int ${p.name}Size = 0; char** ${p.name} = __words(__line(), &${p.name}Size);`;
      case 'int': return `    int ${p.name} = atoi(__line());`;
      default: return `    char* ${p.name} = __line();`;
    }
  }).join('\n');

  const args = fn.params.flatMap((p) =>
    p.type === 'int[]' || p.type === 'string[]' ? [p.name, `${p.name}Size`] : [p.name]).join(', ');

  const sep = fn.join === '\n' ? '\\n' : ' ';
  const call = fn.returns === 'int[]'
    ? `    int __n = 0; int* __r = ${fn.name}(${args}, &__n);\n    for (int i = 0; i < __n; i++) { if (i) printf("${sep}"); printf("%d", __r[i]); }`
    : fn.returns === 'string[]'
      // C has no length on a `char**` either, so a word list is handed back the
      // same way an int list is: the pointer plus a size out-param.
      ? `    int __n = 0; char** __r = ${fn.name}(${args}, &__n);\n    for (int i = 0; i < __n; i++) { if (i) printf("${sep}"); printf("%s", __r[i]); }`
      : fn.returns === 'int'
        ? `    int __r = ${fn.name}(${args});\n    printf("%d", __r);`
        : `    char* __r = ${fn.name}(${args});\n    printf("%s", __r);`;

  return {
    prelude: [
      '#include <stdio.h>', '#include <stdlib.h>', '#include <string.h>',
      // Every helper hands back fresh memory. They used to share one static
      // buffer and one static array, so a question with two list parameters
      // read its second line straight over the first: both arguments ended up
      // pointing at the same values. `strtok` also writes into the string it
      // splits, which destroyed the earlier line even when the array survived.
      'static char* __line(void){ static char b[1 << 16]; if(!fgets(b,sizeof(b),stdin)) b[0]=0; b[strcspn(b,"\\r\\n")]=0; char* c=(char*)malloc(strlen(b)+1); strcpy(c,b); return c; }',
      'static int* __ints(char* s,int* n){ int cap=16; int* v=(int*)malloc(cap*sizeof(int)); *n=0; char* t=strtok(s," \\t"); while(t){ if(*n==cap){ cap*=2; v=(int*)realloc(v,cap*sizeof(int)); } v[(*n)++]=atoi(t); t=strtok(NULL," \\t"); } return v; }',
      'static char** __words(char* s,int* n){ int cap=16; char** v=(char**)malloc(cap*sizeof(char*)); *n=0; char* t=strtok(s," \\t"); while(t){ if(*n==cap){ cap*=2; v=(char**)realloc(v,cap*sizeof(char*)); } v[(*n)++]=t; t=strtok(NULL," \\t"); } return v; }',
      '',
    ].join('\n'),
    main: ['', 'int main(void){', reads, call, '    return 0;', '}', ''].join('\n'),
  };
}

/* --------------------------------------------------------------- public */

const STARTERS: Record<LanguageId, (fn: FnContract) => string> = {
  cpp: cppStarter, python: pyStarter, java: javaStarter, javascript: jsStarter, c: cStarter,
};

const HARNESSES: Record<LanguageId, (fn: FnContract) => { prelude: string; main: string }> = {
  cpp: cppHarness, python: pyHarness, java: javaHarness, javascript: jsHarness, c: cHarness,
};

/** The editable template a team starts from — the function body and nothing else. */
export function starterFor(fn: FnContract, language: LanguageId): string {
  return STARTERS[language]?.(fn) ?? '';
}

/**
 * The team's code with the platform's wrapper around it.
 *
 * Prelude first (includes and the stdin helpers), then the team's function,
 * then `main`. Never shown to the team and never stored as their answer — this
 * is only what gets executed.
 */
export function wrapForExecution(fn: FnContract, language: LanguageId, userCode: string): string {
  const harness = HARNESSES[language]?.(fn);
  if (!harness) return userCode;
  return `${harness.prelude}${userCode}\n${harness.main}`;
}

/** Reads a contract off `questions.runtime_meta`, or null for a stdin/stdout question. */
export function contractOf(runtimeMeta: unknown): FnContract | null {
  if (!runtimeMeta || typeof runtimeMeta !== 'object') return null;
  const fn = (runtimeMeta as { fn?: unknown }).fn;
  if (!fn || typeof fn !== 'object') return null;
  const candidate = fn as FnContract;
  if (typeof candidate.name !== 'string' || !Array.isArray(candidate.params)) return null;
  return candidate;
}

import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { wrapForExecution, type FnContract, type LanguageId } from '@/lib/gameplay/code/contract';

/**
 * Compiles and runs every generated wrapper on this machine.
 *
 * The wrapper is the piece a team never sees and cannot work around: if it
 * misreads stdin or prints the wrong shape, every submission fails and nobody
 * can tell why. Mocking the judge would not catch that — the bugs live in the
 * generated C++ and the Java class layout, and only a compiler finds those.
 */

const dir = mkdtempSync(join(tmpdir(), 'mv-harness-'));

function runLocal(language: LanguageId, code: string, stdin: string): string {
  const opts = { input: stdin, encoding: 'utf8' as const, cwd: dir, timeout: 60_000 };
  if (language === 'python') {
    writeFileSync(join(dir, 'm.py'), code);
    return execFileSync('python', ['m.py'], opts).toString();
  }
  if (language === 'javascript') {
    writeFileSync(join(dir, 'm.js'), code);
    return execFileSync('node', ['m.js'], opts).toString();
  }
  if (language === 'java') {
    writeFileSync(join(dir, 'Main.java'), code);
    execFileSync('javac', ['Main.java'], { cwd: dir, timeout: 90_000 });
    return execFileSync('java', ['Main'], opts).toString();
  }
  const src = language === 'c' ? 'm.c' : 'm.cpp';
  writeFileSync(join(dir, src), code);
  execFileSync(language === 'c' ? 'gcc' : 'g++', [src, '-o', 'm.exe'], { cwd: dir, timeout: 90_000 });
  return execFileSync(join(dir, 'm.exe'), [], opts).toString();
}

const INT_ARRAY: FnContract = { name: 'secondHighest', params: [{ name: 'weights', type: 'int[]' }], returns: 'int' };
const TWO_LISTS: FnContract = { name: 'repairChain', params: [{ name: 'first', type: 'int[]' }, { name: 'second', type: 'int[]' }], returns: 'int[]', join: ' ' };
const WORDS_IN: FnContract = { name: 'longestSignal', params: [{ name: 'signals', type: 'string[]' }], returns: 'string' };

const CASES: Array<{ fn: FnContract; stdin: string; expect: string; sol: Record<LanguageId, string> }> = [
  {
    fn: INT_ARRAY, stdin: '9 9 7 4\n', expect: '7',
    sol: {
      cpp: `class Solution {\npublic:\n int secondHighest(vector<int>& weights){set<int> s(weights.begin(),weights.end());if(s.size()<2)return -1;auto it=s.rbegin();++it;return *it;}\n};`,
      python: `class Solution:\n    def second_highest(self, weights):\n        u=sorted(set(weights),reverse=True)\n        return u[1] if len(u)>1 else -1`,
      java: `class Solution {\n public int secondHighest(int[] w){java.util.TreeSet<Integer> s=new java.util.TreeSet<>();for(int x:w)s.add(x);if(s.size()<2)return -1;java.util.Iterator<Integer> it=s.descendingIterator();it.next();return it.next();}\n}`,
      javascript: `class Solution {\n secondHighest(w){const u=[...new Set(w)].sort((a,b)=>b-a);return u.length>1?u[1]:-1;}\n}`,
      c: `int secondHighest(int* w,int n){int b=-2147483647,s=-2147483647;for(int i=0;i<n;i++){if(w[i]>b){s=b;b=w[i];}else if(w[i]<b&&w[i]>s)s=w[i];}return s==-2147483647?-1:s;}`,
    },
  },
  {
    fn: TWO_LISTS, stdin: '1 4 7\n2 3 9\n', expect: '1 2 3 4 7 9',
    sol: {
      cpp: `class Solution {\npublic:\n vector<int> repairChain(vector<int>& a, vector<int>& b){vector<int> r=a;for(int x:b)r.push_back(x);sort(r.begin(),r.end());return r;}\n};`,
      python: `class Solution:\n    def repair_chain(self, first, second):\n        return sorted(first+second)`,
      java: `class Solution {\n public int[] repairChain(int[] a,int[] b){int[] r=new int[a.length+b.length];int i=0;for(int x:a)r[i++]=x;for(int x:b)r[i++]=x;java.util.Arrays.sort(r);return r;}\n}`,
      javascript: `class Solution {\n repairChain(a,b){return [...a,...b].sort((x,y)=>x-y);}\n}`,
      c: `int* repairChain(int* a,int an,int* b,int bn,int* returnSize){static int r[200000];int k=0;for(int i=0;i<an;i++)r[k++]=a[i];for(int i=0;i<bn;i++)r[k++]=b[i];for(int i=0;i<k;i++)for(int j=i+1;j<k;j++)if(r[j]<r[i]){int t=r[i];r[i]=r[j];r[j]=t;}*returnSize=k;return r;}`,
    },
  },
  {
    fn: WORDS_IN, stdin: 'iron gold diamond\n', expect: 'diamond',
    sol: {
      cpp: `class Solution {\npublic:\n string longestSignal(vector<string>& s){string b=s[0];for(auto& x:s)if(x.size()>b.size())b=x;return b;}\n};`,
      python: `class Solution:\n    def longest_signal(self, signals):\n        return max(signals, key=len)`,
      java: `class Solution {\n public String longestSignal(String[] s){String b=s[0];for(String x:s)if(x.length()>b.length())b=x;return b;}\n}`,
      javascript: `class Solution {\n longestSignal(s){return s.reduce((a,b)=>b.length>a.length?b:a);}\n}`,
      c: `char* longestSignal(char** s,int n){char* b=s[0];for(int i=0;i<n;i++)if(strlen(s[i])>strlen(b))b=s[i];return b;}`,
    },
  },
];

describe('generated wrappers compile and run', () => {
  for (const { fn, stdin, expect: want, sol } of CASES) {
    for (const language of Object.keys(sol) as LanguageId[]) {
      it(`${language} — ${fn.name}`, () => {
        const out = runLocal(language, wrapForExecution(fn, language, sol[language]), stdin);
        expect(out.trim()).toBe(want);
      }, 120_000);
    }
  }
});

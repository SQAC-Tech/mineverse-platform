import { describe, expect, it } from 'vitest';
import { starterFor, wrapForExecution, type FnContract, type LanguageId } from '@/lib/gameplay/code/contract';
import { RUNTIMES } from '@/lib/gameplay/code/runtimes';

/**
 * Executes generated wrappers for real, against the real judge.
 *
 * The wrapper is the one piece of this platform a team never sees and cannot
 * work around: if it reads stdin wrongly or prints the result in the wrong
 * shape, every submission fails and the team has no way to tell why. A unit
 * test with a fake runner would not catch that — the bug would be in the
 * generated C++ or the Java class layout, which only a compiler finds.
 *
 * Skipped unless PISTON_API_URL is set, so it never breaks an offline run.
 */

const ENDPOINT = process.env.PISTON_API_URL;

async function run(language: LanguageId, code: string, stdin: string) {
  const runtime = RUNTIMES[language];
  const res = await fetch(ENDPOINT!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: runtime.piston,
      version: '*',
      files: [{ name: runtime.file, content: code }],
      stdin,
    }),
  });
  const json = await res.json();
  const compileErr = json?.compile?.stderr ?? '';
  const runErr = json?.run?.stderr ?? '';
  return { out: String(json?.run?.stdout ?? '').trim(), compileErr, runErr };
}

/** A correct solution per language, written against the generated starter. */
const SECOND_HIGHEST: FnContract = {
  name: 'secondHighest',
  params: [{ name: 'weights', type: 'int[]' }],
  returns: 'int',
};

const SOLUTIONS: Record<LanguageId, string> = {
  cpp: `class Solution {
public:
    int secondHighest(vector<int>& weights) {
        set<int> s(weights.begin(), weights.end());
        if (s.size() < 2) return -1;
        auto it = s.rbegin(); ++it; return *it;
    }
};`,
  python: `class Solution:
    def second_highest(self, weights: list[int]) -> int:
        u = sorted(set(weights), reverse=True)
        return u[1] if len(u) > 1 else -1`,
  java: `import java.util.*;

class Solution {
    public int secondHighest(int[] weights) {
        TreeSet<Integer> s = new TreeSet<>();
        for (int w : weights) s.add(w);
        if (s.size() < 2) return -1;
        Iterator<Integer> it = s.descendingIterator();
        it.next(); return it.next();
    }
}`,
  javascript: `class Solution {
    secondHighest(weights) {
        const u = [...new Set(weights)].sort((a, b) => b - a);
        return u.length > 1 ? u[1] : -1;
    }
}`,
  c: `int secondHighest(int* weights, int weightsSize) {
    int best = -2147483647, second = -2147483647;
    for (int i = 0; i < weightsSize; i++) {
        if (weights[i] > best) { second = best; best = weights[i]; }
        else if (weights[i] < best && weights[i] > second) second = weights[i];
    }
    return second == -2147483647 ? -1 : second;
}`,
};

describe.skipIf(!ENDPOINT)('generated wrappers execute correctly', () => {
  for (const language of Object.keys(SOLUTIONS) as LanguageId[]) {
    it(`${language}: reads stdin, calls the function, prints the result`, async () => {
      const code = wrapForExecution(SECOND_HIGHEST, language, SOLUTIONS[language]);
      const { out, compileErr } = await run(language, code, '9 9 7 4\n');
      expect(compileErr, `compile error:\n${compileErr}`).toBe('');
      expect(out).toBe('7');
    }, 60_000);
  }

  it('starters are non-empty and name the function for every language', () => {
    for (const language of Object.keys(SOLUTIONS) as LanguageId[]) {
      const starter = starterFor(SECOND_HIGHEST, language);
      expect(starter.length).toBeGreaterThan(10);
      expect(starter.toLowerCase()).toContain('second');
    }
  });
});

import fs from 'node:fs'; import path from 'node:path';
const isCodeLine = (line) => /^\s{2,}|[{};]\s*$|^\s*(?:\d+\s{2,}|[#/]{2}|def |class |for |while |if |int |print\(|cout|return |import |public |values? =|\w+ = )/.test(line);
const OUT = process.argv[2];
for (const dir of fs.readdirSync(OUT)) {
  const full = path.join(OUT, dir);
  if (!fs.statSync(full).isDirectory()) continue;
  if (!/^output|^debug_output|^code_completion/.test(dir)) continue;
  for (const f of fs.readdirSync(full)) {
    if (!f.endsWith('.txt')) continue;
    const text = fs.readFileSync(path.join(full, f), 'utf8');
    if (text.includes('```')) continue; // fenced -> handled by extractCodeBlock
    const lines = text.split('\n');
    const bad = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      const looksProse = /^[A-Z][a-z].* [a-z]+ [a-z]+/.test(line) && !/[;{}]$/.test(line);
      const code = isCodeLine(line);
      // heuristic: a line with an assignment/call/paren that is NOT prose
      const codeish = /[=(){};\[\]]/.test(line) && !looksProse;
      if (codeish && !code) bad.push(line);
    }
    if (bad.length) console.log(`${dir}/${f}\n  ` + bad.join('\n  '));
  }
}

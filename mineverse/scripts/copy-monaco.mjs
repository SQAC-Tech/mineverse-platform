// Copies Monaco's AMD bundle into public/monaco so the editor is served from our
// own origin.
//
// @monaco-editor/react loads Monaco from jsDelivr by default. The event runs in
// a hall on campus wifi; a CDN that is slow, blocked or down would leave every
// coding question without an editor, and there is no way to recover from that
// mid-round. Serving it ourselves removes the dependency entirely.
//
// The full bundle is 24 MB because it ships the TypeScript, CSS, HTML and JSON
// language services. This event compiles Python, C, C++ and Java through Piston,
// none of which use any of them, so they are pruned — see PRUNE below. What is
// left is about 5 MB on disk, and a browser lazily fetches only the core plus
// the one language the team picked.
//
// Generated, so it is gitignored. `prebuild` and `postinstall` both run this,
// which covers a fresh clone and a deploy.
import { cp, rm, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', 'monaco-editor', 'min', 'vs');
const target = join(root, 'public', 'monaco', 'vs');

/**
 * What no supported language reaches for: the JS/TS/JSON/CSS/HTML tooling, and
 * the non-English localisations — English is compiled in. Monaco fetches these
 * lazily and by name, so dropping them is inert for Python, C, C++ and Java. A
 * Python file never asks for ts.worker.
 *
 * Directories and files are matched separately on purpose. One prefix match over
 * both took `nls.messages-loader.js` out along with the `nls/` directory, and
 * Monaco then failed to boot at all.
 */
const PRUNE_DIRS = ['language', 'nls'];

/** Matched by prefix, because each worker carries a content hash in its name. */
const PRUNE_FILES = ['assets/ts.worker', 'assets/css.worker', 'assets/html.worker', 'assets/json.worker'];

async function main() {
  if (!existsSync(source)) {
    console.error('[monaco] node_modules/monaco-editor is missing — run npm install first.');
    process.exitCode = 1;
    return;
  }

  await rm(target, { recursive: true, force: true });
  await mkdir(dirname(target), { recursive: true });

  await cp(source, target, {
    recursive: true,
    filter: (path) => {
      // Path relative to the bundle root.
      const inside = path.replace(/\\/g, '/').split('/min/vs/')[1];
      if (!inside) return true;
      if (PRUNE_DIRS.some((dir) => inside === dir || inside.startsWith(`${dir}/`))) return false;
      // Workers carry a content hash, so those match on prefix.
      return !PRUNE_FILES.some((file) => inside.startsWith(file));
    },
  });

  const { size } = await du(target);
  console.log(`[monaco] served from /monaco/vs — ${(size / 1024 / 1024).toFixed(1)} MB`);
}

/** Recursive size, so the log says what actually shipped. */
async function du(path) {
  const { readdir } = await import('node:fs/promises');
  let size = 0;
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) size += (await du(full)).size;
    else size += (await stat(full)).size;
  }
  return { size };
}

await main();

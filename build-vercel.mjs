// ORION · Vercel production build
// Copies the self-contained static app (which reads three.js via a relative
// node_modules/ import map) into a `dist/` output directory so Vercel's
// outputDirectory serves `/` -> `dist/index.html` without needing node_modules
// on the server. Runs on Vercel AFTER `npm install`, so node_modules/three is
// available here.
import { mkdirSync, cpSync, existsSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, 'dist');

const THREE = join(ROOT, 'node_modules', 'three');

/** copy a file or recursive dir, mirroring into OUT */
function copy(src) {
 if (!existsSync(src)) {
 console.warn(` ! missing ${relative(ROOT, src)} — skipping`);
 return;
 }
 const dest = join(OUT, relative(ROOT, src));
 mkdirSync(dirname(dest), { recursive: true });
 cpSync(src, dest, { recursive: true, force: true });
 console.log(` ✓ ${relative(ROOT, src)}`);
}

// wipe previous output so stale files never leak in
if (existsSync(OUT)) cpSync(OUT, join(ROOT, '.dist_bak'), { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

console.log('ORION · building dist/');
console.log('--- static app files ---');
copy(join(ROOT, 'index.html'));
copy(join(ROOT, 'css'));
copy(join(ROOT, 'js'));

console.log('--- bundled three.js (modules imported from node_modules/) ---');
copy(join(THREE, 'build'));
copy(join(THREE, 'examples', 'jsm'));

// sanity check the entry point exists
const entry = join(OUT, 'index.html');
if (!existsSync(entry)) {
 console.error('FATAL: dist/index.html was not produced.');
 process.exit(1);
}
console.log('\nBuild complete.');
console.log(`Root entry : dist/index.html (${statSync(entry).size} bytes)`);
console.log(`Output dir : ${OUT}`);

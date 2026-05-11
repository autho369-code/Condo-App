// Diagnostic build wrapper. Spawns next build, captures every byte of
// stdout/stderr, and prints stage markers ([STAGE-1] etc.) that survive
// Vercel's log-truncation logic. If the build fails, the last 80 lines
// of next's output are echoed at the bottom under a "=== TAIL ===" header.
import { spawn } from 'node:child_process';

console.log('═══════════════════════════════════════════════════════════════');
console.log('[STAGE-1] Diagnostic build wrapper starting');
console.log('  Node:', process.version);
console.log('  CWD :', process.cwd());
console.log('  Date:', new Date().toISOString());
console.log('═══════════════════════════════════════════════════════════════');

const env = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: '1',
};

const child = spawn('npx', ['next', 'build'], { env, stdio: ['inherit', 'pipe', 'pipe'] });

const tail = [];
const TAIL_LINES = 120;
function capture(stream, label) {
  let buf = '';
  stream.on('data', (chunk) => {
    buf += chunk.toString();
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const out = `[${label}] ${line}`;
      process.stdout.write(out + '\n');
      tail.push(out);
      if (tail.length > TAIL_LINES) tail.shift();
    }
  });
}
capture(child.stdout, 'OUT');
capture(child.stderr, 'ERR');

child.on('close', (code) => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`[STAGE-2] next build exited with code ${code}`);
  if (code !== 0) {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('=== TAIL (last 120 lines of next output) ===');
    for (const l of tail) console.log(l);
    console.log('=== END TAIL ===');
  }
  console.log('═══════════════════════════════════════════════════════════════');
  process.exit(code ?? 1);
});

child.on('error', (err) => {
  console.log('[STAGE-X] Failed to spawn next build:', err.message);
  process.exit(1);
});

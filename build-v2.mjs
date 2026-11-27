// Kept for reproducible preview commands in the browser/performance tools.
process.argv.push('--preview');
await import('./build.mjs');

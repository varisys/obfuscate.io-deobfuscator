import { cp, rm } from 'node:fs/promises';

await rm('dist', { force: true, recursive: true });
await cp('../playground/dist', 'dist', { recursive: true });
await cp('../docs/dist/docs', 'dist/docs', { recursive: true });

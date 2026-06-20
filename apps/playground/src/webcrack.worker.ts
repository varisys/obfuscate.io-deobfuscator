import type { Options, Sandbox } from 'webcrack';
import { webcrack } from 'webcrack';

export type WorkerRequest =
  | {
      type: 'deobfuscate';
      code: string;
      options: Options & { mangleRegex: RegExp | null };
    }
  | { type: 'sandbox'; result: unknown };

export type WorkerResponse =
  | { type: 'sandbox'; code: string }
  | ({ type: 'result' } & DeobfuscateResult)
  | { type: 'progress'; value: number }
  | { type: 'error'; error: Error };

export interface DeobfuscateResult {
  code: string;
  files: { code: string; path: string }[];
  report: {
    durationMs: number;
    inputBytes: number;
    outputBytes: number;
    filesRecovered: number;
    transforms: string[];
  };
}

const postMessage = (message: WorkerResponse) => self.postMessage(message);

self.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
  if (data.type !== 'deobfuscate') return;

  // worker->window->sandybox because it accesses the DOM, which is not available in workers
  const sandbox: Sandbox = (code) => {
    return new Promise((resolve) => {
      self.addEventListener('message', onSandboxResponse);
      postMessage({ type: 'sandbox', code });

      function onSandboxResponse({ data }: MessageEvent<WorkerRequest>) {
        if (data.type === 'sandbox') {
          self.removeEventListener('message', onSandboxResponse);
          resolve(data.result);
        }
      }
    });
  };

  function onProgress(value: number) {
    postMessage({ type: 'progress', value });
  }

  try {
    const startedAt = performance.now();
    const { mangleRegex } = data.options;

    const result = await webcrack(data.code, {
      sandbox,
      onProgress,
      ...data.options,
      mangle: mangleRegex ? (id) => mangleRegex.test(id) : undefined,
    });
    const files = Array.from(result.bundle?.modules ?? [], ([, module]) => ({
      code: module.code,
      path: module.path.replace(/\.?\/?/, ''),
    }));

    const encoder = new TextEncoder();
    postMessage({
      type: 'result',
      code: result.code,
      files,
      report: {
        durationMs: Math.round(performance.now() - startedAt),
        inputBytes: encoder.encode(data.code).byteLength,
        outputBytes: encoder.encode(result.code).byteLength,
        filesRecovered: files.length,
        transforms: [
          data.options.deobfuscate && 'Deobfuscate',
          data.options.unminify && 'Unminify',
          data.options.unpack && 'Unpack',
          data.options.jsx && 'JSX',
          mangleRegex && 'Rename',
        ].filter(Boolean) as string[],
      },
    });
  } catch (error) {
    // Babel SyntaxError dynamically sets `error.message`, has to be
    // accessed/logged before postMessage to be properly cloned.
    console.error(error);
    postMessage({ type: 'error', error: error as Error });
  }
};

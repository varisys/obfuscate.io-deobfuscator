import Sandybox from 'sandybox';

let sandboxPromise: ReturnType<typeof Sandybox.create> | undefined;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function evalCode(code: string) {
  // Creating the iframe at module load blocks the entire UI until its handshake
  // completes. Initialize it only for transforms that actually need evaluation.
  const sandbox = await (sandboxPromise ??= Sandybox.create());
  const iframe = document.querySelector<HTMLIFrameElement>('.sandybox');
  if (!iframe?.dataset.hardened) {
    iframe?.contentDocument?.head.insertAdjacentHTML(
      'afterbegin',
      `<meta http-equiv="Content-Security-Policy" content="default-src 'none';">`,
    );
    if (iframe) iframe.dataset.hardened = 'true';
  }

  const fn = await sandbox.addFunction(`() => ${code}`);
  return Promise.race([
    fn(),
    sleep(10_000).then(() => Promise.reject(new Error('Sandbox timeout'))),
  ]).finally(() => sandbox.removeFunction(fn));
}

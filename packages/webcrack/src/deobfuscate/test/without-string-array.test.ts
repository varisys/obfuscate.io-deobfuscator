import { expect, test } from 'vitest';
import { webcrack } from '../../index';

test('deobfuscates control-flow wrappers without a string array', async () => {
  const result = await webcrack(
    `
      const operations = {
        abcde: function (left, right) { return left + right; },
        fghij: 'decoded'
      };
      console.log(operations.abcde(20, 22), operations.fghij);
    `,
    { jsx: false, unpack: false },
  );

  expect(result.code).toBe(`console.log(42, "decoded");`);
});

test('removes injected dead code without a string array', async () => {
  const result = await webcrack(
    `
      if ('guard' === 'guard') {
        console.log('real');
      } else {
        console.log('decoy');
      }
    `,
    { jsx: false, unpack: false },
  );

  expect(result.code).toBe(`console.log("real");`);
});

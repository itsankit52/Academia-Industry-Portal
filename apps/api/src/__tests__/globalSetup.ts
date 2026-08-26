/**
 * Every integration suite in this project is wrapped in
 * `describe.skipIf(!hasTestDb)`, which is the right call — they need a real
 * MongoDB. The problem is that without TEST_MONGO_URI the whole suite skips and
 * `pnpm test` still exits 0, so a green run can mean "everything passed" or
 * "nothing ran at all". This banner makes the second case impossible to miss.
 */
export function setup(): void {
  if (process.env.TEST_MONGO_URI) return;

  const lines = [
    'TEST_MONGO_URI is not set — every database-backed suite will be SKIPPED.',
    'A passing run here does not mean the API works. To actually exercise it:',
    '  pnpm --filter @aip/api test  (with TEST_MONGO_URI=mongodb://127.0.0.1:27017/aip_test)',
    'Point it at a throwaway database: the suites call deleteMany() on every collection.',
  ];
  const width = Math.max(...lines.map((l) => l.length));
  const rule = '='.repeat(width);

  // eslint-disable-next-line no-console
  console.warn(`\n${rule}\n${lines.join('\n')}\n${rule}\n`);
}

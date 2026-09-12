import test from 'node:test';
import assert from 'node:assert/strict';
import { parseImport, exportCsv } from '../lib/import-data.ts';
test('CSV preserves quoted delimiters, multiline text, BOM and escaped quotes', () => {
  assert.deepEqual(
    parseImport(
      '\uFEFFnome;email\r\n"Ana; ""A""\nSilva";ana@example.test',
      'csv',
    ),
    [{ nome: 'Ana; "A"\nSilva', email: 'ana@example.test' }],
  );
});
test('CSV rejects malformed records, ambiguous headers and excessive batches', () => {
  for (const text of ['a,a\n1,2', 'a,b\n1', 'a,b\n"abc,2', 'a,b\n"ok"extra,2'])
    assert.throws(() => parseImport(text, 'csv'));
  assert.throws(() =>
    parseImport(
      JSON.stringify(Array.from({ length: 201 }, () => ({ nome: 'DEMO' }))),
      'json',
    ),
  );
});
test('JSON normalizes headers and CSV export escapes formulas and quotes', () => {
  assert.deepEqual(parseImport('[{"Série":"6EF","nome":"Ana"}]', 'json'), [
    { serie: '6EF', nome: 'Ana' },
  ]);
  assert.ok(
    exportCsv([{ nome: '=HYPERLINK("bad")' }], ['nome']).includes(
      "'=HYPERLINK",
    ),
  );
});

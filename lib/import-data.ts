export type ImportRow = Record<string, string>;
const normalize = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
const aliases: Record<string, string> = {
  nome_do_aluno: 'nome',
  'e-mail': 'email',
  identificador_institucional: 'identificador',
  ano_letivo: 'ano_letivo',
  serie: 'serie',
  skill_code: 'codigo',
  description: 'descricao',
  subject: 'componente',
  school_year: 'ano',
  thematic_unit: 'unidade',
  knowledge_object: 'objeto',
};
export function parseImport(text: string, format: 'csv' | 'json'): ImportRow[] {
  if (text.length > 5_000_000)
    throw new Error('Arquivo excede 5 MB. Divida a carga.');
  if (format === 'json') {
    const data: unknown = JSON.parse(text);
    if (
      !Array.isArray(data) ||
      data.some((row) => !row || typeof row !== 'object' || Array.isArray(row))
    )
      throw new Error('Use um array JSON de objetos.');
    return validateRows(
      data.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            aliases[normalize(key)] ?? normalize(key),
            String(value ?? '').trim(),
          ]),
        ),
      ),
    );
  }
  const source = text.replace(/^\uFEFF/, '');
  const firstLine = source.split(/\r?\n/, 1)[0];
  const delimiter = firstLine.includes(';') ? ';' : ',';
  const records: string[][] = [];
  let record: string[] = [],
    cell = '',
    quoted = false,
    closed = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
        closed = true;
      } else cell += char;
    } else if (char === '"' && !cell && !closed) quoted = true;
    else if (char === delimiter) {
      record.push(cell);
      cell = '';
      closed = false;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index++;
      record.push(cell);
      if (record.some((v) => v.trim())) records.push(record);
      record = [];
      cell = '';
      closed = false;
    } else {
      if (closed && char.trim())
        throw new Error('CSV inválido: texto após fechamento de aspas.');
      if (char === '"')
        throw new Error('CSV inválido: aspas no meio do campo.');
      cell += char;
    }
  }
  if (quoted) throw new Error('CSV inválido: aspas não fechadas.');
  record.push(cell);
  if (record.some((v) => v.trim())) records.push(record);
  const headers =
    records.shift()?.map((h) => aliases[normalize(h)] ?? normalize(h)) ?? [];
  if (
    !headers.length ||
    headers.some((h) => !h) ||
    new Set(headers).size !== headers.length
  )
    throw new Error('Cabeçalhos vazios ou duplicados.');
  return validateRows(
    records.map((row, index) => {
      if (row.length !== headers.length)
        throw new Error(`Linha ${index + 2}: número de colunas incorreto.`);
      return Object.fromEntries(headers.map((key, i) => [key, row[i].trim()]));
    }),
  );
}
function validateRows(rows: ImportRow[]) {
  if (!rows.length || rows.length > 200)
    throw new Error('Envie de 1 a 200 linhas por lote.');
  return rows;
}
export function exportCsv(rows: Record<string, unknown>[], fields: string[]) {
  const escape = (value: unknown) => {
    let text = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  return (
    '\uFEFF' +
    [
      fields.map(escape).join(';'),
      ...rows.map((row) => fields.map((field) => escape(row[field])).join(';')),
    ].join('\r\n')
  );
}
export function downloadCsv(
  name: string,
  rows: Record<string, unknown>[],
  fields: string[],
) {
  const url = URL.createObjectURL(
    new Blob([exportCsv(rows, fields)], { type: 'text/csv;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

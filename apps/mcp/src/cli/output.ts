export function writeLine(value: string): void {
  process.stdout.write(`${value}\n`);
}

export function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function writeTable(
  headers: readonly string[],
  rows: ReadonlyArray<readonly string[]>,
): void {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => (row[index] ?? '').length)),
  );

  const renderRow = (cells: readonly string[]): string =>
    cells
      .map((cell, index) => pad(cell, widths[index] ?? cell.length))
      .join('  ')
      .trimEnd();

  writeLine(renderRow(headers));
  writeLine(widths.map((width) => '-'.repeat(width)).join('  '));
  for (const row of rows) writeLine(renderRow(row));
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : `${value}${' '.repeat(width - value.length)}`;
}

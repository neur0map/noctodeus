interface MultiplicationTableRequest {
  factor: number;
  rows: number;
  cols: number;
}

const MULTIPLICATION_TABLE_PATTERNS = [
  /(\d+)\s*x\s*(\d+)\s+(?:multiplication|times)\s+table\s+(?:of|for)\s+(-?\d+(?:\.\d+)?)/i,
  /(?:multiplication|times)\s+table\s+(?:of|for)\s+(-?\d+(?:\.\d+)?)(?:\s+(\d+)\s*x\s*(\d+))?/i,
  /(\d+)\s*x\s*(\d+)\s+table\s+(?:of|for)\s+(-?\d+(?:\.\d+)?)/i,
];

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

function parseMultiplicationTablePrompt(prompt: string): MultiplicationTableRequest | null {
  for (const pattern of MULTIPLICATION_TABLE_PATTERNS) {
    const match = prompt.match(pattern);

    if (!match) {
      continue;
    }

    if (match.length >= 4 && pattern === MULTIPLICATION_TABLE_PATTERNS[0]) {
      return {
        rows: Number(match[1]),
        cols: Number(match[2]),
        factor: Number(match[3]),
      };
    }

    if (match.length >= 4 && pattern === MULTIPLICATION_TABLE_PATTERNS[2]) {
      return {
        rows: Number(match[1]),
        cols: Number(match[2]),
        factor: Number(match[3]),
      };
    }

    const factor = Number(match[1]);
    const rows = Number(match[2] ?? 10);
    const cols = Number(match[3] ?? match[2] ?? 10);

    return { factor, rows, cols };
  }

  return null;
}

function renderMultiplicationTable(request: MultiplicationTableRequest): string {
  const header = ['| x |'];
  const divider = ['| --- |'];

  for (let col = 1; col <= request.cols; col += 1) {
    header.push(` ${col} |`);
    divider.push(' --- |');
  }

  const rows: string[] = [header.join(''), divider.join('')];

  for (let row = 1; row <= request.rows; row += 1) {
    const cells = [`| ${row} |`];

    for (let col = 1; col <= request.cols; col += 1) {
      cells.push(` ${formatNumber(request.factor * row * col)} |`);
    }

    rows.push(cells.join(''));
  }

  return rows.join('\n');
}

export function tryGenerateInlineMarkdown(prompt: string): string | null {
  const normalized = prompt.trim();

  if (!normalized) {
    return null;
  }

  const multiplicationTable = parseMultiplicationTablePrompt(normalized);
  if (multiplicationTable) {
    return renderMultiplicationTable(multiplicationTable);
  }

  return null;
}

export function shouldUseInlineContext(prompt: string): boolean {
  const normalized = prompt.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  if (tryGenerateInlineMarkdown(prompt)) {
    return false;
  }

  return /\b(this|above|below|following|same tone|same style|continue|expand|rewrite|rephrase|tighten|polish|summarize|in this note|in this section|from these notes|here)\b/i.test(normalized);
}

export function buildInlineLoadingLabel(prompt: string): string {
  const normalized = prompt.trim().toLowerCase();

  if (!normalized) {
    return 'Drafting...';
  }

  if (/\btable\b/.test(normalized)) {
    return 'Laying out table...';
  }

  if (/\b(list|checklist|bullets?)\b/.test(normalized)) {
    return 'Stacking points...';
  }

  if (/\b(outline|heading|headings|title|headline)\b/.test(normalized)) {
    return 'Sketching structure...';
  }

  if (/\b(rewrite|rephrase|tighten|polish|refine)\b/.test(normalized)) {
    return 'Tuning the line...';
  }

  return 'Drafting...';
}

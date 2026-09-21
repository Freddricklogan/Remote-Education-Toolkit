/** Roster and attendance records: pure functions over { roster: [names], records: { 'YYYY-MM-DD': { name: status } } }. */

export const STATUSES = ['present', 'late', 'absent', 'excused'];
const COUNTS_PRESENT = new Set(['present', 'late']);

export function normaliseName(raw) {
  return raw.trim().replace(/\s+/g, ' ');
}

/** Adds names (one per line or comma-separated); returns the new roster and what was skipped. */
export function addNames(roster, text) {
  const next = [...roster];
  const skipped = [];
  for (const raw of text.split(/\n|,/)) {
    const name = normaliseName(raw);
    if (!name) continue;
    if (next.some((n) => n.toLowerCase() === name.toLowerCase())) skipped.push(name);
    else next.push(name);
  }
  return { roster: next.sort((a, b) => a.localeCompare(b)), skipped };
}

export function removeName(roster, name) {
  return roster.filter((n) => n !== name);
}

export function mark(records, date, name, status) {
  if (!STATUSES.includes(status)) throw new Error(`unknown status "${status}"`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`bad date "${date}"`);
  return { ...records, [date]: { ...records[date], [name]: status } };
}

export function unmark(records, date, name) {
  const day = { ...records[date] };
  delete day[name];
  const next = { ...records };
  if (Object.keys(day).length) next[date] = day; else delete next[date];
  return next;
}

export function dates(records) {
  return Object.keys(records).sort();
}

/** Per-student summary: sessions marked, present (incl. late), rate, and the current run of consecutive absences (excused breaks the run). */
export function summarise(roster, records) {
  const ds = dates(records);
  return roster.map((name) => {
    let marked = 0;
    let present = 0;
    let late = 0;
    let absent = 0;
    let run = 0;
    for (const d of ds) {
      const st = records[d]?.[name];
      if (!st) continue;
      marked += 1;
      if (COUNTS_PRESENT.has(st)) { present += 1; run = 0; } else if (st === 'absent') { absent += 1; run += 1; } else run = 0;
      if (st === 'late') late += 1;
    }
    return { name, marked, present, late, absent, rate: marked ? (present / marked) * 100 : null, consecutiveAbsences: run };
  });
}

/** Session summary for one date. */
export function daySummary(roster, records, date) {
  const day = records[date] ?? {};
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const n of roster) if (day[n]) counts[day[n]] += 1;
  const marked = Object.values(counts).reduce((a, b) => a + b, 0);
  return { date, counts, marked, unmarked: roster.length - marked, presentRate: marked ? ((counts.present + counts.late) / marked) * 100 : null };
}

export function toCsv(roster, records) {
  const ds = dates(records);
  const esc = (v) => `"${String(v).replaceAll('"', '""')}"`;
  const head = ['name', ...ds].map(esc).join(',');
  const rows = roster.map((n) => [n, ...ds.map((d) => records[d]?.[n] ?? '')].map(esc).join(','));
  return [head, ...rows].join('\n') + '\n';
}

function splitLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; } else if (ch === '"') q = false; else cur += ch; } else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Imports the CSV produced by toCsv (or the same shape from a spreadsheet). Unknown statuses are reported and skipped. */
export function fromCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) throw new Error('CSV is empty');
  const head = splitLine(lines[0]);
  if (head[0].toLowerCase() !== 'name') throw new Error('first column must be "name"');
  const ds = head.slice(1);
  const badDates = ds.filter((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d));
  if (badDates.length) throw new Error(`date columns must be YYYY-MM-DD: ${badDates.join(', ')}`);
  const roster = [];
  let records = {};
  const warnings = [];
  lines.slice(1).forEach((l, i) => {
    const f = splitLine(l);
    const name = normaliseName(f[0] ?? '');
    if (!name) return warnings.push(`row ${i + 2}: empty name`);
    if (roster.some((n) => n.toLowerCase() === name.toLowerCase())) return warnings.push(`row ${i + 2}: duplicate name "${name}"`);
    roster.push(name);
    ds.forEach((d, k) => {
      const st = (f[k + 1] ?? '').toLowerCase();
      if (!st) return;
      if (!STATUSES.includes(st)) return warnings.push(`row ${i + 2}: unknown status "${f[k + 1]}" on ${d}`);
      records = mark(records, d, name, st);
      return undefined;
    });
    return undefined;
  });
  return { roster: roster.sort((a, b) => a.localeCompare(b)), records, warnings };
}

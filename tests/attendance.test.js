import { describe, expect, it } from 'vitest';
import { addNames, daySummary, dates, fromCsv, mark, removeName, summarise, toCsv, unmark } from '../src/attendance.js';

describe('roster', () => {
  it('adds, normalises, de-duplicates case-insensitively and sorts', () => {
    const r = addNames([], 'Zoe  Park\nadam lee, Adam Lee,  , Bea');
    expect(r.roster).toEqual(['adam lee', 'Bea', 'Zoe Park']);
    expect(r.skipped).toEqual(['Adam Lee']);
    expect(removeName(r.roster, 'Bea')).toEqual(['adam lee', 'Zoe Park']);
  });
});

describe('records', () => {
  let rec = {};
  rec = mark(rec, '2026-09-01', 'Ana', 'present');
  rec = mark(rec, '2026-09-01', 'Ben', 'absent');
  rec = mark(rec, '2026-09-03', 'Ana', 'late');
  rec = mark(rec, '2026-09-03', 'Ben', 'absent');
  rec = mark(rec, '2026-09-05', 'Ben', 'excused');
  rec = mark(rec, '2026-09-08', 'Ben', 'absent');
  it('marks, validates and summarises with consecutive-absence runs', () => {
    expect(dates(rec)).toEqual(['2026-09-01', '2026-09-03', '2026-09-05', '2026-09-08']);
    expect(() => mark(rec, '2026-09-01', 'Ana', 'asleep')).toThrow(/unknown status/);
    expect(() => mark(rec, '9/1/26', 'Ana', 'present')).toThrow(/bad date/);
    const s = summarise(['Ana', 'Ben', 'Cy'], rec);
    expect(s[0]).toMatchObject({ name: 'Ana', marked: 2, present: 2, late: 1, absent: 0, rate: 100, consecutiveAbsences: 0 });
    expect(s[1]).toMatchObject({ name: 'Ben', marked: 4, present: 0, absent: 3, rate: 0, consecutiveAbsences: 1 }); // excused broke the run of 2
    expect(s[2]).toMatchObject({ name: 'Cy', marked: 0, rate: null });
    expect(daySummary(['Ana', 'Ben', 'Cy'], rec, '2026-09-01')).toMatchObject({ counts: { present: 1, late: 0, absent: 1, excused: 0 }, marked: 2, unmarked: 1, presentRate: 50 });
    expect(daySummary(['Ana'], rec, '2030-01-01').presentRate).toBeNull();
    const cleared = unmark(rec, '2026-09-05', 'Ben');
    expect(dates(cleared)).toEqual(['2026-09-01', '2026-09-03', '2026-09-08']);
    expect(summarise(['Ben'], cleared)[0].consecutiveAbsences).toBe(3);
    expect(unmark(cleared, '2026-09-01', 'Ana')['2026-09-01']).toEqual({ Ben: 'absent' });
  });
  it('round-trips through CSV and reports bad rows', () => {
    const csv = toCsv(['Ana', 'Ben'], rec);
    expect(csv.split('\n')[0]).toBe('"name","2026-09-01","2026-09-03","2026-09-05","2026-09-08"');
    const back = fromCsv(csv);
    expect(back.roster).toEqual(['Ana', 'Ben']);
    expect(back.records).toEqual(rec);
    expect(back.warnings).toEqual([]);
    const messy = fromCsv('name,2026-09-01\n"O\'Neil, Pat",present\n,late\nPat O\'Neil,present\nQ,sleeping\n');
    expect(messy.roster).toEqual(["O'Neil, Pat", "Pat O'Neil", 'Q']);
    expect(messy.warnings).toEqual(['row 3: empty name', 'row 5: unknown status "sleeping" on 2026-09-01']);
    expect(() => fromCsv('student,2026-09-01\nA,present')).toThrow(/first column/);
    expect(() => fromCsv('name,Sept 1\nA,present')).toThrow(/YYYY-MM-DD/);
    expect(() => fromCsv('')).toThrow(/empty/);
  });
});

import { describe, expect, it } from 'vitest';
import { cryptoRandom, makeGroups, makeGroupsAvoidingRepeats, pairHistory, pickNext, repeatScore, shuffle } from '../src/randomizer.js';

const seq = (values) => { let i = 0; return () => values[i++ % values.length]; };
const lcg = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

describe('pickNext', () => {
  it('calls everyone once before anyone twice, then starts a new round', () => {
    const names = ['A', 'B', 'C'];
    let called = [];
    const seen = [];
    for (let i = 0; i < 3; i += 1) { const r = pickNext(names, called, lcg(i + 1)); called = r.called; seen.push(r.picked); expect(r.newRound).toBe(false); }
    expect([...seen].sort()).toEqual(['A', 'B', 'C']);
    const r = pickNext(names, called, () => 0);
    expect(r.newRound).toBe(true);
    expect(r.called).toEqual(['A']);
    expect(r.remaining).toBe(2);
    expect(() => pickNext([], [], Math.random)).toThrow(/no names/);
  });
});

describe('groups', () => {
  const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  it('shuffle is a permutation', () => {
    const s = shuffle(names, lcg(7));
    expect([...s].sort()).toEqual([...names].sort());
    expect(shuffle(['x'], seq([0.5]))).toEqual(['x']);
  });
  it('balances group sizes to within one, by size or by count', () => {
    const bySize = makeGroups(names, { size: 3 }, lcg(1));
    expect(bySize.map((g) => g.length).sort()).toEqual([3, 4]);
    expect(bySize.flat().sort()).toEqual([...names].sort());
    const byCount = makeGroups(names, { count: 3 }, lcg(2));
    expect(byCount.map((g) => g.length).sort()).toEqual([2, 2, 3]);
    expect(makeGroups(names, { count: 50 }, lcg(3))).toHaveLength(7);
    expect(makeGroups([], { size: 2 }, lcg(3))).toEqual([]);
  });
  it('avoids repeated pairs when history allows it', () => {
    const four = ['A', 'B', 'C', 'D'];
    const previous = [[['A', 'B'], ['C', 'D']]];
    const h = pairHistory(previous);
    expect(h.size).toBe(2);
    expect(repeatScore([['A', 'B'], ['C', 'D']], h)).toBe(2);
    expect(repeatScore([['A', 'C'], ['B', 'D']], h)).toBe(0);
    const r = makeGroupsAvoidingRepeats(four, { size: 2 }, previous, lcg(11));
    expect(r.repeatedPairs).toBe(0);
    // With every pairing already used, the best achievable is reported honestly.
    const all = [[['A', 'B'], ['C', 'D']], [['A', 'C'], ['B', 'D']], [['A', 'D'], ['B', 'C']]];
    expect(makeGroupsAvoidingRepeats(four, { size: 2 }, all, lcg(5)).repeatedPairs).toBe(2);
  });
  it('cryptoRandom is in [0,1)', () => {
    for (let i = 0; i < 100; i += 1) { const x = cryptoRandom(); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });
});

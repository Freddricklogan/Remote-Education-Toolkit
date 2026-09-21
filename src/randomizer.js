/** Fair selection and grouping: cold-call queue without replacement, balanced groups, and pair-history-aware grouping. Randomness is injected. */

export function shuffle(items, random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Picks one name not yet called this round; when everyone has been called, starts a new round. */
export function pickNext(names, called, random) {
  if (names.length === 0) throw new Error('no names');
  let pool = names.filter((n) => !called.includes(n));
  let nextCalled = called;
  if (pool.length === 0) { pool = names; nextCalled = []; }
  const picked = pool[Math.floor(random() * pool.length)];
  return { picked, called: [...nextCalled, picked], remaining: pool.length - 1, newRound: nextCalled !== called };
}

/** Splits names into groups of about `size` (or exactly `count` groups); sizes differ by at most one. */
export function makeGroups(names, { size = null, count = null } = {}, random) {
  if (names.length === 0) return [];
  const k = count ? Math.max(1, Math.min(count, names.length)) : Math.max(1, Math.round(names.length / Math.max(1, size)));
  const order = shuffle(names, random);
  const groups = Array.from({ length: k }, () => []);
  order.forEach((n, i) => groups[i % k].push(n));
  return groups;
}

export function pairKey(a, b) {
  return [a, b].sort().join('\u0000');
}

/** Counts how many times each pair has shared a group across previous groupings. */
export function pairHistory(previousGroupings) {
  const h = new Map();
  for (const groups of previousGroupings) for (const g of groups) for (let i = 0; i < g.length; i += 1) for (let j = i + 1; j < g.length; j += 1) h.set(pairKey(g[i], g[j]), (h.get(pairKey(g[i], g[j])) ?? 0) + 1);
  return h;
}

/** Repeated-pair score of a grouping against history (lower is better). */
export function repeatScore(groups, history) {
  let s = 0;
  for (const g of groups) for (let i = 0; i < g.length; i += 1) for (let j = i + 1; j < g.length; j += 1) s += history.get(pairKey(g[i], g[j])) ?? 0;
  return s;
}

/** Tries `attempts` random groupings and keeps the one with the fewest repeated pairs. */
export function makeGroupsAvoidingRepeats(names, opts, previousGroupings, random, attempts = 200) {
  const history = pairHistory(previousGroupings);
  let best = null;
  let bestScore = Infinity;
  for (let i = 0; i < attempts; i += 1) {
    const g = makeGroups(names, opts, random);
    const sc = repeatScore(g, history);
    if (sc < bestScore) { best = g; bestScore = sc; }
    if (sc === 0) break;
  }
  return { groups: best, repeatedPairs: bestScore };
}

/** A uniform random source from the platform CSPRNG. */
export function cryptoRandom() {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 4294967296;
}

/** Countdown and agenda timer as a pure state machine driven by wall-clock timestamps, so a background tab cannot make it drift. */

export function formatTime(totalSeconds) {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** Parses "Warm-up 5, Lecture 20, Breakout 15" (or one segment per line) into segments; problems listed. */
export function parseAgenda(text) {
  const segments = [];
  const problems = [];
  const parts = text.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
  parts.forEach((part, i) => {
    const m = part.match(/^(.*?)\s*(\d+(?:\.\d+)?)\s*(m|min|mins|minutes)?$/i);
    if (!m || !(Number(m[2]) > 0)) return problems.push(`segment ${i + 1}: "${part}" needs a label and a positive number of minutes`);
    segments.push({ label: m[1].trim() || `Segment ${i + 1}`, minutes: Number(m[2]) });
    return undefined;
  });
  if (segments.length === 0 && problems.length === 0) problems.push('no segments');
  return { segments, problems };
}

export function createTimer(segments) {
  return { segments: segments.map((s) => ({ ...s, seconds: Math.round(s.minutes * 60) })), index: 0, running: false, startedAt: null, elapsedBefore: 0, finished: false };
}

export function start(t, now) {
  if (t.running || t.finished) return t;
  return { ...t, running: true, startedAt: now };
}
export function pause(t, now) {
  if (!t.running) return t;
  return { ...t, running: false, startedAt: null, elapsedBefore: t.elapsedBefore + (now - t.startedAt) / 1000 };
}
export function reset(t) {
  return { ...t, index: 0, running: false, startedAt: null, elapsedBefore: 0, finished: false };
}
export function skip(t, now) {
  if (t.index >= t.segments.length - 1) return { ...t, running: false, startedAt: null, elapsedBefore: t.segments[t.index].seconds, finished: true };
  return { ...t, index: t.index + 1, elapsedBefore: 0, startedAt: t.running ? now : null };
}

/** Elapsed seconds in the current segment at `now`. */
export function elapsed(t, now) {
  return t.elapsedBefore + (t.running ? (now - t.startedAt) / 1000 : 0);
}

/**
 * Advances the machine to `now`: moves through segments whose time has elapsed and returns the new state plus
 * the list of segment indices that completed during this tick (for alerts).
 */
export function tick(t, now) {
  let s = t;
  const completed = [];
  while (s.running) {
    const seg = s.segments[s.index];
    const e = elapsed(s, now);
    if (e < seg.seconds) break;
    completed.push(s.index);
    const overshoot = e - seg.seconds;
    if (s.index >= s.segments.length - 1) {
      s = { ...s, running: false, startedAt: null, elapsedBefore: seg.seconds, finished: true };
      break;
    }
    s = { ...s, index: s.index + 1, elapsedBefore: overshoot, startedAt: now };
  }
  return { state: s, completed };
}

export function view(t, now) {
  const seg = t.segments[t.index];
  const e = Math.min(seg.seconds, elapsed(t, now));
  const remaining = seg.seconds - e;
  const totalSeconds = t.segments.reduce((a, s) => a + s.seconds, 0);
  const before = t.segments.slice(0, t.index).reduce((a, s) => a + s.seconds, 0);
  return { label: seg.label, remaining, remainingText: formatTime(remaining), segmentPct: (e / seg.seconds) * 100, overallPct: ((before + e) / totalSeconds) * 100, tone: remaining <= 10 ? 'danger' : remaining <= 60 ? 'warn' : 'ok', index: t.index, count: t.segments.length, finished: t.finished };
}

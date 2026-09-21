import { describe, expect, it } from 'vitest';
import { createTimer, elapsed, formatTime, parseAgenda, pause, reset, skip, start, tick, view } from '../src/timer.js';

describe('formatTime and parseAgenda', () => {
  it('formats mm:ss and h:mm:ss, rounding up partial seconds', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(59.2)).toBe('01:00');
    expect(formatTime(600)).toBe('10:00');
    expect(formatTime(3661)).toBe('1:01:01');
    expect(formatTime(-5)).toBe('00:00');
  });
  it('parses comma or newline separated segments and reports bad ones', () => {
    expect(parseAgenda('Warm-up 5, Lecture 20 min\nBreakout 15 minutes').segments).toEqual([{ label: 'Warm-up', minutes: 5 }, { label: 'Lecture', minutes: 20 }, { label: 'Breakout', minutes: 15 }]);
    expect(parseAgenda('12').segments).toEqual([{ label: 'Segment 1', minutes: 12 }]);
    const bad = parseAgenda('Lecture, Quiz 0, Break 2.5');
    expect(bad.problems).toEqual(['segment 1: "Lecture" needs a label and a positive number of minutes', 'segment 2: "Quiz 0" needs a label and a positive number of minutes']);
    expect(bad.segments).toEqual([{ label: 'Break', minutes: 2.5 }]);
    expect(parseAgenda('   ').problems).toEqual(['no segments']);
  });
});

describe('timer state machine', () => {
  const T = createTimer([{ label: 'A', minutes: 1 }, { label: 'B', minutes: 0.5 }]);
  it('is driven by timestamps, so pausing and resuming keeps elapsed exact', () => {
    let t = start(T, 1000);
    expect(elapsed(t, 21000)).toBe(20);
    t = pause(t, 21000);
    expect(t.running).toBe(false);
    expect(elapsed(t, 99999)).toBe(20);
    t = start(t, 100000);
    expect(elapsed(t, 110000)).toBe(30);
    expect(view(t, 110000)).toMatchObject({ label: 'A', remaining: 30, remainingText: '00:30', segmentPct: 50, index: 0, count: 2, tone: 'warn' });
    expect(view(t, 110000).overallPct).toBeCloseTo((30 / 90) * 100, 9);
  });
  it('advances through segments on tick, carrying overshoot, and finishes', () => {
    let t = start(T, 0);
    let r = tick(t, 30000);
    expect(r.completed).toEqual([]);
    r = tick(t, 65000); // 65 s: segment A (60 s) done, 5 s into B
    expect(r.completed).toEqual([0]);
    expect(r.state.index).toBe(1);
    expect(elapsed(r.state, 65000)).toBeCloseTo(5, 9);
    expect(view(r.state, 65000).remaining).toBeCloseTo(25, 9);
    r = tick(r.state, 200000);
    expect(r.completed).toEqual([1]);
    expect(r.state.finished).toBe(true);
    expect(r.state.running).toBe(false);
    expect(view(r.state, 200000)).toMatchObject({ remaining: 0, finished: true, overallPct: 100 });
    expect(start(r.state, 300000).running).toBe(false); // finished timers do not restart
    expect(reset(r.state)).toMatchObject({ index: 0, running: false, elapsedBefore: 0, finished: false });
  });
  it('a single tick spanning every segment completes all of them', () => {
    const r = tick(start(T, 0), 1e9);
    expect(r.completed).toEqual([0, 1]);
    expect(r.state.finished).toBe(true);
  });
  it('skip moves to the next segment, and past the last segment finishes', () => {
    let t = start(T, 0);
    t = skip(t, 10000);
    expect(t.index).toBe(1);
    expect(t.running).toBe(true);
    expect(elapsed(t, 10000)).toBe(0);
    t = skip(t, 20000);
    expect(t.finished).toBe(true);
    expect(skip(pause(start(T, 0), 5000), 6000).startedAt).toBeNull();
  });
  it('tone is danger in the last ten seconds and ok otherwise', () => {
    const t = start(T, 0);
    expect(view(t, 0).tone).toBe('warn'); // 60 s remaining
    expect(view(createTimer([{ label: 'L', minutes: 10 }]), 0).tone).toBe('ok');
    expect(view(t, 52000).tone).toBe('danger');
  });
});

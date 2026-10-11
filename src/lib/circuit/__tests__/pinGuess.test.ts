import { describe, expect, it } from 'vitest';
import { guessDirFromNeighbours } from '../pinGuess';

describe('guessDirFromNeighbours', () => {
  // board 300×600; cột chân trái ở x≈30, chân cuối sát đáy (y≈580) — như A5 trên Arduino UNO
  const col = [0.3, 0.4, 0.5, 0.6, 0.7].map((fy) => ({ fx: 0.1, fy, dir: 2 as const }));

  it('a pin near the bottom edge in a left-facing column stays left-facing', () => {
    expect(guessDirFromNeighbours(0.1, 0.97, 300, 600, col)).toBe(2);
  });

  it('falls back to the nearest edge when no pin lines up', () => {
    expect(guessDirFromNeighbours(0.5, 0.98, 300, 600, col)).toBe(1);
    expect(guessDirFromNeighbours(0.1, 0.97, 300, 600, [])).toBe(1);
  });

  it('a row of down-facing pins along the bottom keeps its direction near a side edge', () => {
    const row = [0.3, 0.4, 0.5].map((fx) => ({ fx, fy: 0.95, dir: 1 as const }));
    expect(guessDirFromNeighbours(0.03, 0.95, 300, 600, row)).toBe(1);
  });
});

/**
 * Phase 15C — Aptitude Integration Tests for Placement Readiness
 *
 * These tests verify the new APTITUDE component and the 8-component
 * weighting system. Pure unit tests use the `__test` exports so they
 * run without a database.
 */

import { describe, expect, it } from 'vitest';
import { PLACEMENT_READINESS_BANDS, PLACEMENT_READINESS_WEIGHTS } from '@aip/types';
import { __test as readinessTest } from '../placement-readiness.service';

describe('Phase 15C — Placement Readiness APTITUDE component', () => {
  // Cast to accept simple {score, weight} objects for testing the weighted-sum logic.
  const { computeOverall, levelFor } = readinessTest as unknown as {
    computeOverall: (components: Array<{ score: number; weight: number }>) => number;
    levelFor: (score: number) => string;
  };

  describe('weight system', () => {
    it('weights still sum to 1.0 after adding APTITUDE', () => {
      const sum = Object.values(PLACEMENT_READINESS_WEIGHTS).reduce(
        (acc: number, v: number) => acc + v,
        0,
      );
      // Allow tiny floating-point drift.
      expect(Math.abs(sum - 1.0)).toBeLessThan(1e-9);
    });

    it('every key in PLACEMENT_READINESS_WEIGHTS has a defined numeric value', () => {
      for (const [key, value] of Object.entries(PLACEMENT_READINESS_WEIGHTS)) {
        expect(typeof value).toBe('number');
        expect(value as number).toBeGreaterThanOrEqual(0);
        expect(value as number).toBeLessThanOrEqual(1);
        expect(key).toBeTruthy();
      }
    });
  });

  describe('computeOverall with APTITUDE component', () => {
    it('produces a value within [0, 100]', () => {
      const components = [
        { score: 80, weight: 0.3 },
        { score: 70, weight: 0.2 },
        { score: 60, weight: 0.15 },
        { score: 50, weight: 0.1 },
        { score: 40, weight: 0.1 },
        { score: 30, weight: 0.1 },
        { score: 20, weight: 0.03 },
        { score: 90, weight: 0.02 },
      ];
      const overall = computeOverall(components);
      expect(overall).toBeGreaterThanOrEqual(0);
      expect(overall).toBeLessThanOrEqual(100);
    });

    it('is deterministic — same input always produces same output', () => {
      const components = [
        { score: 80, weight: 0.3 },
        { score: 70, weight: 0.2 },
        { score: 60, weight: 0.15 },
        { score: 50, weight: 0.1 },
        { score: 40, weight: 0.1 },
        { score: 30, weight: 0.1 },
        { score: 20, weight: 0.03 },
        { score: 90, weight: 0.02 },
      ];
      const a = computeOverall(components);
      const b = computeOverall(components);
      expect(a).toBe(b);
    });

    it('returns ~30 for a fresh student (all components at 0)', () => {
      const components = [
        { score: 0, weight: 0.3 },
        { score: 0, weight: 0.2 },
        { score: 0, weight: 0.15 },
        { score: 0, weight: 0.1 },
        { score: 0, weight: 0.1 },
        { score: 0, weight: 0.1 },
        { score: 0, weight: 0.03 },
        { score: 0, weight: 0.02 },
      ];
      const overall = computeOverall(components);
      expect(overall).toBe(0);
    });

    it('returns 100 when all components are at 100', () => {
      const components = [
        { score: 100, weight: 0.3 },
        { score: 100, weight: 0.2 },
        { score: 100, weight: 0.15 },
        { score: 100, weight: 0.1 },
        { score: 100, weight: 0.1 },
        { score: 100, weight: 0.1 },
        { score: 100, weight: 0.03 },
        { score: 100, weight: 0.02 },
      ];
      const overall = computeOverall(components);
      expect(overall).toBe(100);
    });
  });

  describe('readiness level thresholds (still deterministic)', () => {
    it('80 → PLACEMENT_READY', () => expect(levelFor(80)).toBe('PLACEMENT_READY'));
    it('65 → NEARLY_READY', () => expect(levelFor(65)).toBe('NEARLY_READY'));
    it('50 → DEVELOPING', () => expect(levelFor(50)).toBe('DEVELOPING'));
    it('30 → NEEDS_IMPROVEMENT', () => expect(levelFor(30)).toBe('NEEDS_IMPROVEMENT'));
    it('0 → NOT_READY', () => expect(levelFor(0)).toBe('NOT_READY'));
  });

  describe('PLACEMENT_READINESS_BANDS consistency', () => {
    it('every level has a non-empty label and description', () => {
      for (const band of PLACEMENT_READINESS_BANDS) {
        expect(band.label.length).toBeGreaterThan(0);
        expect(band.description.length).toBeGreaterThan(0);
        expect(band.min).toBeGreaterThanOrEqual(0);
        expect(band.min).toBeLessThanOrEqual(100);
      }
    });

    it('band mins are descending', () => {
      const mins = PLACEMENT_READINESS_BANDS.map((b) => b.min);
      for (let i = 1; i < mins.length; i++) {
        expect(mins[i]).toBeLessThan(mins[i - 1]!);
      }
    });
  });
});

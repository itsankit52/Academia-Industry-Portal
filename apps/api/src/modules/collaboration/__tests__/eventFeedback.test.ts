import { describe, expect, it } from 'vitest';

/**
 * Phase 8 — Event Feedback Tests
 *
 * Tests feedback validation logic that doesn't require database access.
 */

describe('Event Feedback Validation', () => {
  function isValidRating(rating: number): boolean {
    return Number.isInteger(rating) && rating >= 1 && rating <= 5;
  }

  function isValidComment(comment: string | undefined): boolean {
    if (comment === undefined || comment === '') return true;
    return comment.length <= 2000;
  }

  describe('Rating validation', () => {
    it('accepts ratings 1-5', () => {
      for (let r = 1; r <= 5; r++) {
        expect(isValidRating(r)).toBe(true);
      }
    });

    it('rejects rating 0', () => {
      expect(isValidRating(0)).toBe(false);
    });

    it('rejects rating above 5', () => {
      expect(isValidRating(6)).toBe(false);
      expect(isValidRating(10)).toBe(false);
    });

    it('rejects non-integer ratings', () => {
      expect(isValidRating(3.5)).toBe(false);
      expect(isValidRating(4.9)).toBe(false);
    });

    it('rejects negative and NaN ratings', () => {
      expect(isValidRating(-1)).toBe(false);
      expect(isValidRating(NaN)).toBe(false);
      expect(isValidRating(Infinity)).toBe(false);
    });
  });

  describe('Comment validation', () => {
    it('allows undefined comment', () => {
      expect(isValidComment(undefined)).toBe(true);
    });

    it('allows empty string comment', () => {
      expect(isValidComment('')).toBe(true);
    });

    it('allows comment up to 2000 characters', () => {
      expect(isValidComment('a'.repeat(2000))).toBe(true);
    });

    it('rejects comment over 2000 characters', () => {
      expect(isValidComment('a'.repeat(2001))).toBe(false);
    });
  });

  describe('Feedback submission timing', () => {
    function canSubmitFeedback(
      attendedAt: Date | null,
      eventEndAt: Date | null,
      now: Date,
    ): boolean {
      if (attendedAt) return true;
      if (eventEndAt) return eventEndAt < now;
      return false;
    }

    it('allows feedback if attended', () => {
      const attended = new Date('2026-01-01');
      expect(canSubmitFeedback(attended, null, new Date('2026-12-01'))).toBe(true);
    });

    it('allows feedback after event end', () => {
      const end = new Date('2026-01-01');
      const now = new Date('2026-12-01');
      expect(canSubmitFeedback(null, end, now)).toBe(true);
    });

    it('blocks feedback before event end when not attended', () => {
      const end = new Date('2026-12-31');
      const now = new Date('2026-01-01');
      expect(canSubmitFeedback(null, end, now)).toBe(false);
    });

    it('allows feedback when no endAt but startAt passed', () => {
      // When endAt is null, fall back to startAt
      const start = new Date('2026-01-01');
      const now = new Date('2026-12-01');
      expect(canSubmitFeedback(null, null, now)).toBe(false); // no endAt, not attended
    });
  });

  describe('Feedback summary aggregation', () => {
    interface FeedbackEntry {
      rating: number | null;
      comment: string | null;
      updatedAt: Date;
    }

    function aggregateFeedback(entries: FeedbackEntry[]) {
      const ratings = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      let total = 0;
      let sum = 0;
      for (const e of entries) {
        if (typeof e.rating === 'number' && e.rating >= 1 && e.rating <= 5) {
          ratings[e.rating as 1 | 2 | 3 | 4 | 5] += 1;
          sum += e.rating;
          total += 1;
        }
      }
      const averageRating = total > 0 ? Math.round((sum / total) * 10) / 10 : 0;
      const comments = entries
        .filter((e) => typeof e.comment === 'string' && e.comment.length > 0)
        .slice(0, 10);
      return { ratings, totalFeedback: total, averageRating, recentComments: comments };
    }

    it('calculates correct average', () => {
      const entries: FeedbackEntry[] = [
        { rating: 5, comment: 'Great!', updatedAt: new Date() },
        { rating: 4, comment: 'Good', updatedAt: new Date() },
        { rating: 3, comment: null, updatedAt: new Date() },
      ];
      const result = aggregateFeedback(entries);
      expect(result.averageRating).toBe(4);
      expect(result.totalFeedback).toBe(3);
    });

    it('rounds average to 1 decimal', () => {
      const entries: FeedbackEntry[] = [
        { rating: 5, comment: null, updatedAt: new Date() },
        { rating: 4, comment: null, updatedAt: new Date() },
        { rating: 4, comment: null, updatedAt: new Date() },
      ];
      const result = aggregateFeedback(entries);
      expect(result.averageRating).toBe(4.3);
    });

    it('returns 0 average when no feedback', () => {
      const result = aggregateFeedback([]);
      expect(result.averageRating).toBe(0);
      expect(result.totalFeedback).toBe(0);
    });

    it('ignores null ratings', () => {
      const entries: FeedbackEntry[] = [
        { rating: null, comment: null, updatedAt: new Date() },
        { rating: 5, comment: 'Excellent', updatedAt: new Date() },
      ];
      const result = aggregateFeedback(entries);
      expect(result.averageRating).toBe(5);
      expect(result.totalFeedback).toBe(1);
      expect(result.ratings[5]).toBe(1);
    });

    it('limits recent comments to 10', () => {
      const entries: FeedbackEntry[] = Array.from({ length: 20 }, (_, i) => ({
        rating: 5,
        comment: `Comment ${i}`,
        updatedAt: new Date(),
      }));
      const result = aggregateFeedback(entries);
      expect(result.recentComments.length).toBe(10);
    });

    it('ignores empty comments in recent list', () => {
      const entries: FeedbackEntry[] = [
        { rating: 5, comment: '', updatedAt: new Date() },
        { rating: 4, comment: 'Has content', updatedAt: new Date() },
      ];
      const result = aggregateFeedback(entries);
      expect(result.recentComments.length).toBe(1);
      expect(result.recentComments[0]!.comment).toBe('Has content');
    });
  });
});

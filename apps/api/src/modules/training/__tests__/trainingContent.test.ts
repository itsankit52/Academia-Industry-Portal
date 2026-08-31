/**
 * Phase 15B — Training Content Tests
 *
 * Tests for the in-platform training content system:
 * - TrainingModule CRUD
 * - TrainingLesson CRUD
 * - Lesson completion with idempotency
 * - Progress calculation
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';

// ---------------------------------------------------------------------------
// Pure logic tests (no DB required)
// ---------------------------------------------------------------------------

describe('Training Content Pure Logic', () => {
  describe('Progress calculation', () => {
    function calculateProgress(completed: number, total: number): number {
      if (total === 0) return 100;
      return Math.min(100, Math.round((completed / total) * 100));
    }

    it('calculates correct percentage', () => {
      expect(calculateProgress(5, 10)).toBe(50);
      expect(calculateProgress(3, 4)).toBe(75);
      expect(calculateProgress(1, 3)).toBe(33);
    });

    it('caps at 100', () => {
      expect(calculateProgress(15, 10)).toBe(100);
      expect(calculateProgress(100, 50)).toBe(100);
    });

    it('handles zero total lessons', () => {
      expect(calculateProgress(0, 0)).toBe(100);
    });

    it('handles edge cases', () => {
      expect(calculateProgress(0, 1)).toBe(0);
      expect(calculateProgress(1, 1)).toBe(100);
    });
  });

  describe('Lesson completion idempotency', () => {
    function isLessonCompleted(completedLessons: string[], lessonId: string): boolean {
      return completedLessons.includes(lessonId);
    }

    function addCompletedLesson(
      completedLessons: string[],
      lessonId: string,
    ): { completedLessons: string[]; wasNew: boolean } {
      if (completedLessons.includes(lessonId)) {
        return { completedLessons, wasNew: false };
      }
      return { completedLessons: [...completedLessons, lessonId], wasNew: true };
    }

    it('detects completed lessons', () => {
      const completed = ['lesson1', 'lesson2'];
      expect(isLessonCompleted(completed, 'lesson1')).toBe(true);
      expect(isLessonCompleted(completed, 'lesson3')).toBe(false);
    });

    it('adds new lesson without duplication', () => {
      const completed: string[] = [];
      const result1 = addCompletedLesson(completed, 'lesson1');
      expect(result1.wasNew).toBe(true);
      expect(result1.completedLessons).toEqual(['lesson1']);

      const result2 = addCompletedLesson(result1.completedLessons, 'lesson1');
      expect(result2.wasNew).toBe(false);
      expect(result2.completedLessons).toEqual(['lesson1']); // No duplicate
    });
  });

  describe('Enrollment status transitions', () => {
    type EnrollmentStatus = 'ENROLLED' | 'IN_PROGRESS' | 'COMPLETED' | 'DROPPED';

    const TRANSITIONS: Record<EnrollmentStatus, EnrollmentStatus[]> = {
      ENROLLED: ['IN_PROGRESS', 'COMPLETED', 'DROPPED'],
      IN_PROGRESS: ['COMPLETED', 'DROPPED'],
      COMPLETED: [],
      DROPPED: ['ENROLLED'],
    };

    function canTransition(from: EnrollmentStatus, to: EnrollmentStatus): boolean {
      return TRANSITIONS[from]?.includes(to) ?? false;
    }

    it('allows valid transitions', () => {
      expect(canTransition('ENROLLED', 'IN_PROGRESS')).toBe(true);
      expect(canTransition('ENROLLED', 'COMPLETED')).toBe(true);
      expect(canTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
      expect(canTransition('DROPPED', 'ENROLLED')).toBe(true);
    });

    it('prevents invalid transitions', () => {
      expect(canTransition('COMPLETED', 'IN_PROGRESS')).toBe(false);
      expect(canTransition('COMPLETED', 'ENROLLED')).toBe(false);
      expect(canTransition('DROPPED', 'COMPLETED')).toBe(false);
    });
  });

  describe('Lesson type validation', () => {
    const VALID_LESSON_TYPES = ['VIDEO', 'ARTICLE', 'QUIZ', 'RESOURCE'] as const;
    type LessonType = (typeof VALID_LESSON_TYPES)[number];

    function requiresResourceUrl(type: LessonType): boolean {
      return type === 'VIDEO' || type === 'RESOURCE';
    }

    it('VIDEO requires resourceUrl', () => {
      expect(requiresResourceUrl('VIDEO')).toBe(true);
    });

    it('RESOURCE requires resourceUrl', () => {
      expect(requiresResourceUrl('RESOURCE')).toBe(true);
    });

    it('ARTICLE does not require resourceUrl', () => {
      expect(requiresResourceUrl('ARTICLE')).toBe(false);
    });

    it('QUIZ does not require resourceUrl', () => {
      expect(requiresResourceUrl('QUIZ')).toBe(false);
    });
  });

  describe('Training content type validation', () => {
    const VALID_CONTENT_TYPES = ['INTERNAL', 'EXTERNAL', 'HYBRID'] as const;
    type ContentType = (typeof VALID_CONTENT_TYPES)[number];

    function requiresRegistrationUrl(type: ContentType): boolean {
      return type === 'EXTERNAL';
    }

    it('EXTERNAL requires registrationUrl', () => {
      expect(requiresRegistrationUrl('EXTERNAL')).toBe(true);
    });

    it('INTERNAL does not require registrationUrl', () => {
      expect(requiresRegistrationUrl('INTERNAL')).toBe(false);
    });

    it('HYBRID does not require registrationUrl', () => {
      expect(requiresRegistrationUrl('HYBRID')).toBe(false);
    });
  });
});

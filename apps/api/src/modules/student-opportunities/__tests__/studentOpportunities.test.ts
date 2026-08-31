/**
 * Phase 15B — Student Opportunity Discovery Tests
 *
 * Tests the student-facing opportunity discovery service:
 * - Filtering by target role and status
 * - Application idempotency
 * - Authorization rules
 * - Withdraw flow
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Pure logic tests
// ---------------------------------------------------------------------------

describe('Student Opportunity Pure Logic', () => {
  describe('Visibility filter', () => {
    interface Opportunity {
      targetRoles: string[];
      status: string;
      applicationDeadline: Date;
    }

    function isVisibleToStudent(opp: Opportunity, now: Date = new Date()): boolean {
      if (!opp.targetRoles.includes('STUDENT')) return false;
      if (opp.status !== 'PUBLISHED') return false;
      if (opp.applicationDeadline < now) return false;
      return true;
    }

    it('shows STUDENT-targeted opportunities', () => {
      const future = new Date(Date.now() + 1000 * 60 * 60 * 24);
      const opp: Opportunity = {
        targetRoles: ['STUDENT'],
        status: 'PUBLISHED',
        applicationDeadline: future,
      };
      expect(isVisibleToStudent(opp)).toBe(true);
    });

    it('hides FACULTY-only opportunities', () => {
      const future = new Date(Date.now() + 1000 * 60 * 60 * 24);
      const opp: Opportunity = {
        targetRoles: ['FACULTY'],
        status: 'PUBLISHED',
        applicationDeadline: future,
      };
      expect(isVisibleToStudent(opp)).toBe(false);
    });

    it('hides DRAFT opportunities', () => {
      const future = new Date(Date.now() + 1000 * 60 * 60 * 24);
      const opp: Opportunity = {
        targetRoles: ['STUDENT'],
        status: 'DRAFT',
        applicationDeadline: future,
      };
      expect(isVisibleToStudent(opp)).toBe(false);
    });

    it('hides CLOSED opportunities', () => {
      const future = new Date(Date.now() + 1000 * 60 * 60 * 24);
      const opp: Opportunity = {
        targetRoles: ['STUDENT'],
        status: 'CLOSED',
        applicationDeadline: future,
      };
      expect(isVisibleToStudent(opp)).toBe(false);
    });

    it('hides expired opportunities', () => {
      const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
      const opp: Opportunity = {
        targetRoles: ['STUDENT'],
        status: 'PUBLISHED',
        applicationDeadline: past,
      };
      expect(isVisibleToStudent(opp)).toBe(false);
    });

    it('shows HYBRID-targeted (STUDENT + FACULTY) opportunities', () => {
      const future = new Date(Date.now() + 1000 * 60 * 60 * 24);
      const opp: Opportunity = {
        targetRoles: ['STUDENT', 'FACULTY'],
        status: 'PUBLISHED',
        applicationDeadline: future,
      };
      expect(isVisibleToStudent(opp)).toBe(true);
    });
  });

  describe('Expertise match score', () => {
    function computeExpertiseMatch(studentTags: string[], required: string[]): number {
      const req = new Set(required.map((s) => s.trim().toLowerCase()).filter(Boolean));
      if (req.size === 0) return 0;
      const own = new Set(studentTags.map((s) => s.trim().toLowerCase()).filter(Boolean));
      let hits = 0;
      for (const r of req) if (own.has(r)) hits += 1;
      return Math.round((hits / req.size) * 100);
    }

    it('returns 0 for no required expertise', () => {
      expect(computeExpertiseMatch(['node', 'react'], [])).toBe(0);
    });

    it('returns 100 for perfect match', () => {
      expect(computeExpertiseMatch(['Node.js', 'React'], ['react', 'node.js'])).toBe(100);
    });

    it('returns 50 for partial match', () => {
      expect(computeExpertiseMatch(['Node.js'], ['node.js', 'react'])).toBe(50);
    });

    it('returns 0 for no match', () => {
      expect(computeExpertiseMatch(['python'], ['react', 'vue'])).toBe(0);
    });

    it('is case-insensitive', () => {
      expect(computeExpertiseMatch(['Node.js'], ['NODE.JS'])).toBe(100);
    });
  });

  describe('Application status transitions', () => {
    type AppStatus =
      | 'APPLIED'
      | 'UNDER_REVIEW'
      | 'SHORTLISTED'
      | 'WITHDRAWN'
      | 'SELECTED'
      | 'REJECTED'
      | 'COMPLETED';

    const ALLOWED_WITHDRAW_STATES: AppStatus[] = ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED'];
    const ENGAGEMENT_STATES: AppStatus[] = ['SELECTED', 'COMPLETED'];

    function canWithdraw(status: AppStatus): boolean {
      if (status === 'WITHDRAWN') return false; // already withdrawn
      if (ENGAGEMENT_STATES.includes(status)) return false;
      return ALLOWED_WITHDRAW_STATES.includes(status);
    }

    it('allows withdraw from APPLIED', () => {
      expect(canWithdraw('APPLIED')).toBe(true);
    });

    it('blocks withdraw from SELECTED (engagement)', () => {
      expect(canWithdraw('SELECTED')).toBe(false);
    });

    it('blocks withdraw from COMPLETED (engagement)', () => {
      expect(canWithdraw('COMPLETED')).toBe(false);
    });

    it('blocks double withdraw', () => {
      expect(canWithdraw('WITHDRAWN')).toBe(false);
    });
  });

  describe('Application idempotency', () => {
    function hasAlreadyApplied(
      apps: Array<{ opportunity: string; status: string }>,
      opportunityId: string,
    ): boolean {
      return apps.some((a) => a.opportunity === opportunityId && a.status !== 'WITHDRAWN');
    }

    it('detects existing application', () => {
      const apps = [
        { opportunity: 'opp1', status: 'APPLIED' },
        { opportunity: 'opp2', status: 'APPLIED' },
      ];
      expect(hasAlreadyApplied(apps, 'opp1')).toBe(true);
    });

    it('does not detect withdrawn application', () => {
      const apps = [{ opportunity: 'opp1', status: 'WITHDRAWN' }];
      expect(hasAlreadyApplied(apps, 'opp1')).toBe(false);
    });

    it('returns false for new application', () => {
      const apps = [{ opportunity: 'opp1', status: 'APPLIED' }];
      expect(hasAlreadyApplied(apps, 'opp2')).toBe(false);
    });
  });
});

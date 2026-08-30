import { describe, expect, it } from 'vitest';
import {
  INTERNSHIP_TRANSITIONS,
  JOB_TRANSITIONS,
  validateInternshipTransition,
  validateInternshipDates,
  parseDate,
  isTerminalStatus,
  isInternshipStatus,
} from '../internshipLifecycle';

describe('internshipLifecycle', () => {
  describe('validateInternshipTransition', () => {
    it('allows valid internship transitions', () => {
      const valid = [
        { from: 'APPLIED', to: 'SHORTLISTED' },
        { from: 'APPLIED', to: 'REJECTED' },
        { from: 'SHORTLISTED', to: 'INTERVIEW_SCHEDULED' },
        { from: 'SHORTLISTED', to: 'SELECTED' },
        { from: 'SHORTLISTED', to: 'REJECTED' },
        { from: 'INTERVIEW_SCHEDULED', to: 'SELECTED' },
        { from: 'INTERVIEW_SCHEDULED', to: 'REJECTED' },
        { from: 'SELECTED', to: 'INTERNSHIP_STARTED' },
        { from: 'INTERNSHIP_STARTED', to: 'ONGOING' },
      ] as const;
      for (const t of valid) {
        const result = validateInternshipTransition({
          currentStatus: t.from,
          newStatus: t.to,
          opportunityType: 'INTERNSHIP',
        });
        expect(result.valid).toBe(true);
      }
    });

    it('blocks invalid internship transitions', () => {
      const invalid = [
        { from: 'APPLIED', to: 'ONGOING' },
        { from: 'APPLIED', to: 'SELECTED' },
        { from: 'APPLIED', to: 'COMPLETED' as never },
        { from: 'REJECTED', to: 'SELECTED' },
        { from: 'WITHDRAWN', to: 'SHORTLISTED' },
        { from: 'ONGOING', to: 'SHORTLISTED' },
        { from: 'OFFER_ACCEPTED', to: 'SELECTED' },
        { from: 'OFFER_REJECTED', to: 'SELECTED' },
      ];
      for (const t of invalid) {
        const result = validateInternshipTransition({
          currentStatus: t.from as never,
          newStatus: t.to as never,
          opportunityType: 'INTERNSHIP',
        });
        expect(result.valid).toBe(false);
      }
    });

    it('allows SELECTED → OFFER_ACCEPTED for internships', () => {
      const result = validateInternshipTransition({
        currentStatus: 'SELECTED',
        newStatus: 'OFFER_ACCEPTED',
        opportunityType: 'INTERNSHIP',
      });
      expect(result.valid).toBe(true);
    });

    it('allows SELECTED → OFFER_REJECTED for internships', () => {
      const result = validateInternshipTransition({
        currentStatus: 'SELECTED',
        newStatus: 'OFFER_REJECTED',
        opportunityType: 'INTERNSHIP',
      });
      expect(result.valid).toBe(true);
    });

    it('allows SELECTED → OFFER_ACCEPTED for jobs', () => {
      const result = validateInternshipTransition({
        currentStatus: 'SELECTED',
        newStatus: 'OFFER_ACCEPTED',
        opportunityType: 'JOB',
      });
      expect(result.valid).toBe(true);
    });

    it('allows SELECTED → OFFER_REJECTED for jobs', () => {
      const result = validateInternshipTransition({
        currentStatus: 'SELECTED',
        newStatus: 'OFFER_REJECTED',
        opportunityType: 'JOB',
      });
      expect(result.valid).toBe(true);
    });

    it('sets selectedAt when transitioning to SELECTED for internships', () => {
      const result = validateInternshipTransition({
        currentStatus: 'SHORTLISTED',
        newStatus: 'SELECTED',
        opportunityType: 'INTERNSHIP',
      });
      expect(result.valid).toBe(true);
      expect(result.dateUpdates?.selectedAt).toBeDefined();
      expect(result.dateUpdates?.selectedAt).toBeInstanceOf(Date);
    });

    it('sets startedAt when transitioning to INTERNSHIP_STARTED', () => {
      const result = validateInternshipTransition({
        currentStatus: 'SELECTED',
        newStatus: 'INTERNSHIP_STARTED',
        opportunityType: 'INTERNSHIP',
      });
      expect(result.valid).toBe(true);
      expect(result.dateUpdates?.startedAt).toBeInstanceOf(Date);
    });

    it('does not set internship dates for jobs', () => {
      const result = validateInternshipTransition({
        currentStatus: 'APPLIED',
        newStatus: 'SHORTLISTED',
        opportunityType: 'JOB',
      });
      expect(result.valid).toBe(true);
      expect(result.dateUpdates?.selectedAt).toBeUndefined();
    });

    it('allows backward compatibility for job transitions (APPLIED → SELECTED)', () => {
      const result = validateInternshipTransition({
        currentStatus: 'APPLIED',
        newStatus: 'SELECTED',
        opportunityType: 'JOB',
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('validateInternshipDates', () => {
    it('accepts valid date ranges', () => {
      const result = validateInternshipDates({
        startDate: new Date('2026-01-01'),
        expectedEndDate: new Date('2026-06-01'),
      });
      expect(result.valid).toBe(true);
    });

    it('rejects end date before start date', () => {
      const result = validateInternshipDates({
        startDate: new Date('2026-06-01'),
        expectedEndDate: new Date('2026-01-01'),
      });
      expect(result.valid).toBe(false);
    });

    it('rejects end date equal to start date', () => {
      const result = validateInternshipDates({
        startDate: new Date('2026-01-01'),
        expectedEndDate: new Date('2026-01-01'),
      });
      expect(result.valid).toBe(false);
    });

    it('allows missing dates', () => {
      const result = validateInternshipDates({});
      expect(result.valid).toBe(true);
    });
  });

  describe('parseDate', () => {
    it('parses ISO string to Date', () => {
      const d = parseDate('2026-01-01T00:00:00Z');
      expect(d).toBeInstanceOf(Date);
    });

    it('returns the same Date if already a Date', () => {
      const input = new Date('2026-01-01');
      const d = parseDate(input);
      expect(d).toBe(input);
    });

    it('returns null for invalid input', () => {
      expect(parseDate('not a date')).toBe(null);
      expect(parseDate(undefined)).toBe(null);
      expect(parseDate(null)).toBe(null);
    });
  });

  describe('isTerminalStatus', () => {
    it('correctly identifies terminal statuses', () => {
      expect(isTerminalStatus('REJECTED')).toBe(true);
      expect(isTerminalStatus('WITHDRAWN')).toBe(true);
      expect(isTerminalStatus('COMPLETED')).toBe(true);
      expect(isTerminalStatus('OFFER_ACCEPTED')).toBe(true);
      expect(isTerminalStatus('OFFER_REJECTED')).toBe(true);
    });

    it('correctly identifies non-terminal statuses (Phase 5B: ONGOING is not terminal — it can transition to COMPLETED)', () => {
      expect(isTerminalStatus('APPLIED')).toBe(false);
      expect(isTerminalStatus('SELECTED')).toBe(false);
      expect(isTerminalStatus('INTERNSHIP_STARTED')).toBe(false);
      expect(isTerminalStatus('ONGOING')).toBe(false);
    });
  });

  describe('isInternshipStatus', () => {
    it('identifies internship-specific statuses', () => {
      expect(isInternshipStatus('INTERNSHIP_STARTED')).toBe(true);
      expect(isInternshipStatus('ONGOING')).toBe(true);
    });

    it('returns false for other statuses', () => {
      expect(isInternshipStatus('APPLIED')).toBe(false);
      expect(isInternshipStatus('SELECTED')).toBe(false);
      expect(isInternshipStatus('SHORTLISTED')).toBe(false);
    });
  });

  describe('transition maps', () => {
    it('INTERNSHIP_TRANSITIONS has all statuses', () => {
      for (const status of [
        'APPLIED',
        'UNDER_REVIEW',
        'SHORTLISTED',
        'INTERVIEW_SCHEDULED',
        'SELECTED',
        'REJECTED',
        'WITHDRAWN',
        'INTERNSHIP_STARTED',
        'ONGOING',
        'COMPLETED',
        'OFFER_ACCEPTED',
        'OFFER_REJECTED',
      ]) {
        expect(INTERNSHIP_TRANSITIONS).toHaveProperty(status);
      }
    });

    it('JOB_TRANSITIONS has all statuses', () => {
      for (const status of [
        'APPLIED',
        'UNDER_REVIEW',
        'SHORTLISTED',
        'INTERVIEW_SCHEDULED',
        'SELECTED',
        'REJECTED',
        'WITHDRAWN',
        'INTERNSHIP_STARTED',
        'ONGOING',
        'COMPLETED',
        'OFFER_ACCEPTED',
        'OFFER_REJECTED',
      ]) {
        expect(JOB_TRANSITIONS).toHaveProperty(status);
      }
    });

    it('Terminal states have no further transitions', () => {
      expect(INTERNSHIP_TRANSITIONS.REJECTED).toHaveLength(0);
      expect(INTERNSHIP_TRANSITIONS.WITHDRAWN).toHaveLength(0);
      expect(INTERNSHIP_TRANSITIONS.COMPLETED).toHaveLength(0);
      // Phase 7B: OFFER_ACCEPTED can transition to COMPLETED (placement completion).
      expect(INTERNSHIP_TRANSITIONS.OFFER_ACCEPTED).toContain('COMPLETED');
      expect(INTERNSHIP_TRANSITIONS.OFFER_REJECTED).toHaveLength(0);
      // Phase 5B: ONGOING can still transition to COMPLETED
      expect(INTERNSHIP_TRANSITIONS.ONGOING).toContain('COMPLETED');
    });

    it('SELECTED can transition to OFFER_ACCEPTED and OFFER_REJECTED for jobs', () => {
      expect(JOB_TRANSITIONS.SELECTED).toContain('OFFER_ACCEPTED');
      expect(JOB_TRANSITIONS.SELECTED).toContain('OFFER_REJECTED');
    });

    it('SELECTED can transition to OFFER_ACCEPTED and OFFER_REJECTED for internships', () => {
      expect(INTERNSHIP_TRANSITIONS.SELECTED).toContain('OFFER_ACCEPTED');
      expect(INTERNSHIP_TRANSITIONS.SELECTED).toContain('OFFER_REJECTED');
    });
  });
});

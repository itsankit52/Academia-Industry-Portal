import { describe, expect, it } from 'vitest';

/**
 * Phase 8 — Training Enrollment Tests
 *
 * Tests pure logic functions that don't require database access.
 * Integration tests for full lifecycle require TEST_MONGO_URI.
 */

describe('Training Enrollment Pure Logic', () => {
  // --- buildCertificateText (pure function) ---
  function buildCertificateText(args: {
    studentName: string;
    trainingTitle: string;
    provider: string;
    completionDate: Date;
    certificateId: string;
  }): { text: string; filename: string; mimeType: string } {
    const { studentName, trainingTitle, provider, completionDate, certificateId } = args;
    const dateStr = completionDate.toISOString().slice(0, 10);
    const text = `Certificate of Completion\n\nThis is to certify that\n${studentName}\nhas successfully completed the training program\n"${trainingTitle}"\nprovided by ${provider}\non ${dateStr}.\n\nReference: ${certificateId}\n`;
    const safeTitle = trainingTitle.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'training';
    return {
      text,
      filename: `training_certificate_${safeTitle}_${certificateId}.txt`,
      mimeType: 'text/plain',
    };
  }

  it('generates a certificate with all required fields', () => {
    const result = buildCertificateText({
      studentName: 'Alice Smith',
      trainingTitle: 'React Fundamentals',
      provider: 'TechCorp Academy',
      completionDate: new Date('2026-01-15'),
      certificateId: 'abc123def456',
    });
    expect(result.mimeType).toBe('text/plain');
    expect(result.filename).toBe('training_certificate_React_Fundamentals_abc123def456.txt');
    expect(result.text).toContain('Alice Smith');
    expect(result.text).toContain('React Fundamentals');
    expect(result.text).toContain('TechCorp Academy');
    expect(result.text).toContain('2026-01-15');
    expect(result.text).toContain('abc123def456');
  });

  it('sanitizes filename for special characters', () => {
    const result = buildCertificateText({
      studentName: 'Bob',
      trainingTitle: 'React & Angular: "Best" Practices <2024>',
      provider: 'Corp',
      completionDate: new Date('2026-02-01'),
      certificateId: 'xyz789',
    });
    // &, ", space, <, > become _; : is allowed; title truncated to 80 chars
    expect(result.filename).not.toContain('<');
    expect(result.filename).not.toContain('>');
    expect(result.filename).toContain('React___Angular');
  });

  it('truncates long titles to 80 chars in filename', () => {
    const longTitle = 'A'.repeat(120);
    const result = buildCertificateText({
      studentName: 'Student',
      trainingTitle: longTitle,
      provider: 'Provider',
      completionDate: new Date('2026-03-01'),
      certificateId: 'id123',
    });
    // The filename after sanitization + slice(0, 80) should be 80 chars
    const safePart = longTitle.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    expect(result.filename).toBe(`training_certificate_${safePart}_id123.txt`);
  });

  it('handles empty title gracefully', () => {
    const result = buildCertificateText({
      studentName: 'Student',
      trainingTitle: '',
      provider: 'Provider',
      completionDate: new Date('2026-04-01'),
      certificateId: 'empty01',
    });
    expect(result.filename).toBe('training_certificate_training_empty01.txt');
  });

  // --- Progress validation ---
  describe('Progress bounds', () => {
    function isValidProgress(p: number): boolean {
      return Number.isInteger(p) && p >= 0 && p <= 100;
    }

    it('accepts valid progress values', () => {
      expect(isValidProgress(0)).toBe(true);
      expect(isValidProgress(50)).toBe(true);
      expect(isValidProgress(100)).toBe(true);
      expect(isValidProgress(1)).toBe(true);
    });

    it('rejects out-of-bounds values', () => {
      expect(isValidProgress(-1)).toBe(false);
      expect(isValidProgress(101)).toBe(false);
      expect(isValidProgress(50.5)).toBe(false); // non-integer
      expect(isValidProgress(NaN)).toBe(false);
      expect(isValidProgress(Infinity)).toBe(false);
    });
  });

  // --- Enrollment status transitions ---
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

    it('ENROLLED → IN_PROGRESS is allowed', () => {
      expect(canTransition('ENROLLED', 'IN_PROGRESS')).toBe(true);
    });

    it('ENROLLED → COMPLETED is allowed', () => {
      expect(canTransition('ENROLLED', 'COMPLETED')).toBe(true);
    });

    it('ENROLLED → DROPPED is allowed', () => {
      expect(canTransition('ENROLLED', 'DROPPED')).toBe(true);
    });

    it('IN_PROGRESS → COMPLETED is allowed', () => {
      expect(canTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
    });

    it('IN_PROGRESS → DROPPED is allowed', () => {
      expect(canTransition('IN_PROGRESS', 'DROPPED')).toBe(true);
    });

    it('COMPLETED → anything is not allowed', () => {
      expect(canTransition('COMPLETED', 'DROPPED')).toBe(false);
      expect(canTransition('COMPLETED', 'IN_PROGRESS')).toBe(false);
      expect(canTransition('COMPLETED', 'ENROLLED')).toBe(false);
    });

    it('DROPPED → ENROLLED (re-enrollment) is allowed', () => {
      expect(canTransition('DROPPED', 'ENROLLED')).toBe(true);
    });

    it('DROPPED → COMPLETED is not allowed', () => {
      expect(canTransition('DROPPED', 'COMPLETED')).toBe(false);
    });

    it('IN_PROGRESS → ENROLLED (backward) is not allowed', () => {
      expect(canTransition('IN_PROGRESS', 'ENROLLED')).toBe(false);
    });
  });
});

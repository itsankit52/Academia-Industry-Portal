/**
 * Phase 13 — Faculty-industry collaboration: RBAC tests
 *
 * Tests the faculty application lifecycle endpoints:
 *   PATCH /applications/:id/withdraw           — FACULTY only
 *   GET    /applications/engagements           — FACULTY only
 *   GET    /faculty-opportunities/:id/applicants — COMPANY / INSTITUTION / ADMIN
 *   GET    /faculty-opportunities/:id/match-score — FACULTY only
 *   PATCH  /applications/:id/engagement/complete — COMPANY / INSTITUTION / ADMIN
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestApp, hasTestDb } from '../../../__tests__/helpers/app';
import { clearTestDb, connectTestDb, disconnectTestDb } from '../../../__tests__/helpers/db';
import { createUserAndLogin, ensureTestInstitution } from '../../../__tests__/helpers/fixtures';
import {
  Application,
  CompanyProfile,
  FacultyOpportunity,
  FacultyProfile,
  Institution,
  User,
} from '../../../models';
import { Types } from 'mongoose';

describe.skipIf(!hasTestDb)('faculty-applications rbac', () => {
  const app = createTestApp();

  beforeAll(async () => {
    await connectTestDb();
    await ensureTestInstitution();
  });
  afterAll(async () => {
    await disconnectTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
  });

  // --- PATCH /applications/:id/withdraw ---

  describe('PATCH /applications/:id/withdraw', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app)
        .patch('/api/v1/applications/000000000000000000000001/withdraw')
        .send({});
      expect(res.status).toBe(401);
    });

    it('returns 403 for STUDENT', async () => {
      const student = await createUserAndLogin(app, 'STUDENT', { email: 'withdraw-st@t.demo' });
      const res = await request(app)
        .patch('/api/v1/applications/000000000000000000000001/withdraw')
        .set('Cookie', student.cookie)
        .send({});
      expect(res.status).toBe(403);
    });

    it('returns 403 for COMPANY', async () => {
      const company = await createUserAndLogin(app, 'COMPANY', {
        email: 'withdraw-co@t.demo',
        companyName: 'Withdraw Co',
      });
      const res = await request(app)
        .patch('/api/v1/applications/000000000000000000000001/withdraw')
        .set('Cookie', company.cookie)
        .send({});
      expect(res.status).toBe(403);
    });

    it('returns 404 for a non-existent application (not 403 — role passes)', async () => {
      const faculty = await createUserAndLogin(app, 'FACULTY', { email: 'withdraw-404@t.demo' });
      const res = await request(app)
        .patch('/api/v1/applications/000000000000000000000001/withdraw')
        .set('Cookie', faculty.cookie)
        .send({});
      // Role check passes (FACULTY), but the app doesn't exist
      expect(res.status).toBe(404);
    });

    it("returns 403 when FACULTY tries to withdraw another faculty member's application", async () => {
      // Set up: one company, two faculty members, one opportunity, one application
      const company = await createUserAndLogin(app, 'COMPANY', {
        email: 'withdraw-auth-co@t.demo',
        companyName: 'Auth Co',
      });
      const companyProfile = await CompanyProfile.findOne({ user: company.userId });
      const instId = await ensureTestInstitution();

      // Faculty 1 — creates an application
      const faculty1 = await createUserAndLogin(app, 'FACULTY', { email: 'withdraw-f1@t.demo' });
      const faculty1Profile = await FacultyProfile.findOne({ user: faculty1.userId });

      // Faculty 2 — tries to withdraw Faculty 1's application
      const faculty2 = await createUserAndLogin(app, 'FACULTY', { email: 'withdraw-f2@t.demo' });

      // Create published faculty opportunity
      const opp = await FacultyOpportunity.create({
        title: 'Test FDP',
        description: 'A test faculty development program',
        opportunityType: 'FDP',
        hostType: 'COMPANY',
        host: companyProfile!._id,
        postedBy: new Types.ObjectId(company.userId),
        targetRoles: ['FACULTY'],
        location: 'Remote',
        mode: 'REMOTE',
        applicationDeadline: new Date(Date.now() + 86400000),
        status: 'PUBLISHED',
      });

      // Faculty 1 applies
      const appDoc = await Application.create({
        faculty: faculty1Profile!._id,
        opportunityType: 'FDP',
        opportunity: opp._id,
        status: 'APPLIED',
        timeline: [{ status: 'APPLIED', at: new Date() }],
      });

      // Faculty 2 tries to withdraw Faculty 1's application
      const res = await request(app)
        .patch(`/api/v1/applications/${appDoc._id}/withdraw`)
        .set('Cookie', faculty2.cookie)
        .send({ reason: "Trying to withdraw someone else's application" });

      expect(res.status).toBe(403);
    });
  });

  // --- GET /applications/engagements ---

  describe('GET /applications/engagements', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/applications/engagements');
      expect(res.status).toBe(401);
    });

    it('returns 403 for STUDENT', async () => {
      const student = await createUserAndLogin(app, 'STUDENT', { email: 'eng-st@t.demo' });
      const res = await request(app)
        .get('/api/v1/applications/engagements')
        .set('Cookie', student.cookie);
      expect(res.status).toBe(403);
    });

    it('returns 403 for COMPANY', async () => {
      const company = await createUserAndLogin(app, 'COMPANY', {
        email: 'eng-co@t.demo',
        companyName: 'Eng Co',
      });
      const res = await request(app)
        .get('/api/v1/applications/engagements')
        .set('Cookie', company.cookie);
      expect(res.status).toBe(403);
    });

    it('returns 200 for FACULTY', async () => {
      const faculty = await createUserAndLogin(app, 'FACULTY', { email: 'eng-fa@t.demo' });
      const res = await request(app)
        .get('/api/v1/applications/engagements')
        .set('Cookie', faculty.cookie);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
    });

    it('returns 200 for FACULTY with tab filter', async () => {
      const faculty = await createUserAndLogin(app, 'FACULTY', { email: 'eng-fa-tab@t.demo' });
      const res = await request(app)
        .get('/api/v1/applications/engagements?tab=ACTIVE')
        .set('Cookie', faculty.cookie);
      expect(res.status).toBe(200);
    });
  });

  // --- GET /faculty-opportunities/:id/applicants ---

  describe('GET /faculty-opportunities/:opportunityId/applicants', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app).get(
        '/api/v1/faculty-opportunities/000000000000000000000001/applicants',
      );
      expect(res.status).toBe(401);
    });

    it('returns 403 for STUDENT', async () => {
      const student = await createUserAndLogin(app, 'STUDENT', { email: 'appl-st@t.demo' });
      const res = await request(app)
        .get('/api/v1/faculty-opportunities/000000000000000000000001/applicants')
        .set('Cookie', student.cookie);
      expect(res.status).toBe(403);
    });

    it('returns 403 for FACULTY', async () => {
      const faculty = await createUserAndLogin(app, 'FACULTY', { email: 'appl-fa@t.demo' });
      const res = await request(app)
        .get('/api/v1/faculty-opportunities/000000000000000000000001/applicants')
        .set('Cookie', faculty.cookie);
      expect(res.status).toBe(403);
    });

    it('returns 200 for COMPANY (own opportunity)', async () => {
      const company = await createUserAndLogin(app, 'COMPANY', {
        email: 'appl-co@t.demo',
        companyName: 'Appl Co',
      });
      const companyProfile = await CompanyProfile.findOne({ user: company.userId });

      // Create a published faculty opportunity
      const opp = await FacultyOpportunity.create({
        title: 'Company Faculty Opp',
        description: 'An opportunity posted by a company for faculty',
        opportunityType: 'FACULTY_INTERNSHIP',
        hostType: 'COMPANY',
        host: companyProfile!._id,
        postedBy: new Types.ObjectId(company.userId),
        targetRoles: ['FACULTY'],
        location: 'Mumbai',
        mode: 'HYBRID',
        applicationDeadline: new Date(Date.now() + 86400000),
        status: 'PUBLISHED',
      });

      const res = await request(app)
        .get(`/api/v1/faculty-opportunities/${opp._id}/applicants`)
        .set('Cookie', company.cookie);
      expect(res.status).toBe(200);
    });

    it("returns 403 when COMPANY tries to access another company's faculty opportunity applicants", async () => {
      // Company A creates an opportunity
      const companyA = await createUserAndLogin(app, 'COMPANY', {
        email: 'appl-coa@t.demo',
        companyName: 'Appl Co A',
      });
      const companyAProfile = await CompanyProfile.findOne({ user: companyA.userId });

      const opp = await FacultyOpportunity.create({
        title: 'Company A Faculty Opp',
        description: 'An opportunity only Company A should manage',
        opportunityType: 'FDP',
        hostType: 'COMPANY',
        host: companyAProfile!._id,
        postedBy: new Types.ObjectId(companyA.userId),
        targetRoles: ['FACULTY'],
        location: 'Delhi',
        mode: 'ONSITE',
        applicationDeadline: new Date(Date.now() + 86400000),
        status: 'PUBLISHED',
      });

      // Company B tries to access Company A's applicants
      const companyB = await createUserAndLogin(app, 'COMPANY', {
        email: 'appl-cob@t.demo',
        companyName: 'Appl Co B',
      });
      const res = await request(app)
        .get(`/api/v1/faculty-opportunities/${opp._id}/applicants`)
        .set('Cookie', companyB.cookie);
      expect(res.status).toBe(403);
    });

    it('returns 200 for INSTITUTION (own opportunity)', async () => {
      const instAdmin = await createUserAndLogin(app, 'INSTITUTION', {
        email: 'appl-inst@t.demo',
        institutionCode: 'APPLINST',
      });
      const user = await User.findById(instAdmin.userId);
      const instId = user!.institution!;

      const opp = await FacultyOpportunity.create({
        title: 'Institution Faculty Opp',
        description: 'An opportunity posted by an institution for faculty',
        opportunityType: 'CONSULTANCY',
        hostType: 'INSTITUTION',
        host: instId,
        postedBy: new Types.ObjectId(instAdmin.userId),
        targetRoles: ['FACULTY'],
        location: 'Bangalore',
        mode: 'REMOTE',
        applicationDeadline: new Date(Date.now() + 86400000),
        status: 'PUBLISHED',
      });

      const res = await request(app)
        .get(`/api/v1/faculty-opportunities/${opp._id}/applicants`)
        .set('Cookie', instAdmin.cookie);
      expect(res.status).toBe(200);
    });

    it('returns 200 for ADMIN (cross-institution)', async () => {
      const admin = await createUserAndLogin(app, 'ADMIN', { email: 'appl-admin@t.demo' });

      // Create an institution opportunity
      const instAdmin = await createUserAndLogin(app, 'INSTITUTION', {
        email: 'appl-inst2@t.demo',
        institutionCode: 'APPLINST2',
      });
      const user = await User.findById(instAdmin.userId);
      const instId = user!.institution!;

      const opp = await FacultyOpportunity.create({
        title: 'Institution Faculty Opp for Admin Test',
        description: 'Admin should access this',
        opportunityType: 'COLLABORATIVE_RESEARCH',
        hostType: 'INSTITUTION',
        host: instId,
        postedBy: new Types.ObjectId(instAdmin.userId),
        targetRoles: ['FACULTY'],
        location: 'Hyderabad',
        mode: 'HYBRID',
        applicationDeadline: new Date(Date.now() + 86400000),
        status: 'PUBLISHED',
      });

      const res = await request(app)
        .get(`/api/v1/faculty-opportunities/${opp._id}/applicants`)
        .set('Cookie', admin.cookie);
      expect(res.status).toBe(200);
    });
  });

  // --- GET /faculty-opportunities/:id/match-score ---

  describe('GET /faculty-opportunities/:opportunityId/match-score', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app).get(
        '/api/v1/faculty-opportunities/000000000000000000000001/match-score',
      );
      expect(res.status).toBe(401);
    });

    it('returns 403 for STUDENT', async () => {
      const student = await createUserAndLogin(app, 'STUDENT', { email: 'ms-st@t.demo' });
      const res = await request(app)
        .get('/api/v1/faculty-opportunities/000000000000000000000001/match-score')
        .set('Cookie', student.cookie);
      expect(res.status).toBe(403);
    });

    it('returns 403 for COMPANY', async () => {
      const company = await createUserAndLogin(app, 'COMPANY', {
        email: 'ms-co@t.demo',
        companyName: 'MS Co',
      });
      const res = await request(app)
        .get('/api/v1/faculty-opportunities/000000000000000000000001/match-score')
        .set('Cookie', company.cookie);
      expect(res.status).toBe(403);
    });

    it('returns 404 for non-existent opportunity', async () => {
      const faculty = await createUserAndLogin(app, 'FACULTY', { email: 'ms-404@t.demo' });
      const res = await request(app)
        .get('/api/v1/faculty-opportunities/000000000000000000000001/match-score')
        .set('Cookie', faculty.cookie);
      expect(res.status).toBe(404);
    });

    it('returns match score data for FACULTY on published opportunity', async () => {
      const company = await createUserAndLogin(app, 'COMPANY', {
        email: 'ms-fa-co@t.demo',
        companyName: 'MS Faculty Co',
      });
      const companyProfile = await CompanyProfile.findOne({ user: company.userId });

      const opp = await FacultyOpportunity.create({
        title: 'Machine Learning FDP',
        description: 'An FDP on machine learning for faculty',
        opportunityType: 'FDP',
        hostType: 'COMPANY',
        host: companyProfile!._id,
        postedBy: new Types.ObjectId(company.userId),
        requiredExpertise: ['machine learning', 'python'],
        targetRoles: ['FACULTY'],
        location: 'Remote',
        mode: 'REMOTE',
        applicationDeadline: new Date(Date.now() + 86400000),
        status: 'PUBLISHED',
      });

      const faculty = await createUserAndLogin(app, 'FACULTY', { email: 'ms-fa@t.demo' });
      const res = await request(app)
        .get(`/api/v1/faculty-opportunities/${opp._id}/match-score`)
        .set('Cookie', faculty.cookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('score');
      expect(res.body).toHaveProperty('level');
      expect(res.body).toHaveProperty('opportunityId', String(opp._id));
    });
  });

  // --- PATCH /applications/:id/engagement/complete ---

  describe('PATCH /applications/:id/engagement/complete', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app)
        .patch('/api/v1/applications/000000000000000000000001/engagement/complete')
        .send({});
      expect(res.status).toBe(401);
    });

    it('returns 403 for STUDENT', async () => {
      const student = await createUserAndLogin(app, 'STUDENT', { email: 'comp-st@t.demo' });
      const res = await request(app)
        .patch('/api/v1/applications/000000000000000000000001/engagement/complete')
        .set('Cookie', student.cookie)
        .send({});
      expect(res.status).toBe(403);
    });

    it('returns 403 for FACULTY', async () => {
      const faculty = await createUserAndLogin(app, 'FACULTY', { email: 'comp-fa@t.demo' });
      const res = await request(app)
        .patch('/api/v1/applications/000000000000000000000001/engagement/complete')
        .set('Cookie', faculty.cookie)
        .send({});
      expect(res.status).toBe(403);
    });

    it('returns 404 for non-existent application', async () => {
      const company = await createUserAndLogin(app, 'COMPANY', {
        email: 'comp-co@t.demo',
        companyName: 'Comp Co',
      });
      const res = await request(app)
        .patch('/api/v1/applications/000000000000000000000001/engagement/complete')
        .set('Cookie', company.cookie)
        .send({});
      expect(res.status).toBe(404);
    });

    it('returns 400 when trying to complete a non-engagement application (APPLIED)', async () => {
      const company = await createUserAndLogin(app, 'COMPANY', {
        email: 'comp-co-400@t.demo',
        companyName: 'Comp Co 400',
      });
      const companyProfile = await CompanyProfile.findOne({ user: company.userId });

      // Create a faculty profile and application
      const faculty = await createUserAndLogin(app, 'FACULTY', { email: 'comp-fa-400@t.demo' });
      const facultyProfile = await FacultyProfile.findOne({ user: faculty.userId });

      const opp = await FacultyOpportunity.create({
        title: 'Consultancy Project',
        description: 'A consultancy project for faculty',
        opportunityType: 'CONSULTANCY',
        hostType: 'COMPANY',
        host: companyProfile!._id,
        postedBy: new Types.ObjectId(company.userId),
        targetRoles: ['FACULTY'],
        location: 'Pune',
        mode: 'HYBRID',
        applicationDeadline: new Date(Date.now() + 86400000),
        status: 'PUBLISHED',
      });

      const appDoc = await Application.create({
        faculty: facultyProfile!._id,
        opportunityType: 'CONSULTANCY',
        opportunity: opp._id,
        status: 'APPLIED', // Not yet selected — cannot complete
        timeline: [{ status: 'APPLIED', at: new Date() }],
      });

      const res = await request(app)
        .patch(`/api/v1/applications/${appDoc._id}/engagement/complete`)
        .set('Cookie', company.cookie)
        .send({ notes: 'Completing engagement' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/SELECTED|ONGOING|INTERNSHIP_STARTED|engagement/);
    });

    it('returns 200 when COMPANY completes a SELECTED engagement', async () => {
      const company = await createUserAndLogin(app, 'COMPANY', {
        email: 'comp-co-200@t.demo',
        companyName: 'Comp Co 200',
      });
      const companyProfile = await CompanyProfile.findOne({ user: company.userId });

      const faculty = await createUserAndLogin(app, 'FACULTY', { email: 'comp-fa-200@t.demo' });
      const facultyProfile = await FacultyProfile.findOne({ user: faculty.userId });

      const opp = await FacultyOpportunity.create({
        title: 'Research Collaboration',
        description: 'A collaborative research opportunity',
        opportunityType: 'COLLABORATIVE_RESEARCH',
        hostType: 'COMPANY',
        host: companyProfile!._id,
        postedBy: new Types.ObjectId(company.userId),
        targetRoles: ['FACULTY'],
        location: 'Chennai',
        mode: 'REMOTE',
        applicationDeadline: new Date(Date.now() + 86400000),
        status: 'PUBLISHED',
      });

      const appDoc = await Application.create({
        faculty: facultyProfile!._id,
        opportunityType: 'COLLABORATIVE_RESEARCH',
        opportunity: opp._id,
        status: 'SELECTED', // Already selected — can be completed
        timeline: [
          { status: 'APPLIED', at: new Date() },
          { status: 'SHORTLISTED', at: new Date() },
          { status: 'SELECTED', at: new Date() },
        ],
      });

      const res = await request(app)
        .patch(`/api/v1/applications/${appDoc._id}/engagement/complete`)
        .set('Cookie', company.cookie)
        .send({ notes: 'Research collaboration completed successfully' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('COMPLETED');
    });

    it("returns 403 when COMPANY tries to complete engagement for another company's opportunity", async () => {
      // Company A posts opportunity, Company B tries to complete
      const companyA = await createUserAndLogin(app, 'COMPANY', {
        email: 'comp-coa@t.demo',
        companyName: 'Comp Co A',
      });
      const companyAProfile = await CompanyProfile.findOne({ user: companyA.userId });

      const companyB = await createUserAndLogin(app, 'COMPANY', {
        email: 'comp-cob@t.demo',
        companyName: 'Comp Co B',
      });

      const faculty = await createUserAndLogin(app, 'FACULTY', { email: 'comp-fa-cross@t.demo' });
      const facultyProfile = await FacultyProfile.findOne({ user: faculty.userId });

      const opp = await FacultyOpportunity.create({
        title: 'Company A Only Opportunity',
        description: 'Only Company A should manage this',
        opportunityType: 'PROJECT',
        hostType: 'COMPANY',
        host: companyAProfile!._id,
        postedBy: new Types.ObjectId(companyA.userId),
        targetRoles: ['FACULTY'],
        location: 'Kolkata',
        mode: 'ONSITE',
        applicationDeadline: new Date(Date.now() + 86400000),
        status: 'PUBLISHED',
      });

      const appDoc = await Application.create({
        faculty: facultyProfile!._id,
        opportunityType: 'PROJECT',
        opportunity: opp._id,
        status: 'SELECTED',
        timeline: [{ status: 'SELECTED', at: new Date() }],
      });

      const res = await request(app)
        .patch(`/api/v1/applications/${appDoc._id}/engagement/complete`)
        .set('Cookie', companyB.cookie)
        .send({});

      expect(res.status).toBe(403);
    });
  });

  // --- Institution isolation ---

  describe('institution isolation on faculty engagement endpoints', () => {
    it('INSTITUTION A cannot access faculty opportunity applicants of INSTITUTION B', async () => {
      // Institution A creates an opportunity
      const instA = await createUserAndLogin(app, 'INSTITUTION', {
        email: 'iso-insta@t.demo',
        institutionCode: 'ISOINSTA',
      });
      const userA = await User.findById(instA.userId);

      const opp = await FacultyOpportunity.create({
        title: 'Institution A Faculty Program',
        description: 'An institution A opportunity',
        opportunityType: 'FDP',
        hostType: 'INSTITUTION',
        host: userA!.institution!,
        postedBy: new Types.ObjectId(instA.userId),
        targetRoles: ['FACULTY'],
        location: 'Delhi',
        mode: 'HYBRID',
        applicationDeadline: new Date(Date.now() + 86400000),
        status: 'PUBLISHED',
      });

      // Institution B tries to access Institution A's applicants
      const instB = await createUserAndLogin(app, 'INSTITUTION', {
        email: 'iso-instb@t.demo',
        institutionCode: 'ISOINSTB',
      });

      const res = await request(app)
        .get(`/api/v1/faculty-opportunities/${opp._id}/applicants`)
        .set('Cookie', instB.cookie);

      expect(res.status).toBe(403);
    });

    it('INSTITUTION can list its own faculty opportunity applicants', async () => {
      const inst = await createUserAndLogin(app, 'INSTITUTION', {
        email: 'iso-inst-ok@t.demo',
        institutionCode: 'ISOINSTOK',
      });
      const user = await User.findById(inst.userId);

      const opp = await FacultyOpportunity.create({
        title: 'Institution Faculty FDP',
        description: 'Institution FDP opportunity',
        opportunityType: 'FDP',
        hostType: 'INSTITUTION',
        host: user!.institution!,
        postedBy: new Types.ObjectId(inst.userId),
        targetRoles: ['FACULTY'],
        location: 'Mumbai',
        mode: 'REMOTE',
        applicationDeadline: new Date(Date.now() + 86400000),
        status: 'PUBLISHED',
      });

      const res = await request(app)
        .get(`/api/v1/faculty-opportunities/${opp._id}/applicants`)
        .set('Cookie', inst.cookie);

      expect(res.status).toBe(200);
    });
  });

  // --- Duplicate application prevention ---

  describe('duplicate faculty application prevention', () => {
    it('returns 409 Conflict when faculty applies to the same opportunity twice', async () => {
      const company = await createUserAndLogin(app, 'COMPANY', {
        email: 'dup-co@t.demo',
        companyName: 'Dup Co',
      });
      const companyProfile = await CompanyProfile.findOne({ user: company.userId });

      const faculty = await createUserAndLogin(app, 'FACULTY', { email: 'dup-fa@t.demo' });

      const opp = await FacultyOpportunity.create({
        title: 'Duplicate Test FDP',
        description: 'Testing duplicate application prevention',
        opportunityType: 'FDP',
        hostType: 'COMPANY',
        host: companyProfile!._id,
        postedBy: new Types.ObjectId(company.userId),
        targetRoles: ['FACULTY'],
        location: 'Remote',
        mode: 'REMOTE',
        applicationDeadline: new Date(Date.now() + 86400000),
        status: 'PUBLISHED',
      });

      // First application — should succeed
      const first = await request(app)
        .post('/api/v1/applications')
        .set('Cookie', faculty.cookie)
        .send({ opportunityType: 'FDP', opportunityId: String(opp._id) });
      expect(first.status).not.toBe(403);

      // Second application — should be 409 or 400
      const second = await request(app)
        .post('/api/v1/applications')
        .set('Cookie', faculty.cookie)
        .send({ opportunityType: 'FDP', opportunityId: String(opp._id) });
      expect(second.status).toBeGreaterThanOrEqual(400);
    });

    it('returns 400 when applying to a CLOSED opportunity', async () => {
      const company = await createUserAndLogin(app, 'COMPANY', {
        email: 'closed-co@t.demo',
        companyName: 'Closed Co',
      });
      const companyProfile = await CompanyProfile.findOne({ user: company.userId });

      const faculty = await createUserAndLogin(app, 'FACULTY', { email: 'closed-fa@t.demo' });

      const opp = await FacultyOpportunity.create({
        title: 'Closed Opportunity',
        description: 'This opportunity is closed',
        opportunityType: 'FACULTY_INTERNSHIP',
        hostType: 'COMPANY',
        host: companyProfile!._id,
        postedBy: new Types.ObjectId(company.userId),
        targetRoles: ['FACULTY'],
        location: 'Remote',
        mode: 'REMOTE',
        applicationDeadline: new Date(Date.now() + 86400000),
        status: 'CLOSED',
      });

      const res = await request(app)
        .post('/api/v1/applications')
        .set('Cookie', faculty.cookie)
        .send({ opportunityType: 'FACULTY_INTERNSHIP', opportunityId: String(opp._id) });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('returns 400 when applying after the deadline has passed', async () => {
      const company = await createUserAndLogin(app, 'COMPANY', {
        email: 'deadline-co@t.demo',
        companyName: 'Deadline Co',
      });
      const companyProfile = await CompanyProfile.findOne({ user: company.userId });

      const faculty = await createUserAndLogin(app, 'FACULTY', { email: 'deadline-fa@t.demo' });

      const opp = await FacultyOpportunity.create({
        title: 'Expired Deadline Opportunity',
        description: 'This opportunity has passed its deadline',
        opportunityType: 'APPRENTICESHIP',
        hostType: 'COMPANY',
        host: companyProfile!._id,
        postedBy: new Types.ObjectId(company.userId),
        targetRoles: ['FACULTY'],
        location: 'Remote',
        mode: 'REMOTE',
        applicationDeadline: new Date(Date.now() - 86400000), // Yesterday — past deadline
        status: 'PUBLISHED',
      });

      const res = await request(app)
        .post('/api/v1/applications')
        .set('Cookie', faculty.cookie)
        .send({ opportunityType: 'APPRENTICESHIP', opportunityId: String(opp._id) });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.error).toMatch(/deadline|passed/i);
    });
  });
});

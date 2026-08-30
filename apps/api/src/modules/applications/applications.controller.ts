import type { Request, Response } from 'express';
import type {
  CreateApplicationInput,
  UpdateApplicationStatusInput,
} from '@aip/validation';
import type { ApplicationStatus, OpportunityType, Role } from '@aip/config';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import * as service from './applications.service';

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.createApplication(
    req.user!.id,
    req.user!.role as Role,
    req.body as CreateApplicationInput,
  );
  return created(res, data);
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, unknown>;
  const data = await service.listApplications(
    req.user!.id,
    req.user!.role as Role,
    {
      page: num(q.page),
      pageSize: num(q.pageSize),
      sortBy: str(q.sortBy),
      sortDir: q.sortDir === 'asc' ? 'asc' : 'desc',
    },
    {
      status: str(q.status) as ApplicationStatus | undefined,
      opportunityType: str(q.opportunityType) as OpportunityType | undefined,
    },
  );
  return ok(res, data);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getApplicationById(
    req.user!.id,
    req.user!.role as Role,
    req.params.id!,
  );
  return ok(res, data);
});

export const patchStatus = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.updateStatus(
    req.user!.id,
    req.user!.role as Role,
    req.params.id!,
    req.body as UpdateApplicationStatusInput,
  );
  return ok(res, data);
});

export const countByStatus = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.countByStatus(req.user!.id, req.user!.role as Role);
  return ok(res, data);
});

export const candidate = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getCandidateDetails(req.params.id!, {
    userId: req.user!.id,
    role: req.user!.role as Role,
  });
  return ok(res, data);
});

export const certificate = asyncHandler(async (req: Request, res: Response) => {
  const applicationId = req.params.id!;
  const data = await service.prepareCertificateData(applicationId, {
    userId: req.user!.id,
    role: req.user!.role as Role,
  });

  type PdfDoc = NodeJS.ReadableStream & {
    fontSize: (n: number) => PdfDoc;
    font: (name: string) => PdfDoc;
    text: (s: string, xOrOptions?: number | unknown, y?: number, options?: unknown) => PdfDoc;
    moveDown: (n?: number) => PdfDoc;
    moveTo: (x: number, y: number) => PdfDoc;
    lineTo: (x: number, y: number) => PdfDoc;
    stroke: () => PdfDoc;
    end: () => void;
    pipe: (dest: unknown) => PdfDoc;
  };
  let PdfDocumentCtor: new (options?: unknown) => PdfDoc;
  try {
    const mod = await import('pdfkit');
    PdfDocumentCtor = (mod as { default: typeof PdfDocumentCtor }).default ?? (mod as unknown as typeof PdfDocumentCtor);
  } catch {
    throw AppError.serviceUnavailable('PDF generation is unavailable; install pdfkit and retry');
  }

  const fmtDate = (d: Date): string =>
    d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const doc = new PdfDocumentCtor({ size: 'A4', margin: 60 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="certificate-${applicationId}.pdf"`,
  );
  doc.pipe(res);

  doc.fontSize(28).font('Helvetica-Bold').text('Certificate of Completion', { align: 'center' });
  doc.moveDown(1);
  doc.moveTo(80, 140).lineTo(515, 140).stroke();
  doc.moveDown(3);

  doc.fontSize(14).font('Helvetica').text('This is to certify that', { align: 'center' });
  doc.moveDown(1);
  doc.fontSize(22).font('Helvetica-Bold').text(data.studentName, { align: 'center' });
  doc.moveDown(1);
  doc
    .fontSize(13)
    .font('Helvetica')
    .text(
      `has successfully completed ${data.opportunityTitle} at ${data.hostName} from ${fmtDate(data.startDate)} to ${fmtDate(data.endDate)} totaling ${data.totalHours} hours across ${data.reportCount} interim ${data.reportCount === 1 ? 'report' : 'reports'}.`,
      { align: 'center' },
    );

  doc.moveDown(4);
  doc.moveTo(80, 500).lineTo(250, 500).stroke();
  doc.fontSize(11).font('Helvetica').text('Authorized Signature', 80, 508);

  doc.text(`Issued on ${fmtDate(new Date())}`, 350, 508, { align: 'right' });

  doc.end();
});

const internshipDatesSchema = z.object({
  startDate: z.string().datetime().optional(),
  expectedEndDate: z.string().datetime().optional(),
});

export const setInternshipDates = asyncHandler(async (req: Request, res: Response) => {
  const parsed = internshipDatesSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
  }
  const data = await service.setInternshipDatesForApplication(
    req.user!.id,
    req.user!.role as Role,
    req.params.id!,
    parsed.data,
  );
  return ok(res, data);
});

export const startInternship = asyncHandler(async (req: Request, res: Response) => {
  const parsed = internshipDatesSchema.safeParse(req.body);
  const data = parsed.success ? parsed.data : undefined;
  const result = await service.startInternshipForApplication(
    req.user!.id,
    req.user!.role as Role,
    req.params.id!,
    data,
  );
  return ok(res, result);
});

// --- Phase 6A: Student offer response ---

const offerResponseSchema = z.object({
  response: z.enum(['ACCEPT', 'REJECT']),
});

export const respondToOffer = asyncHandler(async (req: Request, res: Response) => {
  const parsed = offerResponseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: 'Invalid input', details: parsed.error.errors });
  }
  const data = await service.respondToOffer(
    req.user!.id,
    req.user!.role as Role,
    req.params.id!,
    parsed.data.response,
  );
  return ok(res, data);
});

export const markInternshipOngoing = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.markInternshipOngoingForApplication(
    req.user!.id,
    req.user!.role as Role,
    req.params.id!,
  );
  return ok(res, result);
});

// --- Phase 5B: Post-ONGOING lifecycle ---

export const assignMentor = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.assignMentorToApplication(
    req.user!.id,
    req.user!.role as Role,
    req.params.id!,
    req.body,
  );
  return ok(res, data);
});

export const removeMentor = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.removeMentorFromApplication(
    req.user!.id,
    req.user!.role as Role,
    req.params.id!,
  );
  return ok(res, data);
});

export const completeInternship = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.completeInternshipForApplication(
    req.user!.id,
    req.user!.role as Role,
    req.params.id!,
    req.body ?? {},
  );
  return ok(res, result);
});

export const listActiveInterns = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, unknown>;
  const data = await service.listActiveInternsForCompany(
    req.user!.id,
    req.user!.role as Role,
    {
      page: num(q.page),
      pageSize: num(q.pageSize),
      sortBy: str(q.sortBy),
      sortDir: q.sortDir === 'asc' ? 'asc' : 'desc',
    },
  );
  return ok(res, data);
});

export const listMentorAssignedInterns = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, unknown>;
  const data = await service.listAssignedInternsForMentor(req.user!.id, {
    page: num(q.page),
    pageSize: num(q.pageSize),
    sortBy: str(q.sortBy),
    sortDir: q.sortDir === 'asc' ? 'asc' : 'desc',
  });
  return ok(res, data);
});

export const getMentor = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getMentorForApplication(req.params.id!, {
    userId: req.user!.id,
    role: req.user!.role as Role,
  });
  return ok(res, data ?? { message: 'No mentor assigned' });
});

// --- Phase 6B: Offer details, expiry, withdrawal, offer letter ---

const setOfferDetailsSchema = z.object({
  offeredSalary: z.number().min(0).optional(),
  currency: z.string().min(1).max(8).optional(),
  joiningDate: z.string().datetime().optional(),
  offerTerms: z.string().max(5000).optional(),
  offerExpiresAt: z.string().datetime().optional(),
});

export const putOfferDetails = asyncHandler(async (req: Request, res: Response) => {
  const parsed = setOfferDetailsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
  }
  const data = await service.setOfferDetails(
    req.user!.id,
    req.user!.role as Role,
    req.params.id!,
    parsed.data,
  );
  return ok(res, data);
});

const attachOfferLetterSchema = z.object({
  documentId: z.string().min(1),
});

export const attachOfferLetter = asyncHandler(async (req: Request, res: Response) => {
  const parsed = attachOfferLetterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
  }
  const data = await service.attachOfferLetter(
    req.user!.id,
    req.user!.role as Role,
    req.params.id!,
    parsed.data,
  );
  return ok(res, data);
});

const withdrawOfferSchema = z.object({
  reason: z.string().max(1000).optional(),
});

export const requestWithdrawal = asyncHandler(async (req: Request, res: Response) => {
  const parsed = withdrawOfferSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
  }
  const data = await service.requestOfferWithdrawal(
    req.user!.id,
    req.user!.role as Role,
    req.params.id!,
    parsed.data.reason,
  );
  return ok(res, data);
});

export const getOfferLetter = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getOfferLetterForApplication(req.params.id!, {
    userId: req.user!.id,
    role: req.user!.role as Role,
  });
  return ok(res, data);
});

// --- Phase 7B: Placement completion, recruitment source, verification ---

const setRecruitmentSourceSchema = z.object({
  source: z.enum([
    'CAMPUS_DRIVE',
    'JOB_PORTAL',
    'REFERRAL',
    'INTERNSHIP_CONVERSION',
    'COMPANY_WEBSITE',
    'COLLEGE_REFERENCE',
    'OTHER',
  ]),
});

export const putRecruitmentSource = asyncHandler(async (req: Request, res: Response) => {
  const parsed = setRecruitmentSourceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
  }
  const data = await service.setRecruitmentSource(
    req.user!.id,
    req.user!.role as Role,
    req.params.id!,
    parsed.data,
  );
  return ok(res, data);
});

const completePlacementBodySchema = z.object({
  placedAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

export const completePlacement = asyncHandler(async (req: Request, res: Response) => {
  const parsed = completePlacementBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
  }
  const data = await service.completePlacementForApplication(
    req.user!.id,
    req.user!.role as Role,
    req.params.id!,
    parsed.data,
  );
  return ok(res, data);
});

const verifyPlacementBodySchema = z.object({
  status: z.enum(['PENDING', 'VERIFIED', 'REJECTED']).default('VERIFIED'),
  note: z.string().max(2000).optional(),
});

export const verifyPlacement = asyncHandler(async (req: Request, res: Response) => {
  const parsed = verifyPlacementBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
  }
  const data = await service.verifyPlacement(
    req.user!.id,
    req.user!.role as Role,
    req.params.id!,
    parsed.data,
  );
  return ok(res, data);
});

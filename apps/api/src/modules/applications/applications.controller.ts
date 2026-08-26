import type { Request, Response } from 'express';
import type {
  CreateApplicationInput,
  UpdateApplicationStatusInput,
} from '@aip/validation';
import type { ApplicationStatus, OpportunityType, Role } from '@aip/config';
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

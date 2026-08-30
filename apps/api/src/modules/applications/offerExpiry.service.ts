/**
 * Offer Expiry Service
 *
 * Periodically processes expired job/internship offers and transitions them
 * to OFFER_EXPIRED status with timeline entries and notifications.
 */
import type { ApplicationStatus } from '@aip/config';
import { AppError } from '../../utils/AppError';
import { Application, StudentProfile, type ApplicationDoc } from '../../models';
import { createNotification } from '../notifications/notifications.service';
import { logger } from '../../utils/logger';

/**
 * Checks if an application has an expired offer (SELECTED with past offerExpiresAt)
 * @param application The application document to check
 * @returns true if offer is expired
 */
export function isOfferExpired(application: {
  status: ApplicationStatus;
  offerExpiresAt?: Date | null;
}): boolean {
  // Only SELECTED applications can have expiring offers
  if (application.status !== 'SELECTED') return false;
  const deadline = application.offerExpiresAt;
  if (!deadline) return false;
  return deadline.getTime() < Date.now();
}

/**
 * Processes all expired offers in the system.
 * Uses atomic database operations to prevent race conditions and duplicates.
 */
export async function processExpiredOffers(): Promise<void> {
  logger.info({ action: 'processExpiredOffers' }, 'Starting offer expiry processing');

  const now = new Date();

  try {
    // Find all SELECTED applications with expired offer dates
    // Use atomic findOneAndUpdate to transition status in one operation
    // This prevents race conditions where two processors might process the same app
    const expiredApplications = await Application.find({
      status: 'SELECTED',
      offerExpiresAt: { $exists: true, $lt: now },
    }).lean();

    logger.info({
      action: 'processExpiredOffers',
      count: expiredApplications.length
    }, `Found ${expiredApplications.length} expired offers to process`);

    // Process each expired application with atomic update
    for (const app of expiredApplications) {
      try {
        // Atomic update: only succeed if still SELECTED and still expired
        const updatedApp = await Application.findOneAndUpdate(
          {
            _id: app._id,
            status: 'SELECTED', // Double-check status hasn't changed
            offerExpiresAt: { $exists: true, $lt: now }, // Double-check expiry
          },
          {
            $set: { status: 'OFFER_EXPIRED' },
            $push: {
              timeline: {
                status: 'OFFER_EXPIRED',
                at: new Date(),
                note: 'Offer expired automatically after response deadline passed',
              },
            },
          },
          { new: true, lean: true }
        );

        if (!updatedApp) {
          // This means the application was updated by another process
          // (status changed or offer expired) - skip it
          logger.debug({
            action: 'processExpiredOffers',
            applicationId: app._id,
            reason: 'Application no longer eligible for expiry processing'
          });
          continue;
        }

        // Get student profile for notification
        const studentProfile = await StudentProfile.findById(updatedApp.student)
          .populate('user', 'email')
          .lean();

        if (studentProfile?.user) {
          // Create OFFER_EXPIRED notification for the student
          await createNotification(
            String(studentProfile.user._id),
            'OFFER_EXPIRED',
            'Offer has expired',
            'Your placement offer has expired because the response deadline passed. Please contact the company or institution for further information.',
            `/student/applications/${String(updatedApp._id)}`
          );

          logger.info({
            action: 'processExpiredOffers',
            applicationId: updatedApp._id,
            studentId: String(studentProfile._id),
            event: 'offerExpiredNotificationSent'
          });
        }

        logger.info({
          action: 'processExpiredOffers',
          applicationId: updatedApp._id,
          event: 'offerExpiredProcessed'
        });
      } catch (error) {
        // Log individual application errors but continue processing others
        logger.error({
          action: 'processExpiredOffers',
          applicationId: app._id,
          error: error instanceof Error ? error.message : 'Unknown error',
          event: 'offerExpiredProcessingError'
        });
      }
    }

    logger.info({ action: 'processExpiredOffers' }, 'Completed offer expiry processing');
  } catch (error) {
    logger.error({
      action: 'processExpiredOffers',
      error: error instanceof Error ? error.message : 'Unknown error',
      event: 'offerExpiredProcessingFailed'
    });
    // Don't throw - we don't want to crash the server
  }
}
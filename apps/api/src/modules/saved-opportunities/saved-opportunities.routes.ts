import { Router } from 'express';
import { z } from 'zod';
import { OPPORTUNITY_TYPES } from '@aip/config';
import type { OpportunityType } from '@aip/config';
import { idParamSchema, objectIdSchema } from '@aip/validation';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import * as controller from './saved-opportunities.controller';

const opportunityTypeEnum = z.enum(
  OPPORTUNITY_TYPES as unknown as [OpportunityType, ...OpportunityType[]],
);

const saveSchema = z
  .object({
    opportunityType: opportunityTypeEnum,
    opportunityId: objectIdSchema,
  })
  .strict();

const router = Router();

router.use(requireAuth, requireRole('STUDENT'));

router.get('/', controller.list);
router.post('/', validate(saveSchema), controller.save);
router.delete('/by-opportunity', validate(saveSchema), controller.removeByOpportunity);
router.delete('/:id', validate(idParamSchema, 'params'), controller.remove);

export default router;

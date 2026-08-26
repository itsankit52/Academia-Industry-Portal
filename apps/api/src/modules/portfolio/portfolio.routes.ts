import { Router } from 'express';
import { z } from 'zod';
import { objectIdSchema } from '@aip/validation';
import { validate } from '../../middleware/validate';
import * as controller from './portfolio.controller';

const studentIdParamSchema = z.object({ studentId: objectIdSchema }).strict();

const router = Router();

router.get('/:studentId', validate(studentIdParamSchema, 'params'), controller.getPortfolio);

export default router;

import { Router } from 'express';
import * as ctrl from './institutions.controller';

const router = Router();

router.get('/public', ctrl.listPublic);

export default router;

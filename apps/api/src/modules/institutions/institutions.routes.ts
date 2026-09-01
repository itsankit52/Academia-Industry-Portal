import { Router } from 'express';
import * as ctrl from './institutions.controller';

const router = Router();

router.get('/public', ctrl.listPublic);
router.get('/verify-code', ctrl.verifyCode);

export default router;

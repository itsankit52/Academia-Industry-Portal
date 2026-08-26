import { Router } from 'express';
import * as ctrl from './webhooks.controller';

const router = Router();

router.post('/lms/certificate', ctrl.lmsCertificate);
router.post('/erp/students', ctrl.erpStudents);

export default router;

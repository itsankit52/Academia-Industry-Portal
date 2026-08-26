import { Router } from 'express';
import { ok } from '../utils/apiResponse';

const router = Router();

router.get('/', (_req, res) => {
  ok(res, {
    status: 'ok',
    ts: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;

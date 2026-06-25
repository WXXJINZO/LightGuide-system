// 构件文件 / Component-file routes (mounted at /api/components).
import { Router } from 'express';
import { asyncHandler } from '../lib/errors.js';
import { getComponent } from '../services/components.service.js';

export const componentsRouter = Router();

componentsRouter.get('/:id', asyncHandler((req, res) => {
  res.json(getComponent(Number(req.params.id)));
}));

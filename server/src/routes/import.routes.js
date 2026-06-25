// 模型导入 / Model import routes (mounted at /api/import). Accepts an IFC/STEP/
// STP file body and generates projection data (V3 §15).
import { Router } from 'express';
import { asyncHandler, badRequest } from '../lib/errors.js';
import { importModelFile } from '../services/import.service.js';

export const importRouter = Router();

importRouter.post('/', asyncHandler((req, res) => {
  const { filename, content } = req.body || {};
  if (!filename || !content) throw badRequest('filename and content are required');
  res.status(201).json(importModelFile(filename, content));
}));

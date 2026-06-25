// 工程 / Projects routes (mounted at /api/projects).
import { Router } from 'express';
import { asyncHandler } from '../lib/errors.js';
import { listProjects, getProject } from '../services/projects.service.js';

export const projectsRouter = Router();

projectsRouter.get('/', asyncHandler((req, res) => {
  const items = listProjects(req.query.q);
  res.json({ items, total: items.length });
}));

projectsRouter.get('/:id', asyncHandler((req, res) => {
  res.json(getProject(Number(req.params.id)));
}));

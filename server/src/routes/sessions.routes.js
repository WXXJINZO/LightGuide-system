// 作业会话 / Session routes (mounted at /api/sessions) — the 5-step workflow.
import { Router } from 'express';
import { asyncHandler, badRequest } from '../lib/errors.js';
import * as svc from '../services/sessions.service.js';

export const sessionsRouter = Router();

// Create a session for a project (= worker opens a project).
sessionsRouter.post('/', asyncHandler((req, res) => {
  const projectId = Number(req.body?.projectId);
  if (!projectId) throw badRequest('projectId is required');
  res.status(201).json(svc.createSession(projectId));
}));

sessionsRouter.get('/:id', asyncHandler((req, res) => {
  res.json(svc.getSession(Number(req.params.id)));
}));

// Workflow step navigation.
sessionsRouter.patch('/:id/step', asyncHandler((req, res) => {
  res.json(svc.setStep(Number(req.params.id), req.body?.step));
}));

// 页2 工位绑定 — bind / clear a slot.
sessionsRouter.put('/:id/slots/:no/binding', asyncHandler((req, res) => {
  const componentId = Number(req.body?.componentId);
  if (!componentId) throw badRequest('componentId is required');
  res.json(svc.bindSlot(Number(req.params.id), Number(req.params.no), componentId));
}));
sessionsRouter.delete('/:id/slots/:no/binding', asyncHandler((req, res) => {
  res.json(svc.clearSlot(Number(req.params.id), Number(req.params.no)));
}));

// 页3 手动位姿 — set / reset a slot pose.
sessionsRouter.put('/:id/slots/:no/pose', asyncHandler((req, res) => {
  res.json(svc.setPose(Number(req.params.id), Number(req.params.no), {
    headTail: req.body?.headTail,
    assemblyFace: req.body?.assemblyFace,
  }));
}));
sessionsRouter.delete('/:id/slots/:no/pose', asyncHandler((req, res) => {
  res.json(svc.resetPose(Number(req.params.id), Number(req.params.no)));
}));

// 页4 偏差校验 — run the deviation check.
sessionsRouter.post('/:id/check', asyncHandler((req, res) => {
  res.json(svc.runCheck(Number(req.params.id)));
}));

// 页5 投影 — projection lifecycle.
sessionsRouter.post('/:id/projection/start', asyncHandler((req, res) => {
  res.json(svc.startProjection(Number(req.params.id)));
}));
sessionsRouter.post('/:id/projection/pause', asyncHandler((req, res) => {
  res.json(svc.pauseProjection(Number(req.params.id)));
}));
sessionsRouter.post('/:id/projection/resume', asyncHandler((req, res) => {
  res.json(svc.resumeProjection(Number(req.params.id)));
}));
sessionsRouter.post('/:id/projection/complete', asyncHandler((req, res) => {
  res.json(svc.completeProjection(Number(req.params.id)));
}));

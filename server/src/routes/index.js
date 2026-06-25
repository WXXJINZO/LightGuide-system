// API router aggregation. Domain routers are mounted here as modules land.
import { Router } from 'express';
import { healthRouter } from './health.js';
import { projectsRouter } from './projects.routes.js';
import { componentsRouter } from './components.routes.js';
import { sessionsRouter } from './sessions.routes.js';
import { importRouter } from './import.routes.js';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use('/projects', projectsRouter);
apiRouter.use('/components', componentsRouter);
apiRouter.use('/sessions', sessionsRouter);
apiRouter.use('/import', importRouter);

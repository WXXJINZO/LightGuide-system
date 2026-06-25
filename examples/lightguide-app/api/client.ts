/* Real HTTP client for the LightGuide backend (server/src/routes/*). It exposes
   the exact named-export surface the former in-memory mock (mock/api.ts) did, so
   store.ts, composables/useWorkflow.ts and the five workflow pages consume it
   unchanged — only their import path moved from `mock/api` to `api/client`. Each
   function maps to one REST route; signatures and return DTOs are identical. */
import { http } from './http';
import type { AssemblyFace, HeadTail } from '@/projects/lightguide';
import type {
    ComponentFull, ImportResult, Project, ProjectDetail, SessionDTO
} from './types';

// 页1 工程 / Projects ─────────────────────────────────────────────────────────

export async function listProjects(q = ''): Promise<Project[]> {
    // GET /api/projects → { items, total }; the mock returned a bare array.
    const { data } = await http.get<{ items: Project[]; total: number }>('/projects', { params: { q } });
    return data.items;
}

export async function getProject(id: number): Promise<ProjectDetail> {
    const { data } = await http.get<ProjectDetail>(`/projects/${id}`);
    return data;
}

export async function getComponent(id: number): Promise<ComponentFull> {
    const { data } = await http.get<ComponentFull>(`/components/${id}`);
    return data;
}

// 作业会话 / Session — the 5-step workflow ─────────────────────────────────────

export async function createSession(projectId: number): Promise<SessionDTO> {
    const { data } = await http.post<SessionDTO>('/sessions', { projectId });
    return data;
}

export async function getSession(id: number): Promise<SessionDTO> {
    const { data } = await http.get<SessionDTO>(`/sessions/${id}`);
    return data;
}

export async function setStep(id: number, step: number): Promise<SessionDTO> {
    const { data } = await http.patch<SessionDTO>(`/sessions/${id}/step`, { step });
    return data;
}

// 页2 工位绑定 / Slot binding ───────────────────────────────────────────────────

export async function bindSlot(id: number, slotNo: number, componentId: number): Promise<SessionDTO> {
    const { data } = await http.put<SessionDTO>(`/sessions/${id}/slots/${slotNo}/binding`, { componentId });
    return data;
}

export async function clearSlot(id: number, slotNo: number): Promise<SessionDTO> {
    const { data } = await http.delete<SessionDTO>(`/sessions/${id}/slots/${slotNo}/binding`);
    return data;
}

// 页3 手动位姿 / Pose ────────────────────────────────────────────────────────────

export async function setPose(
    id: number, slotNo: number, pose: { headTail: HeadTail; assemblyFace: AssemblyFace }
): Promise<SessionDTO> {
    const { data } = await http.put<SessionDTO>(`/sessions/${id}/slots/${slotNo}/pose`, pose);
    return data;
}

export async function resetPose(id: number, slotNo: number): Promise<SessionDTO> {
    const { data } = await http.delete<SessionDTO>(`/sessions/${id}/slots/${slotNo}/pose`);
    return data;
}

// 页4 偏差校验 / Deviation check ─────────────────────────────────────────────────

export async function runCheck(id: number): Promise<SessionDTO> {
    const { data } = await http.post<SessionDTO>(`/sessions/${id}/check`);
    return data;
}

// 页5 投影 / Projection lifecycle ────────────────────────────────────────────────

export async function startProjection(id: number): Promise<SessionDTO> {
    const { data } = await http.post<SessionDTO>(`/sessions/${id}/projection/start`);
    return data;
}

export async function pauseProjection(id: number): Promise<SessionDTO> {
    const { data } = await http.post<SessionDTO>(`/sessions/${id}/projection/pause`);
    return data;
}

export async function resumeProjection(id: number): Promise<SessionDTO> {
    const { data } = await http.post<SessionDTO>(`/sessions/${id}/projection/resume`);
    return data;
}

export async function completeProjection(id: number): Promise<SessionDTO> {
    const { data } = await http.post<SessionDTO>(`/sessions/${id}/projection/complete`);
    return data;
}

export async function projectionAction(
    id: number, action: 'start' | 'pause' | 'resume' | 'complete'
): Promise<SessionDTO> {
    switch (action) {
        case 'start': return startProjection(id);
        case 'pause': return pauseProjection(id);
        case 'resume': return resumeProjection(id);
        case 'complete': return completeProjection(id);
    }
}

// 模型导入 / Model import (V3 §15) ───────────────────────────────────────────────

export async function importModel(filename: string, content: string): Promise<ImportResult> {
    const { data } = await http.post<ImportResult>('/import', { filename, content });
    return data;
}

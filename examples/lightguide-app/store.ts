/* App state — reactive port of the reference SPA's public/js/store.js. Holds the
   project list, active session DTO and current selections. The session id +
   selected project persist in localStorage so a reload restores the in-flight
   workflow. */
import { reactive } from 'vue';
import * as api from './api/client';
import type { ComponentFull, ProjectDetail, Project, SessionDTO, SlotDTO } from './api/types';
import type { PreviewMode } from '@/projects/lightguide';

interface StoreState {
    projects: Project[];
    project: ProjectDetail | null;
    session: SessionDTO | null;
    selectedSlotNo: number;
    pickedComponentId: number | null;
    previewMode: PreviewMode;
    selectedSecondaryId: string | null;
}

const SESSION_KEY = 'lg_session';
const compCache = new Map<number, ComponentFull>();

export const store = reactive<StoreState>({
    projects: [],
    project: null,
    session: null,
    selectedSlotNo: 1,
    pickedComponentId: null,
    previewMode: 'projection',
    selectedSecondaryId: null
});

export const Store = {
    state: store,

    get sessionId(): number | null {
        return Number(localStorage.getItem(SESSION_KEY) || 0) || null;
    },
    set sessionId(v: number | null) {
        if (v) localStorage.setItem(SESSION_KEY, String(v));
        else localStorage.removeItem(SESSION_KEY);
    },

    async loadProjects(q?: string): Promise<Project[]> {
        store.projects = await api.listProjects(q);
        return store.projects;
    },
    async loadProject(id: number): Promise<ProjectDetail> {
        store.project = await api.getProject(id);
        return store.project;
    },
    async openSession(projectId: number): Promise<SessionDTO> {
        store.session = await api.createSession(projectId);
        this.sessionId = store.session.id;
        return store.session;
    },
    async refreshSession(): Promise<SessionDTO | null> {
        if (!this.sessionId) return null;
        store.session = await api.getSession(this.sessionId);
        return store.session;
    },
    setSession(s: SessionDTO): void { store.session = s; },

    slot(no: number): SlotDTO | null {
        return store.session ? store.session.slots.find((s) => s.slot_no === no) || null : null;
    },
    selectedSlot(): SlotDTO | null { return this.slot(store.selectedSlotNo); },

    async loadComponent(id: number): Promise<ComponentFull> {
        if (compCache.has(id)) return compCache.get(id)!;
        const c = await api.getComponent(id);
        compCache.set(id, c);
        return c;
    }
};

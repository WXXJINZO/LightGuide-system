/* Workflow navigation — the 5-step state machine's routing + reachability,
   ported from the reference app.js (ROUTE_STEP / stepReachable / gotoStep). */
import { useRouter } from 'vue-router';
import * as api from '../mock/api';
import { Store, store } from '../store';

export const STEP_ROUTE: Record<number, string> = {
    1: 'lg-select', 2: 'lg-binding', 3: 'lg-pose', 4: 'lg-check', 5: 'lg-projection'
};
export const ROUTE_STEP: Record<string, number> = {
    'lg-select': 1, 'lg-binding': 2, 'lg-pose': 3, 'lg-check': 4, 'lg-projection': 5
};

/** Which steps are reachable given the current session state (app.js parity). */
export function stepReachable(n: number): boolean {
    const s = store.session;
    if (n === 1) return true;
    if (!s) return false;
    if (n === 2) return true;
    if (n === 3) return s.all_bound;
    if (n === 4) return s.all_bound && s.all_pose_set;
    if (n === 5) return s.all_bound && s.all_checked && !s.has_out_of_tolerance;
    return false;
}

export function useWorkflowNav() {
    const router = useRouter();

    async function gotoStep(n: number): Promise<void> {
        const s = store.session;
        if (s) {
            try { Store.setSession(await api.setStep(s.id, n)); } catch { /* non-fatal */ }
        }
        await router.push({ name: STEP_ROUTE[n] });
    }

    return { gotoStep, router };
}

/* Global toast — single reactive instance shared across the app (mirrors the
   reference App.toast). Rendered once by AppShell. */
import { reactive } from 'vue';

type ToastKind = 'info' | 'ok' | 'warn' | 'bad';

const state = reactive<{ msg: string; kind: ToastKind; show: boolean }>({
    msg: '', kind: 'info', show: false
});

let timer: ReturnType<typeof setTimeout> | null = null;

export function toast(msg: string, kind: ToastKind = 'info'): void {
    state.msg = msg;
    state.kind = kind;
    state.show = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { state.show = false; }, 2600);
}

export function useToast() {
    return { toastState: state, toast };
}

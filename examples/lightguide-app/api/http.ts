/* Thin axios wrapper over the real LightGuide backend (server/). The relative
   baseURL '/api' is reached through the Vite dev proxy (see vite.config.ts) →
   http://127.0.0.1:4178. The interceptor normalizes the backend's JSON error
   envelope { error: { code, message, fields? } } into a thrown Error (carrying
   .code/.status/.fields) so the pages' existing catch blocks behave exactly as
   they did against the former in-memory mock (which threw plain Errors). */
import axios from 'axios';
import type { AxiosError } from 'axios';

export interface ApiError extends Error {
    code?: string;
    status?: number;
    fields?: Record<string, string>;
}

export const http = axios.create({
    baseURL: '/api',
    headers: { 'Content-Type': 'application/json' }
});

type ErrorEnvelope = { error?: { code?: string; message?: string; fields?: Record<string, string> } };

http.interceptors.response.use(
    (res) => res,
    (err: AxiosError<ErrorEnvelope>) => {
        const env = err.response?.data?.error;
        const e: ApiError = new Error(env?.message || err.message || 'Request failed');
        e.code = env?.code;
        e.status = err.response?.status;
        e.fields = env?.fields;
        return Promise.reject(e);
    }
);

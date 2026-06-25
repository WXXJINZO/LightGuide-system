/* Shared face labels (workspace.js faceLabel parity). */
import type { AssemblyFace } from '@/projects/lightguide';
import { t } from './i18n';

export const FACES: AssemblyFace[] = ['top_flange', 'bottom_flange', 'left_web', 'right_web'];

const FACE_KEY: Record<AssemblyFace, string> = {
    top_flange: 'face.top', bottom_flange: 'face.bottom', left_web: 'face.left', right_web: 'face.right'
};

export function faceLabel(f: AssemblyFace): string {
    return t(FACE_KEY[f] || 'face.top');
}

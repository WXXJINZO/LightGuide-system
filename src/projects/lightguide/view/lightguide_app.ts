import { WebCadApiBase } from '@/common';
import { BeamCanvas } from './beam_canvas';
import { BeamViewHandle } from './beam_view_handle';
import { LightGuideCmdParamTypes } from '../command/cmd_register';
import { CMD_TYPES } from '../command/cmd_types';

/**
 * LightGuide 业务 App 门面（替换参考实现的 CadApp，落到底座 WebCadApiBase）。
 *
 * 单例 + keyed view registry：每次 `createView` 生成独立 `BeamCanvas`，UI 经
 * `executeCommand` 驱动命令。
 */
export class LightGuideApp extends WebCadApiBase<LightGuideCmdParamTypes> {
    public static CMD_TYPES = CMD_TYPES;

    private static _instance: LightGuideApp;
    public static getInstance(): LightGuideApp {
        if (!this._instance) {
            this._instance = new LightGuideApp();
        }

        return this._instance;
    }

    public executeCommand<K extends CMD_TYPES>(handleKey: string, cmdName: K, params?: LightGuideCmdParamTypes[K]): Promise<any> {
        return super.executeCommand(handleKey, cmdName, params);
    }

    public async createView(viewKey: string, container: HTMLElement, options?: any): Promise<BeamViewHandle> {
        if (!this._app) {
            this._createApp();
        }

        if (this._views.has(viewKey)) {
            await this._app!.addView(container, BeamCanvas as any, viewKey, options?.configOptions ?? options);
            return this._views.get(viewKey) as BeamViewHandle;
        }
        const viewHandle = await this.createViewHandle(viewKey, container, options);
        this._views.set(viewKey, viewHandle);

        return viewHandle;
    }

    protected async createViewHandle(viewKey: string, domElement: HTMLElement, configOptions?: any): Promise<BeamViewHandle> {
        const view = await this._app!.addView(domElement, BeamCanvas as any, viewKey, configOptions?.configOptions ?? configOptions);

        return new BeamViewHandle(viewKey, view as BeamCanvas);
    }

    /**
     * 仅释放当前 renderer，保留底座 view / handle 注册。
     * 用于 Vue 路由切换后把同一个 WebCAD view 迁移到新的 DOM 宿主。
     */
    public async detachViewRender(viewKey: string): Promise<void> {
        if (!this._app?.getViewByTag(viewKey)) return;
        const originalError = console.error;
        console.error = (...args: unknown[]) => {
            const text = args.map((arg) => String(arg)).join(' ');
            if (text.includes('webglcontextlost') || text.includes("Cannot read properties of undefined (reading 'viewObj')")) return;
            originalError(...args);
        };
        try {
            this._app.destroyView(viewKey);
            await new Promise((resolve) => setTimeout(resolve, 50));
        } finally {
            console.error = originalError;
        }
    }

    /**
     * 销毁视图：释放 canvas 并从注册表删除（区别于底座 destroyView 不删表项的行为，
     * 避免重复挂载时复用陈旧状态 / 泄漏窗口监听）。
     */
    public async destroyView(viewKey: string): Promise<void> {
        const handle = this._views.get(viewKey);
        if (!handle) return;
        await handle.dispose();
        this._views.delete(viewKey);
    }
}

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
            throw new Error(`View with key "${viewKey}" already exists.`);
        }
        const viewHandle = await this.createViewHandle(viewKey, container, options);
        this._views.set(viewKey, viewHandle);

        return viewHandle;
    }

    protected async createViewHandle(viewKey: string, domElement: HTMLElement, configOptions?: any): Promise<BeamViewHandle> {
        const view = await this._app!.createView(viewKey, BeamCanvas as any, { domElement, app: this._app, configOptions });

        return new BeamViewHandle(viewKey, view as BeamCanvas);
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

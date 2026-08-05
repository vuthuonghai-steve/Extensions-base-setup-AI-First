import {
  AppErrorCode,
  type IpcRequestPayload,
  type IpcResponseMap,
  type MessageResponse,
} from '@contracts/ipc-payloads';
import type { IpcAction } from '@contracts/ipc-actions';

/** Data type của response cho một action (trích từ IpcResponseMap). */
type ResponseData<T extends IpcAction> =
  IpcResponseMap[T] extends MessageResponse<infer D> ? D : never;

type RequestOf<T extends IpcAction> = Extract<IpcRequestPayload, { action: T }>;

/** Handler cho một action — trả về MessageResponse của đúng action đó (type-safe). */
export type Handler<T extends IpcAction> = (
  request: RequestOf<T>,
) => Promise<MessageResponse<ResponseData<T>>> | MessageResponse<ResponseData<T>>;

const NO_HANDLER_ERROR: MessageResponse<never> = {
  ok: false,
  error: { code: AppErrorCode.UNKNOWN_ERROR, message: `no handler registered for action` },
};

/**
 * IPC Router (Architect §5, D10) — lớp dispatch trung tâm. Engine Phase 5
 * đăng ký handler MỘT LẦN tại bootstrap; mọi request tới đều qua `handle`.
 */
export class Router {
  private readonly handlers = new Map<IpcAction, Handler<IpcAction>>();

  /** Đăng ký handler cho một action. Ghi đè handler cũ nếu đã tồn tại. */
  registerHandler<T extends IpcAction>(action: T, handler: Handler<T>): void {
    this.handlers.set(action, handler as unknown as Handler<IpcAction>);
  }

  /**
   * Dispatch một request. KHÔNG bao giờ throw:
   * - action chưa đăng ký → `{ok:false, error:{code:UNKNOWN_ERROR, ...}}`
   * - handler throw → catch → error response UNKNOWN_ERROR.
   */
  async handle(request: IpcRequestPayload): Promise<MessageResponse<unknown>> {
    const handler = this.handlers.get(request.action);
    if (handler === undefined) return NO_HANDLER_ERROR;
    try {
      return await handler(request);
    } catch (error) {
      const detail =
        error instanceof Error ? { name: error.name, message: error.message } : undefined;
      return {
        ok: false,
        error: { code: AppErrorCode.UNKNOWN_ERROR, message: 'handler threw', detail },
      };
    }
  }
}

export type { RequestOf, ResponseData };

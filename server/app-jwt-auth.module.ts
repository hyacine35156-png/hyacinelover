import { MiddlewareConsumer, Module, NestMiddleware } from '@nestjs/common';
import { verifyJwt } from './modules/auth/auth.service';

/**
 * 解析应用级 JWT 并确保 req.userContext.userId 不被平台中间件覆盖。
 *
 * - 平台 SqlExecutionContextMiddleware 依赖 req.userContext.userId 切换 DB 角色
 * - 平台 UserContextMiddleware 在之后运行，会替换整个 req.userContext 对象
 * - 通过 Object.defineProperty 劫持赋值操作，每次替换时保留 userId
 *
 * 必须放在 PlatformModule 之前注册。
 */
class AppJwtAuthMiddleware implements NestMiddleware {
  use(req: any, _res: any, next: (err?: any) => void): void {
    const authHeader = req.headers.authorization;
    if (
      authHeader &&
      typeof authHeader === 'string' &&
      authHeader.startsWith('Bearer ')
    ) {
      const token = authHeader.slice(7).trim();
      try {
        const payload = verifyJwt(token);
        const sub = payload.sub;
        if (typeof sub === 'string') {
          const userId = sub;
          let inner: Record<string, unknown> = req.userContext || {};
          inner.userId = userId;

          Object.defineProperty(req, 'userContext', {
            configurable: true,
            enumerable: true,
            get() {
              return inner;
            },
            set(newValue: Record<string, unknown>) {
              inner = newValue || {};
              inner.userId = userId;
            },
          });
        }
      } catch {
        // token 无效时不做处理，由业务层 Guard 处理
      }
    }
    next();
  }
}

@Module({})
export class AppJwtAuthModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AppJwtAuthMiddleware).forRoutes('*');
  }
}
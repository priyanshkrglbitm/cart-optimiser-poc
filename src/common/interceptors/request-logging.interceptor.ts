import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

/** Logs every API call: method, path, status and how long it took. */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const { method, originalUrl } = http.getRequest();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.logger.log(`${method} ${originalUrl} ${http.getResponse().statusCode} ${Date.now() - start}ms`),
        // Validation errors keep their details (e.g. "location.pincode must be...") in response.message
        error: err => this.logger.warn(`${method} ${originalUrl} ${err.status ?? 500} ${Date.now() - start}ms: ${[].concat(err.response?.message ?? err.message).join('; ')}`),
      }),
    );
  }
}

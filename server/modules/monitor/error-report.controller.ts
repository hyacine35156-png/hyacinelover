import { Body, Controller, Logger, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import type {
  ErrorReportRequest,
  ErrorReportResponse,
} from '@shared/api.interface';

@Controller('api/error-report')
export class ErrorReportController {
  private readonly logger = new Logger(ErrorReportController.name);

  @Post()
  async report(
    @Body() body: ErrorReportRequest,
    @Req() req: Request,
  ): Promise<ErrorReportResponse> {
    const userId = req.userContext?.userId;
    this.logger.warn(
      `[FrontendError] type=${body.type} message=${body.message.substring(0, 200)}`,
    );
    this.logger.verbose(
      JSON.stringify({
        type: body.type,
        message: body.message,
        stack: body.stack?.substring(0, 1000),
        url: body.url,
        userAgent: body.userAgent.substring(0, 200),
        timestamp: body.timestamp,
        userId: body.userId ?? userId,
        appVersion: body.appVersion,
        environment: body.environment,
        userFeedback: body.userFeedback
          ? body.userFeedback.substring(0, 500)
          : undefined,
      }),
    );
    return { success: true };
  }
}

export default ErrorReportController;

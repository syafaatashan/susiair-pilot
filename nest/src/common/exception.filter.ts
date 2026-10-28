import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common'
import type { Request, Response } from 'express'

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    let status = 500
    let message: string | string[] | Record<string, unknown> = 'Internal server error'

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const res = exception.getResponse()
      if (typeof res === 'string') {
        message = res
      } else {
        const inner = (res as Record<string, unknown>).message
        if (typeof inner === 'string' || Array.isArray(inner)) message = inner as string | string[]
        else if (inner !== undefined) message = inner as Record<string, unknown>
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack)
      message = status === 500 ? 'Internal server error' : exception.message
    } else {
      this.logger.error(String(exception))
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: this.getErrorName(status),
      timestamp: new Date().toISOString(),
      path: request.url,
    })
  }

  private getErrorName(status: number): string {
    const map: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      500: 'Internal Server Error',
    }
    return map[status] ?? 'Error'
  }
}

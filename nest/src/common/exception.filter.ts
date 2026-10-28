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
        message = this.sanitize(res, status)
      } else {
        const inner = (res as Record<string, unknown>).message
        if (typeof inner === 'string') message = this.sanitize(inner, status)
        else if (Array.isArray(inner)) message = inner.map(String)
        else if (inner !== undefined) message = inner as Record<string, unknown>
      }
    } else if (exception instanceof Error) {
      // Log the real cause, never return it to the client.
      this.logger.error(exception.message, exception.stack)
      message = 'Internal server error'
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

  /**
   * Body-parser forwards its raw parser text ("Unexpected token ... in JSON at
   * position 1"). Replace it with a stable, non-leaky message so every 400 in
   * the API reads consistently.
   */
  private sanitize(message: string, status: number): string {
    if (status === 400 && /json|unexpected token|expected property/i.test(message)) {
      return 'Invalid JSON payload'
    }
    return message
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

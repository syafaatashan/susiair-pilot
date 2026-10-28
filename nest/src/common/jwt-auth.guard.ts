import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'

export interface JwtPayload {
  sub: number
  username: string
  role: string
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

@Injectable()
export class JwtAuthGuard {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('No bearer token provided')
    try {
      request.user = this.jwtService.verify<JwtPayload>(auth.slice(7))
      return true
    } catch {
      throw new UnauthorizedException('Invalid or expired token')
    }
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { JwtPayload } from '../common/jwt-auth.guard.js'

const CREDENTIALS = { username: 'johndoe', password: 'susiairtest' }

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  login(username: string, password: string) {
    if (username !== CREDENTIALS.username || password !== CREDENTIALS.password)
      throw new UnauthorizedException('Invalid credentials')

    const payload: JwtPayload = { sub: 72159, username: 'johndoe', role: 'pilot' }
    return {
      access_token: this.jwtService.sign(payload),
      token_type: 'Bearer',
      expires_in: 2592000, // 30 days in seconds
    }
  }
}

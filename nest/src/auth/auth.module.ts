import { Global, Logger, Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'

const DEV_FALLBACK_SECRET = 'susiair-technical-test-secret'

/**
 * A committed fallback secret means anyone with the repository can forge a valid
 * token. That is tolerable for local development and unacceptable in a deployment,
 * so refuse to boot in production without a real secret.
 */
function resolveSecret(): string {
  const secret = process.env.JWT_SECRET
  if (secret) return secret

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required when NODE_ENV=production. Refusing to start with the public fallback secret.')
  }

  new Logger('AuthModule').warn(
    'JWT_SECRET is not set - using the public development secret. Set JWT_SECRET (or NODE_ENV=production) before deploying.',
  )
  return DEV_FALLBACK_SECRET
}

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: resolveSecret(),
      signOptions: { expiresIn: '30d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [JwtModule],
})
export class AuthModule {}
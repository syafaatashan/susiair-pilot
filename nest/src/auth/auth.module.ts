import { Global, Logger, Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'

const DEV_FALLBACK_SECRET = 'susiair-technical-test-secret'

if (!process.env.JWT_SECRET) {
  new Logger('AuthModule').warn(
    'JWT_SECRET is not set - falling back to a public development secret. ' +
      'Set JWT_SECRET before deploying so tokens cannot be forged.',
  )
}

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? DEV_FALLBACK_SECRET,
      signOptions: { expiresIn: '30d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [JwtModule],
})
export class AuthModule {}

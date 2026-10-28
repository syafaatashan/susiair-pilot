import { Body, Controller, Post, HttpCode } from '@nestjs/common'
import { AuthService } from './auth.service.js'
import { LoginDto } from './dto/login.dto.js'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.username, loginDto.password)
  }
}

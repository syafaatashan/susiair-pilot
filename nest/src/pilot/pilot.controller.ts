import { Controller, Get, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/jwt-auth.guard.js'
import { PilotService } from './pilot.service.js'

@Controller('pilot')
@UseGuards(JwtAuthGuard)
export class PilotController {
  constructor(private readonly pilotService: PilotService) {}

  @Get('me')
  getProfile() {
    return this.pilotService.getProfile()
  }
}

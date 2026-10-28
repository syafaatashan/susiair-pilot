import { Module } from '@nestjs/common'
import { PilotController } from './pilot.controller.js'
import { PilotService } from './pilot.service.js'

@Module({
  controllers: [PilotController],
  providers: [PilotService],
})
export class PilotModule {}

import { Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module.js'
import { PilotModule } from './pilot/pilot.module.js'
import { FlightHoursModule } from './flight-hours/flight-hours.module.js'
import { DocumentsModule } from './documents/documents.module.js'
import { SchedulesModule } from './schedules/schedules.module.js'
import { HealthController } from './health/health.controller.js'

@Module({
  imports: [AuthModule, PilotModule, FlightHoursModule, DocumentsModule, SchedulesModule],
  controllers: [HealthController],
})
export class AppModule {}

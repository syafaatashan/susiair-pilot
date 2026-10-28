import { Module } from '@nestjs/common'
import { FlightHoursController } from './flight-hours.controller.js'
import { FlightHoursService } from './flight-hours.service.js'

@Module({
  controllers: [FlightHoursController],
  providers: [FlightHoursService],
})
export class FlightHoursModule {}

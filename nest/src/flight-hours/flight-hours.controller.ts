import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/jwt-auth.guard.js'
import { FlightHoursService } from './flight-hours.service.js'
import { DateRangeQueryDto, SummaryQueryDto } from './dto/query.dto.js'

@Controller('flight-hours')
@UseGuards(JwtAuthGuard)
export class FlightHoursController {
  constructor(private readonly flightHoursService: FlightHoursService) {}

  @Get()
  getDailyHours(@Query() { from, to }: DateRangeQueryDto) {
    return this.flightHoursService.getDailyHours(from, to)
  }

  @Get('summary')
  getSummary(@Query() { range }: SummaryQueryDto) {
    return this.flightHoursService.getSummary(range)
  }
}

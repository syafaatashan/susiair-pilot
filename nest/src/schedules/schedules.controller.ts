import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/jwt-auth.guard.js'
import { SchedulesService } from './schedules.service.js'
import { MonthQueryDto } from './dto/month-query.dto.js'

@Controller('schedules')
@UseGuards(JwtAuthGuard)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  getMonth(@Query() { year, month }: MonthQueryDto) {
    return this.schedulesService.getMonth(year, month)
  }
}

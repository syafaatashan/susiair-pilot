import { IsDefined, IsIn, IsOptional } from 'class-validator'
import { VALID_RANGES, type Range } from '../../common/types.js'
import { IsCalendarDate } from '../../common/is-calendar-date.decorator.js'

export class DateRangeQueryDto {
  @IsDefined({ message: 'from is required' })
  @IsCalendarDate()
  from: string

  @IsDefined({ message: 'to is required' })
  @IsCalendarDate()
  to: string
}

export class SummaryQueryDto {
  @IsOptional()
  @IsIn(VALID_RANGES)
  range: Range = '1w'
}

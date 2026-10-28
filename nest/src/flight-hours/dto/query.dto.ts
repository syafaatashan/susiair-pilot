import { IsDateString, IsIn, IsOptional } from 'class-validator'
import { VALID_RANGES, type Range } from '../../common/types.js'

export class DateRangeQueryDto {
  @IsDateString()
  from: string

  @IsDateString()
  to: string
}

export class SummaryQueryDto {
  @IsOptional()
  @IsIn(VALID_RANGES)
  range: Range = '1w'
}

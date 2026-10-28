import { IsDefined, IsInt, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class MonthQueryDto {
  @IsDefined({ message: 'year is required' })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number

  @IsDefined({ message: 'month is required' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number
}

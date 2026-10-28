import { registerDecorator, type ValidationOptions } from 'class-validator'
import { isCalendarDate } from './config.js'

/** Rejects strings that are not real YYYY-MM-DD calendar dates (e.g. 2026-02-30). */
export function IsCalendarDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isCalendarDate',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown) => isCalendarDate(value),
        defaultMessage: () => '$property must be a valid calendar date in YYYY-MM-DD format',
      },
    })
  }
}

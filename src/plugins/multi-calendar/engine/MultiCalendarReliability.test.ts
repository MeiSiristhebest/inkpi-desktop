import { describe, expect, it } from 'vitest'
import { MultiCalendarEngine } from './MultiCalendarEngine'

const calendar = {
  id: 'c',
  name: '固定年历',
  epochOffsetDays: -5,
  monthsPerYear: 2,
  daysPerMonth: [2, 3],
}
describe('fixed-calendar arithmetic', () => {
  it.each([
    { year: 1, month: 0, day: 1 },
    { year: 1, month: 3, day: 1 },
    { year: 1, month: 1, day: 3 },
    { year: 1, month: 1, day: 0 },
    { year: 1.5, month: 1, day: 1 },
    { year: NaN, month: 1, day: 1 },
  ])('rejects nonexistent or non-integer dates %o', (date) => {
    expect(() => MultiCalendarEngine.toAbsoluteDay(calendar, date)).toThrow()
  })
  it.each([
    { ...calendar, daysPerMonth: [2] },
    { ...calendar, daysPerMonth: [0, 3] },
    { ...calendar, leapRules: '四年一闰' },
  ])('rejects invalid or unsupported calendars %o', (invalid) => {
    expect(() => MultiCalendarEngine.fromAbsoluteDay(invalid, 0)).toThrow()
  })
  it('uses continuous integer years including zero and round-trips both sides of the epoch', () => {
    for (let absolute = -25; absolute <= 25; absolute++) {
      expect(
        MultiCalendarEngine.toAbsoluteDay(
          calendar,
          MultiCalendarEngine.fromAbsoluteDay(calendar, absolute),
        ),
      ).toBe(absolute)
    }
    expect(MultiCalendarEngine.fromAbsoluteDay(calendar, -6)).toEqual({ year: 0, month: 2, day: 3 })
  })
  it('rejects non-finite and fractional absolute days', () => {
    for (const day of [Infinity, NaN, 0.5])
      expect(() => MultiCalendarEngine.fromAbsoluteDay(calendar, day)).toThrow()
  })
})

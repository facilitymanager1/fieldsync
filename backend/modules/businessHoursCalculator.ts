// Business Hours Calculator for SLA Engine
// Handles business hour calculations, holidays, and time zone considerations
export class BusinessHoursCalculator {
  private holidays: Date[] = [];
  private businessHourStart = 9; // 9 AM
  private businessHourEnd = 17; // 5 PM
  private timezone = 'UTC'; // Default timezone

  constructor() {
    this.loadHolidays();
  }

  /**
   * Calculate target time by adding business hours to start time
   */
  calculateBusinessHours(
    startTime: Date,
    durationHours: number,
    businessHoursOnly: boolean = true,
    excludeWeekends: boolean = true,
    excludeHolidays: boolean = true
  ): Date {
    if (!businessHoursOnly) {
      return new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);
    }

    let currentTime = new Date(startTime);
    let remainingHours = durationHours;

    // If start time is outside business hours, move to next business hour
    currentTime = this.moveToNextBusinessHour(currentTime, excludeWeekends, excludeHolidays);

    while (remainingHours > 0) {
      if (this.isBusinessHour(currentTime, excludeWeekends, excludeHolidays)) {
        const hoursRemainingInDay = this.getRemainingBusinessHoursInDay(currentTime);
        const hoursToAdd = Math.min(remainingHours, hoursRemainingInDay);
        
        currentTime.setHours(currentTime.getHours() + hoursToAdd);
        remainingHours -= hoursToAdd;
      }

      if (remainingHours > 0) {
        currentTime = this.moveToNextBusinessHour(currentTime, excludeWeekends, excludeHolidays);
      }
    }

    return currentTime;
  }

  /**
   * Calculate business hours between two dates
   */
  calculateBusinessHoursBetween(
    startTime: Date,
    endTime: Date,
    excludeWeekends: boolean = true,
    excludeHolidays: boolean = true
  ): number {
    let current = new Date(startTime);
    let totalHours = 0;

    while (current < endTime) {
      if (this.isBusinessHour(current, excludeWeekends, excludeHolidays)) {
        // Calculate how much of this hour counts
        const endOfHour = new Date(current);
        endOfHour.setHours(current.getHours() + 1, 0, 0, 0);
        
        const effectiveEnd = endOfHour > endTime ? endTime : endOfHour;
        const hoursInThisSlot = (effectiveEnd.getTime() - current.getTime()) / (1000 * 60 * 60);
        
        totalHours += hoursInThisSlot;
      }
      
      // Move to next hour
      current.setHours(current.getHours() + 1, 0, 0, 0);
    }

    return totalHours;
  }

  /**
   * Check if given time is within business hours
   */
  private isBusinessHour(
    time: Date,
    excludeWeekends: boolean,
    excludeHolidays: boolean
  ): boolean {
    const hour = time.getHours();
    const dayOfWeek = time.getDay();

    // Check business hours (9 AM to 5 PM by default)
    if (hour < this.businessHourStart || hour >= this.businessHourEnd) {
      return false;
    }

    // Check weekends (0 = Sunday, 6 = Saturday)
    if (excludeWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
      return false;
    }

    // Check holidays
    if (excludeHolidays && this.isHoliday(time)) {
      return false;
    }

    return true;
  }

  /**
   * Get remaining business hours in the current day
   */
  private getRemainingBusinessHoursInDay(time: Date): number {
    const currentHour = time.getHours();
    const currentMinutes = time.getMinutes();
    
    if (currentHour >= this.businessHourEnd) {
      return 0;
    }

    const remainingHours = this.businessHourEnd - currentHour;
    const minuteAdjustment = currentMinutes / 60;

    return Math.max(0, remainingHours - minuteAdjustment);
  }

  /**
   * Move to the next business hour
   */
  private moveToNextBusinessHour(
    time: Date,
    excludeWeekends: boolean,
    excludeHolidays: boolean
  ): Date {
    const nextTime = new Date(time);

    // If current time is before business hours, move to business start
    if (nextTime.getHours() < this.businessHourStart) {
      nextTime.setHours(this.businessHourStart, 0, 0, 0);
    }
    // If current time is after business hours, move to next day's start
    else if (nextTime.getHours() >= this.businessHourEnd) {
      nextTime.setDate(nextTime.getDate() + 1);
      nextTime.setHours(this.businessHourStart, 0, 0, 0);
    }

    // Keep moving forward until we hit a business day
    while (!this.isBusinessHour(nextTime, excludeWeekends, excludeHolidays)) {
      if (excludeWeekends && (nextTime.getDay() === 0 || nextTime.getDay() === 6)) {
        // Skip to Monday if it's weekend
        const daysToAdd = nextTime.getDay() === 0 ? 1 : 2; // Sunday: add 1, Saturday: add 2
        nextTime.setDate(nextTime.getDate() + daysToAdd);
        nextTime.setHours(this.businessHourStart, 0, 0, 0);
      } else if (excludeHolidays && this.isHoliday(nextTime)) {
        // Skip to next day if it's a holiday
        nextTime.setDate(nextTime.getDate() + 1);
        nextTime.setHours(this.businessHourStart, 0, 0, 0);
      } else {
        break;
      }
    }

    return nextTime;
  }

  /**
   * Check if given date is a holiday
   */
  private isHoliday(date: Date): boolean {
    return this.holidays.some(holiday => 
      holiday.getFullYear() === date.getFullYear() &&
      holiday.getMonth() === date.getMonth() &&
      holiday.getDate() === date.getDate()
    );
  }

  /**
   * Load holidays from configuration
   */
  private loadHolidays(): void {
    // Default holidays for 2025 (can be loaded from config/database)
    this.holidays = [
      new Date('2025-01-01'), // New Year's Day
      new Date('2025-01-20'), // Martin Luther King Jr. Day
      new Date('2025-02-17'), // Presidents' Day
      new Date('2025-05-26'), // Memorial Day
      new Date('2025-07-04'), // Independence Day
      new Date('2025-09-01'), // Labor Day
      new Date('2025-10-13'), // Columbus Day
      new Date('2025-11-11'), // Veterans Day
      new Date('2025-11-27'), // Thanksgiving
      new Date('2025-12-25'), // Christmas Day
    ];
  }

  /**
   * Add custom holiday
   */
  addHoliday(date: Date): void {
    this.holidays.push(date);
  }

  /**
   * Remove holiday
   */
  removeHoliday(date: Date): void {
    this.holidays = this.holidays.filter(holiday => 
      holiday.getTime() !== date.getTime()
    );
  }

  /**
   * Set business hours
   */
  setBusinessHours(startHour: number, endHour: number): void {
    this.businessHourStart = startHour;
    this.businessHourEnd = endHour;
  }

  /**
   * Get business hours configuration
   */
  getBusinessHours(): { start: number; end: number } {
    return {
      start: this.businessHourStart,
      end: this.businessHourEnd
    };
  }

  /**
   * Set timezone
   */
  setTimezone(timezone: string): void {
    this.timezone = timezone;
  }

  /**
   * Get current business day info
   */
  getBusinessDayInfo(date: Date = new Date()): {
    isBusinessDay: boolean;
    isBusinessHour: boolean;
    nextBusinessHour: Date;
    hoursRemainingToday: number;
  } {
    const isBusinessDay = !this.isHoliday(date) && ![0, 6].includes(date.getDay());
    const isBusinessHour = this.isBusinessHour(date, true, true);
    const nextBusinessHour = this.moveToNextBusinessHour(date, true, true);
    const hoursRemainingToday = this.getRemainingBusinessHoursInDay(date);

    return {
      isBusinessDay,
      isBusinessHour,
      nextBusinessHour,
      hoursRemainingToday
    };
  }
}

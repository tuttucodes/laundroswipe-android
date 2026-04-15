export const SCHEDULE_ORDER_ERROR_CODES = new Set([
  'INVALID_PICKUP_DATE',
  'INVALID_SLOT',
  'PICKUP_DATE_PAST',
  'DATE_NOT_BOOKABLE',
  'DATE_DISABLED',
  'SLOT_NOT_ALLOWED',
  'SLOT_INACTIVE',
]);

export function isScheduleOrderErrorCode(code: string | undefined): boolean {
  return Boolean(code && SCHEDULE_ORDER_ERROR_CODES.has(code));
}

export function userMessageForScheduleOrderError(code: string | undefined, serverError?: string): string {
  switch (code) {
    case 'PICKUP_DATE_PAST':
      return 'That pickup date has already passed. Choose another date.';
    case 'DATE_NOT_BOOKABLE':
      return 'That date is not open for booking. Pick an available date.';
    case 'DATE_DISABLED':
      return 'This partner is not accepting bookings on that date.';
    case 'SLOT_NOT_ALLOWED':
      return 'That time is not available on the date you chose.';
    case 'SLOT_INACTIVE':
      return 'That time slot is not available right now.';
    case 'INVALID_PICKUP_DATE':
      return 'Please choose a valid pickup date.';
    case 'INVALID_SLOT':
      return 'Please choose a valid time slot.';
    default:
      return serverError?.trim() || 'This date and time cannot be booked. Try again.';
  }
}

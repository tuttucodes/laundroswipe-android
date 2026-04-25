import type { UserRow } from './api';

/**
 * Mirrors needsStudentHostelDetails() from components/LaundroApp.tsx in the web app.
 * A student profile must have college + reg_no + hostel_block + room_number
 * before they can book pickups.
 */

export function isCampusCollegeStudent(
  u: Pick<UserRow, 'user_type' | 'college_id'> | null,
): boolean {
  if (!u) return false;
  if ((u.user_type ?? '').toLowerCase() === 'student') return true;
  const cid = (u.college_id ?? '').trim();
  return Boolean(cid && cid !== 'general');
}

export function needsStudentCollegeChoice(u: UserRow | null): boolean {
  if (!u) return false;
  if ((u.user_type ?? '').toLowerCase() !== 'student') return false;
  const cid = (u.college_id ?? '').trim();
  return !cid || cid === 'general';
}

export function needsStudentHostelDetails(u: UserRow | null): boolean {
  if (!u || !isCampusCollegeStudent(u)) return false;
  if (needsStudentCollegeChoice(u)) return true;
  if (!(u.reg_no ?? '').trim()) return true;
  if (!(u.hostel_block ?? '').trim()) return true;
  if (!(u.room_number ?? '').trim()) return true;
  return false;
}

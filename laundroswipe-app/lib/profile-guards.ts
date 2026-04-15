import type { UserRow } from './api-types';

export function isCampusCollegeStudent(u: Pick<UserRow, 'user_type' | 'college_id'> | null): boolean {
  if (!u) return false;
  if (String(u.user_type ?? '').toLowerCase() === 'student') return true;
  const cid = String(u.college_id ?? '').trim();
  return Boolean(cid && cid !== 'general');
}

function needsStudentCollegeChoice(u: UserRow | null): boolean {
  if (!u) return false;
  if (String(u.user_type ?? '').toLowerCase() !== 'student') return false;
  const cid = String(u.college_id ?? '').trim();
  return !cid || cid === 'general';
}

export function needsStudentHostelDetails(u: UserRow | null): boolean {
  if (!u || !isCampusCollegeStudent(u)) return false;
  if (needsStudentCollegeChoice(u)) return true;
  if (!String(u.reg_no ?? '').trim()) return true;
  if (!String(u.hostel_block ?? '').trim()) return true;
  if (!String(u.room_number ?? '').trim()) return true;
  return false;
}

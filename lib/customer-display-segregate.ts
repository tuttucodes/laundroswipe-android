/**
 * Normalize messy bill/profile snapshots for admin tables: split embedded room from block text,
 * strip trailing college IDs from names, and keep block column to rollup keys (A, D1, D2) when possible.
 * Display-only — does not change stored bills or RPC rollups.
 */

import { normalizeHostelBlockKey } from '@/lib/hostel-block';

const EM_DASH = '—';

function clean(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isEmptyDisplay(s: string): boolean {
  return s === '' || s === EM_DASH;
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Pull room digits out of a combined block string (e.g. "A 317", "D1-828", "A block /room no:-1523").
 */
function tryExtractRoomFromBlock(block: string): { blockOnly: string; room: string } | null {
  const t = block.trim();
  if (!t) return null;

  let m = t.match(/^(.*?)\s*(?:\/\s*)?room\s*no\.?\s*:?\s*-?\s*(\d{1,5})\s*$/i);
  if (m && clean(m[1])) {
    return { blockOnly: clean(m[1]), room: m[2] };
  }

  m = t.match(/^(.*?)\s*\((\d{1,5})\)\s*$/);
  if (m && clean(m[1])) {
    return { blockOnly: clean(m[1]), room: m[2] };
  }

  m = t.match(/^(D\s*[- ]?\s*1|D1)\s*[- /\u2013\u2014]+\s*(\d{2,5})\s*$/i);
  if (m) return { blockOnly: 'D1', room: m[2] };

  m = t.match(/^(D\s*[- ]?\s*2|D2)\s*[- /\u2013\u2014]+\s*(\d{2,5})\s*$/i);
  if (m) return { blockOnly: 'D2', room: m[2] };

  m = t.match(/^(?:(?:BLOCK|BLK)\s*[-:]?\s*)?A\s+(\d{2,5})\s*$/i);
  if (m) return { blockOnly: 'A', room: m[1] };

  m = t.match(/^(.+?)\s+(\d{3,5})$/);
  if (m) {
    const prefix = clean(m[1]);
    const digits = m[2];
    const k = normalizeHostelBlockKey(prefix);
    if (k === 'A' || k === 'D1' || k === 'D2') {
      return { blockOnly: prefix, room: digits };
    }
  }

  return null;
}

function stripTrailingRoomFromBlock(block: string, room: string): string {
  if (!room || !block) return block;
  const esc = escapeReg(room);
  return block.replace(new RegExp(`[- /\u2013\u2014]${esc}\\s*$`, 'i'), '').trim();
}

/**
 * Split block vs room for dashboard columns; prefers rollup keys A / D1 / D2 when the text maps to them.
 */
export function segregateHostelBlockRoom(
  blockRaw: string | null | undefined,
  roomRaw: string | null | undefined,
): { block: string; room: string } {
  let b = clean(blockRaw);
  let r = clean(roomRaw);

  if (!b && !r) return { block: EM_DASH, room: EM_DASH };

  let roomOut = r;
  let blockWork = b;

  const extracted = tryExtractRoomFromBlock(blockWork);
  if (extracted) {
    blockWork = extracted.blockOnly;
    if (!roomOut) roomOut = extracted.room;
  }

  if (roomOut) {
    blockWork = stripTrailingRoomFromBlock(blockWork, roomOut);
  }

  const keyFromWork = normalizeHostelBlockKey(blockWork);
  const keyFromOriginal = normalizeHostelBlockKey(b);

  let blockOut: string;
  if (keyFromWork !== 'No block') {
    blockOut = keyFromWork;
  } else if (keyFromOriginal !== 'No block') {
    blockOut = keyFromOriginal;
  } else if (blockWork) {
    blockOut = blockWork;
  } else if (b) {
    blockOut = b;
  } else {
    blockOut = EM_DASH;
  }

  if (!roomOut) roomOut = EM_DASH;

  return {
    block: blockOut || EM_DASH,
    room: roomOut || EM_DASH,
  };
}

/**
 * Remove trailing registration / college ID from display name; align with reg column when it duplicates the tail.
 */
export function segregateNameAndReg(
  nameRaw: string | null | undefined,
  regRaw: string | null | undefined,
): { name: string; reg: string } {
  let name = clean(nameRaw);
  let reg = clean(regRaw);

  if (!name) return { name: EM_DASH, reg: reg || EM_DASH };

  if (reg && !isEmptyDisplay(reg)) {
    const re = new RegExp(`\\s+${escapeReg(reg)}\\s*$`, 'i');
    if (re.test(name)) {
      name = name.replace(re, '').trim();
      return { name: name || EM_DASH, reg };
    }
  }

  const college = name.match(/\s+(\d{2}[A-Z]{2,6}\d{2,6})\s*$/i);
  if (college) {
    const id = college[1].toUpperCase();
    name = name.slice(0, college.index).trim();
    if (!reg) reg = id;
    return { name: name || EM_DASH, reg: reg || EM_DASH };
  }

  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (/^\d{4,6}$/.test(last) && (!reg || reg === last)) {
      reg = reg || last;
      name = parts.slice(0, -1).join(' ');
      return { name: name || EM_DASH, reg };
    }
  }

  return { name: name || EM_DASH, reg: reg || EM_DASH };
}

export function segregateCustomerDisplay(fields: {
  customer_name: string;
  customer_reg_no: string;
  customer_hostel_block: string;
  customer_room_number: string;
}): {
  customer_name: string;
  customer_reg_no: string;
  customer_hostel_block: string;
  customer_room_number: string;
} {
  const nameIn = isEmptyDisplay(fields.customer_name) ? '' : fields.customer_name;
  const regIn = isEmptyDisplay(fields.customer_reg_no) ? '' : fields.customer_reg_no;
  const blockIn = isEmptyDisplay(fields.customer_hostel_block) ? '' : fields.customer_hostel_block;
  const roomIn = isEmptyDisplay(fields.customer_room_number) ? '' : fields.customer_room_number;

  const nr = segregateNameAndReg(nameIn, regIn);
  const br = segregateHostelBlockRoom(blockIn, roomIn);

  return {
    customer_name: nr.name,
    customer_reg_no: nr.reg,
    customer_hostel_block: br.block,
    customer_room_number: br.room,
  };
}

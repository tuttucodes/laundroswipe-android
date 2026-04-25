export const ESC = 0x1b;
export const GS = 0x1d;
export const FS = 0x1c;
export const LF = 0x0a;

export const CMD_INIT = new Uint8Array([ESC, 0x40]);
export const CMD_LF = new Uint8Array([LF]);

export const CMD_CUT_FULL = new Uint8Array([GS, 0x56, 0x00]);
export const CMD_CUT_PARTIAL = new Uint8Array([GS, 0x56, 0x01]);

export const BOLD_ON = new Uint8Array([ESC, 0x45, 0x01]);
export const BOLD_OFF = new Uint8Array([ESC, 0x45, 0x00]);
export const UNDERLINE_ON = new Uint8Array([ESC, 0x2d, 0x01]);
export const UNDERLINE_OFF = new Uint8Array([ESC, 0x2d, 0x00]);

export const ALIGN_LEFT = new Uint8Array([ESC, 0x61, 0x00]);
export const ALIGN_CENTER = new Uint8Array([ESC, 0x61, 0x01]);
export const ALIGN_RIGHT = new Uint8Array([ESC, 0x61, 0x02]);

export const FONT_NORMAL = new Uint8Array([GS, 0x21, 0x00]);
export const FONT_DH = new Uint8Array([GS, 0x21, 0x01]);
export const FONT_DW = new Uint8Array([GS, 0x21, 0x10]);
export const FONT_DWH = new Uint8Array([GS, 0x21, 0x11]);

export const CMD_DRAWER = new Uint8Array([ESC, 0x70, 0x00, 0x19, 0xfa]);

export const CODEPAGE_PC437 = 0;

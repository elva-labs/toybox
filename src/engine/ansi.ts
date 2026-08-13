export const RESET = '\x1b[0m';
export const BOLD = '\x1b[1m';
export const DIM = '\x1b[2m';
export const INVERSE = '\x1b[7m';

export const UNDERLINE = '\x1b[4m';

export const BLACK = '\x1b[30m';
export const RED = '\x1b[31m';
export const GREEN = '\x1b[32m';
export const YELLOW = '\x1b[33m';
export const BLUE = '\x1b[34m';
export const MAGENTA = '\x1b[35m';
export const CYAN = '\x1b[36m';
export const WHITE = '\x1b[37m';
export const GREY = '\x1b[90m';

/** Backgrounds, for games that need filled tiles. */
export const BG_GREEN = '\x1b[48;5;28m';
export const BG_YELLOW = '\x1b[48;5;136m';
export const BG_GREY = '\x1b[48;5;239m';
export const BG_RED = '\x1b[48;5;124m';

export const ALT_SCREEN_ON = '\x1b[?1049h';
export const ALT_SCREEN_OFF = '\x1b[?1049l';
export const HIDE_CURSOR = '\x1b[?25l';
export const SHOW_CURSOR = '\x1b[?25h';
export const HOME = '\x1b[H';
export const CLEAR = '\x1b[2J';
export const CLEAR_LINE = '\x1b[K';

export const paint = (text: string, ...codes: string[]) => `${codes.join('')}${text}${RESET}`;

/** Visible length, ignoring escape sequences. */
export const width = (text: string) => text.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').length;

export const pad = (text: string, to: number) => text + ' '.repeat(Math.max(0, to - width(text)));

/** Left-pads by half the slack, for centring inside a fixed width. */
export const centre = (text: string, to: number) =>
  ' '.repeat(Math.max(0, Math.floor((to - width(text)) / 2))) + text;

/**
 * Named keys. Anything not listed arrives as the literal character, so a digit
 * is '5' and a letter is 'a'.
 */
export const KEY = {
  up: '\x1b[A',
  down: '\x1b[B',
  right: '\x1b[C',
  left: '\x1b[D',
  delete: '\x1b[3~',
  enter: '\r',
  newline: '\n',
  escape: '\x1b',
  backspace: '\x7f',
  backspaceAlt: '\b',
  space: ' ',
  tab: '\t',
  ctrlC: '\x03',
} as const;

/** A paste or a fast key repeat can arrive as several keys in one chunk. */
export const parseKeys = (chunk: string): string[] =>
  chunk.match(/\x1b\[[0-9;]*[a-zA-Z~]|[\s\S]/g) ?? [];

export const isEnter = (key: string) => key === KEY.enter || key === KEY.newline;

export const isBackspace = (key: string) =>
  key === KEY.backspace || key === KEY.backspaceAlt || key === KEY.delete;

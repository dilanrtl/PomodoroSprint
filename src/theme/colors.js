export const Colors = {
  background: '#FAFAFA',
  primary: '#FFB69E',
  secondary: '#F9A7A7',
  text: '#4A4A4A',
  progressBackground: '#EDEDED',
  complementMint: '#CFFFE5',

  bgWork: '#FAFAFA',
  bgShort: '#FFF4F4',
  bgLong:  '#F7FFFB',

  pillBg: '#FFFFFF',
};

export const ModeTheme = {
  work:  { tint: Colors.primary,       bg: Colors.bgWork,  text: Colors.text, pillBg: Colors.pillBg },
  short: { tint: Colors.secondary,     bg: Colors.bgShort, text: Colors.text, pillBg: Colors.pillBg },
  long:  { tint: Colors.complementMint,bg: Colors.bgLong,  text: Colors.text, pillBg: Colors.pillBg },
};

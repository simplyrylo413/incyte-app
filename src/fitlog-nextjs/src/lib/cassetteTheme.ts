// Cassette-deck hardware theme tokens — ported from the standalone prototype's theme.jsx.
// Used by the hardware-aesthetic Today screen and Timer modals.

export type CassetteTheme = {
  appBg: string;
  chassisTop: string;
  chassisBottom: string;
  chassisInk: string;
  chassisRule: string;
  screw: string;
  screwSlot: string;
  panel: string;
  panelInner: string;
  panelInset: string;
  btnFace: string;
  btnFaceActive: string;
  btnEdge: string;
  keyEdge: string;
  btnInk: string;
  btnInkDim: string;
  tape: string;
  tapeShadow: string;
  cassetteBody: string;
  cassetteBodyShadow: string;
  tapeWindow: string;
  tapeLabel: string;
  reelHub: string;
  reelSpoke: string;
  reelCenter: string;
  lcdInk: string;
  lcdInkSecondary: string;
  lcdShadow: string;
  lcdLabel: string;
  accent: string;
  accentDim: string;
  success: string;
  danger: string;
  listBg: string;
  listInk: string;
  listInkDim: string;
  listRule: string;
  chipWork: string;
  chipWorkInk: string;
  chipWarm: string;
  chipWarmInk: string;
  chipNow: string;
  chipNowInk: string;
  rowRecoBg: string;
  rowRecoBorder: string;
  rowNowBg: string;
  rowNowBorder: string;
  rowDefaultBg: string;
  rowDefaultBorder: string;
  rowInset: string;
  keyOnBg: string;
  keyOnBorder: string;
  keyOnInset: string;
  keyOffBorder: string;
  keyOffInk: string;
  hwKeyBg: string;
  hwKeyBorder: string;
  hwKeyInset: string;
  recoToInk: string;
  isLight: boolean;
  navChassis: string;
  navKey: string;
  navKeyActive: string;
  navKeyInk: string;
  navKeyInkActive: string;
  navLabel: string;
  navGlyphInk: string;
  recallLabel: string;
  recallEmph: string;
  recallInk: string;
  recallRule: string;
  recallRuleStrong: string;
  recallTopBg: string;
  pagerLabel: string;
  pagerNum: string;
  pagerNumShadow: string;
  pagerDotIdle: string;
  recallStampInk: string;
  recallStampWeight: number;
  led: string;
  ledGreen: string;
  rubberFoot: string;
};

export const CASSETTE_DARK: CassetteTheme = {
  appBg: '#0a0a0a',
  chassisTop: '#1a1a1a',
  chassisBottom: '#0a0a0a',
  chassisInk: 'rgba(255,255,255,0.06)',
  chassisRule: 'rgba(255,255,255,0.05)',
  screw: 'radial-gradient(circle at 35% 35%, #6a6a6a 0%, #3a3a3a 50%, #1a1a1a 100%)',
  screwSlot: 'rgba(0,0,0,0.6)',
  panel: 'linear-gradient(170deg, #2c2c2a 0%, #1c1c1a 55%, #141413 100%)',
  panelInner: '#0a0a0a',
  panelInset: 'inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -1px 0 rgba(0,0,0,0.6), 0 18px 36px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.6)',
  btnFace: 'linear-gradient(180deg, #3a3a38 0%, #2a2a28 50%, #1a1a18 100%)',
  btnFaceActive: 'linear-gradient(180deg, #1a1a18 0%, #2a2a28 100%)',
  btnEdge: 'inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -2px 0 rgba(0,0,0,0.5), 0 2px 3px rgba(0,0,0,0.5)',
  keyEdge: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -2px 0 rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.3)',
  btnInk: 'rgba(255,255,255,0.92)',
  btnInkDim: 'rgba(255,255,255,0.55)',
  tape: 'linear-gradient(180deg, #5a544a 0%, #4a4438 25%, #3e3830 60%, #2c2620 100%)',
  tapeShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -2px 0 rgba(0,0,0,0.55), inset 1px 0 0 rgba(255,255,255,0.08), inset -1px 0 0 rgba(0,0,0,0.4), 0 6px 16px rgba(0,0,0,0.55), 0 1px 0 rgba(0,0,0,0.6)',
  cassetteBody: 'linear-gradient(180deg, rgba(248,245,235,0.96) 0%, rgba(228,222,206,0.94) 25%, rgba(208,200,182,0.92) 60%, rgba(186,178,160,0.94) 100%)',
  cassetteBodyShadow: 'inset 0 2px 1px rgba(255,255,255,1), inset 0 -2px 1px rgba(0,0,0,0.22), inset 2px 0 2px rgba(255,255,255,0.6), inset -2px 0 2px rgba(0,0,0,0.18), inset 0 0 0 1px rgba(255,255,255,0.7), 0 4px 12px rgba(0,0,0,0.4), 0 1px 0 rgba(0,0,0,0.35)',
  tapeWindow: 'linear-gradient(180deg, #1a1814 0%, #0a0906 50%, #050402 100%)',
  tapeLabel: 'rgba(255,255,255,0.5)',
  reelHub: 'radial-gradient(circle at 30% 30%, #6a655a 0%, #3a3630 60%, #1a1814 100%)',
  reelSpoke: '#1a1814',
  reelCenter: '#c9a23a',
  lcdInk: '#f6e84a',
  lcdInkSecondary: '#c9bf3a',
  lcdShadow: '0 0 12px rgba(246,232,74,0.45), 0 0 2px rgba(246,232,74,0.8)',
  lcdLabel: 'rgba(255,255,255,0.55)',
  accent: '#f6e84a',
  accentDim: 'rgba(246,232,74,0.7)',
  success: '#3ec97a',
  danger: '#e35454',
  listBg: 'transparent',
  listInk: 'rgba(255,255,255,0.9)',
  listInkDim: 'rgba(255,255,255,0.4)',
  listRule: 'rgba(255,255,255,0.07)',
  chipWork: 'linear-gradient(180deg, #2b6a44 0%, #1a4a30 100%)',
  chipWorkInk: '#a8f0c6',
  chipWarm: 'linear-gradient(180deg, #8a3030 0%, #5a1a1a 100%)',
  chipWarmInk: '#f0b8b8',
  chipNow: 'linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%)',
  chipNowInk: 'rgba(255,255,255,0.85)',
  rowRecoBg: 'radial-gradient(ellipse at 25% 140%, rgba(255,68,68,0.22), transparent 65%), linear-gradient(180deg, #2c1d1f, #1c1314)',
  rowRecoBorder: 'rgba(255,68,68,0.35)',
  rowNowBg: 'linear-gradient(180deg, #2a2c25, #1a1c16)',
  rowNowBorder: 'rgba(246,232,74,0.4)',
  rowDefaultBg: 'linear-gradient(180deg, #1f2125, #131517)',
  rowDefaultBorder: '#0a0a0b',
  rowInset: 'inset 0 1px 0 rgba(255,255,255,0.06)',
  keyOnBg: 'linear-gradient(180deg, #2c2c30, #18181b)',
  keyOnBorder: '#0a0a0b',
  keyOnInset: 'inset 0 1px 0 rgba(255,255,255,0.1)',
  keyOffBorder: 'rgba(255,255,255,0.12)',
  keyOffInk: 'rgba(255,255,255,0.28)',
  hwKeyBg: 'linear-gradient(180deg, #3a3a3e, #1f1f22)',
  hwKeyBorder: '#0a0a0b',
  hwKeyInset: 'inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -2px 0 rgba(0,0,0,0.5)',
  recoToInk: '#fff',
  isLight: false,
  navChassis: 'linear-gradient(180deg, #1f1f1f 0%, #0e0e0e 100%)',
  navKey: 'linear-gradient(180deg, #2c2c2c 0%, #1a1a1a 100%)',
  navKeyActive: 'linear-gradient(180deg, #f6e84a 0%, #c9a23a 100%)',
  navKeyInk: 'rgba(255,255,255,0.78)',
  navKeyInkActive: '#0a0a0a',
  navLabel: 'rgba(255,255,255,0.55)',
  navGlyphInk: '#f6e84a',
  recallLabel: 'rgba(255,255,255,0.35)',
  recallEmph: 'rgba(255,255,255,0.5)',
  recallInk: 'rgba(255,255,255,0.82)',
  recallRule: 'rgba(255,255,255,0.06)',
  recallRuleStrong: 'rgba(255,255,255,0.1)',
  recallTopBg: 'rgba(246,232,74,0.06)',
  pagerLabel: 'rgba(255,255,255,0.55)',
  pagerNum: '#f6e84a',
  pagerNumShadow: '0 0 12px rgba(246,232,74,0.45), 0 0 2px rgba(246,232,74,0.8)',
  pagerDotIdle: 'rgba(255,255,255,0.18)',
  recallStampInk: '#f6e84a',
  recallStampWeight: 400,
  led: '#ff3b3b',
  ledGreen: '#3ec97a',
  rubberFoot: 'radial-gradient(circle at 30% 30%, #2a2a2a, #0a0a0a)',
};

export const CASSETTE_LIGHT: CassetteTheme = {
  appBg: '#bdb7a6',
  chassisTop: '#d8d2c0',
  chassisBottom: '#bab4a2',
  chassisInk: 'rgba(40,38,30,0.55)',
  chassisRule: 'rgba(40,38,30,0.12)',
  screw: 'radial-gradient(circle at 35% 35%, #f0ebd8 0%, #b8b1a0 55%, #6a6458 100%)',
  screwSlot: 'rgba(0,0,0,0.5)',
  panel: 'linear-gradient(170deg, #efebde 0%, #d8d2c0 55%, #bab4a0 100%)',
  panelInner: '#bcb7a5',
  panelInset: 'inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -2px 0 rgba(0,0,0,0.15), 0 10px 22px rgba(0,0,0,0.18)',
  btnFace: 'linear-gradient(180deg, #efebde 0%, #d2cdbc 50%, #a8a290 100%)',
  btnFaceActive: 'linear-gradient(180deg, #a8a290 0%, #c2bdac 100%)',
  btnEdge: 'inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -2px 0 rgba(0,0,0,0.15), 0 2px 3px rgba(0,0,0,0.15)',
  keyEdge: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -2px 0 rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.3)',
  btnInk: 'rgba(40,38,30,0.8)',
  btnInkDim: 'rgba(40,38,30,0.5)',
  tape: 'linear-gradient(170deg, #f4f0e0 0%, #d8d2c0 35%, #b0a896 70%, #8a8474 100%)',
  tapeShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -2px 0 rgba(0,0,0,0.2), inset 1px 0 0 rgba(255,255,255,0.3), inset -1px 0 0 rgba(0,0,0,0.18), 0 5px 14px rgba(0,0,0,0.22), 0 1px 0 rgba(0,0,0,0.18)',
  cassetteBody: 'linear-gradient(180deg, rgba(248,245,235,0.98) 0%, rgba(238,232,215,0.97) 25%, rgba(220,212,192,0.97) 60%, rgba(200,192,172,0.98) 100%)',
  cassetteBodyShadow: 'inset 0 2px 1px rgba(255,255,255,0.9), inset 0 -1px 1px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.2)',
  tapeWindow: 'linear-gradient(180deg, #1e1c16 0%, #0c0b08 50%, #0a0906 100%)',
  tapeLabel: 'rgba(30,28,20,0.6)',
  reelHub: 'radial-gradient(circle at 30% 30%, #4a4438 0%, #2a2620 60%, #0e0c08 100%)',
  reelSpoke: '#0e0c08',
  reelCenter: '#c9a23a',
  lcdInk: '#f6e84a',
  lcdInkSecondary: '#d4c63a',
  lcdShadow: '0 0 10px rgba(246,232,74,0.4), 0 0 2px rgba(246,232,74,0.7)',
  lcdLabel: 'rgba(255,240,180,0.7)',
  accent: '#2c5fa8',
  accentDim: 'rgba(44,95,168,0.55)',
  success: '#2f9a5a',
  danger: '#c84545',
  listBg: 'transparent',
  listInk: '#1a1810',
  listInkDim: '#6a6458',
  listRule: 'rgba(40,38,30,0.12)',
  chipWork: 'linear-gradient(180deg, #4cc275 0%, #2f9a5a 100%)',
  chipWorkInk: '#000',
  chipWarm: 'linear-gradient(180deg, #d06a6a 0%, #b04545 100%)',
  chipWarmInk: '#3a0e0e',
  chipNow: 'linear-gradient(180deg, #ece8db 0%, #d6d1c0 100%)',
  chipNowInk: 'rgba(40,38,30,0.8)',
  rowRecoBg: 'radial-gradient(ellipse at 25% 150%, rgba(192,57,43,0.16), transparent 62%), linear-gradient(180deg, #f1e0dc, #e9d4cf)',
  rowRecoBorder: 'rgba(192,57,43,0.5)',
  rowNowBg: 'linear-gradient(180deg, #eef0df, #e2e4cd)',
  rowNowBorder: 'rgba(150,140,40,0.5)',
  rowDefaultBg: 'linear-gradient(180deg, #ece6d5, #ddd6c3)',
  rowDefaultBorder: '#c2bba6',
  rowInset: 'inset 0 1px 0 rgba(255,255,255,0.5)',
  keyOnBg: 'linear-gradient(180deg, #e6e0d0, #d2ccbb)',
  keyOnBorder: '#a9a290',
  keyOnInset: 'inset 0 1px 0 rgba(255,255,255,0.6)',
  keyOffBorder: 'rgba(40,38,28,0.18)',
  keyOffInk: '#1a1810',
  hwKeyBg: 'linear-gradient(180deg, #e6e0d0, #d2ccbb)',
  hwKeyBorder: '#a9a290',
  hwKeyInset: 'inset 0 1px 0 rgba(255,255,255,0.6)',
  recoToInk: '#26241c',
  isLight: true,
  navChassis: 'linear-gradient(180deg, #c6c0ae 0%, #aaa494 100%)',
  navKey: 'linear-gradient(180deg, #f0ecdf 0%, #d2cdbb 100%)',
  navKeyActive: 'linear-gradient(180deg, #f0e4a8 0%, #c9b240 100%)',
  navKeyInk: 'rgba(40,38,30,0.75)',
  navKeyInkActive: '#1a1810',
  navLabel: '#1a1810',
  navGlyphInk: '#1a1810',
  recallLabel: '#6a6458',
  recallEmph: '#3a3628',
  recallInk: 'rgba(38,36,28,0.86)',
  recallRule: 'rgba(40,38,28,0.1)',
  recallRuleStrong: 'rgba(40,38,28,0.18)',
  recallTopBg: 'rgba(154,138,20,0.14)',
  pagerLabel: 'rgba(40,38,30,0.62)',
  pagerNum: '#1a1810',
  pagerNumShadow: 'none',
  pagerDotIdle: 'rgba(40,38,30,0.24)',
  recallStampInk: '#161310',
  recallStampWeight: 700,
  led: '#c84545',
  ledGreen: '#2f9a5a',
  rubberFoot: 'radial-gradient(circle at 30% 30%, #7a7466, #3a3628)',
};

export function getCassetteTheme(isDark: boolean): CassetteTheme {
  return isDark ? CASSETTE_DARK : CASSETTE_LIGHT;
}

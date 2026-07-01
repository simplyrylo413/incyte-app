'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// ─── Theme System ───────────────────────────────────────────────

const THEMES: Record<string, any> = {
  dark: {
    appBg: '#0a0a0a',
    accent: '#f6e84a',
    success: '#3ec97a',
    danger: '#e35454',
    listBg: 'transparent',
    listInk: 'rgba(255,255,255,0.9)',
    listInkDim: 'rgba(255,255,255,0.4)',
    listRule: 'rgba(255,255,255,0.07)',
    navChassis: 'linear-gradient(180deg, #1f1f1f 0%, #0e0e0e 100%)',
    navKey: 'linear-gradient(180deg, #2c2c2c 0%, #1a1a1a 100%)',
    navKeyActive: 'linear-gradient(180deg, #f6e84a 0%, #c9a23a 100%)',
    navKeyInk: 'rgba(255,255,255,0.78)',
    navKeyInkActive: '#0a0a0a',
    navLabel: 'rgba(255,255,255,0.55)',
    navGlyphInk: '#f6e84a',
    led: '#ff3b3b',
    ledGreen: '#3ec97a',
    panel: 'linear-gradient(180deg, #242629 0%, #16181c 100%)',
    panelInset: '0 -10px 30px rgba(0,0,0,0.5)',
    isLight: false,
  },
  light: {
    appBg: '#bdb7a6',
    accent: '#2c5fa8',
    success: '#2f9a5a',
    danger: '#c84545',
    listBg: 'transparent',
    listInk: '#000',
    listInkDim: '#000',
    listRule: 'rgba(40,38,30,0.12)',
    navChassis: 'linear-gradient(180deg, #c6c0ae 0%, #aaa494 100%)',
    navKey: 'linear-gradient(180deg, #f0ecdf 0%, #d2cdbb 100%)',
    navKeyActive: 'linear-gradient(180deg, #f0e4a8 0%, #c9b240 100%)',
    navKeyInk: 'rgba(40,38,30,0.75)',
    navKeyInkActive: '#1a1810',
    navLabel: '#000',
    navGlyphInk: '#1a1810',
    led: '#c84545',
    ledGreen: '#2f9a5a',
    panel: 'linear-gradient(180deg, #e2ddcc 0%, #cdc7b4 100%)',
    panelInset: '0 -10px 30px rgba(0,0,0,0.3)',
    isLight: true,
  },
};

function useTheme(mode: string) {
  return THEMES[mode] || THEMES.dark;
}

// ─── LED ────────────────────────────────────────────────────────

function LED({ color = '#ff3b3b', size = 5, glow = true }: { color?: string; size?: number; glow?: boolean }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color,
      boxShadow: glow ? `0 0 ${size * 1.5}px ${color}, inset 0 0 1px rgba(255,255,255,0.5)` : 'none',
    }}/>
  );
}

// ─── Nav ────────────────────────────────────────────────────────

const G_MONO = '"JetBrains Mono", ui-monospace, monospace';
const G_LCD  = '"Share Tech Mono", "VT323", monospace';

function TDNav({ theme, currentTab, onTab, currentTime }: any) {
  const tabs = [
    { id: 'today', label: 'TODAY', icon: 'play' },
    { id: 'insights', label: 'INSIGHTS', icon: 'insights' },
    { id: 'plan', label: 'PLAN', icon: 'target' },
    { id: 'profile', label: 'PROFILE', icon: 'profile' },
  ];
  const isLight = theme.appBg !== '#0a0a0a';
  const icons: Record<string, React.ReactElement> = {
    play: (<svg width="16" height="16" viewBox="0 0 16 16"><polygon points="4,2 14,8 4,14" fill="currentColor"/></svg>),
    target: (<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" strokeWidth="1.6" stroke="currentColor"/><circle cx="9" cy="9" r="3.5" strokeWidth="1.6" stroke="currentColor"/><circle cx="9" cy="9" r="1" fill="currentColor"/></svg>),
    insights: (<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="5.5" r="1.5" fill={isLight ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)'}/><circle cx="18.5" cy="12" r="1.5" fill={isLight ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)'}/><circle cx="12" cy="18.5" r="1.5" fill={isLight ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)'}/><circle cx="5.5" cy="12" r="1.5" fill={isLight ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)'}/></svg>),
    profile: (<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4" fill={isLight ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)'}/><path d="M12 14c-5 0-8 2.5-8 5v3h16v-3c0-2.5-3-5-8-5z" fill={isLight ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)'}/></svg>),
  };
  return (
    <div style={{
      background: theme.navChassis,
      padding: '8px 14px 6px',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.6), 0 -10px 24px rgba(0,0,0,0.25)',
      position: 'relative',
    }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {tabs.map(t => {
            const active = t.id === currentTab;
            return (
              <div key={t.id} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <span style={{ flex: '0 0 6px', height: 1, background: active ? theme.accent : theme.navLabel, opacity: active ? 0.8 : 0.3 }}/>
                <span style={{ fontFamily: G_MONO, fontSize: 8.5, letterSpacing: 1.4, fontWeight: 700, color: active ? theme.accent : theme.navLabel, textShadow: active ? `0 0 4px ${theme.accent}` : 'none' }}>{t.label}</span>
                <span style={{ flex: '0 0 6px', height: 1, background: active ? theme.accent : theme.navLabel, opacity: active ? 0.8 : 0.3 }}/>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {tabs.map(t => {
            const active = t.id === currentTab;
            return (
              <button key={t.id} onClick={() => onTab && onTab(t.id)} style={{
                flex: 1, height: 42, position: 'relative',
                background: active ? theme.navKeyActive : theme.navKey,
                border: 'none', cursor: 'pointer', borderRadius: 5,
                boxShadow: active
                  ? 'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -2px 0 rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.4)'
                  : 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -2px 0 rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.3)',
                color: active ? theme.navKeyInkActive : theme.navKeyInk,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ position: 'absolute', top: 3, left: 0, right: 0, display: 'flex', justifyContent: 'space-around', padding: '0 6px' }}>
                  <LED color={active ? theme.led : 'rgba(255,255,255,0.15)'} size={3} glow={active}/>
                  <LED color={active ? theme.led : 'rgba(255,255,255,0.15)'} size={3} glow={active}/>
                </div>
                <span style={{ marginTop: 4 }}>{React.cloneElement(icons[t.icon], { fill: 'currentColor' })}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div style={{
        marginTop: 6, padding: '3px 8px 0',
        fontFamily: G_MONO, fontSize: 7.5, letterSpacing: 2.2,
        color: theme.navLabel, textAlign: 'center',
        borderTop: `1px solid ${theme.listRule}`, paddingTop: 5,
      }}>INCYTE · MDL-X7 · 04CH · {currentTime}</div>
    </div>
  );
}

// ─── Movement Editor Sheet ──────────────────────────────────────

function TDMoveEditor({ theme, editing, onChange, onRemove, onClose }: any) {
  const [sets, setSets] = useState(editing ? editing.sets : 3);
  const [reps, setReps] = useState(editing ? editing.reps : 10);
  useEffect(() => { if (editing) { setSets(editing.sets); setReps(editing.reps); } }, [editing]);
  if (!editing) return null;
  const isLight = theme.appBg !== '#0a0a0a';
  const panel = isLight ? 'linear-gradient(180deg, #e2ddcc 0%, #cdc7b4 100%)' : 'linear-gradient(180deg, #242629 0%, #16181c 100%)';
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={(e: React.MouseEvent) => e.stopPropagation()} style={{ width: '100%', background: panel, borderTopLeftRadius: 18, borderTopRightRadius: 18, boxShadow: '0 -10px 30px rgba(0,0,0,0.5)', padding: '14px 16px 24px', animation: 'tdSheet 0.24s ease-out' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 8, letterSpacing: 2, fontWeight: 700, color: theme.accent }}>{editing.part} · EDIT</span>
          <button onClick={onClose} style={{ background: 'transparent', border: `1px solid ${theme.listRule}`, color: theme.listInkDim, padding: '4px 10px', borderRadius: 5, fontFamily: 'Helvetica Neue, sans-serif', fontSize: 9, letterSpacing: 1.4, fontWeight: 700, cursor: 'pointer' }}>DONE</button>
        </div>
        <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 19, fontWeight: 800, color: theme.listInk, marginBottom: 16 }}>{editing.name}</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 8, letterSpacing: 1.6, fontWeight: 700, color: theme.listInkDim, marginBottom: 6, textAlign: 'center' }}>SETS</div>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
              <button onClick={() => { setSets(Math.max(1, sets - 1)); onChange({ ...editing, sets: Math.max(1, sets - 1), reps }); }} style={{ width: 40, borderRadius: 6, cursor: 'pointer', background: 'linear-gradient(180deg, #3a3a3e, #1f1f22)', border: '1px solid #0a0a0b', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)', color: theme.listInk, fontSize: 19, fontWeight: 700 }}>−</button>
              <div style={{ flex: 1, background: 'rgba(0,0,0,0.35)', borderRadius: 6, boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '9px 0' }}>
                <span style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 24, fontWeight: 700, color: theme.accent, fontVariantNumeric: 'tabular-nums' }}>{sets}</span>
              </div>
              <button onClick={() => { setSets(Math.min(10, sets + 1)); onChange({ ...editing, sets: Math.min(10, sets + 1), reps }); }} style={{ width: 40, borderRadius: 6, cursor: 'pointer', background: 'linear-gradient(180deg, #3a3a3e, #1f1f22)', border: '1px solid #0a0a0b', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)', color: theme.listInk, fontSize: 19, fontWeight: 700 }}>+</button>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 8, letterSpacing: 1.6, fontWeight: 700, color: theme.listInkDim, marginBottom: 6, textAlign: 'center' }}>REPS</div>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
              <button onClick={() => { setReps(Math.max(1, reps - 1)); onChange({ ...editing, sets, reps: Math.max(1, reps - 1) }); }} style={{ width: 40, borderRadius: 6, cursor: 'pointer', background: 'linear-gradient(180deg, #3a3a3e, #1f1f22)', border: '1px solid #0a0a0b', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)', color: theme.listInk, fontSize: 19, fontWeight: 700 }}>−</button>
              <div style={{ flex: 1, background: 'rgba(0,0,0,0.35)', borderRadius: 6, boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '9px 0' }}>
                <span style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 24, fontWeight: 700, color: theme.accent, fontVariantNumeric: 'tabular-nums' }}>{reps}</span>
              </div>
              <button onClick={() => { setReps(Math.min(30, reps + 1)); onChange({ ...editing, sets, reps: Math.min(30, reps + 1) }); }} style={{ width: 40, borderRadius: 6, cursor: 'pointer', background: 'linear-gradient(180deg, #3a3a3e, #1f1f22)', border: '1px solid #0a0a0b', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)', color: theme.listInk, fontSize: 19, fontWeight: 700 }}>+</button>
            </div>
          </div>
        </div>
        <button onClick={onRemove} style={{ width: '100%', padding: '12px 0', borderRadius: 7, cursor: 'pointer', background: 'transparent', border: `1px solid rgba(227,84,84,0.5)`, color: '#e35454', fontFamily: 'Helvetica Neue, sans-serif', fontSize: 10, letterSpacing: 1.6, fontWeight: 700 }}>✕ REMOVE MOVEMENT</button>
      </div>
    </div>
  );
}

// ─── Profile / Settings ─────────────────────────────────────────

function ProfileScreen({ theme, onModeChange, selectedTimer, onSelectTimer, onClose }: any) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div onClick={(e: React.MouseEvent) => e.stopPropagation()} style={{ background: theme.appBg, borderRadius: 16, padding: '24px', width: '80%', maxWidth: 280, boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 18, fontWeight: 800, color: theme.listInk }}>Settings</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: theme.listInk, fontSize: 20, cursor: 'pointer', fontWeight: 800 }}>✕</button>
        </div>
        <div style={{ textAlign: 'center' }}>
          <button onClick={() => { onModeChange && onModeChange(); }} style={{
            width: 100, height: 50, borderRadius: 25, cursor: 'pointer', padding: '0 6px', border: 'none',
            background: theme.appBg !== '#0a0a0a' ? 'linear-gradient(180deg, #b8b1a0, #a89c8a)' : 'linear-gradient(180deg, #3a3a3e, #1f1f22)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 8px rgba(0,0,0,0.3)',
            margin: '0 auto 12px'
          }}>
            <div style={{ fontSize: 18, opacity: theme.appBg === '#0a0a0a' ? 1 : 0.3 }}>🌙</div>
            <div style={{ fontSize: 18, opacity: theme.appBg === '#0a0a0a' ? 0.3 : 1 }}>☀</div>
          </button>
          <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 12, color: theme.listInkDim, marginBottom: 20 }}>{theme.appBg === '#0a0a0a' ? 'Dark Mode' : 'Light Mode'}</div>
        </div>
        <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${theme.listRule ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.1)'}` }}>
          <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 11, fontWeight: 800, color: theme.listInk, marginBottom: 12, letterSpacing: 0.5 }}>Default Timer</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {[
              { id: 'tabata', label: 'Tabata', desc: '20s work / 10s rest' },
              { id: 'emom', label: 'EMOM', desc: 'Every minute on minute' },
              { id: 'standard', label: 'Standard', desc: 'Countdown or stopwatch' }
            ].map((t: any) => (
              <button key={t.id} onClick={() => onSelectTimer(t.id)} style={{
                padding: '10px 12px', borderRadius: 6, border: selectedTimer === t.id ? `1.5px solid ${theme.accent}` : `1px solid ${theme.listRule ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.08)'}`,
                background: selectedTimer === t.id ? (theme.appBg === '#0a0a0a' ? 'rgba(246,232,74,0.08)' : 'rgba(44,95,168,0.08)') : 'transparent',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                cursor: 'pointer',
              }}>
                <div>
                  <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 10, fontWeight: 800, color: theme.listInk, textAlign: 'left' }}>{t.label}</div>
                  <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 8, color: theme.listInkDim, textAlign: 'left' }}>{t.desc}</div>
                </div>
                <div style={{ width: 12, height: 12, borderRadius: '50%', border: `1.5px solid ${theme.accent}`, background: selectedTimer === t.id ? theme.accent : 'transparent' }}/>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Timer Screen ───────────────────────────────────────────────

function TimerScreen({ theme, timerType, onClose }: any) {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [rounds, setRounds] = useState(0);
  const [isRest, setIsRest] = useState(false);
  const [emomDuration, setEmomDuration] = useState(5);
  const [emomElapsed, setEmomElapsed] = useState(0);
  const [tabataWork, setTabataWork] = useState(20);
  const [tabataRest, setTabataRest] = useState(10);
  const [standardCountType, setStandardCountType] = useState('down');
  const [standardDuration, setStandardDuration] = useState(120);
  const [setupMode, setSetupMode] = useState(true);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isRunning && timerType === 'tabata') {
      if (time > 0) { interval = setInterval(() => setTime((t: number) => t - 1), 1000); }
      else { setIsRest(!isRest); setTime(!isRest ? tabataRest : tabataWork); if (!isRest) setRounds((r: number) => r + 1); }
    } else if (isRunning && timerType === 'emom') {
      if (emomElapsed < emomDuration * 60) {
        interval = setInterval(() => { setTime((t: number) => t === 0 ? 60 : t - 1); setEmomElapsed((e: number) => e + 1); }, 1000);
      } else { setIsRunning(false); }
    } else if (isRunning && timerType === 'standard') {
      if (standardCountType === 'down') {
        if (time > 0) { interval = setInterval(() => setTime((t: number) => t - 1), 1000); } else { setIsRunning(false); }
      } else {
        if (time < standardDuration) { interval = setInterval(() => setTime((t: number) => t + 1), 1000); } else { setIsRunning(false); }
      }
    }
    return () => clearInterval(interval);
  }, [isRunning, time, timerType, isRest, emomDuration, emomElapsed, tabataWork, tabataRest, standardCountType, standardDuration]);

  const displayMinSec = `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110 }}>
      <div onClick={(e: React.MouseEvent) => e.stopPropagation()} style={{ width: '90%', maxWidth: 320, background: theme.appBg, borderRadius: 24, padding: '40px 24px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.9)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 11, fontWeight: 800, color: theme.accent, letterSpacing: 1.6 }}>{timerType?.toUpperCase()}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: theme.listInk, fontSize: 20, cursor: 'pointer', fontWeight: 800 }}>✕</button>
        </div>
        {setupMode && timerType === 'tabata' ? (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 12, fontWeight: 700, color: theme.listInkDim, marginBottom: 16, letterSpacing: 1.2 }}>CUSTOMIZE INTERVALS</div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 10, fontWeight: 800, color: theme.accent }}>WORK</div>
                <button onClick={() => setTabataWork(Math.max(1, tabataWork - 1))} style={{ width: '100%', padding: '8px 0', borderRadius: 6, cursor: 'pointer', background: 'linear-gradient(180deg, #3a3a3e, #1f1f22)', border: '1px solid #0a0a0b', color: theme.listInk, fontSize: 16, fontWeight: 700 }}>−</button>
                <div style={{ flex: 1, background: '#050607', borderRadius: 6, boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: 60 }}>
                  <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 40, fontWeight: 700, color: theme.accent }}>{tabataWork}</span>
                </div>
                <button onClick={() => setTabataWork(tabataWork + 1)} style={{ width: '100%', padding: '8px 0', borderRadius: 6, cursor: 'pointer', background: 'linear-gradient(180deg, #3a3a3e, #1f1f22)', border: '1px solid #0a0a0b', color: theme.listInk, fontSize: 16, fontWeight: 700 }}>+</button>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 10, fontWeight: 800, color: theme.listInkDim }}>REST</div>
                <button onClick={() => setTabataRest(Math.max(1, tabataRest - 1))} style={{ width: '100%', padding: '8px 0', borderRadius: 6, cursor: 'pointer', background: 'linear-gradient(180deg, #3a3a3e, #1f1f22)', border: '1px solid #0a0a0b', color: theme.listInk, fontSize: 16, fontWeight: 700 }}>−</button>
                <div style={{ flex: 1, background: '#050607', borderRadius: 6, boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: 60 }}>
                  <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 40, fontWeight: 700, color: theme.listInkDim }}>{tabataRest}</span>
                </div>
                <button onClick={() => setTabataRest(tabataRest + 1)} style={{ width: '100%', padding: '8px 0', borderRadius: 6, cursor: 'pointer', background: 'linear-gradient(180deg, #3a3a3e, #1f1f22)', border: '1px solid #0a0a0b', color: theme.listInk, fontSize: 16, fontWeight: 700 }}>+</button>
              </div>
            </div>
            <button onClick={() => { setSetupMode(false); setTime(tabataWork); setIsRest(false); }} style={{ width: '100%', padding: '14px 0', borderRadius: 8, cursor: 'pointer', fontWeight: 800, fontSize: 11, letterSpacing: 1.6, background: 'linear-gradient(180deg, #3a3a3e, #1f1f22)', border: '1px solid #0a0a0b', color: theme.accent, fontFamily: G_MONO }}>SET TIMER</button>
          </div>
        ) : setupMode && timerType === 'standard' ? (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 12, fontWeight: 700, color: theme.listInkDim, marginBottom: 16, letterSpacing: 1.2 }}>MODE</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button onClick={() => setStandardCountType('down')} style={{ flex: 1, padding: '12px 0', borderRadius: 6, cursor: 'pointer', background: standardCountType === 'down' ? 'linear-gradient(180deg, #3a3a3e, #1f1f22)' : 'transparent', border: `1px solid ${standardCountType === 'down' ? theme.accent : 'rgba(255,255,255,0.1)'}`, color: theme.accent, fontFamily: G_MONO, fontSize: 10, fontWeight: 800, letterSpacing: 1.2 }}>COUNT DOWN</button>
              <button onClick={() => setStandardCountType('up')} style={{ flex: 1, padding: '12px 0', borderRadius: 6, cursor: 'pointer', background: standardCountType === 'up' ? 'linear-gradient(180deg, #3a3a3e, #1f1f22)' : 'transparent', border: `1px solid ${standardCountType === 'up' ? theme.accent : 'rgba(255,255,255,0.1)'}`, color: theme.accent, fontFamily: G_MONO, fontSize: 10, fontWeight: 800, letterSpacing: 1.2 }}>COUNT UP</button>
            </div>
            <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 12, fontWeight: 700, color: theme.listInkDim, marginBottom: 16, letterSpacing: 1.2 }}>DURATION (MINUTES)</div>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, marginBottom: 20 }}>
              <button onClick={() => setStandardDuration(Math.max(60, standardDuration - 60))} style={{ width: 50, borderRadius: 6, cursor: 'pointer', background: 'linear-gradient(180deg, #3a3a3e, #1f1f22)', border: '1px solid #0a0a0b', color: theme.listInk, fontSize: 18, fontWeight: 700 }}>−</button>
              <div style={{ flex: 1, background: '#050607', borderRadius: 6, boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 36, fontWeight: 700, color: theme.accent }}>{Math.round(standardDuration / 60)}</span>
              </div>
              <button onClick={() => setStandardDuration(standardDuration + 60)} style={{ width: 50, borderRadius: 6, cursor: 'pointer', background: 'linear-gradient(180deg, #3a3a3e, #1f1f22)', border: '1px solid #0a0a0b', color: theme.listInk, fontSize: 18, fontWeight: 700 }}>+</button>
            </div>
            <button onClick={() => { setSetupMode(false); setTime(standardCountType === 'down' ? standardDuration : 0); setIsRunning(false); }} style={{ width: '100%', padding: '14px 0', borderRadius: 8, cursor: 'pointer', fontWeight: 800, fontSize: 11, letterSpacing: 1.6, background: 'linear-gradient(180deg, #3a3a3e, #1f1f22)', border: '1px solid #0a0a0b', color: theme.accent, fontFamily: G_MONO }}>SET TIMER</button>
          </div>
        ) : setupMode && timerType === 'emom' ? (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 12, fontWeight: 700, color: theme.listInkDim, marginBottom: 16, letterSpacing: 1.2 }}>SET DURATION</div>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, marginBottom: 20 }}>
              <button onClick={() => setEmomDuration(Math.max(1, emomDuration - 1))} style={{ width: 50, borderRadius: 6, cursor: 'pointer', background: 'linear-gradient(180deg, #3a3a3e, #1f1f22)', border: '1px solid #0a0a0b', color: theme.listInk, fontSize: 18, fontWeight: 700 }}>−</button>
              <div style={{ flex: 1, background: '#050607', borderRadius: 6, boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 48, fontWeight: 700, color: theme.accent }}>{emomDuration}</span>
              </div>
              <button onClick={() => setEmomDuration(emomDuration + 1)} style={{ width: 50, borderRadius: 6, cursor: 'pointer', background: 'linear-gradient(180deg, #3a3a3e, #1f1f22)', border: '1px solid #0a0a0b', color: theme.listInk, fontSize: 18, fontWeight: 700 }}>+</button>
            </div>
            <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 11, color: theme.listInkDim, marginBottom: 20 }}>MINUTES</div>
            <button onClick={() => setSetupMode(false)} style={{ width: '100%', padding: '14px 0', borderRadius: 8, cursor: 'pointer', fontWeight: 800, fontSize: 11, letterSpacing: 1.6, background: 'linear-gradient(180deg, #3a3a3e, #1f1f22)', border: '1px solid #0a0a0b', color: theme.accent, fontFamily: G_MONO }}>SET TIMER</button>
          </div>
        ) : (
          <>
            {timerType === 'tabata' && (
              <div style={{ marginBottom: 24, display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, textAlign: 'center', opacity: isRest ? 0.5 : 1, transition: 'opacity 0.3s' }}>
                  <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 10, fontWeight: 800, color: theme.accent, marginBottom: 8, letterSpacing: 1.2 }}>WORK</div>
                  <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 56, fontWeight: 700, color: theme.accent, lineHeight: 1, textShadow: `0 0 24px ${theme.accent}`, marginBottom: 8 }}>{isRest ? '--' : String(time).padStart(2, '0')}</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', opacity: isRest ? 1 : 0.5, transition: 'opacity 0.3s' }}>
                  <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 10, fontWeight: 800, color: theme.listInkDim, marginBottom: 8, letterSpacing: 1.2 }}>REST</div>
                  <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 56, fontWeight: 700, color: theme.listInkDim, lineHeight: 1, marginBottom: 8 }}>{isRest ? String(time).padStart(2, '0') : String(tabataRest).padStart(2, '0')}</div>
                </div>
              </div>
            )}
            {timerType !== 'tabata' && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 88, fontWeight: 700, color: theme.accent, lineHeight: 1, textShadow: `0 0 24px ${theme.accent}`, marginBottom: 12 }}>{displayMinSec}</div>
              </div>
            )}
            {timerType === 'tabata' && (
              <div style={{ marginBottom: 24, padding: '12px', background: 'rgba(246,232,74,0.05)', borderRadius: 8, border: `1px solid rgba(246,232,74,0.2)` }}>
                <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 8, color: theme.listInkDim, letterSpacing: 1.4, marginBottom: 6 }}>ROUND</div>
                <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 28, fontWeight: 700, color: theme.accent }}>{rounds} / 8</div>
              </div>
            )}
            {timerType === 'emom' && (
              <div style={{ marginBottom: 24, padding: '12px', background: 'rgba(246,232,74,0.05)', borderRadius: 8, border: `1px solid rgba(246,232,74,0.2)` }}>
                <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 8, color: theme.listInkDim, letterSpacing: 1.4, marginBottom: 6 }}>ELAPSED</div>
                <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 28, fontWeight: 700, color: theme.accent }}>{Math.floor(emomElapsed / 60)}:{String(emomElapsed % 60).padStart(2, '0')}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <button onClick={() => setIsRunning(!isRunning)} style={{ flex: 1, padding: '14px 0', borderRadius: 8, cursor: 'pointer', fontWeight: 800, fontSize: 11, letterSpacing: 1.6, background: 'linear-gradient(180deg, #3a3a3e, #1f1f22)', border: '1px solid #0a0a0b', color: theme.accent, fontFamily: G_MONO }}>{isRunning ? '⏸ PAUSE' : '▶ START'}</button>
              <button onClick={() => { setTime(tabataWork); setIsRunning(false); setRounds(0); setIsRest(false); setEmomElapsed(0); }} style={{ flex: 1, padding: '14px 0', borderRadius: 8, cursor: 'pointer', fontWeight: 800, fontSize: 11, letterSpacing: 1.6, background: 'linear-gradient(180deg, #3a3a3e, #1f1f22)', border: '1px solid #0a0a0b', color: theme.listInk, fontFamily: G_MONO }}>⟲ RESET</button>
            </div>
            <button onClick={onClose} style={{ width: '100%', padding: '12px 0', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: `1px dashed ${theme.listRule}`, color: theme.listInk, fontFamily: 'Helvetica Neue, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: 1.4 }}>CLOSE</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Generate Flow ──────────────────────────────────────────────

const GEN_EQUIP = ['FULL GYM', 'HOME GYM', 'DUMBBELLS', 'BODYWEIGHT', 'BANDS'];
const G_LIBRARY: Record<string, string[]> = {
  CHEST: ['Barbell Bench Press', 'Incline Dumbbell Press', 'Cable Fly', 'Machine Chest Press', 'Dumbbell Pullover', 'Push-Up'],
  SHOULDERS: ['Overhead Press', 'Lateral Raise', 'Arnold Press', 'Face Pull', 'Rear Delt Fly', 'Upright Row'],
  TRICEPS: ['Triceps Pushdown', 'Overhead Extension', 'Skull Crusher', 'Close-Grip Bench', 'Dips'],
  BACK: ['Pull-Up', 'Barbell Row', 'Lat Pulldown', 'Seated Cable Row', 'T-Bar Row'],
  BICEPS: ['Barbell Curl', 'Dumbbell Curl', 'Hammer Curl', 'Preacher Curl', 'Cable Curl'],
  LEGS: ['Back Squat', 'Romanian Deadlift', 'Leg Press', 'Leg Curl', 'Calf Raise', 'Walking Lunge'],
  CORE: ['Hanging Leg Raise', 'Cable Crunch', 'Plank', 'Ab Wheel'],
};

function GScreen({ theme, children, scroll = true }: any) {
  const [currentTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  });
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: theme.appBg, position: 'relative', overflow: 'hidden', fontFamily: 'Helvetica Neue, system-ui, sans-serif' }}>
      <div style={{ flex: 1, overflow: scroll ? 'auto' : 'hidden', padding: '52px 16px 150px' }}>{children}</div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 22, background: theme.navChassis }}>
        <TDNav theme={theme} currentTab="today" currentTime={currentTime}/>
      </div>
    </div>
  );
}

function GBack({ theme, label = 'AI · GENERATE', onBack }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
      <button onClick={() => { onBack && onBack(); }} aria-label="Back" style={{ width: 34, height: 32, borderRadius: 6, flex: '0 0 auto', background: 'linear-gradient(180deg, #3a3a3e, #1f1f22)', border: '1px solid #0a0a0b', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)', color: theme.listInk, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6L8 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      <span style={{ flex: 1, fontFamily: G_MONO, fontSize: 10, letterSpacing: 2.5, fontWeight: 800, color: theme.listInk }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: G_MONO, fontSize: 8, letterSpacing: 1.4, fontWeight: 700, color: theme.ledGreen }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: theme.ledGreen, boxShadow: `0 0 5px ${theme.ledGreen}` }}/>ARMED
      </span>
    </div>
  );
}

function GLabel({ theme, children, n }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: theme.accent, boxShadow: `0 0 5px ${theme.accent}` }}/>
      <span style={{ fontFamily: G_MONO, fontSize: 8.5, letterSpacing: 2, fontWeight: 800, color: theme.accent }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: theme.listRule }}/>
      {n && <span style={{ fontFamily: G_MONO, fontSize: 8, letterSpacing: 1, fontWeight: 700, color: theme.accent }}>{n}</span>}
    </div>
  );
}

function Chip({ theme, on, onClick, children }: any) {
  return (
    <button onClick={onClick} style={{
      position: 'relative', cursor: 'pointer', fontFamily: G_MONO, fontSize: 9.5, letterSpacing: 1.2, fontWeight: 800,
      padding: '14px 14px', borderRadius: 7,
      color: on ? '#1a1810' : theme.listInk,
      background: on ? theme.accent : 'linear-gradient(180deg, #2a2a2e, #1a1a1d)',
      border: on ? 'none' : '1px solid #0a0a0b',
      boxShadow: on ? '0 0 10px rgba(246,232,74,0.3), inset 0 1px 0 rgba(255,255,255,0.5)' : 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -2px 0 rgba(0,0,0,0.5)',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ position: 'absolute', top: 5, right: 5, width: 4, height: 4, borderRadius: '50%', background: on ? '#1a1810' : 'rgba(255,255,255,0.18)', boxShadow: on ? `0 0 4px #1a1810` : 'none' }}/>
      {children}
    </button>
  );
}

function GenConfigA({ theme, onBuild, onBack }: any) {
  const [time, setTime] = useState('30 MIN');
  const [parts, setParts] = useState<string[]>([]);
  const [focus, setFocus] = useState('MUSCLE');
  const [equip, setEquip] = useState('FULL GYM');
  const toggle = (p: string) => setParts((s: string[]) => s.includes(p) ? s.filter((x: string) => x !== p) : [...s, p]);
  const ALLP = ['CHEST','BACK','SHOULDERS','ARMS','LEGS','CORE'];

  return (
    <GScreen theme={theme}>
      <GBack theme={theme} onBack={onBack}/>
      <div style={{ fontFamily: 'Helvetica Neue', fontSize: 30, fontWeight: 800, color: theme.listInk, letterSpacing: -0.7, lineHeight: 1, marginBottom: 6 }}>Build me a<br/>session.</div>
      <div style={{ fontSize: 12.5, color: theme.listInkDim, marginBottom: 8, lineHeight: 1.4 }}>INCYTE picks the movements and loads from your history.</div>
      <button onClick={() => setEquip((e: string) => GEN_EQUIP[(GEN_EQUIP.indexOf(e) + 1) % GEN_EQUIP.length])} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24, padding: '5px 10px', borderRadius: 99, border: `1px solid ${theme.listRule}`, background: 'transparent', cursor: 'pointer' }}>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: theme.accent }}/>
        <span style={{ fontFamily: G_MONO, fontSize: 8, letterSpacing: 1.2, fontWeight: 700, color: theme.listInkDim }}>EQUIPMENT · {equip}</span>
        <span style={{ fontFamily: G_MONO, fontSize: 8, letterSpacing: 1.2, fontWeight: 800, color: theme.accent }}>EDIT</span>
      </button>
      <div style={{ marginBottom: 22 }}>
        <GLabel theme={theme}>SELECT TIME AVAILABLE</GLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {['30 MIN','45 MIN','60 MIN','75 MIN'].map((o: string) => <Chip key={o} theme={theme} on={o === time} onClick={() => setTime(o)}><span style={{ display: 'block', textAlign: 'center' }}>{o}</span></Chip>)}
        </div>
      </div>
      <div style={{ marginBottom: 22 }}>
        <GLabel theme={theme} n={`${parts.length} SELECTED`}>SELECT BODY PARTS</GLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {ALLP.map((p: string) => <Chip key={p} theme={theme} on={parts.includes(p)} onClick={() => toggle(p)}><span style={{ display: 'block', textAlign: 'center' }}>{p}</span></Chip>)}
        </div>
      </div>
      <div style={{ marginBottom: 22 }}>
        <GLabel theme={theme}>SELECT FOCUS</GLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {['MUSCLE','CARDIO','MIXED'].map((o: string) => <Chip key={o} theme={theme} on={o === focus} onClick={() => setFocus(o)}><span style={{ display: 'block', textAlign: 'center' }}>{o}</span></Chip>)}
        </div>
      </div>
      <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center' }}>
        <button onClick={onBuild} style={{
          position: 'relative', width: '100%', padding: '15px 0', borderRadius: 7, cursor: 'pointer',
          background: 'linear-gradient(180deg, #3a3a3e 0%, #2c2c30 50%, #1f1f22 100%)',
          border: '1px solid #0a0a0b',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -2px 0 rgba(0,0,0,0.5), 0 2px 5px rgba(0,0,0,0.55)',
          fontFamily: G_MONO, fontSize: 12, letterSpacing: 2, fontWeight: 800,
          color: theme.accent, textShadow: '0 0 8px rgba(246,232,74,0.5)',
        }}>
          <span aria-hidden style={{ position: 'absolute', top: 0, left: 8, right: 8, height: 1, background: 'linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.06))' }}/>
          ⚡ GENERATE WORKOUT
        </button>
      </div>
    </GScreen>
  );
}

// ─── Add Movement Screen ────────────────────────────────────────

const AM_PARTS = ['CHEST', 'BACK', 'SHOULDERS', 'ARMS', 'LEGS', 'CORE'];
const AM_EQUIP = ['FULL GYM', 'HOME GYM', 'DUMBBELLS', 'BODYWEIGHT', 'BANDS'];
const AM_PART_LIB: Record<string, string[]> = {
  CHEST: ['CHEST'], BACK: ['BACK'], SHOULDERS: ['SHOULDERS'],
  ARMS: ['TRICEPS', 'BICEPS'], LEGS: ['LEGS'], CORE: ['CORE'],
};

function GStepper({ theme, label, value, min, max, step, onChange }: any) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontFamily: G_MONO, fontSize: 7.5, letterSpacing: 1.6, fontWeight: 700, color: theme.listInkDim, marginBottom: 6, textAlign: 'center' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
        <button onClick={() => onChange(Math.max(min, value - step))} style={{ width: 38, borderRadius: 6, cursor: 'pointer', background: 'linear-gradient(180deg, #3a3a3e, #1f1f22)', border: '1px solid #0a0a0b', color: theme.listInk, fontSize: 18, fontWeight: 700 }}>−</button>
        <div style={{ flex: 1, background: '#050607', border: '1px solid #1f2226', borderRadius: 6, boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }}>
          <span style={{ fontFamily: G_LCD, fontSize: 26, color: theme.accent, textShadow: `0 0 10px rgba(246,232,74,0.5)` }}>{value}</span>
        </div>
        <button onClick={() => onChange(Math.min(max, value + step))} style={{ width: 38, borderRadius: 6, cursor: 'pointer', background: 'linear-gradient(180deg, #3a3a3e, #1f1f22)', border: '1px solid #0a0a0b', color: theme.listInk, fontSize: 18, fontWeight: 700 }}>+</button>
      </div>
    </div>
  );
}

function GMoveEditor({ theme, editing, onSave, onRemove, onClose }: any) {
  const [sets, setSets] = useState(editing ? editing.sets : 3);
  const [reps, setReps] = useState(editing ? editing.reps : 10);
  useEffect(() => { if (editing) { setSets(editing.sets); setReps(editing.reps); } }, [editing]);
  if (!editing) return null;
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={(e: React.MouseEvent) => e.stopPropagation()} style={{ width: '100%', background: theme.panel, borderTopLeftRadius: 18, borderTopRightRadius: 18, boxShadow: theme.panelInset, padding: '14px 16px 20px', animation: 'tdSheet 0.24s ease-out' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontFamily: G_MONO, fontSize: 8, letterSpacing: 2, fontWeight: 700, color: theme.accent }}>{editing.part} · EDIT</span>
          <button onClick={onClose} style={{ background: 'transparent', border: `1px solid ${theme.listRule}`, color: theme.listInkDim, padding: '3px 9px', borderRadius: 5, fontFamily: G_MONO, fontSize: 9, letterSpacing: 1.2, cursor: 'pointer' }}>DONE</button>
        </div>
        <div style={{ fontFamily: 'Helvetica Neue', fontSize: 19, fontWeight: 800, color: theme.listInk, marginBottom: 16 }}>{editing.name}</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <GStepper theme={theme} label="SETS" value={sets} min={1} max={10} step={1} onChange={(v: number) => { setSets(v); onSave({ ...editing, sets: v, reps }); }}/>
          <GStepper theme={theme} label="REPS" value={reps} min={1} max={30} step={1} onChange={(v: number) => { setReps(v); onSave({ ...editing, sets, reps: v }); }}/>
        </div>
        <button onClick={onRemove} style={{ width: '100%', padding: '12px 0', borderRadius: 7, cursor: 'pointer', background: 'transparent', border: `1px solid rgba(227,84,84,0.5)`, color: '#e35454', fontFamily: G_MONO, fontSize: 10, letterSpacing: 1.6, fontWeight: 700 }}>✕ REMOVE MOVEMENT</button>
      </div>
    </div>
  );
}

function AddMovementScreen({ theme, onDone, onBack }: any) {
  const [part, setPart] = useState<string | null>(null);
  const [equip, setEquip] = useState('FULL GYM');
  const [picked, setPicked] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);

  const pool = part
    ? (AM_PART_LIB[part] || []).flatMap((g: string) => (G_LIBRARY[g] || []).map((name: string) => ({ name, libGroup: g })))
    : [];
  const isPicked = (name: string) => picked.some((p: any) => p.name === name);

  function addMove(name: string) {
    if (isPicked(name)) { setPicked((p: any[]) => p.filter((x: any) => x.name !== name)); return; }
    setPicked((p: any[]) => [...p, { part, name, sets: 3, reps: 10 }]);
  }
  function saveMove(u: any) { setPicked((p: any[]) => p.map((m: any, i: number) => i === u.mi ? { ...m, sets: u.sets, reps: u.reps } : m)); }
  function removeMove() { if (editing) { setPicked((p: any[]) => p.filter((_: any, i: number) => i !== editing.mi)); setEditing(null); } }

  return (
    <GScreen theme={theme}>
      <GBack theme={theme} label="BUILD YOUR OWN" onBack={onBack}/>
      <div style={{ fontFamily: 'Helvetica Neue', fontSize: 22, fontWeight: 800, color: theme.listInk, letterSpacing: -0.4, marginBottom: 4 }}>Build your own</div>
      <div style={{ fontSize: 12, color: theme.listInkDim, marginBottom: 12 }}>{part ? 'Load movements from the crate below.' : 'Assemble a session one movement at a time.'}</div>
      <button onClick={() => setEquip((e: string) => AM_EQUIP[(AM_EQUIP.indexOf(e) + 1) % AM_EQUIP.length])}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 18, padding: '5px 10px', borderRadius: 99, border: `1px solid ${theme.listRule}`, background: 'transparent', cursor: 'pointer' }}>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: theme.accent, boxShadow: `0 0 4px ${theme.accent}` }}/>
        <span style={{ fontFamily: G_MONO, fontSize: 8, letterSpacing: 1.2, fontWeight: 700, color: theme.listInkDim }}>EQUIPMENT · {equip}</span>
        <span style={{ fontFamily: G_MONO, fontSize: 8, letterSpacing: 1.2, fontWeight: 800, color: theme.accent }}>EDIT</span>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: theme.accent, boxShadow: `0 0 5px ${theme.accent}` }}/>
        <span style={{ fontFamily: G_MONO, fontSize: 8.5, letterSpacing: 2, fontWeight: 800, color: theme.accent }}>SELECT BODY PART</span>
        <span style={{ flex: 1, height: 1, background: theme.listRule }}/>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 18 }}>
        {AM_PARTS.map((p: string) => {
          const on = p === part;
          const count = picked.filter((m: any) => m.part === p).length;
          return (
            <button key={p} onClick={() => setPart(on ? null : p)} style={{
              position: 'relative', padding: '14px 4px', borderRadius: 7, cursor: 'pointer',
              background: on ? theme.accent : 'linear-gradient(180deg, #2a2a2e, #1a1a1d)',
              border: on ? 'none' : '1px solid #0a0a0b',
              boxShadow: on ? '0 0 10px rgba(246,232,74,0.3)' : 'inset 0 1px 0 rgba(255,255,255,0.08)',
              fontFamily: G_MONO, fontSize: 9.5, letterSpacing: 1.2, fontWeight: 800,
              color: on ? '#1a1810' : theme.listInk,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
              <span style={{ position: 'absolute', top: 5, right: 5, width: 4, height: 4, borderRadius: '50%', background: on ? '#1a1810' : (count > 0 ? theme.accent : 'rgba(255,255,255,0.18)'), boxShadow: (on || count > 0) ? `0 0 4px ${on ? '#1a1810' : theme.accent}` : 'none' }}/>
              {p}
              {count > 0 && <span style={{ fontFamily: G_LCD, fontSize: 10, color: on ? '#1a1810' : theme.accent }}>{count}</span>}
            </button>
          );
        })}
      </div>
      {part && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: theme.accent, boxShadow: `0 0 5px ${theme.accent}` }}/>
            <span style={{ fontFamily: G_MONO, fontSize: 8.5, letterSpacing: 2, fontWeight: 800, color: theme.accent }}>SELECT MOVEMENT</span>
            <span style={{ flex: 1, height: 1, background: theme.listRule }}/>
            <span style={{ fontFamily: G_LCD, fontSize: 11, color: theme.accent }}>{part} · {String(pool.length).padStart(2, '0')}</span>
          </div>
          {pool.map((m: any, i: number) => {
            const on = isPicked(m.name);
            const pickedEntry = picked.find((x: any) => x.name === m.name);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'stretch', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 0, flex: '0 0 auto' }}/>
                <div style={{ flex: 1, borderRadius: 5, overflow: 'hidden', border: `1px solid ${on ? 'rgba(246,232,74,0.4)' : '#0a0a0b'}`, background: on ? 'linear-gradient(180deg, #2a2c25, #1a1c16)' : 'linear-gradient(180deg, #1f2125, #131517)' }}>
                  <button onClick={() => addMove(m.name)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', background: 'transparent', border: 'none', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ fontFamily: G_LCD, fontSize: 12, color: theme.listInkDim, width: 18, flex: '0 0 auto' }}>{String(i + 1).padStart(2, '0')}</span>
                    <span style={{ flex: 1, fontFamily: 'Helvetica Neue', fontSize: 13, fontWeight: 600, color: on ? theme.accent : theme.listInk }}>{m.name}</span>
                    {(AM_PART_LIB[part] || []).length > 1 && (
                      <span style={{ fontFamily: G_MONO, fontSize: 7, letterSpacing: 1, color: theme.listInkDim }}>{m.libGroup}</span>
                    )}
                    <span style={{
                      width: 30, height: 30, flex: '0 0 auto', borderRadius: 4, position: 'relative',
                      background: on ? theme.accent : 'linear-gradient(180deg, #2c2c30, #18181b)',
                      border: '1px solid #0a0a0b', boxShadow: on ? `0 0 8px rgba(246,232,74,0.4)` : 'inset 0 1px 0 rgba(255,255,255,0.1)',
                      color: on ? '#1a1810' : theme.accent, fontSize: on ? 14 : 16, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ position: 'absolute', top: 3, left: 3, width: 3, height: 3, borderRadius: '50%', background: on ? '#1a1810' : theme.accent, boxShadow: on ? 'none' : `0 0 4px ${theme.accent}` }}/>
                      {on ? '✓' : '+'}
                    </span>
                  </button>
                  {on && pickedEntry && (
                    <button onClick={() => setEditing({ mi: picked.indexOf(pickedEntry), part: pickedEntry.part, name: pickedEntry.name, sets: pickedEntry.sets, reps: pickedEntry.reps })}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: 'rgba(0,0,0,0.25)', border: 'none', borderTop: '1px solid rgba(246,232,74,0.15)', cursor: 'pointer' }}>
                      <span style={{ fontFamily: G_MONO, fontSize: 7.5, letterSpacing: 1.2, fontWeight: 700, color: theme.listInkDim }}>CUED</span>
                      <span style={{ marginLeft: 'auto', fontFamily: G_LCD, fontSize: 13, color: theme.accent, textShadow: `0 0 7px rgba(246,232,74,0.45)` }}>{pickedEntry.sets} × {pickedEntry.reps}</span>
                      <span style={{ fontFamily: G_MONO, fontSize: 10, color: theme.listInkDim }}>✎</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {picked.length > 0 && (
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 120 }}>
          <button onClick={() => picked.length && onDone && onDone(picked)} disabled={!picked.length} style={{
            display: 'flex', alignItems: 'center', width: '100%', padding: '12px 16px', borderRadius: 7,
            cursor: picked.length ? 'pointer' : 'default',
            background: 'linear-gradient(180deg, #3a3a3e 0%, #2c2c30 50%, #1f1f22 100%)',
            border: '1px solid #0a0a0b',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -2px 0 rgba(0,0,0,0.5), 0 3px 8px rgba(0,0,0,0.5)',
          }}>
            <span style={{ textAlign: 'left' }}>
              <span style={{ display: 'block', fontFamily: G_MONO, fontSize: 7, letterSpacing: 1.6, fontWeight: 700, color: theme.listInkDim }}>{picked.length ? `${picked.length} MOVE${picked.length > 1 ? 'S' : ''} CUED` : 'NO MOVES CUED'}</span>
              <span style={{ display: 'block', fontFamily: G_MONO, fontSize: 13, letterSpacing: 1.5, fontWeight: 800, color: picked.length ? theme.accent : 'rgba(255,255,255,0.3)', textShadow: picked.length ? '0 0 8px rgba(246,232,74,0.5)' : 'none' }}>ADD TO TODAY</span>
            </span>
            <span style={{ marginLeft: 'auto', width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800,
              background: picked.length ? theme.accent : 'rgba(255,255,255,0.08)',
              color: picked.length ? '#1a1810' : 'rgba(255,255,255,0.3)',
              boxShadow: picked.length ? `0 0 10px rgba(246,232,74,0.5)` : 'none' }}>→</span>
          </button>
        </div>
      )}
      <GMoveEditor theme={theme} editing={editing} onSave={saveMove} onRemove={removeMove} onClose={() => setEditing(null)}/>
    </GScreen>
  );
}

// ─── Today Screen (main export) ─────────────────────────────────

export default function TodayScreen() {
  const router = useRouter();
  const [mode, setMode] = useState(() => {
    if (typeof window === 'undefined') return 'dark';
    try { const s = localStorage.getItem('incyte:theme'); if (s === 'light' || s === 'dark') return s; } catch(e){}
    return 'dark';
  });
  const [todayMovements, setTodayMovements] = useState<any[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const s = localStorage.getItem('incyte:today-movements'); return s ? JSON.parse(s) : []; } catch(e) { return []; }
  });
  const [tab, setTab] = useState('today');
  const [showProfile, setShowProfile] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [selectedTimer, setSelectedTimer] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);
  const [showAddMovement, setShowAddMovement] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [localPlan, setLocalPlan] = useState<any>(null);

  const theme = useTheme(mode);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`);
    };
    update();
    const t = setInterval(update, 10000);
    return () => clearInterval(t);
  }, []);

  function pick(v: string) {
    setMode(v);
    try { localStorage.setItem('incyte:theme', v); } catch(e){}
  }

  function addMovementsToToday(movements: any[]) {
    const updated = [...todayMovements, ...movements];
    setTodayMovements(updated);
    try { localStorage.setItem('incyte:today-movements', JSON.stringify(updated)); } catch(e){}
  }

  const DEFAULT_PLAN = [
    { part: 'CHEST', moves: [{ name: 'Barbell Bench Press', sets: 4, reps: 8 }, { name: 'Incline Dumbbell Press', sets: 3, reps: 10 }] },
    { part: 'SHOULDERS', moves: [{ name: 'Overhead Press', sets: 3, reps: 8 }, { name: 'Lateral Raise', sets: 3, reps: 15 }] },
    { part: 'TRICEPS', moves: [{ name: 'Triceps Pushdown', sets: 3, reps: 12 }] },
  ];

  const hasTodayMovements = todayMovements.length > 0;
  const planned = hasTodayMovements;

  const basePlan = todayMovements.length > 0
    ? (() => {
        const grouped: Record<string, any[]> = {};
        todayMovements.forEach((m: any) => {
          if (!grouped[m.part]) grouped[m.part] = [];
          grouped[m.part].push({ name: m.name, sets: m.sets, reps: m.reps });
        });
        return Object.entries(grouped).map(([part, moves]) => ({ part, moves }));
      })()
    : DEFAULT_PLAN;

  const groupsData = localPlan || basePlan;

  const applyPlan = (next: any) => {
    setLocalPlan(next);
    const flat = next.flatMap((g: any) => g.moves.map((mv: any) => ({ part: g.part, name: mv.name, sets: mv.sets, reps: mv.reps })));
    setTodayMovements(flat);
    try { localStorage.setItem('incyte:today-movements', JSON.stringify(flat)); } catch(e){}
  };

  function commitEdit(u: any) {
    applyPlan(groupsData.map((g: any, gi: number) => gi !== u.gi ? g : { ...g, moves: g.moves.map((m: any, mi: number) => mi === u.mi ? { name: u.name, sets: u.sets, reps: u.reps } : m) }));
  }

  function removeEdit() {
    if (editing) applyPlan(groupsData.map((g: any, gi: number) => gi !== editing.gi ? g : { ...g, moves: g.moves.filter((_: any, mi: number) => mi !== editing.mi) }).filter((g: any) => g.moves.length));
    setEditing(null);
  }

  if (showGenerate) {
    return <GenConfigA theme={theme} onBuild={() => setShowGenerate(false)} onBack={() => setShowGenerate(false)} />;
  }

  if (showAddMovement) {
    return <AddMovementScreen theme={theme} onBack={() => setShowAddMovement(false)} onDone={(picked: any[]) => { addMovementsToToday(picked); setShowAddMovement(false); }} />;
  }

  return (
    <>
      <style>{`
        @keyframes tdSheet { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes amBlink { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        *::-webkit-scrollbar { display: none; }
        * { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        background: theme.appBg, position: 'relative', overflow: 'hidden',
        fontFamily: 'Helvetica Neue, system-ui, sans-serif',
      }}>
        <div style={{ flex: 1, overflow: 'auto', padding: '52px 16px 150px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
            <span style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 9, letterSpacing: 2.5, fontWeight: 800, color: theme.listInk }}>INCYTE</span>
            <span style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 8, letterSpacing: 1.6, color: theme.listInkDim }}>FRI · MAR 14 · DAY 12</span>
          </div>

          {/* Hero */}
          <div style={{ marginBottom: 26 }}>
            <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 9, letterSpacing: 2.5, fontWeight: 700, color: theme.listInkDim, marginBottom: 8 }}>GOOD MORNING, ALEX</div>
            <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 38, fontWeight: 800, color: theme.listInk, letterSpacing: -1, lineHeight: 0.98 }}>
              Strength is<br/>a <span style={{ color: theme.accent }}>habit.</span>
            </div>
            <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 14, color: theme.listInk, marginTop: 10, lineHeight: 1.4, fontWeight: 600 }}>{planned ? 'Twelve days straight. Keep the streak alive.' : 'Let\'s build today\'s session.'}</div>
          </div>

          {planned ? (
            <div style={{ padding: '0 2px', marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 8.5, letterSpacing: 2.5, fontWeight: 700, color: theme.listInkDim }}>TRAINING TODAY</span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                {groupsData.map((g: any, i: number) => (
                  <span key={i} style={{
                    position: 'relative', fontFamily: G_MONO, fontSize: 9.5, letterSpacing: 1.2, fontWeight: 800,
                    padding: '11px 16px', borderRadius: 7,
                    color: '#1a1810', background: theme.accent,
                    boxShadow: '0 0 10px rgba(246,232,74,0.3), inset 0 1px 0 rgba(255,255,255,0.5)',
                  }}>
                    <span style={{ position: 'absolute', top: 5, right: 5, width: 4, height: 4, borderRadius: '50%', background: '#1a1810' }}/>
                    {g.part}
                  </span>
                ))}
              </div>

              <div style={{ display: 'flex', marginBottom: 16, borderTop: `1px solid ${theme.listRule}`, borderBottom: `1px solid ${theme.listRule}` }}>
                {([['EXERCISES','5'],['SETS','18'],['EST','52m']] as [string,string][]).map(([l,v],i) => (
                  <div key={i} style={{ flex: 1, padding: '10px 0', borderLeft: i ? `1px solid ${theme.listRule}` : 'none', paddingLeft: i ? 12 : 0 }}>
                    <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 6.5, letterSpacing: 1.4, color: theme.listInkDim, marginBottom: 3 }}>{l}</div>
                    <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 22, fontWeight: 700, color: theme.listInk }}>{v}</div>
                  </div>
                ))}
              </div>

              <button onClick={() => {
                const flat = groupsData.flatMap((g: any) => g.moves.map((mv: any) => ({ name: mv.name, part: g.part, sets: mv.sets, reps: mv.reps, weight: mv.weight || 135 })));
                if (flat.length) router.push(`/workout/${encodeURIComponent(flat[0].name)}`);
              }} style={{
                position: 'relative', width: '100%', padding: '15px 0', borderRadius: 7, cursor: 'pointer',
                background: 'linear-gradient(180deg, #3a3a3e 0%, #2c2c30 50%, #1f1f22 100%)',
                border: '1px solid #0a0a0b',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -2px 0 rgba(0,0,0,0.5), 0 2px 5px rgba(0,0,0,0.55)',
                fontFamily: G_MONO, fontSize: 12, letterSpacing: 2.5, fontWeight: 800,
                color: theme.accent, textShadow: '0 0 8px rgba(246,232,74,0.5)',
              }}>▶ START WORKOUT</button>

              <div style={{ marginTop: 18 }}>
                {(() => {
                  let flat = -1;
                  return groupsData.map((grp: any, gi: number) => (
                    <div key={gi} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 8, letterSpacing: 2, fontWeight: 800, color: theme.accent }}>{grp.part}</span>
                        <span style={{ flex: 1, height: 1, background: theme.listRule }}/>
                        <span style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 8, letterSpacing: 1, fontWeight: 700, color: theme.listInkDim }}>{String(grp.moves.length).padStart(2, '0')}</span>
                      </div>
                      {grp.moves.map((mv: any, mi: number) => {
                        const n = mv.name, s = `${mv.sets} × ${mv.reps}`;
                        flat += 1;
                        return (
                          <div key={mi} style={{ display: 'flex', alignItems: 'stretch', gap: 8, marginBottom: 6 }}>
                            <div style={{ width: 0, flex: '0 0 auto' }}/>
                            <div style={{
                              flex: 1, display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px',
                              background: 'linear-gradient(180deg, #1f2125, #131517)',
                              borderRadius: 5, border: '1px solid #0a0a0b',
                              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                            }}>
                              <button onClick={() => router.push(`/workout/${encodeURIComponent(n)}`)}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 9, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                                <span style={{
                                  width: 18, height: 18, flex: '0 0 auto', borderRadius: '50%',
                                  border: `1.5px solid ${theme.accent}`,
                                  background: theme.appBg, color: theme.accent,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 8, paddingLeft: 1,
                                  boxShadow: `0 0 8px rgba(246,232,74,0.45)`,
                                }}>▶</span>
                                <span style={{ flex: 1, fontFamily: 'Helvetica Neue, sans-serif', fontSize: 13, fontWeight: 600, color: theme.listInk }}>{n}</span>
                              </button>
                              <button onClick={() => setEditing({ gi, mi, part: grp.part, name: n, sets: mv.sets, reps: mv.reps })}
                                style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', background: 'transparent', border: 'none', padding: '2px 4px', cursor: 'pointer' }}>
                                <span style={{ fontFamily: G_LCD, fontSize: 13, fontWeight: 600, color: theme.accent, textShadow: `0 0 7px rgba(246,232,74,0.45)` }}>{s}</span>
                              </button>
                              <button onClick={() => setDeleteConfirm({ gi, mi, name: n })} style={{
                                flex: '0 0 auto', width: 26, height: 26, borderRadius: 4, marginLeft: 2,
                                background: 'linear-gradient(180deg, #2c2c30, #18181b)', border: '1px solid #0a0a0b',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)', cursor: 'pointer',
                                color: theme.danger, fontSize: 11, fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                              }}>
                                <span style={{ position: 'absolute', top: 3, left: 3, width: 3, height: 3, borderRadius: '50%', background: theme.danger, boxShadow: `0 0 4px ${theme.danger}` }}/>✕
                              </button>
                              <button onClick={() => setEditing({ gi, mi, part: grp.part, name: n, sets: mv.sets, reps: mv.reps })} style={{
                                flex: '0 0 auto', width: 26, height: 26, borderRadius: 4, marginLeft: 2,
                                background: 'linear-gradient(180deg, #2c2c30, #18181b)', border: '1px solid #0a0a0b',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)', cursor: 'pointer',
                                color: theme.success, fontSize: 11, fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                              }}>
                                <span style={{ position: 'absolute', top: 3, left: 3, width: 3, height: 3, borderRadius: '50%', background: theme.success, boxShadow: `0 0 4px ${theme.success}` }}/>✎
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ));
                })()}
                <button onClick={() => setShowAddMovement(true)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  marginTop: 8, padding: '13px 0', borderRadius: 8, cursor: 'pointer',
                  background: 'transparent', border: `1px dashed ${theme.listRule}`,
                }}>
                  <span style={{ width: 20, height: 20, flex: '0 0 auto', borderRadius: '50%', border: `1.5px solid ${theme.accent}`, color: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, boxShadow: `0 0 8px rgba(246,232,74,0.25)` }}>+</span>
                  <span style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 10, letterSpacing: 1.6, fontWeight: 800, color: theme.listInk }}>ADD MOVEMENT</span>
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: '0 2px', marginBottom: 22 }}>
              <div style={{ fontFamily: G_MONO, fontSize: 8.5, letterSpacing: 2.5, fontWeight: 700, color: theme.listInkDim, marginBottom: 10 }}>HOW DO YOU WANT TO START</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                {[
                  { icon: '⚡', t: 'GENERATE', s: 'AI builds it', rec: true, label: 'CH-01 AUTO' },
                  { icon: '+', t: 'BUILD YOUR OWN', s: 'Add movement', label: 'CH-02 MAN' },
                ].map((b, i) => (
                  <div key={i} onClick={i === 0 ? () => setShowGenerate(true) : () => setShowAddMovement(true)} style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg, #3a3a3e, #2c2c30 50%, #1f1f22)', border: '1px solid #0a0a0b', borderRadius: 8, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)', padding: '14px 10px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <div style={{ position: 'absolute', top: 6, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 10, paddingRight: 10 }}>
                      <span style={{ fontFamily: G_MONO, fontSize: 7, letterSpacing: 1.6, fontWeight: 800, color: theme.accent }}>{b.label}</span>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: theme.accent, boxShadow: `0 0 6px ${theme.accent}` }}/>
                    </div>
                    <span style={{ width: 38, height: 38, borderRadius: '50%', background: theme.accent, color: '#1a1810', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: b.icon === '+' ? 22 : 18, fontWeight: 800, marginTop: 8, boxShadow: `0 0 12px rgba(246,232,74,0.4)` }}>{b.icon}</span>
                    <span style={{ fontFamily: G_MONO, fontSize: 10, letterSpacing: 1.4, fontWeight: 800, color: theme.listInk }}>{b.t}</span>
                    <span style={{ fontSize: 11, color: theme.listInkDim }}>{b.s}</span>
                    {b.rec && <span style={{ fontFamily: G_MONO, fontSize: 7, letterSpacing: 1.2, fontWeight: 700, color: theme.accent }}>RECOMMENDED</span>}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                {([['STREAK','12','DAYS'],['THIS WK','4','SESS'],['VOLUME','38K','LB']] as [string,string,string][]).map(([l,v,u],i) => (
                  <div key={i} style={{ flex: 1, background: '#050607', border: '1px solid #1f2226', borderRadius: 6, padding: '9px 8px', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.9)' }}>
                    <div style={{ fontFamily: G_MONO, fontSize: 6.5, letterSpacing: 1.4, color: theme.listInkDim, marginBottom: 3 }}>{l}</div>
                    <div style={{ fontFamily: G_LCD, fontSize: 22, color: theme.accent, textShadow: `0 0 9px rgba(246,232,74,0.5)` }}>{v}</div>
                    <div style={{ fontFamily: G_MONO, fontSize: 6, letterSpacing: 1, color: 'rgba(255,255,255,0.3)' }}>{u}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10, padding: '12px', borderRadius: 8, background: 'rgba(246,232,74,0.05)', border: `1px solid rgba(246,232,74,0.25)` }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3ec97a', boxShadow: '0 0 6px #3ec97a', marginTop: 3 }}/>
                <div>
                  <div style={{ fontFamily: G_MONO, fontSize: 8, letterSpacing: 1.6, fontWeight: 800, color: theme.accent, marginBottom: 3 }}>AI COACH</div>
                  <div style={{ fontSize: 12, color: theme.listInk, lineHeight: 1.5 }}>You&apos;ve hit push twice this week. A <b style={{ color: theme.accent }}>pull day</b> would balance your volume — want me to build one?</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Nav */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 22, background: theme.navChassis }}>
          <TDNav theme={theme} currentTab={tab} onTab={(id: string) => {
            if (id === 'profile') { setShowProfile(true); return; }
            if (id === 'insights') { router.push('/momentum'); return; }
            if (id === 'plan') { router.push('/plan'); return; }
            setTab(id);
          }} currentTime={currentTime}/>
        </div>

        {/* Overlays */}
        {showProfile && (
          <ProfileScreen
            theme={theme}
            onModeChange={() => pick(mode === 'dark' ? 'light' : 'dark')}
            selectedTimer={selectedTimer}
            onSelectTimer={(timer: string) => { setSelectedTimer(timer); setShowTimer(true); setShowProfile(false); }}
            onClose={() => setShowProfile(false)}
          />
        )}

        <TDMoveEditor theme={theme} editing={editing} onChange={commitEdit} onRemove={removeEdit} onClose={() => setEditing(null)}/>

        {showTimer && selectedTimer && <TimerScreen theme={theme} timerType={selectedTimer} onClose={() => setShowTimer(false)}/>}

        {deleteConfirm && (
          <div onClick={() => setDeleteConfirm(null)} style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }}>
            <div onClick={(e: React.MouseEvent) => e.stopPropagation()} style={{ width: '100%', background: 'linear-gradient(180deg, #242629, #16181c)', borderTopLeftRadius: 18, borderTopRightRadius: 18, boxShadow: '0 -10px 30px rgba(0,0,0,0.5)', padding: '16px 16px 24px', animation: 'tdSheet 0.24s ease-out' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: theme.danger, boxShadow: `0 0 6px ${theme.danger}` }}/>
                <span style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 8, letterSpacing: 2, fontWeight: 800, color: theme.danger }}>REMOVE MOVEMENT</span>
              </div>
              <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 18, fontWeight: 800, color: theme.listInk, marginBottom: 4 }}>Remove {deleteConfirm.name}?</div>
              <div style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: 12, color: theme.listInkDim, marginBottom: 16 }}>This takes it off today&apos;s plan.</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '13px 0', borderRadius: 7, cursor: 'pointer', background: 'transparent', border: `1px solid ${theme.listRule}`, fontFamily: G_MONO, fontSize: 10, letterSpacing: 1.6, fontWeight: 700, color: theme.listInk }}>CANCEL</button>
                <button onClick={() => {
                  applyPlan(groupsData.map((g: any, gi: number) => gi !== deleteConfirm.gi ? g : { ...g, moves: g.moves.filter((_: any, mi: number) => mi !== deleteConfirm.mi) }).filter((g: any) => g.moves.length));
                  setDeleteConfirm(null);
                }} style={{ flex: 1.4, padding: '13px 0', borderRadius: 7, cursor: 'pointer', background: theme.danger, border: 'none', fontFamily: G_MONO, fontSize: 10, letterSpacing: 1.6, fontWeight: 800, color: '#fff' }}>✕ REMOVE</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export const appTheme = {
  accent: '#7dd3fc',
  accentSoft: '#a78bfa',
  glass: {
    background: 'rgba(8, 12, 24, 0.72)',
    border: 'rgba(255, 255, 255, 0.16)',
    blur: '28px',
    shadow: '0 20px 55px rgba(2, 6, 23, 0.65)'
  },
  surface: '#05070f',
  text: {
    primary: 'rgba(248, 250, 255, 0.94)',
    secondary: 'rgba(202, 214, 235, 0.75)'
  },
  radius: '18px'
};

export const applyTheme = () => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const entries: Record<string, string> = {
    '--accent': appTheme.accent,
    '--accent-soft': appTheme.accentSoft,
    '--glass-bg': appTheme.glass.background,
    '--glass-border': appTheme.glass.border,
    '--glass-blur': appTheme.glass.blur,
    '--glass-shadow': appTheme.glass.shadow,
    '--surface': appTheme.surface,
    '--text-primary': appTheme.text.primary,
    '--text-secondary': appTheme.text.secondary,
    '--window-radius': appTheme.radius
  };

  Object.entries(entries).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
};

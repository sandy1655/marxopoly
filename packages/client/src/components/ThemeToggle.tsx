import { toggleTheme, useTheme } from '../theme.js';

export default function ThemeToggle() {
  const dark = useTheme() === 'dark';
  return (
    <button
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}

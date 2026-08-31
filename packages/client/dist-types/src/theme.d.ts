export type Theme = 'dark' | 'light';
export declare function getTheme(): Theme;
export declare function setTheme(theme: Theme): void;
export declare function toggleTheme(): void;
/** Re-assert the stored theme on the <html> element (the inline script in
 *  index.html already does this before first paint; this keeps us in sync). */
export declare function initTheme(): void;
export declare function useTheme(): Theme;
//# sourceMappingURL=theme.d.ts.map
// Shared theme configuration

import { ThemeMode } from './types';

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  border: string;
  accent: string;
}

export const themes: Record<ThemeMode, ThemeColors> = {
  light: {
    primary: '#3f51b5',
    secondary: '#f50057',
    background: '#ffffff',
    text: '#333333',
    border: '#e0e0e0',
    accent: '#ff9800'
  },
  dark: {
    primary: '#7986cb',
    secondary: '#ff4081',
    background: '#303030',
    text: '#ffffff',
    border: '#424242',
    accent: '#ffb74d'
  }
};

export const getThemeClass = (mode: ThemeMode): string => {
  return `theme-${mode}`;
};
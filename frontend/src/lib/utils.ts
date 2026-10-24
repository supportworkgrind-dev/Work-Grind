import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';
import { formatDate as formatLocalizedDate, formatRelativeTime, getActiveLanguage } from '@/lib/i18n/core';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// date-fns patterns used across the app, as Intl options for other languages.
const INTL_PATTERNS: Record<string, Intl.DateTimeFormatOptions> = {
  'MMM d, yyyy': { month: 'short', day: 'numeric', year: 'numeric' },
  'MMM d, yyyy h:mm a': { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' },
  'MMM d, yyyy · h:mm a': { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' },
  'MMM d, h:mm a': { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
  'MMM d': { month: 'short', day: 'numeric' },
  'MMMM yyyy': { month: 'long', year: 'numeric' },
  'h:mm a': { hour: 'numeric', minute: '2-digit' },
  'EEEE': { weekday: 'long' },
  'EEE': { weekday: 'short' },
};

/** Formats in the interface language (English keeps its date-fns pattern). */
export function formatDate(dateString?: string | Date, fmt: string = 'MMM d, yyyy') {
  if (!dateString) return '';
  try {
    const lang = getActiveLanguage();
    if (lang !== 'en') return formatLocalizedDate(dateString, INTL_PATTERNS[fmt] ?? INTL_PATTERNS['MMM d, yyyy'], lang);
    return format(new Date(dateString), fmt);
  } catch {
    return '';
  }
}

export function formatTimeAgo(dateString?: string | Date) {
  if (!dateString) return '';
  try {
    const lang = getActiveLanguage();
    if (lang !== 'en') return formatRelativeTime(dateString, lang);
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return '';
  }
}

export function formatBytes(bytes: number, decimals: number = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function getInitials(name: string) {
  if (!name) return 'WG';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

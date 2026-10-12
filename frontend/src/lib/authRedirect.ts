export function getSafeReturnPath(value: string | null | undefined): string | undefined {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return undefined;

  try {
    const url = new URL(value, 'https://workgrind.invalid');
    if (url.origin !== 'https://workgrind.invalid') return undefined;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return undefined;
  }
}

export function isOAuthCallbackRequest(url: string): boolean {
  const path = url.split('?', 1)[0];
  return /(?:^|\/)auth\/oauth\/(?:google|apple|linkedin)\/callback$/.test(path);
}

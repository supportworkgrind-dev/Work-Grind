/** YouTube publishing constants (dependency-free so OAuth and publishing code can share them). */
export const YOUTUBE_UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload';
/** Read-only access is required to identify the authorized channel (channels.list mine=true). */
export const YOUTUBE_READONLY_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
export const YOUTUBE_PUBLISHING_SCOPES = [YOUTUBE_UPLOAD_SCOPE, YOUTUBE_READONLY_SCOPE];

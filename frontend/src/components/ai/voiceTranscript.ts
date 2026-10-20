export type VoiceSpeaker = 'You' | 'Tavro AI';

export type VoiceTranscriptMessage = {
  id: string;
  speaker: VoiceSpeaker;
  text: string;
  timestamp: number;
  final: boolean;
};

export type VoiceTranscriptSegment = {
  id: string;
  text: string;
  final: boolean;
};

export function mergeVoiceTranscriptSegments(
  messages: VoiceTranscriptMessage[],
  speaker: VoiceSpeaker,
  segments: VoiceTranscriptSegment[],
  timestamp = Date.now(),
): VoiceTranscriptMessage[] {
  let next = messages;

  for (const segment of segments) {
    const text = segment.text.trim();
    if (!text) continue;

    const existingIndex = next.findIndex(
      (message) => message.id === segment.id && message.speaker === speaker,
    );
    if (existingIndex === -1) {
      if (next === messages) next = [...messages];
      next.push({ id: segment.id, speaker, text, timestamp, final: segment.final });
      continue;
    }

    const existing = next[existingIndex];
    if (existing.final && !segment.final) continue;
    if (existing.text === text && existing.final === (existing.final || segment.final)) continue;

    if (next === messages) next = [...messages];
    next[existingIndex] = {
      ...existing,
      text,
      final: existing.final || segment.final,
    };
  }

  return next;
}

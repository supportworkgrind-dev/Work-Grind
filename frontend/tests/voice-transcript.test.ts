import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeVoiceTranscriptSegments } from '../src/components/ai/voiceTranscript';

test('partial transcript updates are replaced by the final segment without duplication', () => {
  const partial = mergeVoiceTranscriptSegments([], 'You', [
    { id: 'segment-1', text: 'hello', final: false },
  ], 100);
  const final = mergeVoiceTranscriptSegments(partial, 'You', [
    { id: 'segment-1', text: 'hello Tavro', final: true },
  ], 200);

  assert.equal(final.length, 1);
  assert.deepEqual(final[0], {
    id: 'segment-1',
    speaker: 'You',
    text: 'hello Tavro',
    timestamp: 100,
    final: true,
  });
});

test('late partials and duplicate finals do not overwrite or duplicate finalized text', () => {
  const finalized = mergeVoiceTranscriptSegments([], 'Tavro AI', [
    { id: 'segment-2', text: 'Welcome back.', final: true },
  ], 300);
  const latePartial = mergeVoiceTranscriptSegments(finalized, 'Tavro AI', [
    { id: 'segment-2', text: 'Welcome', final: false },
  ], 400);
  const duplicateFinal = mergeVoiceTranscriptSegments(latePartial, 'Tavro AI', [
    { id: 'segment-2', text: 'Welcome back.', final: true },
  ], 500);

  assert.equal(duplicateFinal.length, 1);
  assert.equal(duplicateFinal[0].text, 'Welcome back.');
  assert.equal(duplicateFinal[0].timestamp, 300);
});

test('speaker and segment identity keep separate speakers and utterances distinct', () => {
  const messages = mergeVoiceTranscriptSegments([], 'You', [
    { id: 'segment-1', text: 'Hi', final: true },
  ], 100);
  const withReply = mergeVoiceTranscriptSegments(messages, 'Tavro AI', [
    { id: 'segment-1', text: 'Hello.', final: true },
  ], 200);

  assert.equal(withReply.length, 2);
  assert.deepEqual(withReply.map(({ speaker }) => speaker), ['You', 'Tavro AI']);
});

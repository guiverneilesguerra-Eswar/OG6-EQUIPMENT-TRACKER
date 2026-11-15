import { addNames, nameKey } from '../services/movements.ts';
import type { NameDirectory } from '../services/movements.ts';
Deno.test('independent name histories ignore capitalization/spaces and retain first spelling', () => {
  const blank: NameDirectory = { version: 1, releasers: [], receivers: [] }; let id = 0;
  const first = addNames(blank, '  JOHN   Doe ', 'Jane  Smith', '2026-11-15T10:00:00Z', () => `name-${++id}`);
  const repeated = addNames(first, 'john doe', '  JANE smith  ', '2026-11-15T11:00:00Z', () => `name-${++id}`);
  if (repeated.releasers.length !== 1 || repeated.receivers.length !== 1 || repeated.releasers[0].name !== 'JOHN Doe' || nameKey(repeated.receivers[0].name) !== 'jane smith') throw new Error('Name normalization failed');
  if (blank.releasers.length || blank.receivers.length) throw new Error('Name input mutated');
  const opposite = addNames(repeated, 'Jane Smith', 'John Doe', '2026-11-15T12:00:00Z', () => `name-${++id}`);
  if (opposite.releasers.length !== 2 || opposite.receivers.length !== 2) throw new Error('Role histories must be independent');
  if (JSON.stringify(JSON.parse(JSON.stringify(opposite))) !== JSON.stringify(opposite)) throw new Error('Name history failed persistence round trip');
});

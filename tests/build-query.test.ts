import test from 'ava';
import { AqBuilder } from '../src/builder.js';

test('query renders correctly', t => {
  const rendered = `
  FOR item IN responses
  FILTER item.url.domain IN @value0
  COLLECT
    status = item.status,
    mime = item.mime
  WITH COUNT INTO total
  FILTER status IN @value1
  SORT total DESC
  RETURN {
    status,
    mime,
    total
  }`;

  const q = new AqBuilder('responses')
    .filterBy('url.domain', ['example.com', 'test.com'])
    .groupBy('status')
    .groupBy('mime')
    .count('total')
    .filterBy('status', [200, 404])
    .sortBy('total', 'desc')
    .build();

  const qt = q.query.trim().replace(/[\r\s]+/g, ' ');
  const rt = rendered.trim().replace(/[\r\s]+/g, ' ');

  t.assert(qt === rt);
});

test('spec and fluent match', t => {
  const q = new AqBuilder('responses')
    .filterBy('url.domain', ['example.com', 'test.com'])
    .groupBy('status')
    .groupBy('mime')
    .count('total')
    .filterBy('status', [200, 404])
    .sortBy('total', 'desc')
    .build();

  const q2 = new AqBuilder({
    collection: 'responses',
    filters: [
      { property: 'url.domain', in: ['example.com', 'test.com'] },
      { property: 'status', in: [200, 404], collected: true },
    ],
    aggregates: [
      { property: 'status', aggregate: 'collect' },
      { property: 'mime', aggregate: 'collect' },
    ],
    sorts: [
      { property: 'total', direction: 'desc' },
    ],
    count: 'total'
  }).build();

  t.assert(q.query === q2.query);
});

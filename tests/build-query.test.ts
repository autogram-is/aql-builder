import test from 'ava';
import { Query } from '../src/query.js';

test('query renders correctly', t => {
  const rendered = `
  FOR item IN responses
  FILTER item.url.domain IN @value0
  COLLECT
    status = item.status,
    mime = item.mime
  WITH COUNT INTO total
  FILTER status IN @value1
  RETURN {
    status,
    mime,
    total
  }`;

  const q = new Query('responses')
    .filter('url.domain', ['example.com', 'test.com'])
    .groupBy('status')
    .groupBy('mime')
    .count('total')
    .filter('status', [200, 404])
    .sort('url.domain', 'asc')
    .sort('total', 'asc')
    .build();

  const qt = q.query.trim().replaceAll(/[\r\s]+/g, ' ');
  const rt = rendered.trim().replaceAll(/[\r\s]+/g, ' ');

  t.assert(qt === rt);
});

test('spec and fluent match', t => {
  const q = new Query('responses')
    .filter('url.domain', ['example.com', 'test.com'])
    .groupBy('status')
    .groupBy('mime')
    .count('total')
    .filter('status', [200, 404])
    .sort('url.domain', 'asc')
    .sort('total', 'asc')
    .build();

  const q2 = new Query({
    collection: 'responses',
    filters: [
      { property: 'url.domain', in: ['example.com', 'test.com'] },
      { property: 'status', in: [200, 404], collected: true },
    ],
    aggregates: [
      { property: 'status', aggregate: 'collect' },
      { property: 'mime', aggregate: 'collect' },
    ],
    count: 'total'
  }).build();

  t.assert(q.query === q2.query);
});

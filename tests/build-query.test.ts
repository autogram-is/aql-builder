import test from 'ava';
import { Query } from '../src/query.js';

test('query renders correctly', t => {
  const rendered = `
  FOR item IN resources
  FILTER item.parsed.domain IN @value0
  COLLECT
    code = item.code,
    mime = item.mime
  WITH COUNT INTO total
  FILTER code IN @value1
  RETURN {
    code,
    mime,
    total
  }`;

  const q = new Query('resources')
    .filter('parsed.domain', ['schwab.com', 'tdameritrade'])
    .groupBy('code')
    .groupBy('mime')
    .count('total')
    .filter('code', [200, 404])
    .sort('parsed.domain', 'asc')
    .sort('total', 'asc')
    .build();

  const qt = q.query.trim().replaceAll(/[\r\s]+/g, ' ');
  const rt = rendered.trim().replaceAll(/[\r\s]+/g, ' ');

  t.assert(qt === rt);
});

test('spec and fluent match', t => {
  const q = new Query('resources')
    .filter('parsed.domain', ['schwab.com', 'tdameritrade'])
    .groupBy('code')
    .groupBy('mime')
    .count('total')
    .filter('code', [200, 404])
    .sort('parsed.domain', 'asc')
    .sort('total', 'asc')
    .build();

  const q2 = new Query({
    collection: 'resources',
    filters: [
      { property: 'parsed.domain', in: ['schwab.com', 'tdameritrade'] },
      { property: 'code', in: [200, 404], collected: true },
    ],
    aggregates: [
      { property: 'code', aggregate: 'collect' },
      { property: 'mime', aggregate: 'collect' },
    ],
    count: 'total'
  }).build();

  t.assert(q.query === q2.query);
});

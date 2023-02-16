import test from 'ava';
import { AqBuilder } from '../src/builder.js';

test('fluent, spec, and strict spec render identically', t => {
  const fluent = new AqBuilder('responses')
    .filterBy('url.protocol')
    .filterBy('url.domain', ['example.com', 'test.com'])
    .groupBy('status')
    .groupBy('mime')
    .count('total')
    .filterBy('status', [200, 404])
    .sortBy('total', 'desc')
    .build();

  const spec = new AqBuilder({
    collection: 'responses',
    filters: [
      { path: 'url.protocol', eq: null, negate: true },
      { path: 'url.domain', in: ['example.com', 'test.com'] },
      { path: 'status', in: [200, 404], document: false },
    ],
    aggregates: [
      { path: 'status', function: 'collect' },
      { path: 'mime', function: 'collect' },
    ],
    sorts: [
      { path: 'total', direction: 'desc' },
    ],
    count: 'total'
  }).build();

  const strictSpec = new AqBuilder({
    collection: 'responses',
    filters: [
      'url.protocol',
      { path: 'url.domain', in: ['example.com', 'test.com'] },
      { path: 'status', in: [200, 404], document: false },
    ],
    aggregates: ['status', 'mime'],
    sorts: ['total'],
    count: 'total'
  }).build();

  t.deepEqual(fluent.query, spec.query);
  t.deepEqual(spec.query, strictSpec.query);
});

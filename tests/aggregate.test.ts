import test from 'ava';
import { AqStrict } from '../src/query.js';
import { buildQuery } from '../src/build-query.js';

test('render from spec', t => {
  const expected = `
    FOR item IN collection
    COLLECT prop1 = item.prop1
    AGGREGATE prop2 = SUM(item.prop2), prop3 = SUM(CHAR_LENGTH(item.prop3))
    RETURN { prop1, prop2, prop3 }
  `;

  const spec: AqStrict = {
    collection: 'collection',
    document: 'item',
    aggregates: [
      { path: 'prop1', function: 'collect' },
      { path: 'prop2', function: 'sum', type: 'number' },
      { path: 'prop3', function: 'sum', type: 'string' }
    ],
    count: false
  }

  const q = buildQuery(spec).query.trim().replace(/[\r\s]+/g, ' ');
  const e = expected.trim().replace(/[\r\s]+/g, ' ');

  t.is(q, e);
});

test('aggregate and custom total', t => {
  const expected = `
    FOR item IN collection
    COLLECT prop1 = item.prop1
    AGGREGATE
      prop2 = SUM(item.prop2),
      prop3 = SUM(CHAR_LENGTH(item.prop3)),
      totalCount = COUNT(1)
    RETURN { prop1, prop2, prop3, totalCount }
  `;

  const spec: AqStrict = {
    collection: 'collection',
    document: 'item',
    aggregates: [
      { path: 'prop1', function: 'collect' },
      { path: 'prop2', function: 'sum', type: 'number' },
      { path: 'prop3', function: 'sum', type: 'string' }
    ],
    count: 'totalCount'
  }

  const q = buildQuery(spec).query.trim().replace(/[\r\s]+/g, ' ');
  const e = expected.trim().replace(/[\r\s]+/g, ' ');

  t.is(q, e);
});


test('render with total', t => {
  const expected = `
    FOR item IN collection
    COLLECT prop1 = item.prop1
    WITH COUNT INTO total
    RETURN { prop1, total }
  `;

  const spec: AqStrict = {
    collection: 'collection',
    document: 'item',
    count: 'total',
    aggregates: [{ path: 'prop1', function: 'collect' }]
  }

  const q = buildQuery(spec).query.trim().replace(/[\r\s]+/g, ' ');
  const e = expected.trim().replace(/[\r\s]+/g, ' ');

  t.is(q, e);
});

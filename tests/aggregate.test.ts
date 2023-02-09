import test from 'ava';
import { QuerySpec } from '../src/query-spec.js';
import { buildQuery } from '../src/build-query.js';

test('render from spec', t => {
  const expected = `
    FOR item IN collection
    COLLECT prop1 = item.prop1
    AGGREGATE prop2 = SUM(item.prop2), prop3 = SUM(LENGTH(item.prop3))
    RETURN { prop1, prop2, prop3 }
  `;

  const spec: QuerySpec = {
    collection: 'collection',
    aggregate: [
      { property: 'prop1', aggregate: 'collect' },
      { property: 'prop2', aggregate: 'sum', type: 'number' },
      { property: 'prop3', aggregate: 'sum', type: 'string' }
    ],
    count: false
  }

  const q = buildQuery(spec).query.trim().replaceAll(/[\r\s]+/g, ' ');
  const e = expected.trim().replaceAll(/[\r\s]+/g, ' ');

  t.assert(q == e);
});

test('render with total', t => {
  const expected = `
    FOR item IN collection
    COLLECT prop1 = item.prop1
    WITH COUNT INTO total
    RETURN { prop1, total }
  `;

  const spec: QuerySpec = {
    collection: 'collection',
    aggregate: [{ property: 'prop1', aggregate: 'collect' }]
  }

  const q = buildQuery(spec).query.trim().replaceAll(/[\r\s]+/g, ' ');
  const e = expected.trim().replaceAll(/[\r\s]+/g, ' ');

  t.assert(q == e);
});

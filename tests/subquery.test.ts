import test from 'ava';
import { AqQuery, expandAqShorthand } from '../src/query.js';
import { buildQuery } from '../src/build-query.js';

test('simple subquery', t => {
  const pq: AqQuery = {
    collection: 'unique_urls',
    document: 'uu',
    filters: [ { name: 'parsed.protocol', in: ['http:', 'https:'] } ],
    subqueries: [
      {
        collection: 'responds_with',
        document: 'rw',
        filters: [{ path: '_from', eq: 'uu._id', value: 'variable' }]
      },
    ],
    return: [
      { name: 'id', path: '_id' },
      { name: 'url', path: 'url' },
      { name: 'resource', document: 'rw', path: '_to' }
    ]
  }

  const renderedQuery =
`FOR uu IN unique_urls
  FOR rw IN responds_with
  FILTER rw._from == uu._id
FILTER uu.parsed.protocol IN @value0
RETURN {
  id: uu._id,
  url: uu.url,
  resource: rw._to
}`

  console.log(expandAqShorthand(pq));

  t.is(buildQuery(pq).query, renderedQuery);
});

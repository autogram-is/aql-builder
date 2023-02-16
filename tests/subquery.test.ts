import test from 'ava';
import { AqQuery } from '../src/query.js';
import { buildQuery } from '../src/build-query.js';

test('nested subqueries', t => {
  const pq: AqQuery = {
    collection: 'unique_urls',
    document: 'uu',
    subqueries: [
      {
        collection: 'responds_with',
        document: 'rw',
        filters: [{ path: '_from', eq: 'uu._id', value: 'dynamic' }],
        subqueries: [
          {
            collection: 'resources',
            document: 'rs',
            filters: [{ path: '_id', eq: 'rw._to', value: 'dynamic' }]
          },
        ]
      },
    ],
    return: [
      { name: 'requested', path: 'parsed.href' },
      { name: 'redirects', document: 'rw', path: 'redirects' },
      { name: 'delivered', document: 'rs', path: 'url' }
    ]
  }

  const renderedQuery =
`FOR uu IN unique_urls
  FOR rw IN responds_with
    FOR rs IN resources
    FILTER rs._id == rw._to
  FILTER rw._from == uu._id
RETURN {
  requested: uu.parsed.href,
  redirects: rw.redirects,
  delivered: rs.url
}`

  t.is(buildQuery(pq).query, renderedQuery);
});

test('assigned subquery', t => {
  const pq: AqQuery = {
    collection: 'unique_urls',
    document: 'uu',
    filters: [ { name: 'parsed.protocol', in: ['http:', 'https:'] } ],
    subqueries: [
      {
        name: 'request',
        query: {
          collection: 'responds_with',
          document: 'rw',
          filters: [{ path: '_from', eq: 'uu._id', value: 'dynamic' }]
        }
      },
    ],
    return: [
      { name: 'url', path: 'url' },
      { name: 'redirects', document: 'request', path: 'redirects' }
    ]
  }

  const renderedQuery =
  `FOR uu IN unique_urls
LET request = (
  FOR rw IN responds_with
  FILTER rw._from == uu._id
  RETURN rw
)
FILTER uu.parsed.protocol IN @value0
RETURN {
  url: uu.url,
  redirects: request.redirects
}`

  t.is(buildQuery(pq).query, renderedQuery);
});

test('assigned wrapped subquery', t => {
  const pq: AqQuery = {
    collection: 'unique_urls',
    document: 'uu',
    filters: [ { name: 'parsed.protocol', in: ['http:', 'https:'] } ],
    subqueries: [
      {
        name: 'redirects',
        function: 'count',
        query: {
          collection: 'responds_with',
          document: 'rw',
          filters: [{ path: '_from', eq: 'uu._id', value: 'dynamic' }],
          return: ['redirects']
        }
      },
    ],
    return: [
      { name: 'url', path: 'url' },
      { path: 'redirects', document: false }
    ]
  }

  const renderedQuery =
  `FOR uu IN unique_urls
LET redirects = COUNT(
  FOR rw IN responds_with
  FILTER rw._from == uu._id
  RETURN rw.redirects
)
FILTER uu.parsed.protocol IN @value0
RETURN {
  url: uu.url,
  redirects
}`

  t.is(buildQuery(pq).query, renderedQuery);
});

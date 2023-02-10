# AQL Builder

A simple dynamic query-builder for ArangoDB, written in Typescript.

## Installation

`npm i --save aql-builder`

## Usage

AQL Builder supports two modes: you can build a JSON 'query spec' and generate AQL from it, or you can create a new Query object and chain method calls to assemble the query clause by clause.

### Fluent methods

```typescript
import { AqBuilder } from 'aql-builder';

const aqlQuery = new AqBuilder('responses')
  .filterBy('url.protocol') // Defaults to '!= null'
  .filterBy('url.domain', ['example.com', 'test.com'])
  .groupBy('status')
  .groupBy('mime')
  .count('total')
  .filterBy('status', [200, 404])
  .sortBy('total', 'desc')
  .build();
```

### AqQuery structure

```typescript
import { AqQuery, buildQuery } from 'aql-builder';

const qs: AqQuery = {
  collection: 'responses',
  filters: [
    { property: 'url.protocol', eq: null, negate: true },
    { property: 'url.domain', in: ['example.com', 'test.com'] },
    { property: 'status', in: [200, 404], collected: true },
  ],
  aggregates: [
    { property: 'status', aggregate: 'collect' },
    { property: 'mime', aggregate: 'collect' },
  ],
  count: 'total',
  sorts: [
    { property: 'total', direction: 'desc' },
  ],
};
const aqlQuery = buildQuery(qs);
```

### AqQuery shorthand

The `AqQuery` structure also supports shorthand versions of common filter, aggregate,
sort, and return definitions in addition to the full structures from AqQuery.
e.g., `return: [{ property: 'prop.name' }]` be written as `return: ['prop.name']`.

These shorthand versions can be mixed and matched as needed.

```typescript
import { AqQuery, buildQuery } from 'aql-builder';

const qs: AqQuery = {
  collection: 'responses',
  filters: [
    'url.protocol', // Expanded to 'equals null, negated' filter
    { property: 'url.domain', in: ['example.com', 'test.com'] },
    { property: 'status', in: [200, 404], collected: true },
  ],
  aggregates: ['status', 'mime'], // Expanded to 'collect' aggregates
  count: 'total',
  sorts: ['total'] // Expanded to 'desc' sorts
};
const aqlQuery = buildQuery(qs);
```

## Limitations

For the time being, AQL Builder only supports simple queries that operate on a single collection without any joins or subqueries. It doesn't support explicit construction of return documents with nested properties, though it does allow you to select properties that are arrays or objects.

AQL functions can't be used when adding individual properties; the aggregate functions like SUM() and MAX() are handled as one-offs by the aggregate code; if you need something more complex, writing your own AQL isnt much more complicated than tweaking the complex JSON that would be necessary to define it.

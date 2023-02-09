# AQL

A simple dynamic query-builder for ArangoDB, written in typescript.

## Installation

`npm i --save aql-builder`

## Usage

AQL Builder supports two modes: you can build a JSON 'query spec' and generate AQL from it, or you can create a new Query object and chaining method calls to assemble the query clause by clause.

### Fluent

```typescript
import { Query } from 'aql-builder';

const aqlQuery = new Query('responses')
  .filter('url.domain', ['example.com', 'test.com'])
  .groupBy('status')
  .groupBy('mime')
  .count('total')
  .filter('status', [200, 404])
  .sort('total', 'desc')
  .build();
```

### Query Spec

```typescript
import { QuerySpec, buildQuery } from 'aql-builder';

const qs: QuerySpec = {
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
    { property: 'total', sort: 'desc' },
  ],
  count: 'total'
};
const aqlQuery = buildQuery(qs);
```

## Limitations

For the time being, AQL Builder only support simple queries that operate on a single collection without any joins or subqueries. It doesn't support explicit construction of return documents with nested properties, though it does allow you to select properties that are arrays or objects.

AQL functions can't be used when adding individual properties; the aggregate functions like SUM() and MAX() are handled as one-offs by the aggregate code; if you need something more complex, writing your own AQL isnt much more complicated than tweaking the complex JSON that would be necessary to define it.

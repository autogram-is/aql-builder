# AQL Builder

A simple dynamic query-builder for ArangoDB, written in Typescript.

## Installation

`npm i --save aql-builder`

## Usage

AQL Builder supports two modes: you can build a JSON 'query spec' and generate AQL from it, or you can create a new Query object and chain method calls to assemble the query clause by clause.

### Fluent

```typescript
import { AqBuilder } from 'aql-builder';

const aqlQuery = new AqBuilder('responses')
  .filterBy('url.domain', ['example.com', 'test.com'])
  .groupBy('status')
  .groupBy('mime')
  .count('total')
  .filterBy('status', [200, 404])
  .sortBy('total', 'desc')
  .build();
```

### Query Spec

```typescript
import { AqQuery, buildQuery } from 'aql-builder';

const qs: AqQuery = {
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
};
const aqlQuery = buildQuery(qs);
```

## Limitations

For the time being, AQL Builder only supports simple queries that operate on a single collection without any joins or subqueries. It doesn't support explicit construction of return documents with nested properties, though it does allow you to select properties that are arrays or objects.

AQL functions can't be used when adding individual properties; the aggregate functions like SUM() and MAX() are handled as one-offs by the aggregate code; if you need something more complex, writing your own AQL isnt much more complicated than tweaking the complex JSON that would be necessary to define it.

# AQL Builder

A simple dynamic query-builder for ArangoDB, written in Typescript.

## Installation

`npm i --save aql-builder`

## Usage

AQL Builder consists of a small cluster of types, and a helper class to make using them easier.

- `AqQuery`, a JSON structure that describes a complete AQL query
- `AqProperty`, a JSON structure that describes a single property or attribute of an Arango document
- `AqFilter`, `AqAggregate`, and `AqSort`; all subtypes of `AqProperty`
- `buildQuery`, a function that turns an `AqQuery` JSON object into a `GeneratedAqlQuery` that can be run via `arangojs`
- `AqBuilder`, a class that lets you build an `AqQuery` using chainable helper methods.

### Chainable methods with AqBuilder

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

console.log(aqlQuery);

// GeneratedAqlQuery: {
//  query: 'FOR item IN responses\n' +
//    'FILTER item.url.protocol != @value0\n' +
//    'FILTER item.url.domain IN @value1\n' +
//    'COLLECT\n' +
//    '  status = item.status,\n' +
//    '  mime = item.mime\n' +
//    'WITH COUNT INTO total\n' +
//    'FILTER status IN @value2\n' +
//    'SORT total DESC\n' +
//    'RETURN { status, mime, total }',
//  bindVars: {
//    value0: null,
//    value1: [ 'example.com', 'test.com' ],
//    value2: [ 200, 404 ]
//  }
//}
```

### Building a raw AqQuery

Queries can also be described in JSON and passed straight to the builder function; the structure below generates a query identical to the chained method approach above.

```typescript
import { AqQuery, buildQuery } from 'aql-builder';

const aq: AqQuery = {
  collection: 'responses',
  filters: [
    { name: 'url.protocol', eq: null, negate: true },
    { name: 'url.domain', in: ['example.com', 'test.com'] },
    { name: 'status', in: [200, 404], document: false },
  ],
  aggregates: [
    { name: 'status', aggregate: 'collect' },
    { name: 'mime', aggregate: 'collect' },
  ],
  count: 'total',
  sorts: [
    { name: 'total', direction: 'desc' },
  ],
};
const aqlQuery = buildQuery(aq);
```

### Using shorthand syntax with AqQuery

Finally, the `AqQuery` structure also supports shorthand versions of common filter, aggregate, sort, and return definitions in addition to the full structures from AqQuery. e.g., `return: [{ name: 'prop.name' }]` be written as `return: ['prop.name']`.

These shorthand versions can be mixed and matched as needed.

```typescript
import { AqQuery, buildQuery } from 'aql-builder';

const aq: AqQuery = {
  collection: 'responses',
  filters: [
    'url.protocol', // Expanded to 'equals null, negated' filter
    { name: 'url.domain', in: ['example.com', 'test.com'] },
    { name: 'status', in: [200, 404], documemt: false },
  ],
  aggregates: ['status', 'mime'], // Expanded to 'collect' aggregates
  count: 'total',
  sorts: ['total'] // Expanded to 'desc' sorts
};
const aqlQuery = buildQuery(aq);
```

### Using them together

`AqBuilder` can be instantiated with an existing `AqQuery` object; that makes it possible to store a reusable query in JSON format, set up an `AqBuilder` instance with it, and customize the query with the builder object's chainable methods.

```typescript
import { AqQuery, AqBuilder } from 'aql-builder';

const aq: AqQuery = {
  collection: 'responses',
  filters: [
    'url.protocol',
    { name: 'url.domain', in: ['example.com', 'test.com'] },
    { name: 'status', in: [200, 404], documemt: false },
  ],
  aggregates: ['status', 'mime'],
  count: 'total'
};

const query = new AqBuilder(aq)
  .sort('total', 'asc')
  .build();
```

## The Internals

### A single Arango Property

```typescript
type AqProperty property = RequireOneOf<{
  name?: string,
  path?: string,
  document?: string,
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
}, 'name' | 'path'>;
```

- If only `name` or `path` are specified, they're effectively synonyms — but using them together allows you to control the name of the property in the query's results.
- `type` is optional, and can be used when aggregate functions need to know the type of data they're working with before applying functions like SUM or AVG.
- `document` is optional, and controls the name of the variable that contains the property. It defaults to 'item', which the AqQuery structure uses as its default when looping over documents in a given collection.

The `AqAggregate` type extends `AqProperty` with an `aggregate` attribute that determines how the property will be rendered into a `COLLECT` or `AGGREGATE` statement in the final query. Supported aggregate functions consist of `collect`, `distinct` (aka `COUNT_DISTINCT`), `empty` (aka `COUNT_EMPTY`), `nonempty` (aka `COUNT_NONEMPTY`), `min`, `max`, `avg`, and `sum`. An aggregate without an explicit aggregate function is treated as a `COLLECT` statement in the final query.

The `AqFilter` type also extends `AqProperty`, and adds a number of properties that control the filter's equality comparison. `eq` (equals), `lt` (less than), `gt` (greater than), `in`, and `contains` all map to the equality statements one would expected. Setting the `negate` attribute to `true` on the `AqFilter` object will invert the equality statement. An `AqFilter` without an explicit equality comparison is treated as `!= null` in the final query.

### A query description

```typescript
type AqQuery = {
  collection: string,
  document: string,
  return: AqProperty[],
  filters: AqFilter[],
  aggregates: AqAggregates[],
  count: string | false,
  returnFilter: AqFilter[],
  sorts: AqSort[]
  document: string,
  limit: number | false
}
```

- `collection`: the name of an Arango collection, or a full `ArangoCollection` object.
- `document`: the variable name that should be used to refer to a single document in the collection; it defaults to 'item'.
- `return`: property names, or full `AqProperty` objects, that should be returned in the result set.
- `filters`: property names, or full `AqFilter` objects, that should be used to construct filters.
- `aggregates`: property names, or full `AqAggregate` objects, that should be collected or aggregated.
- `count`: When collecting or aggregating, this controls the name of the 'WITH COUNT INTO...' variable.
- `returnFilter`: Filters that should apply *after* the collect/aggregate phase of the query.
- `sorts`: Property names, or full `AqSort` objects, to sort the final results by.
- `limit`: The max number or results to return (`false` or `-1` will return all results).

## Limitations

- For the time being, AQL Builder only supports simple queries that operate on a single collection without any joins or subqueries.
- It doesn't support explicit construction of return documents with nested properties, though it does allow you to select properties that are arrays or objects.
- AQL functions can't be used when adding individual properties; the aggregate functions like SUM() and MAX() are handled as one-offs by the aggregate code; if you need something more complex, writing your own AQL isnt much more complicated than tweaking the complex JSON that would be necessary to define it.

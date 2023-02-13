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

//  GeneratedAqlQuery
//
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

### Manually constructed AqQuery

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

### Shorthand syntax with AqQuery

Finally, the `AqQuery` structure supports shorthand versions of common filter, aggregate, sort, and return definitions. For example, `return: [{ name: 'prop.name' }]` can be written as `return: ['prop.name']`. These shorthand versions can be mixed and matched as needed.

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

### Advanced features

Although the fluent methods on the `AqBuilder` class are handy, some types of query structures are only supported with manually-created `AqQuery` objects:

- Filters that compare two properties, rather than one property to a literal value.
- Subqueries, and filters/aggregations/property assignments that explicitly reference them.
- Assignment of subqueries to custom variables that can be included in the results or used in filters

Examples can be found in [INTERNALS.md](INTERNALS.md).

## Limitations

As noted above, the `AqBuilder` class doesn't support the full range of features that are possible with `AqQuery`, and `AqQuery` only supports a subset of the full AQL spec. In particular:

- Insert or Update queries. AQL Builder is read-only.
- Use of constructed documents as query sources. Every query requires an existing collection to iterate over.
- Explicit construction of return documents with nested properties. (Though you can return properties that are themselves arrays or objects.)
- Complex AQL functions. While it's possible to sneak certain functions in using 'FUNCTION(foo)" as property path, that trick chokes on any functions that require more than one parameter.
- Explicitly ordering filter/subquery/aggregation functions to optimize queries or control returned results. The closest we get is the distinction between `filters` and `returnFilters` that run after aggregation.

# AQL Builder Internals

This document describes how the library stores the representation of a query internally. Please don't them as authoritative statements about the AQL language as a whole; there are some situations where AQL Builder terminology isn't the same as ArangoDB terminology, and we're primarily concerned with how we map some easy-to-wrangle JSON *to* AQL.

## Important concepts

Consider the following AQL query:

```aql
FOR document IN collection
FILTER document.path != 1
LET name2 = document.path2
RETURN {
  name = document.path,
  name2
}
```

AQL Builder treats most of the query as collections of 'properties' to be dealt with in different ways. Some are used as filters, some are used in aggregation or collect statements, and others just control the return statement itself.

Each property has three critical pieces: its `path`, its `name`, and its `document`. The path (as seen in the example query)

## Representing a single Arango Property

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

## A query description

```typescript
type AqQuery = {
  collection: string,
  document: string,
  subqueries: (AqQuery | AqSubquery)[]
  filters: AqFilter[],
  aggregates: AqAggregates[],
  count: string | false,
  returnFilter: AqFilter[],
  sorts: AqSort[]
  limit: number | false,
  return: AqProperty[],
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

# AQL

A simple dynamic query-builder for ArangoDB, written in typescript.

## Why?

ArangoJS already provides excellent support for writing queries with dynamic elements using the `aql` template function.

Building *fully* dynamic queries, though — where the collection is passed in at runtime or user-specified aggregation functions are used to build a report — can be a bit rough. That's where AQL Builder comes in.

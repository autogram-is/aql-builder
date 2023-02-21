# AQL Builder todos

- [ ] General improvements
  - [ ] Figure out a better approach to the 'document' property. Right now, it's necessary in many cases where we should be able to intuit from context.
  - [ ] Add examples of different query types
  - [ ] Make `LET x = y` explicit
  - [ ] Make `COLLECT` a special case of `LET` rather than `AGGREGATE`; this would be convenient, as `LET` statements are currently transformed to `COLLECT`s if any aggregation or collect statements are present.
  - [ ] Remove `collect` pseudo-function entry in SupportedAqlFunctions, replace it with `collect: true` flag on property
- [ ] AqQuery structure
  - [ ] Carve out preFilter, filter, and postFilter sections of `AqQuery` structure; preFilter always runs before subselects. filter runs after subselects but before collect/aggregate. And postFilter runs after all of them but before LIMIT/SORT.
  - [ ] Store return properties and LET assignments as a dictionary; use keys in LET to auto-shortcut document prefixing.
- [ ] Builder/Rendering
  - [ ] `expandShorthand()` should expand property shorthand, ensuring default function values for aggregates.

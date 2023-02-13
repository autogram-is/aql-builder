# AQL Builder todos

- [ ] Figure out a better approach to the 'document' property. One possible solution: support an explicit 'LET' command that assigns variables, and skip the 'prefix path with document name' step whenever a path matches an already-set variable.
- [ ] Allow `AqBuilder.sortBy()` to accept a Sort property in addition to a propname and direction. That would allow sorting by function results.
- [ ] Consider using the `function` attribute for aggregation. That would make validation of supported functions more complicated, however.

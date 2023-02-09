import { aql } from 'arangojs';
import { GeneratedAqlQuery, literal, join } from 'arangojs/aql.js';
import { Property, Aggregate, aggregateMap, Filter } from './property.js';
import { QuerySpec } from './query-spec.js';

/**
 * Given a QuerySpec object, build an executable GeneratedAqlQuery.
 */
export function buildQuery(spec: QuerySpec): GeneratedAqlQuery {
  // We use key/value pairs to accumulate properties and assignments that
  // must be unique in the final query.
  const collected: Record<string, string> = {};
  const aggregated: Record<string, string> = {};
  const document: Record<string, string> = {};

  // An array of GneratedAqlQueries we can fill as we build out the query
  const querySegments: GeneratedAqlQuery[] = [];
  querySegments.push(aql`FOR item IN ${literal(spec.collection)}`);

  // If we're doing any collect or aggregation queries, turn the properties
  // into collects — otherwise, they'd disappear after the collect statement
  // resets the query's local variables.
  if (spec.aggregates?.length) {
    const coerced: Aggregate[] =
      spec.properties
        ?.filter(p => p.label !== false)
        .map(p => {
          return { ...p, aggregate: 'collect' } as Aggregate;
        }) ?? [];
    spec.aggregates.push(...coerced);
    spec.properties = undefined;
  }

  // If there are still properties left, we add them to the final
  // returned result collection.
  for (const p of spec.properties ?? []) {
    const path = renderPath(p);
    if (p.label !== false) {
      const label = p.label ? labelify(p.label) : labelify(p.property);
      document[label] = path;
    }
  }

  // Loop through the aggregates, splitting out 'collect' assignments
  // (equivalent to SQL's GROUP BY) from the aggregation functions.
  for (const p of spec.aggregates ?? []) {
    const path = renderPath(p);
    if (p.label !== false) {
      const label = p.label ? labelify(p.label) : labelify(p.property);
      if (p.aggregate === 'collect') {
        collected[label] = path;
        document[label] = label;
      } else {
        aggregated[label] = wrapAggregate(p);
        document[label] = label;
      }
    }
  }

  // Add any filters that should apply *before* the collect statement.
  for (const p of spec.filters ?? []) {
    if (p.collected !== true) querySegments.push(...wrapFilter(p));
  }

  // If there are any COLLECT assignments, or any AGGREGATE statements,
  // we need to start the COLLECT section and start stacking the individual
  // clauses.
  if (Object.entries(aggregated).length > 0 || Object.entries(collected).length > 0) {
    querySegments.push(aql`COLLECT`);
    querySegments.push(
      join(
        Object.entries(collected).map(
          ([label, path]) => aql`  ${literal(label)} = ${literal(path)}`
        ),
      ",\n")
    );
  }

  // If aggregation functions are being used, start an AGGREGATE section
  if (Object.entries(aggregated).length > 0) {
    querySegments.push(aql`AGGREGATE`);
    querySegments.push(
      join(
        Object.entries(aggregated).map(
          ([label, path]) => aql`  ${literal(label)} = ${literal(path)}`
        ),
      ',\n')
    );
  }

  // If any COLLECT or AGGREGATE properties are used, and the 'count' property
  // isn't set to false, wrap up the COLLECT section, ala WITH COUNT INTO…
  if (Object.entries(aggregated).length > 0 || Object.entries(collected).length > 0) {
    if (spec.count !== false) {
      querySegments.push(aql`WITH COUNT INTO ${literal(spec.count ?? 'total')}`);
      document[spec.count ?? 'total'] = spec.count ?? 'total';
    }
  }

  // Add any filters that should apply after the collection is done
  for (const p of spec.filters ?? []) {
    if (p.collected === true) querySegments.push(...wrapFilter(p));
  }

  // Add a LIMIT statement if a max number of records was specified.
  if (spec.limit && spec.limit > 0) {
    querySegments.push(aql`LIMIT ${spec.limit}`);
  }

  // Finally, build out the RETURN clause and join the various AQL 
  // fragments together, returning the finaly GeneratedAqlQuery.
  querySegments.push(renderReturn(document));
  return aql`${join(querySegments, '\n')}`;
}


/**
 * Given an Aggregate Property definition, the right side of an AQL
 * aggregate assignment.
 */
function wrapAggregate(p: Aggregate) {
  const path = renderPath(p);

  if (['min', 'max', 'sum', 'avg'].includes(p.aggregate) && p.type !== 'number') {
    return aggregateMap[p.aggregate](`LENGTH(${path})`);
  } else {
    return aggregateMap[p.aggregate](path);
  }

  // If something went wrong, fall back to count nonempty.
  return aggregateMap['nonempty'](path);
}

function wrapFilter(p: Filter, collected = false) {
  const label = p.label
    ? labelify(p.label)
    : renderPath(p);

  const conditions: GeneratedAqlQuery[] = [];
  if (p.eq !== undefined) {
    conditions.push(
      aql`FILTER ${literal(label)} ${literal(p.negate ? '!=' : '==')} ${p.eq}`,
    );
  }

  if (p.lt !== undefined) {
    conditions.push(
      aql`FILTER ${literal(label)} ${literal(p.negate ? '>=' : '<')} ${p.lt}`,
    );
  }

  if (p.gt !== undefined) {
    conditions.push(
      aql`FILTER ${literal(label)} ${literal(p.negate ? '<=' : '>')} ${p.gt}`,
    );
  }

  if (p.in !== undefined) {
    conditions.push(
      aql`FILTER ${literal(label)} ${literal(p.negate ? 'NOT IN' : 'IN')} ${
        p.in
      }`,
    );
  }

  if (p.contains !== undefined) {
    if (p.type === 'string' && typeof p.contains === 'string') {
      conditions.push(
        aql`FILTER ${literal(label)} ${literal(
          p.negate ? 'NOT LIKE' : 'LIKE',
        )} ${p.contains}'`,
      );
    }
    conditions.push(
      aql`FILTER ${p.contains} ${literal(p.negate ? 'NOT IN' : 'IN')} ${literal(
        label,
      )}`,
    );
  }

  return conditions;
}

function renderReturn(document: Record<string, string>): GeneratedAqlQuery {
  const entries = Object.entries(document);
  if (entries.length === 0) return aql``;
  if (entries.length === 1) return aql`RETURN ${literal(entries[0][1])}`;
  const l = literal(
    entries.map(entry => {
      if (entry[0] === entry[1]) return `  ${entry[0]}`;
      else return `  ${entry[0]}: ${entry[1]}`;
    }).join(',\n')
  );
  return aql`RETURN {\n${l}\n}`;
}

function renderPath(p: Property | Filter): string {
  if ('collected' in p && p.collected === true) {
    return p.property;
  } else {
    return p.document ?? 'item' + '.' + p.property;
  }
}

export function labelify(input: string, replacement = '_') {
  return input.replaceAll(/[[\].-\s@]/g, replacement);
}

import { aql } from 'arangojs';
import { GeneratedAqlQuery, literal, join } from 'arangojs/aql.js';
import {
  AqProperty,
  AqAggregate,
  aggregateMap,
  sortMap,
  AqFilter,
  AqSort,
} from './property.js';
import { AqQuery, expandAqShorthand } from './query.js';
import { isArangoCollection } from 'arangojs/collection.js';

/**
 * Given an AqQuery object, build an executable GeneratedAqlQuery.
 */
export function buildQuery(spec: AqQuery): GeneratedAqlQuery {
  const strictSpec = expandAqShorthand(spec);
  // We use key/value pairs to accumulate properties and assignments that
  // must be unique in the final query.
  const collected: Record<string, string> = {};
  const aggregated: Record<string, string> = {};
  const document: Record<string, string> = {};

  // An array of GneratedAqlQueries we can fill as we build out the query
  const querySegments: GeneratedAqlQuery[] = [];
  if (isArangoCollection(strictSpec.collection)) {
    querySegments.push(aql`FOR item IN ${strictSpec.collection}`);
  } else {
    querySegments.push(aql`FOR item IN ${literal(strictSpec.collection)}`);
  }

  // If we're doing any collect or aggregation queries, turn the properties
  // into collects — otherwise, they'd disappear after the collect statement
  // resets the query's local variables.
  if (strictSpec.aggregates?.length) {
    const coerced: AqAggregate[] =
      strictSpec.return
        ?.filter(p => p.document !== false)
        .map(p => {
          return { ...p, aggregate: 'collect' } as AqAggregate;
        }) ?? [];
    strictSpec.aggregates.push(...coerced);
    strictSpec.return = undefined;
  }

  // If there are still properties left, we add them to the final
  // returned result collection.
  for (const p of strictSpec.return ?? []) {
    document[renderLabel(p)] = renderPath(p);
  }

  // Loop through the aggregates, splitting out 'collect' assignments
  // (equivalent to SQL's GROUP BY) from the aggregation functions.
  for (const p of strictSpec.aggregates ?? []) {
    if (p.aggregate === 'collect') {
      collected[renderLabel(p)] = renderPath(p);
      document[renderLabel(p)] = renderLabel(p);
    } else {
      aggregated[renderLabel(p)] = renderAggregatePath(p);
      document[renderLabel(p)] = renderLabel(p);
    }
  }

  // Add any filters that should apply *before* the collect statement.
  for (const p of strictSpec.filters ?? []) {
    if (p.document !== false) querySegments.push(...wrapFilter(p));
  }

  // If there are any COLLECT assignments, or any AGGREGATE statements,
  // we need to start the COLLECT section and start stacking the individual
  // clauses.
  if (
    Object.entries(aggregated).length > 0 ||
    Object.entries(collected).length > 0
  ) {
    querySegments.push(aql`COLLECT`);
    querySegments.push(
      join(
        Object.entries(collected).map(
          ([label, path]) => aql`  ${literal(label)} = ${literal(path)}`,
        ),
        ',\n',
      ),
    );
  }

  // If aggregation functions are being used, start an AGGREGATE section
  if (Object.entries(aggregated).length > 0) {
    querySegments.push(aql`AGGREGATE`);
    querySegments.push(
      join(
        Object.entries(aggregated).map(
          ([label, path]) => aql`  ${literal(label)} = ${literal(path)}`,
        ),
        ',\n',
      ),
    );
  }

  // If any COLLECT or AGGREGATE properties are used, and the 'count' property
  // isn't set to false, wrap up the COLLECT section, ala WITH COUNT INTO…
  if (
    Object.entries(aggregated).length > 0 ||
    Object.entries(collected).length > 0
  ) {
    if (strictSpec.count !== false) {
      querySegments.push(
        aql`WITH COUNT INTO ${literal(strictSpec.count ?? 'total')}`,
      );
      document[strictSpec.count ?? 'total'] = strictSpec.count ?? 'total';
    }
  }

  // Add any filters that should apply after the collection is done
  for (const p of strictSpec.filters ?? []) {
    if (p.document === false) querySegments.push(...wrapFilter(p));
  }

  // Add a LIMIT statement if a max number of records was strictSpecified.
  if (strictSpec.limit && strictSpec.limit > 0) {
    querySegments.push(aql`LIMIT ${strictSpec.limit}`);
  }

  if (strictSpec.sorts === null) {
    querySegments.push(aql`SORT null`);
  } else {
    for (const p of strictSpec.sorts ?? []) {
      const path = renderPath({
        document: strictSpec.aggregates?.length ? false : strictSpec.document,
        ...p,
      });
      querySegments.push(
        aql`SORT ${literal(path)} ${literal(sortMap[p.direction])}`,
      );
    }
  }

  // Finally, build out the RETURN clause and join the various AQL
  // fragments together, returning the finaly GeneratedAqlQuery.
  querySegments.push(renderReturn(document));
  return aql`${join(querySegments, '\n')}`;
}

/**
 * Given an AqAggregate definition, generate the right side of an AQL
 * aggregate assignment.
 */
export function renderAggregatePath(p: AqAggregate, document: string | false = 'item') {
  const path = renderPath(p, document);

  if (
    ['min', 'max', 'sum', 'avg'].includes(p.aggregate) &&
    p.type !== 'number'
  ) {
    return aggregateMap[p.aggregate](`LENGTH(${path})`);
  } else {
    return aggregateMap[p.aggregate](path);
  }
}

function wrapFilter(p: AqFilter) {
  const path = renderPath(p);

  const conditions: GeneratedAqlQuery[] = [];
  if (p.eq !== undefined) {
    conditions.push(
      aql`FILTER ${literal(path)} ${literal(p.negate ? '!=' : '==')} ${p.eq}`,
    );
  }

  if (p.lt !== undefined) {
    conditions.push(
      aql`FILTER ${literal(path)} ${literal(p.negate ? '>=' : '<')} ${p.lt}`,
    );
  }

  if (p.gt !== undefined) {
    conditions.push(
      aql`FILTER ${literal(path)} ${literal(p.negate ? '<=' : '>')} ${p.gt}`,
    );
  }

  if (p.in !== undefined) {
    conditions.push(
      aql`FILTER ${literal(path)} ${literal(p.negate ? 'NOT IN' : 'IN')} ${
        p.in
      }`,
    );
  }

  if (p.contains !== undefined) {
    if (p.type === 'string' && typeof p.contains === 'string') {
      conditions.push(
        aql`FILTER ${literal(path)} ${literal(
          p.negate ? 'NOT LIKE' : 'LIKE',
        )} ${p.contains}'`,
      );
    }
    conditions.push(
      aql`FILTER ${p.contains} ${literal(p.negate ? 'NOT IN' : 'IN')} ${literal(
        path,
      )}`,
    );
  }

  return conditions;
}

function renderReturn(document: Record<string, string>): GeneratedAqlQuery {
  const entries = Object.entries(document);
  if (entries.length === 0) return aql`RETURN item`;
  if (entries.length === 1) return aql`RETURN ${literal(entries[0][1])}`;
  const l = literal(
    entries
      .map(entry => {
        if (entry[0] === entry[1]) return `  ${entry[0]}`;
        else return `  ${entry[0]}: ${entry[1]}`;
      })
      .join(',\n'),
  );
  return aql`RETURN {\n${l}\n}`;
}

export function renderPath(p: AqProperty | AqFilter | AqAggregate | AqSort, document: string | false = 'item'): string {
  const prefix = (p.document === false) ? '' : ((p.document ?? document) + '.');
  return prefix + (p.path ?? p.name);
}

export function renderLabel(p: AqProperty | AqFilter | AqAggregate | AqSort): string {
  return sanitizeName(p.name ?? p.path ?? 'ERROR');
}

export function sanitizeName(input: string, replacement = '_') {
  return input.replace(/[[\].-\s@]/g, replacement);
}

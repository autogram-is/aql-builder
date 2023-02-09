import { aql } from 'arangojs';
import { GeneratedAqlQuery, literal, join } from 'arangojs/aql.js';
import { Property, Aggregate, aggregateMap, Filter } from './property.js';
import { QuerySpec } from './query-spec.js';

export function labelify(input: string, replacement = '_') {
  return input.replaceAll(/[[\].-\s@]/g, replacement);
}

export function buildQuery(spec: QuerySpec): GeneratedAqlQuery {
  const collected: Record<string, string> = {};
  const aggregated: Record<string, string> = {};
  const document: Record<string, string> = {};

  const querySegments: GeneratedAqlQuery[] = [];
  querySegments.push(aql`FOR item IN ${literal(spec.collection)}`);

  // If we're doing any collect or aggregation queries, turn the properties
  // into collects.
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

  for (const p of spec.properties ?? []) {
    const path = renderPath(p);
    if (p.label !== false) {
      const label = p.label ? labelify(p.label) : labelify(p.property);
      document[label] = path;
    }
  }

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

  for (const p of spec.filters ?? []) {
    if (p.collected !== true) querySegments.push(...wrapFilter(p));
  }

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

  if (Object.entries(aggregated).length > 0 || Object.entries(collected).length > 0) {
    if (spec.count !== false) {
      querySegments.push(aql`WITH COUNT INTO ${literal(spec.count ?? 'total')}`);
      document[spec.count ?? 'total'] = spec.count ?? 'total';
    }
  }

  for (const p of spec.filters ?? []) {
    if (p.collected === true) querySegments.push(...wrapFilter(p));
  }

  if (spec.limit && spec.limit > 0) {
    querySegments.push(aql`LIMIT ${spec.limit}`);
  }


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
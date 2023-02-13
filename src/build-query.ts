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
import { AqQuery, AqSubquery, AqlExpansionOptions, expandAqShorthand } from './query.js';
import { isArangoCollection } from 'arangojs/collection.js';

/**
 * Given an AqQuery object, build an executable GeneratedAqlQuery.
 * 
 * @param spec An AqQuery structure the query to be build
 * @param options.inline If `true`, query won't include a RETURN clause.
 */
export function buildQuery(spec: AqQuery, options: AqlExpansionOptions = {}): GeneratedAqlQuery {
  const strictSpec = expandAqShorthand(spec, options);
  // We use key/value pairs to accumulate properties and assignments that
  // must be unique in the final query.
  const collected: Record<string, string> = {};
  const aggregated: Record<string, string> = {};
  const document: Record<string, string> = {};

  // An array of GeneratedAqlQueries we can fill as we build out the query
  const querySegments: GeneratedAqlQuery[] = [];

  // The kickoff for the query; looping over the collection.
  if (isArangoCollection(strictSpec.collection)) {
    querySegments.push(
      aql`FOR ${literal(strictSpec.document)} IN ${strictSpec.collection}`,
    );
  } else {
    querySegments.push(
      aql`FOR ${literal(strictSpec.document)} IN ${literal(
        strictSpec.collection
      )}`,
    );
  }

  // If we're doing any collect or aggregation queries, turn the properties
  // into collects — otherwise, they'd disappear after the collect statement
  // resets the query's local variables.

  // Eventually, we may want to do some fancy footwork with LET or KEEP
  // statements to make this less necessary, but for now we'll deal with it.
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
    document[renderLabel(p)] = renderPath(p, strictSpec.document);
  }

  // Loop through the aggregates, splitting out 'collect' assignments
  // (equivalent to SQL's GROUP BY) from the aggregation functions.
  for (const p of strictSpec.aggregates ?? []) {
    if (p.aggregate === 'collect') {
      collected[renderLabel(p)] = renderPath(p, strictSpec.document);
      document[renderLabel(p)] = renderLabel(p);
    } else {
      aggregated[renderLabel(p)] = renderAggregatePath(p, strictSpec.document);
      document[renderLabel(p)] = renderLabel(p);
    }
  }

  // Add any inline subqueries
  for (const q of strictSpec.subqueries ?? []) {
    querySegments.push(renderSubQuery(q));
  }

  // Add any filters that should apply *before* the collect statement.
  for (const p of strictSpec.filters ?? []) {
    if (p.document !== false)
      querySegments.push(...wrapFilter(p, strictSpec.document));
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

    // If aggregation functions are being used, start an AGGREGATE section
    // and convert any COUNT into an aggregate.
    if (Object.entries(aggregated).length > 0) {
      querySegments.push(aql`AGGREGATE`);
      const qs = Object.entries(aggregated).map(
        ([label, path]) => aql`  ${literal(label)} = ${literal(path)}`,
      );
      if (strictSpec.count !== false) {
        qs.push(aql`  ${literal(strictSpec.count)} = COUNT(1)`);
        document[strictSpec.count] = strictSpec.count;
      }

      querySegments.push(join(qs, ',\n'));
    } else {
      // If there are no aggregates but COUNT is active, create it.
      if (strictSpec.count !== false) {
        querySegments.push(
          aql`WITH COUNT INTO ${literal(strictSpec.count ?? 'total')}`,
        );
        document[strictSpec.count ?? 'total'] = strictSpec.count ?? 'total';
      }
    }
  }

  // Add any filters that should apply after the collection is done
  for (const p of strictSpec.filters ?? []) {
    if (p.document === false)
      querySegments.push(...wrapFilter(p, strictSpec.document));
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

  // Unless we're in an inline subquery, build out the RETURN clause.
  if (!strictSpec.inline) {
    querySegments.push(renderReturn(document));
  }

  // Finally, render everything.
  return aql`${join(querySegments, '\n')}`;
}

/**
 * Renders one query for use as a subquery inside another.
 */
export function renderSubQuery(
  subquery: AqQuery | AqSubquery
) {
  if ('query' in subquery) {
    const opt: AqlExpansionOptions = {
      inline: true,
      ...(subquery.document ? { document: subquery.document } : {})
    };
    return buildQuery(subquery.query, opt);
  } else {
    return buildQuery(subquery, { inline: true });
  }
}

/**
 * Given an AqAggregate definition, generate the right side of an AQL
 * aggregate assignment.
 */
export function renderAggregatePath(p: AqAggregate, document?: string | false) {
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

function wrapFilter(p: AqFilter, document?: string | false) {
  const path = renderPath(p, document);

  const conditions: GeneratedAqlQuery[] = [];
  if (p.eq !== undefined) {
    conditions.push(
      aql`FILTER ${literal(path)} ${literal(p.negate ? '!=' : '==')} ${ p.value === 'literal' ? p.eq : literal(p.eq)}`,
    );
  }

  if (p.lt !== undefined) {
    conditions.push(
      aql`FILTER ${literal(path)} ${literal(p.negate ? '>=' : '<')} ${ p.value === 'literal' ? p.lt : literal(p.lt)}`,
    );
  }

  if (p.gt !== undefined) {
    conditions.push(
      aql`FILTER ${literal(path)} ${literal(p.negate ? '<=' : '>')} ${ p.value === 'literal' ? p.gt : literal(p.gt)}`,
    );
  }

  if (p.in !== undefined) {
    if (p.value === 'variable' && typeof p.in === 'string') {
      conditions.push(
        aql`FILTER ${literal(path)} ${literal(p.negate ? 'NOT IN' : 'IN')} ${literal(p.in)}`,
      );  
    } else {
      conditions.push(
        aql`FILTER ${literal(path)} ${literal(p.negate ? 'NOT IN' : 'IN')} ${
          p.in
        }`,
      );  
    }
  }

  if (p.contains !== undefined) {
    if (p.value === 'variable') {
      conditions.push(aql`FILTER ${literal(p.contains)} ${literal(p.negate ? 'NOT IN' : 'IN')} ${literal(
        path,
      )}`);
    } else {
      if (p.type === 'string' && typeof p.contains === 'string') {
        conditions.push(
          aql`FILTER ${literal(path)} ${literal(
            p.negate ? 'NOT LIKE' : 'LIKE',
          )} ${p.contains}'`,
        );
      } else {
        conditions.push(
          aql`FILTER ${p.contains} ${literal(p.negate ? 'NOT IN' : 'IN')} ${literal(
            path,
          )}`,
        );
      }
    }
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

export function renderPath(
  p: AqProperty | AqFilter | AqAggregate | AqSort,
  document?: string | false,
): string {
  const prefix = p.document === false ? '' : p.document ?? document ?? '';
  return (prefix ? prefix + '.' : '') + (p.path ?? p.name);
}

export function renderLabel(
  p: AqProperty | AqFilter | AqAggregate | AqSort,
): string {
  return sanitizeName(p.name ?? p.path ?? 'ERROR');
}

export function sanitizeName(input: string, replacement = '_') {
  return input.replace(/[[\].-\s@]/g, replacement);
}

export function indentQuery(aql: GeneratedAqlQuery, indent = '  ') {
  aql.query = aql.query
    .split(/\n/g)
    .map(line => indent + line)
    .join('\n');
}

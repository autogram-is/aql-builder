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
export function buildQuery(spec: AqQuery, options: AqlExpansionOptions = {}, depth = 0): GeneratedAqlQuery {
  const strictSpec = expandAqShorthand(spec, options);
  // We use key/value pairs to accumulate properties and assignments that
  // must be unique in the final query.
  const collected: Record<string, string> = {};
  const aggregated: Record<string, string> = {};
  const document: Record<string, string> = {};
  const d = aqIndent(depth);

  // An array of GeneratedAqlQueries we can fill as we build out the query
  const querySegments: GeneratedAqlQuery[] = [];

  // The kickoff for the query; looping over the collection.
  if (isArangoCollection(strictSpec.collection)) {
    querySegments.push(
      aql`${d}FOR ${literal(strictSpec.document)} IN ${strictSpec.collection}`,
    );
  } else {
    querySegments.push(
      aql`${d}FOR ${literal(strictSpec.document)} IN ${literal(
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

  // Add any filters that should apply *before* the collect statement.
  for (const p of strictSpec.filters ?? []) {
    if (p.document !== false)
      querySegments.push(...wrapFilter(p, strictSpec.document).map(q => aql`${d}FILTER ${q}`));
  }

  // Add any inline subqueries
  for (const q of strictSpec.subqueries ?? []) {
    // a nested subquery with no name is inline
    if ('query' in q) {
      if (!q.name) {
        q.query.inline = true;
        querySegments.push(renderSubQuery(q, depth+1));
      }
    } else {
      q.inline = true;
      querySegments.push(renderSubQuery(q, depth+1));
    }
  }
  
  // Add assignment subqueries
  for (const q of strictSpec.subqueries ?? []) {
    if ('query' in q) {
      const label = renderLabel({ name: q.name ?? q.query.document ?? 'ERR' });
      querySegments.push(aql`${d}LET ${literal(label)} = (`);
      querySegments.push(renderSubQuery(q, depth+1));
      querySegments.push(aql`${d})`);
    } else if (!q.inline){
      const label = renderLabel({ name: q.document ?? 'ERR' });
      querySegments.push(aql`${d}LET ${literal(label)} = (`);
      querySegments.push(renderSubQuery(q, depth+1));
      querySegments.push(aql`${d})`);
    }
  }

  // If there are any COLLECT assignments, or any AGGREGATE statements,
  // we need to start the COLLECT section and start stacking the individual
  // clauses.
  if (
    Object.entries(aggregated).length > 0 ||
    Object.entries(collected).length > 0
  ) {
    querySegments.push(aql`${d}COLLECT`);
    querySegments.push(
      join(
        Object.entries(collected).map(
          ([label, path]) => aql`${aqIndent(depth+1)}${literal(label)} = ${literal(path)}`,
        ),
        ',\n',
      ),
    );

    // If aggregation functions are being used, start an AGGREGATE section
    // and convert any COUNT into an aggregate.
    if (Object.entries(aggregated).length > 0) {
      querySegments.push(aql`${d}AGGREGATE`);
      const qs = Object.entries(aggregated).map(
        ([label, path]) => aql`  ${literal(label)} = ${literal(path)}`,
      );
      if (strictSpec.count !== false) {
        qs.push(aql`${aqIndent(depth+1)}${literal(strictSpec.count)} = COUNT(1)`);
        document[strictSpec.count] = strictSpec.count;
      }

      querySegments.push(join(qs, ',\n'));
    } else {
      // If there are no aggregates but COUNT is active, create it.
      if (strictSpec.count !== false) {
        querySegments.push(
          aql`${d}WITH COUNT INTO ${literal(strictSpec.count ?? 'total')}`,
        );
        document[strictSpec.count ?? 'total'] = strictSpec.count ?? 'total';
      }
    }
  }

  // Add any filters that should apply after the collection is done
  for (const p of strictSpec.filters ?? []) {
    if (p.document === false)
    querySegments.push(...wrapFilter(p, strictSpec.document).map(q => aql`${d}FILTER ${q}`));
  }

  // Add a LIMIT statement if a max number of records was strictSpecified.
  if (strictSpec.limit && strictSpec.limit > 0) {
    querySegments.push(aql`${d}LIMIT ${strictSpec.limit}`);
  }

  if (strictSpec.sorts === null) {
    querySegments.push(aql`${d}SORT null`);
  } else {
    for (const p of strictSpec.sorts ?? []) {
      const path = renderPath({
        document: strictSpec.aggregates?.length ? false : strictSpec.document,
        ...p,
      });
      querySegments.push(
        aql`${d}SORT ${literal(path)} ${literal(sortMap[p.direction])}`,
      );
    }
  }

  // Unless we're in an inline subquery, build out the RETURN clause.
  if (!strictSpec.inline) {
    querySegments.push(renderReturn(document, depth, strictSpec.document));
  }

  return join(querySegments, '\n');
}

/**
 * Renders one query for use as a subquery inside another.
 */
export function renderSubQuery(
  subquery: AqQuery | AqSubquery,
  depth = 0
) {
  if ('query' in subquery) {
    const opt: AqlExpansionOptions = {
      ...(subquery.document ? { document: subquery.document } : {})
    };
    return buildQuery(subquery.query, opt, depth);
  } else {
    return buildQuery(subquery, {}, depth);
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
      aql`${literal(path)} ${literal(p.negate ? '!=' : '==')} ${ p.value === 'literal' ? p.eq : literal(p.eq)}`,
    );
  }

  if (p.lt !== undefined) {
    conditions.push(
      aql`${literal(path)} ${literal(p.negate ? '>=' : '<')} ${ p.value === 'literal' ? p.lt : literal(p.lt)}`,
    );
  }

  if (p.gt !== undefined) {
    conditions.push(
      aql`${literal(path)} ${literal(p.negate ? '<=' : '>')} ${ p.value === 'literal' ? p.gt : literal(p.gt)}`,
    );
  }

  if (p.in !== undefined) {
    if (p.value === 'dynamic' && typeof p.in === 'string') {
      conditions.push(
        aql`${literal(path)} ${literal(p.negate ? 'NOT IN' : 'IN')} ${literal(p.in)}`,
      );  
    } else {
      conditions.push(
        aql`${literal(path)} ${literal(p.negate ? 'NOT IN' : 'IN')} ${
          p.in
        }`,
      );  
    }
  }

  if (p.contains !== undefined) {
    if (p.value === 'dynamic') {
      conditions.push(aql`${literal(p.contains)} ${literal(p.negate ? 'NOT IN' : 'IN')} ${literal(
        path,
      )}`);
    } else {
      if (p.type === 'string' && typeof p.contains === 'string') {
        conditions.push(
          aql`${literal(path)} ${literal(
            p.negate ? 'NOT LIKE' : 'LIKE',
          )} ${p.contains}'`,
        );
      } else {
        conditions.push(
          aql`${p.contains} ${literal(p.negate ? 'NOT IN' : 'IN')} ${literal(
            path,
          )}`,
        );
      }
    }
  }

  return conditions;
}

function renderReturn(properties: Record<string, string>, depth = 0, document = ''): GeneratedAqlQuery {
  const entries = Object.entries(properties);
  if (entries.length === 0) return aql`${aqIndent(depth)}RETURN ${literal(document)}`;
  if (entries.length === 1) return aql`${aqIndent(depth)}RETURN ${literal(entries[0][1])}`;
  const l = literal(
    entries
      .map(entry => {
        if (entry[0] === entry[1]) return `${'  '.repeat(depth+1)}${entry[0]}`;
        else return `${'  '.repeat(depth+1)}${entry[0]}: ${entry[1]}`;
      })
      .join(',\n'),
  );
  return aql`${aqIndent(depth)}RETURN {\n${l}\n${aqIndent(depth)}}`;
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

export function aqIndent(amount = 0) {
  return literal('  '.repeat(amount));
}
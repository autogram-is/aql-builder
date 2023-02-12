import { ArangoCollection } from 'arangojs/collection.js';
import { AqProperty, AqAggregate, AqSort, AqFilter } from './property.js';

/**
 * A structured description of a simple Arango query.
 *
 * Although this format can't express AQL's full capabilities, it supports
 * the essentials:
 */
export type AqQuery = {
  /**
   * The name of the collection to query, or a direct reference to an
   * {@link ArangoCollection} instance.
   */
  collection: string | ArangoCollection;

  /**
   * The AQL variable name used to refer to individual documents in the
   * collection. In most cases, this is prepended to the {@link AqProperty.path|path}
   * of each invididual property when building the query.
   *
   * @defaultValue `item`
   */
  document?: string;

  /**
   * A list of {@link AqFilter} definitions, property names, or property
   * name/path pairs to filter by when querying the collection.
   */
  filters?: (AqPropertyName | AqPropertyNameAndPath | AqFilter)[];

  /**
   * A list of {@link AqAggregate} definitions, property names, or property
   * name/path pairs to group or aggregate results by.
   */
  aggregates?: (AqPropertyName | AqPropertyNameAndPath | AqAggregate)[];

  /**
   * The label to use for record counts when building aggregate queries.
   * If `false`, the number of records per grouping will not be counted.
   *
   * If no aggregate properties are supplied,
   */
  count?: string | false;

  /**
   * A list of properties to {@link AqSort} results by.
   */
  sorts?: (AqPropertyName | AqSort)[] | null;

  /**
   * The maximum number of records to return; when `false`, all matching data
   * will be returned.
   */
  limit?: number | false;

  /**
   * A list of {@link AqProperty} definitions, property names, or property
   * name/path pairs, to be returned in the results.
   */
  return?: (AqPropertyName | AqPropertyNameAndPath | AqProperty)[];
};

export type AqPropertyName = string;

export type AqPropertyNameAndPath = [name: string, path: string];

/**
 * A strict version of AqQuery that requires an explicit {@link AqQuery.document|document}
 * value, and doesn't support shorthand property syntax for filters,
 * aggregates, sorts, or return values.
 */
export type AqStrict = Omit<
  AqQuery,
  'document' | 'count' | 'filters' | 'aggregates' | 'sorts' | 'return'
> & {
  document: string;
  count: string | false;
  filters?: AqFilter[];
  aggregates?: AqAggregate[];
  sorts?: AqSort[] | null;
  return?: AqProperty[];
};

export function expandAqShorthand(
  input: AqQuery,
  document = 'item',
  count = 'total',
) {
  input.document ??= document;
  input.count ??= count;

  if (input.filters) {
    for (let i = 0; i < input.filters.length; i++) {
      const val = input.filters[i];
      if (typeof val === 'string') {
        input.filters[i] = {
          path: val,
          eq: null,
          negate: true,
        } as AqFilter;
      } else if (Array.isArray(val)) {
        input.filters[i] = {
          name: val[0],
          path: val[1],
          eq: null,
          negate: true,
        } as AqFilter;
      }
    }
  }

  if (input.aggregates) {
    for (let i = 0; i < input.aggregates.length; i++) {
      const val = input.aggregates[i];
      if (typeof val === 'string') {
        input.aggregates[i] = {
          path: val,
          aggregate: 'collect',
        } as AqAggregate;
      } else if (Array.isArray(val)) {
        input.aggregates[i] = {
          name: val[0],
          path: val[1],
          aggregate: 'collect',
        } as AqAggregate;
      }
    }
  }

  if (input.sorts) {
    for (let i = 0; i < input.sorts.length; i++) {
      const val = input.sorts[i];
      if (typeof val === 'string') {
        input.sorts[i] = { path: val, direction: 'desc' } as AqSort;
      }
    }
  }

  if (input.return) {
    for (let i = 0; i < input.return.length; i++) {
      const val = input.return[i];
      if (typeof val === 'string') {
        input.return[i] = { path: val } as AqProperty;
      } else if (Array.isArray(val)) {
        input.return[i] = { name: val[0], path: val[1] } as AqProperty;
      }
    }
  }

  return input as AqStrict;
}

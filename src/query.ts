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
   * A list of {@link AqFilter} properties to use when querying the collection.
   */
  filters?: AqFilter[];

  /**
   * A list of {@link AqAggregate} properties to group or aggregate results by.
   */
  aggregates?: AqAggregate[];

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
  sorts?: AqSort[] | null;

  /**
   * The maximum number of records to return.
   */
  limit?: number;

  /**
   * A list of {@link AqProperty} definitions to be returned in the results.
   */
  return?: AqProperty[];
};

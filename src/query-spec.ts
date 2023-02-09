import { ArangoCollection } from 'arangojs/collection.js';
import { Property, Aggregate, Sort, Filter } from './property.js';

/**
 * A structured description of a simple Arango query.
 *
 * Although this format can't express AQL's full capabilities, it supports
 * the essentials:
 */
export type QuerySpec = {
  /**
   * The name of the collection to query, or a direct reference to an
   * {@link ArangoCollection} instance.
   */
  collection: string | ArangoCollection;

  /**
   * A list of {@link Filter} properties to use when querying the collection.
   */
  filter?: Filter[];

  /**
   * A list of {@link Aggregate} properties to group or aggregate results by.
   */
  aggregate?: Aggregate[];

  /**
   * The label to use for record counts when building aggregate queries.
   * If `false`, the number of records per grouping will not be counted.
   *
   * If no aggregate properties are supplied,
   */
  count?: string | false;

  /**
   * A list of properties to {@link Sort} results by.
   */
  sort?: Sort[] | null;

  /**
   * The maximum number of records to return.
   */
  limit?: number;

  /**
   * A list of {@link Property} definitions to be returned in the results.
   */
  return?: Property[];
};

import { Property, Aggregate, Sort, Filter } from './property.js';

/**
 * Describes an
 *
 * @typedef {AqlQuery}
 */
export type QuerySpec = {
  /**
   * The name of the Arango collection to query.
   */
  collection: string;

  /**
   * A list of properties on the document
   */
  properties?: Property[];

  /**
   * Description placeholder
   */
  aggregates?: Aggregate[];

  /**
   * Description placeholder
   */
  filters?: Filter[];

  /**
   * Description placeholder
   */
  sorts?: Sort[] | null;

  /**
   * The label to use for record counts when building aggregate queries.
   * If `false`, the number of records per grouping will not be counted.
   *
   * If no aggregate properties are supplied,
   */
  count?: string | false;

  /**
   * Description placeholder
   */
  limit?: number;
};

import { GeneratedAqlQuery } from 'arangojs/aql.js';
import {
  AqProperty,
  AqAggregate,
  AqSort,
  AqFilter,
  SortDirection,
  AqlAggregateFunction,
} from './property.js';
import { AqStrict, AqQuery, expandAqShorthand, AqRemove } from './query.js';
import { sanitizeName, buildQuery } from './build-query.js';
import { JsonPrimitive } from '@salesforce/ts-types';
import { ArangoCollection, isArangoCollection } from 'arangojs/collection.js';

/**
 * A fluent wrapper for a {@link AqStrict} structure, with functions to build
 * a {@link GeneratedAqlQuery} object from the spec.
 *
 * @example Fluent chainable methods
 * ```
 * const generatedAql = new AqBuilder('my_collection')
 *   .filterBy('property.nestedProperty', 'value')
 *   .sortBy('prop3', 'asc')
 *   .limit(100)
 *   .return('prop1')
 *   .return('prop2', 'customLabel')
 *   .build();
 * ```
 * @example AqQuery structure
 * ```
 * const generatedAql = AqBuilder.build({
 *   collection: 'my_collection',
 *   filters: [{ property: 'property.nestedProperty', eq: 'value'}],
 *   sorts: [{ property: 'prop3', direction: 'asc' }],
 *   limit: 100,
 *   return: [
 *     { property: 'prop1' },
 *     { property: 'prop2', label: 'customLabel' },
 *   ],
 * });
 * ```
 */
export class AqBuilder {
  /**
   * A JSON structure defining the Query's properties, filters, sorts, etc.
   *
   * Although it may be altered directly, the {@link AqBuilder} class's chainable
   * methods are the intended mechanism for building and managing its spec structure.
   */
  spec: AqStrict;

  /**
   * Convenience wrapper for the {@link buildQuery} function.
   */
  static build(input: AqStrict | AqQuery): GeneratedAqlQuery {
    return buildQuery(expandAqShorthand(input));
  }

  /**
   * Builds a {@link GeneratedAqlQuery} based on the instance's {@link AqStrict}.
   */
  build(): GeneratedAqlQuery {
    // Instantiate a query, build the AQL, execute it, and return.
    return buildQuery(this.spec);
  }

  /**
   * Returns a new {@link AqBuilder} containing a buildable {@link AqStrict}.
   */
  constructor(
    input: string | ArangoCollection | AqStrict | AqQuery,
    document?: string,
  ) {
    if (isArangoCollection(input)) {
      this.spec = expandAqShorthand({ collection: input }, { document });
    } else if (typeof input === 'string') {
      this.spec = expandAqShorthand(
        { collection: sanitizeName(input) },
        { document },
      );
    } else {
      this.spec = expandAqShorthand(input, { document });
    }
  }

  /**
   * Adds a descriptive comment to the query; there is no effect on the query results.
   */
  comment(input: string): this {
    this.spec.comment = input;
    return this;
  }

  /**
   * Adds a property to the query results.
   *
   * @remarks
   * If any {@link AqAggregate} properties exist on the query, these
   * properties will be transformed into COLLECT assignments when
   * the final query is built.
   */
  return(name: string | AqProperty, path?: string): this {
    if (this.spec.remove) {
      throw new TypeError('Return and remove clauses are mutually exclusive');
    }
    this.spec.return ??= [];
    if (typeof name === 'string') {
      this.spec.return.push({ name, path });
    } else {
      this.spec.return.push(name);
    }
    return this;
  }


  /**
   * Delete matching documents from the collection.
   */
  remove(): this;
  remove(clause?: AqRemove): this;
  remove(collection?: string | ArangoCollection): this;
  remove(input?: string | ArangoCollection | AqRemove): this {
    if (this.spec.return) {
      throw new TypeError('Return and remove clauses are mutually exclusive');
    }
    this.spec.remove ??= [];
    if (typeof input === 'undefined') {
      this.spec.remove.push({
        property: '_key',
        collection: this.spec.collection
      });
    } else if (typeof input === 'string' || isArangoCollection(input)) {
      this.spec.remove.push({
        property: '_key',
        collection: input
      });
    } else {
      this.spec.remove.push(input);
    }
    return this;
  }
  

  /**
   * Groups query results by the values in a given property.
   */
  groupBy(definition: AqAggregate): this;
  /**
   * Groups query results by the values in a given property.
   */
  groupBy(name: string, path?: string): this;
  /**
   * Groups query results by the values in a given property.
   */
  groupBy(name: string | AqAggregate, path?: string): this {
    if (typeof name === 'string') return this.aggregate(name, 'collect', path);
    return this.aggregate(name);
  }

  /**
   * Groups query results by the values in a given property.
   */
  collect(definition: AqAggregate): this;
  /**
   * Groups query results by the values in a given property.
   */
  collect(name: string, path?: string): this;
  /**
   * Groups query results by the values in a given property.
   */
  collect(name: string | AqAggregate, path?: string): this {
    if (typeof name === 'string') return this.aggregate(name, 'collect', path);
    return this.aggregate(name);
  }

  /**
   * Adds an aggregate property to the query results that summarizes a particular
   * property's values, in conjunction with a collect/groupBy statement.
   */
  aggregate(name: string, func?: AqlAggregateFunction, path?: string): this;
  /**
   * Adds an aggregate property to the query results that summarizes a particular
   * property's values, in conjunction with a collect/groupBy statement.
   */
  aggregate(definition: AqAggregate): this;
  /**
   * Adds an aggregate property to the query results that summarizes a particular
   * property's values, in conjunction with a collect/groupBy statement.
   */
  aggregate(
    name: string | AqAggregate,
    func: AqlAggregateFunction = 'collect',
    path?: string,
  ): this {
    this.spec.aggregates ??= [];
    if (typeof name === 'string') {
      this.spec.aggregates.push({ path, name, function: func });
    } else {
      this.spec.aggregates.push({
        ...name,
        ...(path ? { path } : {}),
        function: func,
      });
    }
    return this;
  }

  /**
   * Filters query results by a particular property's value.
   *
   * @remarks
   * The order in which the query is built matters: if 'groupBy' or 'aggregate'
   * clauses have already been added, the filter will apply to the post-aggregation
   * values.
   */
  filterBy(name: string, value?: JsonPrimitive | JsonPrimitive[]): this;
  /**
   * Filters query results by a particular property's value.
   *
   * @remarks
   * The order in which the query is built matters: if 'groupBy' or 'aggregate'
   * clauses have already been added, the filter will apply to the post-aggregation
   * values.
   */
  filterBy(definition: AqFilter): this;
  /**
   * Filters query results by a particular property's value.
   *
   * @remarks
   * The order in which the query is built matters: if 'groupBy' or 'aggregate'
   * clauses have already been added, the filter will apply to the post-aggregation
   * values.
   */
  filterBy(
    property: string | AqFilter,
    value?: JsonPrimitive | JsonPrimitive[],
  ): this {
    this.spec.filters ??= [];
    if (typeof property === 'string') {
      if (value === undefined) {
        this.spec.filters.push({
          document: this.spec.aggregates?.length ? false : this.spec.document,
          path: property,
          eq: null,
          negate: true,
        });
      } else if (Array.isArray(value)) {
        this.spec.filters.push({
          document: this.spec.aggregates?.length ? false : this.spec.document,
          path: property,
          in: value,
        });
      } else {
        this.spec.filters.push({
          document: this.spec.aggregates?.length ? false : this.spec.document,
          path: property,
          eq: value,
        });
      }
    } else {
      const document = this.spec.aggregates?.length
        ? false
        : this.spec.document;
      this.spec.filters.push({ ...property, document });
    }
    return this;
  }

  /**
   * Sorts the query results by a particular property value.
   */
  sortBy(name: string | null, direction?: SortDirection): this;
  /**
   * Sorts the query results by a particular property value.
   */
  sortBy(definition: AqSort): this;
  /**
   * Sorts the query results by a particular property value.
   */
  sortBy(
    property: string | null | AqSort,
    direction: SortDirection = 'asc',
  ): this {
    this.spec.sorts ??= [];
    if (property === null) {
      this.spec.sorts = null;
    } else if (typeof property === 'string') {
      this.spec.sorts.push({
        path: property,
        direction: direction,
      });
    } else {
      this.spec.sorts.push(property);
    }
    return this;
  }

  /**
   * Limits the number of results returned.
   */
  limit(value: number | undefined): this {
    if (value && value > 0) {
      this.spec.limit = value;
    } else {
      this.spec.limit = undefined;
    }
    return this;
  }

  /**
   * Changes the name of the 'count' property generated when aggregating data. Setting
   * count to 'false' will remove the auto-calculated property from the query results entirely.
   */
  count(label: string | false): this {
    this.spec.count = label;
    return this;
  }
}

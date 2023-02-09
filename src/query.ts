import { GeneratedAqlQuery } from 'arangojs/aql.js';
import {
  Property,
  Aggregate,
  Sort,
  Filter,
  SortDirection,
  AggregateFunction,
} from './property.js';
import { QuerySpec } from './query-spec.js';
import { labelify, buildQuery } from './build-query.js';
import { JsonPrimitive } from '@salesforce/ts-types';
import { ArangoCollection, isArangoCollection } from 'arangojs/collection.js';

/**
 * A fluent wrapper for a {@link QuerySpec} structure, with functions to build
 * a {@link GeneratedAqlQuery} object from the spec.
 *
 * @example Fluent chainable methods
 * ```
 * const generatedAql = new Query('my_collection')
 *   .filter('property.nestedProperty', 'value')
 *   .sort('prop3', 'asc')
 *   .limit(100)
 *   .return('prop1')
 *   .return('prop2', 'customLabel')
 *   .build();
 * ```
 * @example QuerySpec structure
 * ```
 * const generatedAql = Query.build({
 *   collection: 'my_collection',
 *   filters: [{ property: 'property.nestedProperty', eq: 'value'}],
 *   sort: [{ property: 'prop3', direction: 'asc' }],
 *   limit: 100,
 *   return: [
 *     { property: 'prop1' },
 *     { property: 'prop2', label: 'customLabel' },
 *   ],
 * });
 * ```
 */
export class Query {
  /**
   * A JSON structure defining the Query's properties, filters, sorts, etc.
   *
   * Although it may be altered directly, the {@link Query} class's chainable
   * methods are the intended mechanism for building and managing its spec structure.
   */
  spec: QuerySpec;

  /**
   * Convenience wrapper for the {@link buildQuery} function.
   */
  static build(input: QuerySpec): GeneratedAqlQuery {
    return buildQuery(input);
  }

  /**
   * Builds a {@link GeneratedAqlQuery} based on the instance's {@link QuerySpec}.
   */
  build(): GeneratedAqlQuery {
    // Instantiate a query, build the AQL, execute it, and return.
    return buildQuery(this.spec);
  }

  /**
   * Returns a new {@link Query} containing a buildable {@link QuerySpec}.
   */
  constructor(input: string | ArangoCollection | QuerySpec) {
    if (isArangoCollection(input)) {
      this.spec = { collection: input };
    } else if (typeof input === 'string') {
      this.spec = { collection: labelify(input) };
    } else {
      this.spec = input;
    }
  }

  /**
   * Adds a {@link Property} to the document returned by the query.
   *
   * @remarks
   * If any {@link Aggregate} properties exist on the query, these
   * properties will be transformed into COLLECT assignments when
   * the final query is built.
   */
  return(property: string | Property, label?: string): this {
    this.spec.return ??= [];
    if (typeof property === 'string') {
      if (label) {
        this.spec.return.push({
          label: labelify(label),
          property: property,
        });
      } else {
        this.spec.return.push({ property: property });
      }
    } else {
      this.spec.return.push(property);
    }
    return this;
  }

  groupBy(property: string | Aggregate, label?: string): this {
    return this.collect(property, label);
  }

  collect(property: string | Aggregate, label?: string): this {
    return this.aggregate(property, label, 'collect' );
  }

  aggregate(
    property: string | Aggregate,
    label?: string,
    aggregate: AggregateFunction = 'collect',
  ): this {
    this.spec.aggregate ??= [];
    if (typeof property === 'string') {
      this.spec.aggregate.push({
        label: label ? labelify(label) : labelify(property),
        property: property,
        aggregate,
      });
    } else {
      this.spec.aggregate.push({ ...property, label, aggregate });
    }
    return this;
  }

  filter(
    property: string | Filter,
    value?: JsonPrimitive | JsonPrimitive[],
  ): this {
    this.spec.filter ??= [];
    if (typeof property === 'string') {
      if (value === undefined) {
        this.spec.filter.push({
          collected: this.spec.aggregate?.length ? true : false,
          label: false,
          property,
          eq: null,
          negate: true,
        });
      } else if (Array.isArray(value)) {
        this.spec.filter.push({
          property,
          label: false,
          in: value,
          collected: this.spec.aggregate?.length ? true : false,
        });
      } else {
        this.spec.filter.push({
          property,
          label: false,
          eq: value,
          collected: this.spec.aggregate?.length ? true : false,
        });
      }
    } else {
      const collected = this.spec.aggregate?.length ? true : false;
      this.spec.filter.push({ ...property, collected });
    }
    return this;
  }

  sort(property: string | null | Sort, direction: SortDirection = 'asc'): this {
    this.spec.sort ??= [];
    if (property === null) {
      this.spec.sort = null;
    } else if (typeof property === 'string') {
      this.spec.sort.push({
        property,
        sort: direction,
      });
    } else {
      this.spec.sort.push(property);
    }
    return this;
  }

  limit(value: number | undefined): this {
    if (value && value > 0) {
      this.spec.limit = value;
    } else {
      this.spec.limit = undefined;
    }
    return this;
  }

  count(label: string | false | undefined): this {
    this.spec.count = label;
    return this;
  }
}

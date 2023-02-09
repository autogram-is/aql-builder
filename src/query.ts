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

export class Query {
  protected spec: QuerySpec;

  build(): GeneratedAqlQuery {
    // Instantiate a query, build the AQL, execute it, and return.
    return buildQuery(this.spec);
  }

  constructor(input: string | QuerySpec) {
    if (typeof input === 'string') {
      this.spec = { collection: labelify(input) };
    } else {
      this.spec = input;
    }
  }

  add(property: string | Property, path?: string): this {
    this.spec.properties ??= [];
    if (typeof property === 'string') {
      if (path) {
        this.spec.properties.push({
          label: labelify(property),
          property: path,
        });
      } else {
        this.spec.properties.push({
          label: labelify(property),
          property: property,
        });
      }
    } else {
      this.spec.properties.push(property);
    }
    return this;
  }

  groupBy(property: string | Aggregate): this {
    return this.collect(property);
  }

  collect(property: string | Aggregate): this {
    return this.aggregate(property);
  }

  aggregate(
    property: string | Aggregate,
    aggregate: AggregateFunction = 'collect',
  ): this {
    this.spec.aggregates ??= [];
    if (typeof property === 'string') {
      this.spec.aggregates.push({
        label: labelify(property),
        property: property,
        aggregate: aggregate,
      });
    } else {
      this.spec.aggregates.push(property);
    }
    return this;
  }

  filter(
    property: string | Filter,
    value?: JsonPrimitive | JsonPrimitive[],
  ): this {
    this.spec.filters ??= [];
    if (typeof property === 'string') {
      if (value === undefined) {
        this.spec.filters.push({
          collected: (this.aggregate.length > 0 || this.collect.length > 0) ? false : undefined,
          label: false,
          property: property,
          eq: null,
          negate: true,
        });
      } else if (Array.isArray(value)) {
        this.spec.filters.push({
          collected: (this.spec.aggregates?.length) ? true : false,
          label: false,
          property: property,
          in: value,
        });
      } else {
        this.spec.filters.push({
          collected: (this.spec.aggregates?.length) ? true : false,
          label: false,
          property: property,
          eq: value,
        });
      }
    } else {
      const collected = (this.spec.aggregates?.length) ? false : undefined;
      this.spec.filters.push({ collected, ...property });
    }
    return this;
  }

  sort(property: string | null | Sort, direction: SortDirection = 'asc'): this {
    this.spec.sorts ??= [];
    if (property === null) {
      this.spec.sorts = null;
    } else if (typeof property === 'string') {
      this.spec.sorts.push({
        property: property,
        sort: direction,
      });
    } else {
      this.spec.sorts.push(property);
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

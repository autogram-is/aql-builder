import { JsonPrimitive } from '@salesforce/ts-types';
import {
  SupportedAqlFunctions,
  SupportedAqlAggregateFunctions,
} from './type-guards.js';
export type AqlFunction = keyof typeof SupportedAqlFunctions;
export type AqlAggregateFunction = keyof typeof SupportedAqlAggregateFunctions;
export type SortDirection = keyof typeof sortMap;

type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

export const sortMap = {
  asc: 'ASC',
  desc: 'DESC',
};

/**
 * Describes a property used in an Arango query.
 *
 * An {@link AqProperty}'s most important attributes are {@link AqProperty.name|name} and
 * {@link AqProperty.path|path}; they interact in important ways.
 *
 * - When {@link AqProperty.name|name} is specified but {@link AqProperty.path|path} is not,
 *   `path` is set to `name` and `name` is sanitized: periods, brackets, and whitespace are
 *   replaced with underscores.
 * - When both {@link AqProperty.name|name} and {@link AqProperty.path|path} are set, `name`
 *   is sanitized and used as the friendly label for the value pointed to by `path`.
 *
 * @example A simple property reference
 * ```
 * const p: AqProperty = { name: 'title' }
 * // AQL output: RETURN { title: item.title }
 * ```
 *
 * @example A nested property with custom label
 * ```
 * const p: AqProperty = {
 *   name: 'headline',
 *   path: 'metadata.headline'
 * }
 * // AQL output: RETURN { headline: item.metadata.headline }
 * ```
 *
 * @example Sanitized label
 * ```
 * const p: AqProperty = { name: 'metadata.headline' }
 * // AQL output: RETURN { metadata_headline: item.metadata.headline }
 * ```
 *
 * @example An item from a nested array, with a custom label
 * ```
 * const p: AqProperty = {
 *   name: 'firstborn',
 *   path: 'children[0].name'
 * }
 * // AQL output: RETURN { firstborn: item.children[0].name }
 * ```
 *
 * @example An item from a nested array, with a custom label, and no document identifier.
 * ```
 * const p: AqProperty = {
 *   name: 'firstborn',
 *   path: 'children[0].name',
 *   document: false
 * }
 * // AQL output: RETURN { firstborn: children[0].name }
 * ```
 */
export type AqProperty = RequireAtLeastOne<
  {
    /**
     * A specific property to be returned in the query results. For nested properties, this
     * can be the dot-notation path to a document attribute.
     *
     * Alternately, a friendly label can be given here and the dot-notation path can be set
     * in the {@link AqProperty.path} property.
     */
    name?: string;

    /**
     * The document variable this property belongs to. Only necessary when constructing
     * complex, multi-collection queries. If this value is `false`, no document name will
     * be used when constucting the property's path.
     *
     * @defaultValue `item`
     */
    document?: string | false;

    /**
     * The dot-notation path of a JSON document property; individual entries
     * in arrays can also be referenced using array notation.
     */
    path?: string;

    /**
     * A function to wrap the property in once it's retrieved; this can be useful
     * for returning the COUNT of a particular attribute rather than the attribute
     * itself.
     *
     * Light validation is done *if* the property has its `type` set; otherwise,
     * we only ensure that the function is a known one.
     *
     * @example `const prop: AqProperty = { name: 'property', function: 'count' }`
     *
     * @experimental
     */
    function?: AqlFunction;

    /**
     * The data type of the property in question. Generally, this is only necessary
     * when generating aggregate queries that use numeric functions like SUM or AVG
     * on string properties.
     */
    type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  },
  'name' | 'path'
>;

export type AqAggregate = AqProperty & {
  /**
   * An aggregation function to apply to the property. Supported values:
   *
   * - collect:  Distinct values of this property will be collected to group
   *             other properties' aggregate values. If any aggregate properties
   *             exist in a query, vanilla properties are treated as 'collect'
   *             aggregates.
   * - distinct: The number of distinct values
   * - min:      The smallest numeric value present in the property
   * - max:      The largest numeric value present in the property
   * - sum:      The sum of all numeric values in the property
   * - avg:      The average of all numeric values in the property
   *
   * If numeric functions (min, max, sum, avg) are used on string or array
   * properties, the function is applied to the length of the property.
   */
  function: AqlAggregateFunction;
};

export type AqSort = AqProperty & {
  /**
   * Sort the final results by this property, in the direction specified.
   */
  direction: SortDirection;
};

export type AqFilter = AqProperty & {
  /**
   * Filters the query result to documents where the property is **equal to** the specified value.
   */
  eq?: JsonPrimitive;

  /**
   * Filters the query result to documents where the property is **less than** to the specified value.
   */
  lt?: string | number;

  /**
   * Filters the query result to documents where the property is **greater than** to the specified value.
   */
  gt?: string | number;

  /**
   * Filters the query result to documents where the property is **one of the specified values**.
   */
  in?: JsonPrimitive[] | string;

  /**
   * Filters the query result to documents where the property is an array that **contains the specified value**.
   */
  contains?: JsonPrimitive;

  /**
   * Indicates whether the comparison value is a literal or a reference to another variable in the query.
   */
  value?: 'literal' | 'dynamic';

  /**
   * Negates the effect of any filter conditions; for example, an `eq` condition
   * becomes `!=` rather than `==` in the final AQL query.
   */
  negate?: true;
};

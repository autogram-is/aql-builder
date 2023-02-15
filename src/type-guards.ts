import { AqProperty, AqAggregate, AqFilter, AqSort } from './property.js';
import { AqSubquery, AqQuery } from './query.js';

export function isAqProperty(input: unknown): input is AqProperty {
  return (
    input !== null &&
    typeof input === 'object' &&
    ('name' in input || 'path' in input)
  );
}

export function isAqAggregate(input: unknown): input is AqAggregate {
  return isAqProperty(input) && isSupportedFunction(input, true);
}

export function isAqFilter(input: unknown): input is AqFilter {
  return (
    isAqProperty(input) &&
    ('eq' in input ||
      'lt' in input ||
      'gt' in input ||
      'empty' in input ||
      'notempty' in input ||
      'in' in input ||
      'contains' in input)
  );
}

// In theory, any property can be used as a sort.
export function isAqSort(input: unknown): input is AqSort {
  return isAqProperty(input);
}

// Any object with a 'collection' property is potentially a valid AqQuery.
export function isAqQuery(input: unknown): input is AqQuery {
  return input !== null && typeof input === 'object' && 'collection' in input;
}

export function isAqSubquery(input: unknown): input is AqSubquery {
  return isAqProperty(input) && 'query' in input && isAqQuery(input.query);
}

export function isSupportedFunction(
  input: string | AqProperty,
  aggregate = false,
  valueType?: string,
): boolean {
  const { funcName, type } =
    typeof input === 'string'
      ? { funcName: input, type: valueType }
      : { funcName: input.function, type: input.type };
  if (funcName === undefined) return false;

  // Bail if there's simply no knowledge of the function
  const supportedTypes = SupportedAqlFunctions[funcName];
  if (supportedTypes === undefined) return false;

  // Bail if we're using it as an aggregate, but it's not aggregate-friendly
  if (aggregate && !supportedTypes.includes('aggregate')) return false;

  if (type === undefined) {
    return supportedTypes.includes(funcName);
  } else {
    return (
      supportedTypes.length === 0 ||
      supportedTypes.includes('*') ||
      supportedTypes.includes(type)
    );
  }

  return false;
}

/**
 * A lookup table of supported AQL functions that can be used when specifying
 * property return values, filters, and so on. Validation is light, but if a property
 * specifies its data type, we make sure the function is marked as compatible with
 * that type.
 */
export const SupportedAqlFunctions: Record<string, undefined | string[]> = {
  // Standalone
  date_now: [],
  uuid: [],
  rand: [],

  // Arrays/strings
  count: ['array', 'string', 'aggregate'],
  length: ['array', 'string', 'aggregate'],
  reverse: ['array', 'string'],

  // Objects
  json_stringify: ['*'],

  // Aggregates only
  sorted_unique: ['aggregate'],
  count_unique: ['aggregate'],
  count_distinct: ['aggregate'],
  distinct: ['aggregate'],
  collect: ['aggregate'], // This isn't actually a filter; it's a special case to mark a property as part of a COLLECT clause.

  // Arrays
  first: ['array'],
  pop: ['array'],
  unique: ['array', 'aggregate'],
  sorted: ['array'],
  max: ['array', 'aggregate'],
  min: ['array', 'aggregate'],
  avg: ['array', 'aggregate'],
  average: ['array', 'aggregate'],
  median: ['array'],
  stddev_population: ['array', 'aggregate'],
  stddev_sample: ['array', 'aggregate'],
  stddev: ['array', 'aggregate'],
  sum: ['array', 'aggregate'],
  variance_population: ['array', 'aggregate'],
  variance_sample: ['array', 'aggregate'],
  variance: ['array', 'aggregate'],

  // Dates (numeric timestamps or ISO 8601 strings)
  date_iso8601: ['number', 'string'],
  date_dayofweek: ['number', 'string'],
  date_year: ['number', 'string'],
  date_month: ['number', 'string'],
  date_day: ['number', 'string'],
  date_hour: ['number', 'string'],
  date_minute: ['number', 'string'],
  date_second: ['number', 'string'],
  date_millisecond: ['number', 'string'],
  date_dayofyear: ['number', 'string'],
  date_isoweek: ['number', 'string'],
  date_leapyear: ['number', 'string'],
  date_quarter: ['number', 'string'],
  date_days_in_month: ['number', 'string'],
  date_trunc: ['number', 'string'],

  // Numbers
  abs: ['number'],
  acos: ['number'],
  asin: ['number'],
  atan: ['number'],
  ceil: ['number'],
  cos: ['number'],
  degrees: ['number'],
  exp: ['number'],
  exp2: ['number'],
  floor: ['number'],
  log: ['number'],
  log2: ['number'],
  log10: ['number'],
  product: ['array'],
  radians: ['number'],
  random_token: ['number'],
  round: ['number'],
  sin: ['number'],
  sqrt: ['number'],
  tan: ['number'],

  // String manipulation
  char_length: ['string'],
  concat: ['array'],
  crc32: ['string'],
  encode_uri_component: ['string'],
  fnv64: ['string'],
  json_parse: ['string'],
  lower: ['string'],
  ltrim: ['string'],
  md5: ['string'],
  rtrim: ['string'],
  sha1: ['string'],
  sha512: ['string'],
  soundex: ['string'],
  to_base64: ['string'],
  to_hex: ['string'],
  trim: ['string'],
  upper: ['string'],

  // Type coercion
  to_bool: ['*'],
  to_number: ['*'],
  to_string: ['*'],
  to_array: ['*'],
  to_list: ['*'],

  // Type checking
  is_null: ['*'],
  is_bool: ['*'],
  is_number: ['*'],
  is_string: ['*'],
  is_array: ['*'],
  is_list: ['*'],
  is_object: ['*'],
  is_document: ['*'],
  is_datestring: ['*'],
  is_ipv4: ['*'],
  is_key: ['*'],
  typename: ['*'],
};

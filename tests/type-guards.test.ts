import test from 'ava';
import * as guards from '../src/type-guards.js';

test('properties', t => {
  t.is(guards.isAqProperty({ name: 'propName' }), true);
  t.is(guards.isAqProperty({ somePropery: true }), false);
});

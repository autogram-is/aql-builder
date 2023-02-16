import test from 'ava';
import { AqProperty } from '../src/property.js';
import { renderPath } from '../src/build-query.js';
import { isSupportedFunction } from '../src/type-guards.js';

test('property wrapped', t => {
  t.is(renderPath({ name: 'property', path: 'prop.subprop' }), 'prop.subprop');

  const p: AqProperty = { name: 'property', path: 'prop.subprop', function: 'md5' };
  t.is(renderPath(p), 'MD5(prop.subprop)');
  t.is(renderPath(p, 'item'), 'MD5(item.prop.subprop)');
});

test('bad type detected', t => {
  const p: AqProperty = { name: 'property', path: 'prop.subprop', function: 'sum', type: 'string' };

  t.is(isSupportedFunction('sum', false, 'string'), false);
  t.is(renderPath(p), 'prop.subprop');
  t.is(renderPath(p, 'item'), 'item.prop.subprop');
});


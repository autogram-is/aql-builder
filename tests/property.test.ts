import test from 'ava';
import { AqAggregate, AqProperty } from '../src/property.js';
import { renderPath, renderLabel, renderAggregatePath } from '../src/build-query.js';

function renderProperty(p: AqProperty) {
  const o = `RETURN { ${renderLabel(p)}: ${renderPath(p)} }`;
  return o;
}

function renderAggregate(p: AqAggregate) {
  const o = `AGGREGATE ${renderLabel(p)}: ${renderAggregatePath(p)}`;
  return o;
}

test('name only', t => {
  const p: AqProperty = { name: 'foo.bar' };
  t.is(renderProperty(p), 'RETURN { foo_bar: foo.bar }');
});

test('name and path', t => {
  const p: AqProperty = { name: 'label', path: 'nested.property' };
  t.is(renderProperty(p), 'RETURN { label: nested.property }');
});

test('name, path, custom document', t => {
  const p: AqProperty = { name: 'label', path: 'nested.property', document: 'foo' };
  t.is(renderProperty(p), 'RETURN { label: foo.nested.property }');
});

test('aggregate string property', t => {
  const p: AqAggregate = { name: 'label', path: 'nested.property', document: 'foo', function: 'sum' };
  t.is(renderAggregate(p), 'AGGREGATE label: SUM(LENGTH(foo.nested.property))');
});

test('aggregate number property', t => {
  const p: AqAggregate = { name: 'label', path: 'nested.property', document: 'foo', function: 'sum', type: 'number' };
  t.is(renderAggregate(p), 'AGGREGATE label: SUM(foo.nested.property)');
});
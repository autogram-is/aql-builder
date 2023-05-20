import test from 'ava';
import { AqBuilder } from '../src/builder.js';

test('remove in place', t => {
  const rendered = `
  FOR item IN responses
  FILTER item.url.domain IN @value0
  REMOVE { _key: item._key } IN responses`;

  const q = new AqBuilder('responses')
    .filterBy('url.domain', ['example.com', 'test.com'])
    .remove()
    .build();

  const qt = q.query.trim().replace(/[\r\s]+/g, ' ');
  const rt = rendered.trim().replace(/[\r\s]+/g, ' ');

  t.is(qt, rt);
});

test('custom collection', t => {
  const rendered = `
  FOR item IN responses
  FILTER item.url.domain IN @value0
  REMOVE { _key: item._key } IN kv_html_body`;

  const q = new AqBuilder('responses')
    .filterBy('url.domain', ['example.com', 'test.com'])
    .remove('kv_html_body')
    .build();

  const qt = q.query.trim().replace(/[\r\s]+/g, ' ');
  const rt = rendered.trim().replace(/[\r\s]+/g, ' ');

  t.is(qt, rt);
});

test('multi delete', t => {
  const rendered = `
  FOR item IN responses
  FILTER item.url.domain IN @value0
  REMOVE { _key: item._key } IN kv_html_body
  REMOVE { _key: item._key } IN responses`;

  const q = new AqBuilder('responses')
    .filterBy('url.domain', ['example.com', 'test.com'])
    .remove('kv_html_body')
    .remove()
    .build();

  const qt = q.query.trim().replace(/[\r\s]+/g, ' ');
  const rt = rendered.trim().replace(/[\r\s]+/g, ' ');

  t.is(qt, rt);
});

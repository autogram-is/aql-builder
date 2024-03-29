import test from 'ava';
import { AqBuilder } from '../src/builder.js';

test('query comment', t => {
  const rendered = `
  /** comment goes here */
  FOR item IN responses
  FILTER item.url.domain IN @value0
  COLLECT
    status = item.status,
    mime = item.mime
  WITH COUNT INTO total
  FILTER status IN @value1
  SORT total DESC
  RETURN {
    status,
    mime,
    total
  }`;

  const q = new AqBuilder('responses')
    .filterBy('url.domain', ['example.com', 'test.com'])
    .groupBy('status')
    .groupBy('mime')
    .count('total')
    .filterBy('status', [200, 404])
    .sortBy('total', 'desc')
    .comment('comment goes here')
    .build();

  const qt = q.query.trim().replace(/[\r\s]+/g, ' ');
  const rt = rendered.trim().replace(/[\r\s]+/g, ' ');

  t.is(qt, rt);
});


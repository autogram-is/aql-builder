import test from 'ava';
import { AqBuilder } from '../src/builder.js';

test('query renders', t => {
  const rendered = `
  FOR item IN responses
  FILTER item.url.domain IN @value0
  COLLECT
    status = item.status,
    mime = item.mime
  WITH COUNT INTO howMany
  FILTER status IN @value1
  SORT howMany DESC
  RETURN {
    status,
    mime,
    howMany
  }`;

  const q = new AqBuilder('responses')
    .filterBy('url.domain', ['example.com', 'test.com'])
    .groupBy('status')
    .groupBy('mime')
    .count('howMany')
    .filterBy('status', [200, 404])
    .sortBy('howMany', 'desc')
    .build();

  const qt = q.query.trim().replace(/[\r\s]+/g, ' ');
  const rt = rendered.trim().replace(/[\r\s]+/g, ' ');

  t.is(rt, qt);
});

test('custom document', t => {
  const rendered = `
  FOR r IN responses
  FILTER r.url.domain IN @value0
  COLLECT
    status = r.status,
    mime = r.mime
  WITH COUNT INTO total
  FILTER status IN @value1
  SORT total DESC
  RETURN {
    status,
    mime,
    total
  }`;

  const q = new AqBuilder({ collection: 'responses', document: 'r' })
    .filterBy('url.domain', ['example.com', 'test.com'])
    .groupBy('status')
    .groupBy('mime')
    .count('total')
    .filterBy('status', [200, 404])
    .sortBy('total', 'desc')
    .build();

  const qt = q.query.trim().replace(/[\r\s]+/g, ' ');
  const rt = rendered.trim().replace(/[\r\s]+/g, ' ');

  t.is(qt, rt);
})


import test from 'ava';
import { AqQuery } from "../src/query.js";
import { buildQuery } from '../src/build-query.js';

test('bind vars identified', t => {

  const q: AqQuery = {
    "document": "item",
    "collection": "resources",
    "count": "total",
    "filters": [
      {
        "path": "code",
        "eq": 200,
      },
      {
        "path": "mime",
        "eq": "text/html",
      }
    ],
    "limit": 20
  };

  const aq = buildQuery(q);

  t.deepEqual(aq.bindVars, { value0: 200, value1: 'text/html', value2: 20 });
});
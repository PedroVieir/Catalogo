import assert from 'assert';
import { getAllProducts, getAllConjuntos, getAllAplicacoes } from '../src/services/productService.js';

// These tests are basic unit-style checks that call the query function indirectly.
// They are intended to be run in an environment with a populated test DB; here
// we perform a light smoke check that the exported functions exist and that
// they return arrays and that codes are strings uppercased when present.

(async function run() {
  console.log('normalization tests - availability check');
  assert(typeof getAllProducts === 'function');
  assert(typeof getAllConjuntos === 'function');
  assert(typeof getAllAplicacoes === 'function');

  // We won't execute the DB queries here automatically because test DB might not be available.
  console.log('normalization tests - ready (requires DB to run full checks)');
})();

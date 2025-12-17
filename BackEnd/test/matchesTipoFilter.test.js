import assert from 'assert';
import { matchesTipoFilter } from '../src/services/productService.js';

// basic smoke tests
(function run() {
  // canonical sigla must match exact sigla_tipo
  assert(matchesTipoFilter({ sigla_tipo: 'VLP' }, 'VLP') === true, 'VLP should match VLP');
  assert(matchesTipoFilter({ sigla_tipo: 'VLP' }, 'vlp') === true, 'vlp should match vlp');
  assert(matchesTipoFilter({ sigla_tipo: 'VLP' }, 'VLL') === false, 'VLP should not match VLL');

  // legacy textual matching
  assert(matchesTipoFilter({ tipo: 'Veículo Linha', sigla_tipo: '' }, 'leve') === true, 'Veículo Linha should map to leve');
  assert(matchesTipoFilter({ tipo: 'Veículo Linha', sigla_tipo: '' }, 'pesado') === false, 'Veículo Linha should not map to pesado');

  // motor case
  assert(matchesTipoFilter({ tipo: 'Motor de Linha Pesada', sigla_tipo: 'MLP' }, 'pesado') === true, 'Motor pesado should map to pesado');

  console.log('matchesTipoFilter: all tests passed');
})();

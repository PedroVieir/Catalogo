-- Otimização de Índices para Banco de Dados ABR_Catalogo
-- Execute estes comandos no MySQL para melhorar o desempenho das consultas

-- Índices para tabela produtoss
CREATE INDEX idx_produtoss_codigo_abr ON produtoss (codigo_abr(50));
CREATE INDEX idx_produtoss_grupo ON produtoss (grupo(100));
CREATE INDEX idx_produtoss_descricao ON produtoss (descricao(255));

-- Índices para tabela estrutura_conjunto
CREATE INDEX idx_estrutura_pai_filho ON estrutura_conjunto (codigo_conjunto(50), codigo_componente(50));
CREATE INDEX idx_estrutura_componente ON estrutura_conjunto (codigo_componente(50));

-- Índices para tabela aplicacoes
CREATE INDEX idx_aplicacoes_codigo_conjunto ON aplicacoes (codigo_conjunto(50));
CREATE INDEX idx_aplicacoes_fabricante ON aplicacoes (fabricante(100));
CREATE INDEX idx_aplicacoes_sigla_tipo ON aplicacoes (sigla_tipo(10));
CREATE INDEX idx_aplicacoes_tipo ON aplicacoes (tipo(100));

-- Índices para tabela benchmarks
CREATE INDEX idx_benchmarks_codigo_produto ON benchmarks (codigo_produto(50));
CREATE INDEX idx_benchmarks_numero_original ON benchmarks (numero_original(100));

-- Índices para tabela fabricantes
CREATE INDEX idx_fabricantes_nome ON fabricantes (nome(100));

-- Índices compostos para consultas frequentes
CREATE INDEX idx_aplicacoes_fabricante_sigla ON aplicacoes (fabricante(50), sigla_tipo(10));
CREATE INDEX idx_produtoss_grupo_codigo ON produtoss (grupo(50), codigo_abr(50));

-- Verificar índices existentes (opcional)
-- SHOW INDEX FROM produtoss;
-- SHOW INDEX FROM aplicacoes;
-- SHOW INDEX FROM estrutura_conjunto;
-- SHOW INDEX FROM benchmarks;
-- SHOW INDEX FROM fabricantes;
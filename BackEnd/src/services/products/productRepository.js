// src/services/products/productRepository.js
import { query, beginTransaction } from "../../config/db.js";

/**
 * productRepository: apenas SQL e operações DB.
 * Retorna rows "brutos" (strings conforme DB).
 */

// Paginated fetch: COUNT + SELECT (params seguros)
export async function fetchProductsPaginated({ page = 1, limit = 20, filters = {} } = {}) {
  page = Math.max(1, Number(page) || 1);
  limit = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (page - 1) * limit;

  const where = [];
  const params = [];

  // normalizar filtros simples
  if (filters.grupo && String(filters.grupo).trim()) {
    where.push("TRIM(p.grupo) = ?");
    params.push(String(filters.grupo).trim());
  }

  if (filters.search && String(filters.search).trim()) {
    const s = `%${String(filters.search).trim()}%`;
    where.push("(p.codigo_abr LIKE ? OR p.descricao LIKE ?)");
    params.push(s, s);
  }

  // fabricante / tipoVeiculo via subqueries (vamos montar sem prefixo aqui)
  const fabParams = [];
  let fabricanteSubCondition = ""; // será apenas o conteúdo (sem WHERE/AND)

  if ((filters.fabricante && String(filters.fabricante).trim()) || (filters.tipoVeiculo && String(filters.tipoVeiculo).trim())) {
    const fabConds = [];

    if (filters.fabricante && String(filters.fabricante).trim()) {
      fabConds.push("TRIM(a.fabricante) LIKE ?");
      fabParams.push(`%${String(filters.fabricante).trim()}%`);
    }

    if (filters.tipoVeiculo && String(filters.tipoVeiculo).trim()) {
      fabConds.push("a.sigla_tipo = ?");
      fabParams.push(String(filters.tipoVeiculo).trim());
    }

    if (fabConds.length) {
      const cond = fabConds.join(" AND ");
      // montamos a condição completa (sem prefixo) para depois encaixar em whereParts
      fabricanteSubCondition = `(
        p.codigo_abr IN (
          SELECT DISTINCT a.codigo_conjunto FROM aplicacoes a
          WHERE a.codigo_conjunto IS NOT NULL AND ${cond}
        )
        OR p.codigo_abr IN (
          SELECT DISTINCT ec.codigo_componente FROM estrutura_conjunto ec
          INNER JOIN aplicacoes a ON ec.codigo_conjunto = a.codigo_conjunto
          WHERE ${cond}
        )
      )`;
    }
  }

  // Combine todas as condições (where simples + fabricanteSubCondition) em um único WHERE
  const whereParts = [...where];
  if (fabricanteSubCondition) {
    whereParts.push(fabricanteSubCondition);
  }
  const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

  const sortCol = (filters.sortBy === "descricao") ? "p.descricao" : "p.codigo_abr";
  const orderClause = `ORDER BY ${sortCol} ASC`;

  const countSql = `
    SELECT COUNT(*) AS total
    FROM produtoss p
    ${whereClause}
  `;

  const dataSql = `
    SELECT TRIM(p.codigo_abr) as codigo_abr, TRIM(p.descricao) as descricao, TRIM(p.grupo) as grupo
    FROM produtoss p
    ${whereClause}
    ${orderClause}
    LIMIT ? OFFSET ?
  `;

  // params order must match placeholders: where params first, then fabricante params repeated for the two subqueries, then limit/offset
  const repeatedFabParams = fabParams.length ? [...fabParams, ...fabParams] : [];
  const countParams = [...params, ...repeatedFabParams];
  const dataParams = [...params, ...repeatedFabParams, limit, offset];

  const countRows = await query(countSql, countParams);
  const total = parseInt(countRows?.[0]?.total || 0, 10);
  const dataRows = await query(dataSql, dataParams);

  return { total, data: Array.isArray(dataRows) ? dataRows : [] };
}

export async function fetchAllProductsRaw() {
  const sql = `
    SELECT TRIM(codigo_abr) as codigo_abr, TRIM(descricao) as descricao, TRIM(grupo) as grupo
    FROM produtoss
    WHERE codigo_abr IS NOT NULL AND TRIM(codigo_abr) != ''
    ORDER BY codigo_abr
  `;
  return await query(sql, []);
}

export async function fetchConjuntosRaw() {
  const sql = `
    SELECT TRIM(ec.codigo_conjunto) as pai, TRIM(ec.codigo_componente) as filho,
           ec.quantidade as quantidade, p.descricao as filho_des
    FROM estrutura_conjunto ec
    LEFT JOIN produtoss p ON TRIM(p.codigo_abr) = TRIM(ec.codigo_componente)
    WHERE ec.codigo_conjunto IS NOT NULL AND TRIM(ec.codigo_conjunto) != ''
      AND ec.codigo_componente IS NOT NULL AND TRIM(ec.codigo_componente) != ''
    ORDER BY ec.codigo_conjunto, ec.codigo_componente
  `;
  return await query(sql, []);
}

export async function fetchAplicacoesRaw() {
  const sql = `
    SELECT id, codigo_conjunto, veiculo, fabricante, tipo, sigla_tipo
    FROM aplicacoes
    WHERE codigo_conjunto IS NOT NULL AND codigo_conjunto != ''
  `;
  return await query(sql, []);
}

export async function fetchBenchmarksRaw() {
  const sql = `
    SELECT id, codigo_produto, origem, numero_original
    FROM benchmarks
    WHERE codigo_produto IS NOT NULL AND codigo_produto != ''
  `;
  return await query(sql, []);
}

export async function fetchFabricantesRaw() {
  const sql = `
    SELECT f.nome as name, COUNT(a.id) as count
    FROM fabricantes f
    LEFT JOIN aplicacoes a ON TRIM(a.fabricante) = f.nome
    GROUP BY f.nome
    ORDER BY f.nome
  `;
  return await query(sql, []);
}

export async function fetchProdutosFromConjuntos(conjuntoCodes = []) {
  const codes = Array.isArray(conjuntoCodes) ? conjuntoCodes : Array.from(conjuntoCodes || []);
  if (!codes.length) return [];
  const placeholders = codes.map(() => "?").join(",");
  const sql = `
    SELECT DISTINCT p.codigo_abr, p.descricao, p.grupo
    FROM produtoss p
    INNER JOIN conjunto_produtos cp ON p.codigo_abr = cp.codigo_produto
    WHERE cp.codigo_conjunto IN (${placeholders})
  `;
  return await query(sql, codes);
}

export async function ensureFabricantesPopulated() {
  // create table if not exists and insert distinct fabricantes from aplicacoes
  await query(`
    CREATE TABLE IF NOT EXISTS fabricantes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      UNIQUE KEY unq_fabricante_nome (nome)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query(`
    INSERT IGNORE INTO fabricantes (nome)
    SELECT DISTINCT TRIM(fabricante) as nome
    FROM aplicacoes
    WHERE fabricante IS NOT NULL AND TRIM(fabricante) != ''
  `);
}

export { beginTransaction };

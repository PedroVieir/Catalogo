import { query, beginTransaction } from "../../config/db.js";

function norm(v) {
  return String(v || "").trim();
}
function up(v) {
  return norm(v).toUpperCase();
}
function isCanonicalSigla(v) {
  const s = up(v);
  return s === "VLL" || s === "VLP" || s === "MLL" || s === "MLP";
}

export async function fetchProductsPaginated({ page = 1, limit = 20, filters = {} } = {}) {
  page = Math.max(1, Number(page) || 1);
  limit = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (page - 1) * limit;

  const where = [];
  const params = [];

  if (filters.grupo && norm(filters.grupo)) {
    where.push("TRIM(p.grupo) = ?");
    params.push(norm(filters.grupo));
  }

  if (filters.search && norm(filters.search)) {
    const s = `%${norm(filters.search)}%`;
    where.push("(p.codigo_abr LIKE ? OR p.descricao LIKE ?)");
    params.push(s, s);
  }

  const fabParams = [];
  let subCondition = "";

  const hasFab = filters.fabricante && norm(filters.fabricante);
  const hasTipo = filters.tipoVeiculo && norm(filters.tipoVeiculo);
  const hasLinha = filters.linha && norm(filters.linha);

  if (hasFab || hasTipo || hasLinha) {
    const conds = [];

    if (hasFab) {
      conds.push("TRIM(a.fabricante) LIKE ?");
      fabParams.push(`%${norm(filters.fabricante)}%`);
    }

    if (hasTipo) {
      const tv = up(filters.tipoVeiculo);
      if (isCanonicalSigla(tv)) {
        conds.push("a.sigla_tipo = ?");
        fabParams.push(tv);
      } else if (tv === "MOTOR" || tv === "M") {
        conds.push("a.sigla_tipo LIKE ?");
        fabParams.push("M%");
      } else if (tv === "VEICULO" || tv === "VEÍCULO" || tv === "V") {
        conds.push("a.sigla_tipo LIKE ?");
        fabParams.push("V%");
      } else {
        conds.push("a.sigla_tipo = ?");
        fabParams.push(tv);
      }
    }

    if (hasLinha) {
      const ln = up(filters.linha);
      if (isCanonicalSigla(ln)) {
        conds.push("a.sigla_tipo = ?");
        fabParams.push(ln);
      } else if (ln === "LEVE" || ln === "L") {
        conds.push("a.sigla_tipo LIKE ?");
        fabParams.push("%L");
      } else if (ln === "PESADA" || ln === "PESADO" || ln === "P") {
        conds.push("a.sigla_tipo LIKE ?");
        fabParams.push("%P");
      } else {
        // fallback: tenta por texto (se existir)
        conds.push("TRIM(a.tipo) LIKE ?");
        fabParams.push(`%${ln}%`);
      }
    }

    if (conds.length) {
      const cond = conds.join(" AND ");
      subCondition = `(
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

  const whereParts = [...where];
  if (subCondition) whereParts.push(subCondition);
  const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

  const sortCol =
    (filters.sortBy === "descricao") ? "p.descricao" :
      (filters.sortBy === "grupo") ? "p.grupo" :
        "p.codigo_abr";
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

  // params: simples + fabParams duplicados (duas subqueries) + limit/offset
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

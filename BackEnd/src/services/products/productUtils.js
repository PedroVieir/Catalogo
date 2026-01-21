export function normalizeCodigo(codigo) {
    if (codigo === null || codigo === undefined) return "";
    return String(codigo).toUpperCase().replace(/\s+/g, "").trim();
}

export function normalizeTexto(texto) {
    if (texto === null || texto === undefined) return "";
    return String(texto).trim();
}

export function safeArray(x) {
    return Array.isArray(x) ? x : [];
}

export function createSearchFilter(searchTerm) {
    const s = String(searchTerm || "").trim().toLowerCase();
    return (text) => !!text && String(text).toLowerCase().includes(s);
}

function up(v) {
    return String(v || "").trim().toUpperCase();
}

function isCanonicalSigla(v) {
    const s = up(v);
    return s === "VLL" || s === "VLP" || s === "MLL" || s === "MLP";
}

/**
 * tipoVeiculoFilter:
 * - MOTOR => sigla_tipo começa com M
 * - VEICULO => sigla_tipo começa com V
 * - compat: VLL/VLP/MLL/MLP
 */
export function matchesTipoVeiculoFilter(aplicacao = {}, tipoVeiculoFilter = "") {
    const tf = up(tipoVeiculoFilter);
    if (!tf) return true;

    const sigla = up(aplicacao.sigla_tipo || "");

    if (!sigla) return false;

    if (isCanonicalSigla(tf)) return sigla === tf;
    if (tf === "MOTOR" || tf === "M") return sigla.startsWith("M");
    if (tf === "VEICULO" || tf === "VEÍCULO" || tf === "V") return sigla.startsWith("V");

    // fallback: tenta conter
    return sigla.includes(tf);
}

/**
 * linhaFilter:
 * - LEVE => sigla_tipo termina com L
 * - PESADA => sigla_tipo termina com P
 * - compat: VLL/VLP/MLL/MLP
 */
export function matchesLinhaFilter(aplicacao = {}, linhaFilter = "") {
    const lf = up(linhaFilter);
    if (!lf) return true;

    const sigla = up(aplicacao.sigla_tipo || "");
    if (!sigla) return false;

    if (isCanonicalSigla(lf)) return sigla === lf;
    if (lf === "LEVE" || lf === "L") return sigla.endsWith("L");
    if (lf === "PESADA" || lf === "PESADO" || lf === "P") return sigla.endsWith("P");

    return sigla.includes(lf);
}

/**
 * Mantida por compatibilidade com código legado.
 */
export function matchesTipoFilter(aplicacao = {}, tipoFilter = "") {
    if (!tipoFilter) return true;
    const tfRaw = String(tipoFilter || "").trim().toLowerCase();
    const tipo = (aplicacao.tipo || "").toString().toLowerCase();
    const sigla = (aplicacao.sigla_tipo || "").toString().toLowerCase();
    const canonical = ["vll", "vlp", "mll", "mlp"];
    if (canonical.includes(tfRaw)) return sigla === tfRaw;
    if (tfRaw === "leve") return sigla.endsWith("l") || tipo.includes("lev");
    if (tfRaw === "pesado" || tfRaw === "pesada") return sigla.endsWith("p") || tipo.includes("pes");
    return tipo.includes(tfRaw) || sigla.includes(tfRaw);
}

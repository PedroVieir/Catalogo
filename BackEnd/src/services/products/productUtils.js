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

export function matchesTipoFilter(aplicacao = {}, tipoFilter = "") {
    if (!tipoFilter) return true;
    const tfRaw = String(tipoFilter || "").trim().toLowerCase();
    const tipo = (aplicacao.tipo || "").toString().toLowerCase();
    const sigla = (aplicacao.sigla_tipo || "").toString().toLowerCase();
    const canonical = ["vll", "vlp", "mll", "mlp"];
    if (canonical.includes(tfRaw)) return sigla === tfRaw;
    if (tfRaw === "leve") {
        if (tipo.includes("lev") || tipo.includes("linha")) return true;
        if (sigla.includes("l") && !sigla.includes("p")) return true;
        return false;
    }
    if (tfRaw === "pesado") {
        if (tipo.includes("pesad")) return true;
        if (sigla.includes("p")) return true;
        return false;
    }
    return tipo.includes(tfRaw) || sigla.includes(tfRaw);
}

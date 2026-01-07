export const VEHICLE_OPTIONS = [
    { label: "Motor Leve", value: "MLL" },
    { label: "Motor Pesado", value: "MLP" },
    { label: "Veículo Linha leve", value: "VLL" },
    { label: "Veículo Linha pesada", value: "VLP" },
];

export const VEHICLE_ALIASES = {
    MLL: ["MLL", "MOTOR LEVE", "MOTOR LEVE", "MOTOR LINHA LEVE"],
    MLP: ["MLP", "MOTOR PESADO", "MOTOR LINHA PESADA"],
    VLL: [
        "VLL",
        "VEICULO LINHA LEVE",
        "VEÍCULO LINHA LEVE",
        "VEICULO LEVE",
        "VEÍCULO LEVE",
        "VEÍCULO - LINHA LEVE",
        "VEICULO - LINHA LEVE",
    ],
    VLP: [
        "VLP",
        "VEICULO LINHA PESADA",
        "VEÍCULO LINHA PESADA",
        "VEICULO PESADO",
        "VEÍCULO PESADO",
        "VEÍCULO - LINHA PESADA",
    ],
};

/**
 * Normalize a string by removing diacritics and converting to lower case.
 * Undefined or null values are coerced to an empty string.
 *
 * @param {any} v - The value to normalize.
 * @returns {string} Normalized string.
 */
export function normalizeString(v) {
    if (v === null || v === undefined) return "";
    return String(v)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

/**
 * Convert a display label or raw value into its canonical sigla.
 * If the value matches one of the canonical siglas directly it is returned unchanged.
 * Otherwise aliases are searched and the first matching canonical sigla is returned.
 *
 * @param {string} value - The incoming label or sigla.
 * @returns {string} A canonical sigla (e.g. "MLL") if found, or the upper‑cased value.
 */
export function valueToSigla(value) {
    if (!value) return "";
    const up = String(value).trim().toUpperCase();
    const canonical = ["MLL", "MLP", "VLL", "VLP"];
    if (canonical.includes(up)) return up;
    const foundOption = VEHICLE_OPTIONS.find((o) => o.label.toUpperCase() === up);
    if (foundOption) return foundOption.value;
    // Check through aliases to find a matching sigla.
    for (const sigla of Object.keys(VEHICLE_ALIASES)) {
        const aliases = VEHICLE_ALIASES[sigla];
        if (aliases.some((a) => {
            // Skip generic terms that might match multiple categories
            if (a === "MOTOR" || a === "VEICULO" || a === "VEÍCULO") return false;
            return a === up || up.includes(a);
        })) return sigla;
    }
    // Fallback to the original upper‑cased value.
    return up;
}

/**
 * Determine whether a given application value matches the target sigla or one of its aliases.
 *
 * @param {string} appValue - The raw type or sigla from an application record.
 * @param {string} targetSigla - The canonical sigla to match against.
 * @returns {boolean} True if appValue matches the target sigla or one of its aliases.
 */
export function matchesVehicleAlias(appValue, targetSigla) {
    if (!appValue || !targetSigla) return false;
    const normApp = String(appValue).toUpperCase().trim();
    const aliases = VEHICLE_ALIASES[targetSigla] || [];

    // Exact match first
    if (aliases.includes(normApp)) return true;

    // For partial matches, require the alias to be more specific
    // Avoid matching generic terms that could belong to multiple categories
    return aliases.some((alias) => {
        // Skip generic terms that might match multiple categories
        if (alias === "MOTOR" || alias === "VEICULO" || alias === "VEÍCULO") return false;
        // Require the alias to be contained in the app value
        return normApp.includes(alias);
    });
}

/**
 * Convert a canonical sigla back into its human-readable label.
 * If a matching label is not found, returns the provided sigla.
 *
 * @param {string} sigla - The canonical sigla.
 * @returns {string} Human‑friendly label.
 */
export function siglaToLabel(sigla) {
    if (!sigla) return "";
    const found = VEHICLE_OPTIONS.find((o) => o.value === sigla);
    return found ? found.label : sigla;
}

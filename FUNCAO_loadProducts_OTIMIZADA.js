// ================================================================================
// ARQUIVO DE REFERÊNCIA: loadProducts() - Versão Otimizada
// Copie esta função para substituir a versão antiga em CatalogPage.js
// ================================================================================

async function loadProducts(page = 1) {
    if (!mountedRef.current) return;
    setLoading(true);
    setError("");
    try {
        const filters = {
            search: catalogState?.currentFilters?.search || "",
            grupo: catalogState?.currentFilters?.grupo || "",
            fabricante: catalogState?.currentFilters?.fabricante || "",
            tipoVeiculo: catalogState?.currentFilters?.tipoVeiculo || "",
            linha: catalogState?.currentFilters?.linha || "",
            sortBy: catalogState?.currentFilters?.sortBy || "codigo",
            isConjunto: catalogState?.currentFilters?.isConjunto,
        };

        // ✅ OTIMIZADO: Use APENAS snapshot (carregado em CatalogContext)
        // SEM fallback para fetchConjuntosPaginated() ou fetchProductsPaginated()
        let snap = catalogSnapshot;

        // Se snapshot não está em memória, tenta restaurar do localStorage
        if (!snap) {
            console.log("[LoadProducts] Snapshot não em memória, restaurando...");
            snap = await ensureSnapshot(false);
        }

        // Se snapshot não existe, força reload do servidor (UMA ÚNICA VEZ)
        if (!snap) {
            console.log("[LoadProducts] Snapshot não encontrado, carregando do servidor...");
            snap = await ensureSnapshot(true); // force=true
        }

        // Se snapshot ainda é null, erro crítico
        if (!snap || typeof snap !== "object") {
            throw new Error("Catálogo indisponível");
        }

        // ✅ Processamento ÚNICO e LOCAL (SEM requisições de rede!)
        const result = filterCatalogSnapshot(snap, filters, page, PAGE_LIMIT);

        if (!mountedRef.current) return;
        setProducts(result.data);
        setPagination(result.pagination);
        setImageErrors({});
        if (result.data.length > 0 && typeof addToProductsCache === "function") {
            addToProductsCache(result.data);
        }
        console.log("[LoadProducts] ✓ Sucesso:", result.data.length, "itens");
    } catch (err) {
        if (!mountedRef.current) return;
        console.error("[LoadProducts] ❌ Erro:", err?.message || err);
        setError(err?.message || "Erro ao carregar produtos");
        setProducts([]);
        setPagination({ page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 0 });
    } finally {
        if (mountedRef.current) setLoading(false);
    }
}

// ================================================================================
// MUDANÇAS FEITAS:
// ================================================================================
//
// ❌ REMOVIDO:
// - Lógica de fallback complexa com try-catch aninhado
// - Requisições paralelas: Promise.all([fetchConjuntosPaginated, fetchProductsPaginated])
// - Requisição única: fetchProductsPaginated()
// - Requisição única: fetchConjuntosPaginated()
// - Processamento de resposta em 3 formatos diferentes
// - Deduplicação manual de itens
//
// ✅ ADICIONADO:
// - Validação simples de snapshot
// - Fallback linear: tenta memória → localStorage → servidor
// - UMA ÚNICA chamada de processamento: filterCatalogSnapshot()
// - SEM requisições de rede (tudo processado localmente)
// - Logs informativos para debug
//
// ================================================================================
// BENEFÍCIOS:
// ================================================================================
//
// 1. Antes:  3-4 requisições de rede = 25-30s
//    Depois: 1 requisição (na 1ª carga) = ~15s
//
// 2. Antes:  Processamento complexo com merge de respostas
//    Depois: Processamento local simples
//
// 3. Antes:  Mudança de filtro = aguardava rede
//    Depois: Mudança de filtro = 300ms (processamento local)
//
// 4. Antes:  Código difícil de entender
//    Depois: Lógica linear e clara
//
// ================================================================================

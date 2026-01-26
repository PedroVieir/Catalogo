# 🧪 Guia de Testes - Validação das Correções de Cache

## Pré-Requisitos

- VS Code com DevTools do Navegador aberto (F12)\n- Aplicação rodando em localhost:3000
- Backend rodando em localhost:4000

---

## ✅ Teste 1: Verificar localStorage na 1ª Consulta

### Passo 1: Limpar localStorage
```javascript
// Abrir Console (F12 → Console)
localStorage.clear();
```

### Passo 2: Abrir Network Tab
```
F12 → Network → Recarregar página
```

### Passo 3: Fazer primeira consulta
- Clique em \"Produtos\" ou deixe carregar automaticamente
- Observe na aba Network:
  - ✅ Requisição GET `/catalog` com ~15 segundos
  - ✅ Tamanho: ~4MB
  - Status: 200

### Passo 4: Verificar localStorage
```
F12 → Application → Local Storage → http://localhost:3000
```
- ✅ Procurar chave: `abr_catalog_snapshot`
- ✅ Conteúdo: deve haver JSON com \"expiresAt\"
- ✅ Console deve mostrar: \"[Cache] Catálogo salvo em localStorage\"

**Resultado Esperado:**
```
✅ localStorage.getItem('abr_catalog_snapshot').length > 100000
✅ JSON contém propriedade \"expiresAt\"
✅ JSON contém propriedade \"data\" com products, conjuntos, etc.
```

---

## ✅ Teste 2: Cache em-memória (mesma sessão)

### Passo 1: Mesma página aberta

### Passo 2: Abrir Network Tab
```
F12 → Network → Limpar requisições anteriores (botão 🚫)
```

### Passo 3: Mudar filtro ou fazer nova busca
- Mude de \"Produtos\" para \"Conjuntos\"
- Ou faça uma busca
- Ou mude de página

### Passo 4: Verificar Network
- ❌ NÃO deve haver requisição GET `/catalog`
- ✅ Pode haver requisição GET `/conjuntos/paginated` ou `/products/paginated`
- ✅ Console deve mostrar: \"[Cache] Usando catálogo em-memória\"

**Resultado Esperado:**
```
✅ Nenhuma requisição /catalog
✅ Resposta rápida (~300-500ms)
⏱️ Total de tempo do filtro < 1 segundo
```

---

## ✅ Teste 3: localStorage Persiste após F5 (CRÍTICO!)

### Passo 1: Página carregada com dados

### Passo 2: Abrir Network Tab
```
F12 → Network → Limpar
```

### Passo 3: Pressionar F5 (refresh)
```
F5 ou Ctrl+Shift+R (hard refresh - DESABILITAR por enquanto)
F5 apenas (soft refresh - ISTO QUEREMOS TESTAR)
```

### Passo 4: Verificar Network após carregar
- ❌ NÃO deve haver requisição GET `/catalog`
- ✅ Apenas requisições opcionais como `/filters`, `/conjuntos`
- ✅ Console deve mostrar: \"[Cache] Catálogo restaurado do localStorage\"

### Passo 5: Medir tempo
- ⏱️ Página carregada em ~300-500ms (SEM rede de /catalog!)
- 📊 Antes das correções: ~15-16s
- 📊 Depois das correções: ~300-500ms
- **Melhoria: ~97%** ⬆️

**Resultado Esperado:**
```
✅ Nenhuma requisição /catalog (nem ao recarregar!)
✅ Página carrega rapidamente
✅ Console mostra: \"[Cache] Catálogo restaurado do localStorage\"
❌ localStorage.getItem('abr_catalog_snapshot') !== null
```

---

## ✅ Teste 4: Hard Refresh (Ctrl+Shift+R) Força Novo Download

### Passo 1: Página carregada

### Passo 2: Abrir Network Tab
```
F12 → Network → Limpar
```

### Passo 3: Fazer Hard Refresh
```
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)
```

### Passo 4: Verificar Network
- ✅ DEVE haver requisição GET `/catalog` (~15s)
- ✅ Esta é a \"recarga forçada\" do cache
- ✅ Novo conteúdo é salvo em localStorage

**Resultado Esperado:**
```
✅ Requisição /catalog feita
✅ Console mostra: \"[Cache] Buscando catálogo do servidor...\"
✅ localStorage atualizado com novo timestamp
```

---

## ✅ Teste 5: Verificar Expiração (7 dias)

### Passo 1: Abrir Console
```javascript
F12 → Console
```

### Passo 2: Verificar timestamp de expiração
```javascript
// Ver quando o cache expira
const cached = localStorage.getItem('abr_catalog_snapshot');
const payload = JSON.parse(cached);
const expiresAt = new Date(payload.expiresAt);
console.log('Expira em:', expiresAt);
console.log('Tempo até expiração:', (payload.expiresAt - Date.now()) / (1000 * 60 * 60 * 24), 'dias');
```

**Resultado Esperado:**
```
✅ expiresAt é aproximadamente 7 dias no futuro
✅ \"Tempo até expiração\" mostra ~6.9-7 dias
✅ Data de expiração é Date.now() + 604800000ms
```

### Passo 3: Simular expiração
```javascript
// Forçar expiração no localStorage
const cached = localStorage.getItem('abr_catalog_snapshot');
const payload = JSON.parse(cached);
payload.expiresAt = Date.now() - 1000; // Expira 1s atrás
localStorage.setItem('abr_catalog_snapshot', JSON.stringify(payload));
```

### Passo 4: Recarregar página
```
F5
```

### Passo 5: Verificar
- ✅ localStorage agora está vazio (foi deletado)
- ✅ Novo /catalog será requisitado
- ✅ Novo cache com 7 dias será salvo

---

## ✅ Teste 6: localStorage Indisponível (Edge Case)

### Passo 1: Desabilitar localStorage no DevTools
```
F12 → Console
localStorage.clear();
// Ou:
// F12 → Settings → Disable localStorage (se disponível)
```

### Passo 2: Fazer Hard Refresh
```
Ctrl+Shift+R
```

### Passo 3: Usar aplicação normalmente
- ✅ Deve funcionar normalmente
- ✅ Sem localStorage, usa apenas cache em-memória
- ✅ Comportamento = antes das correções (mas sem localStorage)
- ✅ Console mostra warns: \"Falha ao salvar em localStorage\"

**Resultado Esperado:**
```
✅ App continua funcionando
❌ localStorage.getItem('abr_catalog_snapshot') === null
✅ Console com warnings (não erros)
```

---

## 📊 Teste 7: Medir Performance (Completo)

### Setup
```javascript
// Abrir Console e copiar este código:
console.time('total');

// Depois de ter feito carregamento com cache:
console.timeEnd('total');
```

### Teste Comparativo

```javascript
// Script para testar ambos cenários:

// CENÁRIO 1: Com cache localStorage
console.group('Teste 1: Com cache localStorage');
const start1 = performance.now();
// [Recarregar página com F5]
// [Esperar página carregar]
const end1 = performance.now();
console.log('Tempo total: ' + (end1 - start1) + 'ms');
console.groupEnd();

// CENÁRIO 2: Sem cache localStorage (hard refresh)
console.group('Teste 2: Sem cache localStorage');
localStorage.clear();
const start2 = performance.now();
// [Hard refresh com Ctrl+Shift+R]
// [Esperar página carregar]
const end2 = performance.now();
console.log('Tempo total: ' + (end2 - start2) + 'ms');
console.groupEnd();

// Resultado:
console.log('Melhoria: ' + ((end2 - end1) / end2 * 100) + '%');
```

**Resultado Esperado:**
```
Teste 1 (com cache): ~300-500ms
Teste 2 (sem cache): ~15-16s
Melhoria: ~97%
```

---

## 🔍 Teste 8: Verificar Logs Console

### Abrir Console (F12 → Console)

### Limpar localStorage e recarregar
```
localStorage.clear()
F5
```

**Esperado ver em sequência:**
```
[Init] Verificando cache localStorage...
[Cache] Catálogo restaurado do localStorage
ou
[Cache] Buscando catálogo do servidor...
[Cache] Catálogo salvo em localStorage
```

### Fazer segunda consulta (mudar filtro)
**Esperado ver:**
```
[Cache] Usando catálogo em-memória
```

### Recarregar página (F5)
**Esperado ver:**
```
[Cache] Catálogo restaurado do localStorage
[Cache] Usando catálogo em-memória
```

---

## ❌ Testes de Erro (Verificar robustez)

### Erro 1: localStorage Cheio
```javascript
// Simular localStorage cheio
try {
  for (let i = 0; i < 100; i++) {
    localStorage.setItem('test' + i, 'x'.repeat(100000));
  }
} catch(e) {
  console.log('localStorage cheio');
}
// Agora try usar o app
```
**Resultado:** App continua funcionando (sem localStorage)

### Erro 2: JSON Corrompido
```javascript
localStorage.setItem('abr_catalog_snapshot', '{invalid json}');
F5
```
**Resultado:** Faz novo fetch de /catalog (não trata como erro)

### Erro 3: Dados Inválidos
```javascript
localStorage.setItem('abr_catalog_snapshot', JSON.stringify({bad: 'data'}));
F5
```
**Resultado:** Tipo check `typeof stored === \"object\"` retorna true, mas filtros falham gracefully

---

## 📈 Checklist Final

- [ ] localStorage é populado após 1ª consulta
- [ ] localStorage não é requisitado na 2ª consulta (mesma sessão)
- [ ] localStorage é restaurado após F5 (refresh)
- [ ] Hard refresh (Ctrl+Shift+R) força novo /catalog
- [ ] Console mostra logs corretos
- [ ] Tempo de resposta: 1ª = ~15s, 2ª+ = ~300-500ms
- [ ] Expiração funciona (~7 dias)
- [ ] App funciona sem localStorage (edge case)
- [ ] Nenhum erro de JavaScript no Console

---

## 🎯 KPIs de Sucesso

| Métrica | Antes | Depois | ✅/❌ |
|---------|-------|--------|-------|
| 1ª consulta | ~15s | ~15s | ✅ (servidor) |
| 2ª consulta | ~500ms | ~300-400ms | ✅ (melhor) |
| Após F5 | ~15s | ~300-400ms | ✅ (97% melhor!) |
| localStorage | ❌ Não | ✅ Sim (7 dias) | ✅ |
| Logs console | ❌ Não | ✅ Sim | ✅ |
| Robustez | Parcial | Total | ✅ |

---

## 💡 Dicas de Debug

### Ver tamanho do localStorage
```javascript
function getLocalStorageSize() {
  let total = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += localStorage[key].length + key.length;
    }
  }
  return (total / 1024).toFixed(2) + ' KB';
}
console.log('localStorage size:', getLocalStorageSize());
```

### Ver todos os itens do localStorage
```javascript
for (let [key, value] of Object.entries(localStorage)) {
  console.log(key, '=', value.substring(0, 100) + '...');
}
```

### Verificar age do cache
```javascript
const cached = JSON.parse(localStorage.getItem('abr_catalog_snapshot'));
const ageMs = Date.now() - (cached.expiresAt - 7 * 24 * 60 * 60 * 1000);
const ageDays = ageMs / (1000 * 60 * 60 * 24);
console.log('Cache tem', ageDays.toFixed(1), 'dias');
```

### Forçar reload do catálogo
```javascript
// Backend tem endpoint para refresh
fetch('http://localhost:4000/api/status/refresh', { method: 'POST' });
// Frontend:
localStorage.removeItem('abr_catalog_snapshot');
window.location.reload();
```

# 🚌 Bus Tracker Rio — API Proxy

Cloudflare Worker que atua como proxy inteligente para a API de ônibus do Rio de Janeiro, reduzindo o payload de **31MB para ~5MB** com cache, deduplicação e filtragem em edge.

## 🎯 Problema

A API pública do Rio (`dados.mobilidade.rio/gps/sppo`) retorna **~31MB** de dados brutos por requisição, com registros históricos duplicados por veículo. Isso é inviável para apps mobile em redes 3G/4G.

## 💡 Solução

Um proxy serverless no Cloudflare Workers que:

1. **Comprime** — Mantém apenas 6 campos essenciais por ônibus (de ~15 campos originais)
2. **Deduplica** — Remove registros históricos, mantendo apenas a posição mais recente
3. **Cacheia** — KV Store com TTL de 30s e `stale-while-revalidate` para latência zero
4. **Filtra** — Retorna apenas as linhas solicitadas via query parameter

### Resultado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Payload | ~31MB | ~5MB (cache) → ~50KB (filtrado) |
| Latência | 3-8s | <50ms (cache hit) |
| Dados duplicados | Sim | Não |

## 🛠️ Stack Técnica

| Tecnologia | Uso |
|---|---|
| **Cloudflare Workers** | Runtime serverless (edge computing) |
| **KV Store** | Cache distribuído globalmente |
| **JavaScript (ES Modules)** | Lógica do Worker |

## 🔗 Endpoints

```
GET /?lines=485,343    → Ônibus das linhas 485 e 343
GET /?linha=500        → Ônibus da linha 500
GET /?lines=485&slim=1 → Modo econômico (remove velocidade e timestamp)
GET /                  → Mensagem de ajuda
```

### Headers de Resposta

| Header | Descrição |
|--------|-----------|
| `X-Cache-Status` | `HIT`, `STALE` ou `MISS` |
| `X-Cache-Age` | Idade do cache em segundos |
| `X-Total-Buses` | Total de ônibus no cache |
| `X-Filtered-Buses` | Ônibus retornados após filtro |

## 🚀 Deploy

Consulte o [SETUP.md](./SETUP.md) para instruções detalhadas de deploy no Cloudflare.

## 📊 Limites (Plano Gratuito)

| Recurso | Limite | Uso Estimado |
|---------|--------|-------------|
| Requests/dia | 100.000 | ~2.880 |
| CPU time | 10ms/req | ~2-5ms |
| KV reads | 100.000/dia | ~2.880 |

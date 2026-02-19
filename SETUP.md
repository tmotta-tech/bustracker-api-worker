# Configuração do Cloudflare Worker - Bus Tracker

## Passo 1: Acessar Cloudflare Dashboard

1. Acesse [dash.cloudflare.com](https://dash.cloudflare.com)
2. Vá para **Workers & Pages** no menu lateral

---

## Passo 2: Criar o Worker

1. Clique em **Create Application** → **Create Worker**
2. Dê um nome: `bus-tracker-rio` (ou outro de sua preferência)
3. Clique em **Deploy** (ignora o código inicial)
4. Clique em **Edit code** para abrir o editor

---

## Passo 3: Colar o Código

1. **Apague todo o código** que está no editor
2. Copie e cole o conteúdo do arquivo:
   - [worker.js](file:///C:/Users/thiag/.gemini/antigravity/scratch/bus-tracker/cloudflare-worker/worker.js)
3. Clique em **Save and Deploy**

---

## Passo 4: Vincular o KV Namespace

1. Volte para a página do Worker (saia do editor)
2. Vá na aba **Settings** → **Variables**
3. Na seção **KV Namespace Bindings**, clique **Add binding**
4. Configure:
   - **Variable name**: `RIO_CACHE` (exatamente assim, maiúsculas)
   - **KV namespace**: Selecione o `RIO_CACHE` que você já criou
5. Clique **Save**

---

## Passo 5: Testar o Worker

Sua URL será algo como:

```text
https://bus-tracker-rio.SEU_USUARIO.workers.dev
```

### Teste no navegador

1. **Todos os ônibus (cuidado, muito grande!):**

   ```text
   https://bus-tracker-rio.SEU_USUARIO.workers.dev
   ```

2. **Filtrado por linha (recomendado):**

   ```text
   https://bus-tracker-rio.SEU_USUARIO.workers.dev?lines=343,474,500
   ```

### Verificar headers da resposta

- `X-Cache-Age`: Idade do cache em segundos
- `X-Total-Buses`: Total de ônibus no cache
- `X-Filtered-Buses`: Ônibus retornados após filtro

---

## Passo 6: Anote a URL

Depois de testar, anote a URL completa do seu Worker:

```text
https://bus-tracker-rio.________________.workers.dev
```

Me informe essa URL para eu atualizar o app!

---

## Limites do Plano Gratuito

| Recurso      | Limite       | Uso Estimado              |
| ------------ | ------------ | ------------------------- |
| Requests/dia | 100.000      | ~2.880 (1 a cada 30s)     |
| CPU time     | 10ms/request | ~2-5ms (filtro leve)      |
| KV reads     | 100.000/dia  | ~2.880                    |
| KV writes    | 1.000/dia    | ~2.880 (ok, sobra!)       |

> ⚠️ **Nota**: O limite de KV writes é 1.000/dia no plano gratuito, mas com cache de 30s teremos ~2.880 writes. Se isso causar problema, podemos aumentar o TTL para 60s (1.440 writes/dia).

---

## Troubleshooting

**Erro 500:** Verifique se o KV binding está correto (nome exato: `RIO_CACHE`)

**Resposta vazia:** A API do Rio pode estar fora do ar. Teste direto:

```text
https://dados.mobilidade.rio/gps/sppo
```

**Cache não funciona:** Aguarde 30 segundos e teste novamente

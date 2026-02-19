/**
 * Bus Tracker Rio - Cloudflare Worker Otimizado v2
 * 
 * SOLUÇÃO: A API Rio retorna ~31MB, que excede o limite KV (25MB).
 * Estratégia: Armazenar apenas campos essenciais (reduz para ~5MB)
 * 
 * Campos mantidos: ordem, linha, latitude, longitude, velocidade, datahora
 */

const CACHE_TTL_SECONDS = 30;
const API_URL = 'https://dados.mobilidade.rio/gps/sppo';
const KV_KEY = 'rio_buses_slim';
const KV_TIMESTAMP_KEY = 'rio_buses_ts';

export default {
    async fetch(request, env, ctx) {
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            const url = new URL(request.url);
            const linesParam = url.searchParams.get('lines') || url.searchParams.get('linha');
            const targetLines = linesParam ? linesParam.split(',').map(l => l.trim()) : [];
            const slimMode = url.searchParams.get('slim') === '1'; // Modo ultra-leve para 3G

            // PROTEÇÃO: Retorna ajuda se nenhuma linha especificada (evita crash do preview)
            if (targetLines.length === 0) {
                return new Response(JSON.stringify({
                    status: 'ok',
                    message: 'Bus Tracker API - Use ?linha=XXX para filtrar',
                    example: '?linha=485 ou ?lines=485,343',
                    slim: '?slim=1 para modo econômico'
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            // 1. Verificar cache
            const [cachedData, cachedTimestamp] = await Promise.all([
                env.RIO_CACHE.get(KV_KEY),
                env.RIO_CACHE.get(KV_TIMESTAMP_KEY)
            ]);

            const now = Date.now();
            const cacheAge = cachedTimestamp ? now - parseInt(cachedTimestamp) : Infinity;
            const isCacheValid = cacheAge < (CACHE_TTL_SECONDS * 1000);

            let busData;

            if (cachedData && isCacheValid) {
                busData = JSON.parse(cachedData);
            } else if (cachedData) {
                // Cache stale - retornar imediatamente, atualizar em background
                busData = JSON.parse(cachedData);
                ctx.waitUntil(refreshCache(env));
            } else {
                // Sem cache - precisa esperar
                busData = await fetchAndCache(env);
            }

            // 2. Filtrar por linhas
            let result = busData;
            if (targetLines.length > 0) {
                result = busData.filter(bus => {
                    const busLine = String(bus.linha || '').replace('.0', '');
                    return targetLines.some(target => {
                        const targetClean = target.replace('.0', '');
                        return busLine === targetClean ||
                            busLine === target ||
                            parseFloat(busLine) === parseFloat(target);
                    });
                });
            }
            // 3. Modo slim: remove campos desnecessários para economizar dados
            let finalResult = result;
            if (slimMode) {
                finalResult = result.map(bus => ({
                    ordem: bus.ordem,
                    linha: bus.linha,
                    latitude: bus.latitude,
                    longitude: bus.longitude
                    // velocidade e datahora removidos (~30% menor)
                }));
            }

            return new Response(JSON.stringify(finalResult), {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=5, stale-while-revalidate=30',
                    'X-Cache-Age': Math.round(cacheAge / 1000) + 's',
                    'X-Cache-Status': isCacheValid ? 'HIT' : (cachedData ? 'STALE' : 'MISS'),
                    'X-Total-Buses': String(busData.length),
                    'X-Filtered-Buses': String(result.length),
                    'X-Slim-Mode': slimMode ? '1' : '0',
                },
            });

        } catch (error) {
            console.error('Worker error:', error);
            return new Response(JSON.stringify({
                error: 'Internal Server Error',
                message: error.message
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
    },
};

// Buscar da API e salvar versão comprimida no cache
async function fetchAndCache(env) {
    const response = await fetch(API_URL, {
        headers: {
            'User-Agent': 'BusTrackerWorker/2.0',
            'Accept': 'application/json',
        },
    });

    if (!response.ok) {
        // Tentar usar cache stale como fallback
        const staleCache = await env.RIO_CACHE.get(KV_KEY);
        if (staleCache) {
            console.log('API failed, using stale cache as fallback');
            return JSON.parse(staleCache);
        }
        throw new Error(`API returned ${response.status}`);
    }

    const rawData = await response.json();

    // COMPRESSÃO: Manter apenas campos essenciais
    // Reduz de ~31MB para ~5MB
    const slimData = rawData.map(bus => ({
        ordem: bus.ordem,
        linha: bus.linha,
        latitude: bus.latitude,
        longitude: bus.longitude,
        velocidade: bus.velocidade,
        datahora: bus.datahora
    }));

    // DEDUPLICAÇÃO: A API retorna múltiplos registros históricos por ônibus.
    // Manter apenas o registro mais recente (maior datahora) para cada ordem.
    const deduplicatedData = Object.values(
        slimData.reduce((acc, bus) => {
            const id = bus.ordem;
            if (!id) return acc; // Skip buses without ID
            if (!acc[id] || (bus.datahora && bus.datahora > (acc[id].datahora || 0))) {
                acc[id] = bus;
            }
            return acc;
        }, {})
    );

    console.log(`Deduplicated: ${slimData.length} -> ${deduplicatedData.length} buses`);

    const jsonStr = JSON.stringify(deduplicatedData);
    console.log(`Compressed data size: ${jsonStr.length} bytes (${(jsonStr.length / 1024 / 1024).toFixed(2)} MB)`);

    // Salvar no KV
    const now = Date.now();
    await Promise.all([
        env.RIO_CACHE.put(KV_KEY, jsonStr),
        env.RIO_CACHE.put(KV_TIMESTAMP_KEY, String(now))
    ]);

    return deduplicatedData;
}

async function refreshCache(env) {
    try {
        await fetchAndCache(env);
        console.log('Background cache refresh completed');
    } catch (e) {
        console.error('Background refresh failed:', e);
    }
}

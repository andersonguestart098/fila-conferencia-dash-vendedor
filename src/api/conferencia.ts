// src/api/conferencia.ts
import { api } from "./client";
import type { DetalhePedido } from "../types/conferencia";

type PedidosResponse = {
  pedidos: DetalhePedido[];
  total: number;
  page: number;
  pageSize: number;
};

// controller compartilhado só pra essa rota
let pendentesController: AbortController | null = null;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// retry leve só para timeout/network
async function getComRetry<T>(
  url: string,
  config: any,
  tentativas = 2
): Promise<T> {
  let lastErr: any;

  for (let i = 0; i <= tentativas; i++) {
    try {
      const resp = await api.get<T>(url, config);
      return resp.data as T;
    } catch (err: any) {
      lastErr = err;

      const isCanceled =
        err?.code === "ERR_CANCELED" ||
        err?.message?.toLowerCase?.().includes("canceled");

      // se você mesmo cancelou, não é erro de rede: só sobe o cancel pra quem chamou
      if (isCanceled) throw err;

      const isTimeout =
        err?.code === "ECONNABORTED" ||
        String(err?.message || "").includes("timeout");

      const isNetwork = !err?.response;

      const podeRetry = isTimeout || isNetwork;

      if (!podeRetry || i === tentativas) break;

      await sleep(400 * (i + 1));
    }
  }

  throw lastErr;
}

/**
 * Busca pedidos pendentes.
 *
 * Retornos:
 *  - DetalhePedido[]  -> sucesso (200), podendo ser [] se não tiver pendentes
 *  - null             -> erro (timeout, 5xx, network, etc.)
 */
export async function buscarPedidosPendentes(): Promise<DetalhePedido[] | null> {
  try {
    if (pendentesController) pendentesController.abort();
    pendentesController = new AbortController();

    const url = "/api/conferencia/fila-db";
    const signal = pendentesController.signal;

    const primeira = await getComRetry<PedidosResponse | DetalhePedido[]>(
      url,
      { signal, timeout: 60000 },
      1
    );

    if (primeira == null) {
      console.warn("⚠ [API] Sem data, retornando lista vazia");
      return [];
    }

    // formato simples: array direto
    if (Array.isArray(primeira)) {
      console.log("✅ [API] Resposta array direto:", { pedidos: primeira.length });
      return primeira;
    }

    // formato paginado: { pedidos, total, page, pageSize }
    if (Array.isArray(primeira.pedidos)) {
      const { pedidos, total, pageSize } = primeira;

      console.log("✅ [API] Página 1:", { pedidos: pedidos.length, total, pageSize });

      // se veio tudo na primeira página, retorna direto
      if (!total || !pageSize || pedidos.length >= total) {
        return pedidos;
      }

      // busca páginas restantes em paralelo
      const totalPaginas = Math.ceil(total / pageSize);
      const paginas = Array.from({ length: totalPaginas - 1 }, (_, i) => i + 2);

      const resultados = await Promise.all(
        paginas.map((page) =>
          getComRetry<PedidosResponse>(
            url,
            { signal, timeout: 60000, params: { page } },
            1
          ).then((r) => r.pedidos ?? [])
        )
      );

      const todos = [...pedidos, ...resultados.flat()];
      console.log("✅ [API] Total após todas as páginas:", todos.length);
      return todos;
    }

    console.warn("⚠ [API] Resposta inesperada, retornando lista vazia", primeira);
    return [];
  } catch (error: any) {
    const isCanceled =
      error?.code === "ERR_CANCELED" ||
      error?.message?.toLowerCase?.().includes("canceled");

    if (isCanceled) {
      console.log("🟦 [API] Request cancelado (novo poll iniciou).");
      return null;
    }

    console.error("❌ [API] ERRO ao buscar pedidos:", {
      message: error?.message,
      code: error?.code,
      status: error?.response?.status,
      url: error?.config?.url,
    });

    return null;
  } finally {
    pendentesController = null;
  }
}
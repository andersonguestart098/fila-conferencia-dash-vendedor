// src/hooks/useFilaConferencia.ts

import { useCallback, useEffect, useState } from "react";
import type { DetalhePedido } from "../types/conferencia";
import { buscarPedidosPendentes } from "../api/conferencia";
import { conectarConferenciaStream } from "../api/conferenciaStream";

import {
  AudioLogger,
  limparFilaAudio,
  dispararAlertasVoz,
} from "../../public/audio/audioManager";

interface UseFilaConferenciaResult {
  pedidos: DetalhePedido[];
  loadingInicial: boolean;
  erro: string | null;
  selecionado: DetalhePedido | null;
  setSelecionado: (p: DetalhePedido | null) => void;
  refresh: () => Promise<void>;
}

export function useFilaConferencia(): UseFilaConferenciaResult {
  const [pedidos, setPedidos] = useState<DetalhePedido[]>([]);
  const [loadingInicial, setLoadingInicial] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionado, setSelecionado] =
    useState<DetalhePedido | null>(null);

  const carregar = useCallback(async () => {
    try {
      console.log("📡 [API] Buscando pedidos sob demanda...");

      const lista = await buscarPedidosPendentes();

      if (lista === null) {
        setErro("Erro ao atualizar pedidos.");
        setLoadingInicial(false);
        return;
      }

      setErro(null);
      setLoadingInicial(false);

      dispararAlertasVoz(lista);

      setPedidos(lista);

      setSelecionado((anterior) => {
        if (!anterior) return lista[0] ?? null;

        const aindaExiste = lista.find(
          (p) => p.nunota === anterior.nunota
        );

        return aindaExiste ?? lista[0] ?? null;
      });
    } catch (e) {
      console.error("❌ erro ao buscar pedidos:", e);

      setLoadingInicial(false);
      setErro("Erro ao atualizar pedidos.");
    }
  }, []);

  useEffect(() => {
    AudioLogger.log(
      "INSTANCE_INIT",
      "Inicializando painel admin"
    );

    carregar();

    const disconnect = conectarConferenciaStream({
      onConnected: () => {
        console.log("✅ [APP] SSE conectado");
      },

      onPedidoStatusChanged: (event) => {
        console.log(
          "📩 [APP] pedido_status_changed",
          event
        );

        setPedidos((prev) =>
          prev.map((p) =>
            p.nunota === event.nunota
              ? {
                  ...p,
                  statusConferencia:
                    event.statusConferencia,
                }
              : p
          )
        );

        setTimeout(() => {
          carregar();
        }, 800);
      },

      onPedidoFinalizado: (event) => {
        console.log(
          "📩 [APP] pedido_finalizado",
          event
        );

        setPedidos((prev) =>
          prev.map((p) =>
            p.nunota === event.nunota
              ? {
                  ...p,
                  statusConferencia:
                    event.statusConferencia,
                }
              : p
          )
        );

        setTimeout(() => {
          carregar();
        }, 800);
      },
    });

    return () => {
      disconnect();
      limparFilaAudio();
    };
  }, [carregar]);

  return {
    pedidos,
    loadingInicial,
    erro,
    selecionado,
    setSelecionado,
    refresh: carregar,
  };
}
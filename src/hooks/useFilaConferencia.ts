// src/hooks/useFilaConferencia.ts

import { useCallback, useEffect, useRef, useState } from "react";
import type { DetalhePedido } from "../types/conferencia";
import { buscarPedidosPendentes } from "../api/conferencia";
import { conectarConferenciaStream } from "../api/conferenciaStream";

import {
  AudioLogger,
  limparFilaAudio,
  dispararAlertasVoz,
  marcarJaTocados,
} from "../../public/audio/audioManager";

interface UseFilaConferenciaResult {
  pedidos: DetalhePedido[];
  loadingInicial: boolean;
  erro: string | null;
  selecionado: DetalhePedido | null;
  setSelecionado: (p: DetalhePedido | null) => void;
  refresh: () => Promise<void>;
}

const POLLING_INTERVAL_MS = 30_000; // 30s — leve e silencioso

export function useFilaConferencia(): UseFilaConferenciaResult {
  const [pedidos, setPedidos] = useState<DetalhePedido[]>([]);
  const [loadingInicial, setLoadingInicial] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<DetalhePedido | null>(null);

  const primeiraCarrega = useRef(true);

  // Controle do polling: evita chamadas simultâneas
  const pollingEmAndamentoRef = useRef(false);

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

      if (primeiraCarrega.current) {
        // Na carga inicial, marca todos os "C" históricos como já tocados
        // sem disparar áudio — evita spam ao puxar todo o DB
        primeiraCarrega.current = false;
        const historicos = lista
          .filter((p) => p.statusConferencia === "C")
          .map((p) => p.nunota);
        marcarJaTocados(historicos);
      } else {
        dispararAlertasVoz(lista);
      }

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

  // Carga inicial + SSE
  useEffect(() => {
    AudioLogger.log("INSTANCE_INIT", "Inicializando painel admin");

    carregar();

    const disconnect = conectarConferenciaStream({
      onConnected: () => {
        console.log("✅ [APP] SSE conectado");
      },

      onReconnect: () => {
        console.log("🔄 [APP] SSE reconectado — fazendo refresh");
        carregar();
      },

      onPedidoStatusChanged: (event) => {
        console.log("📩 [APP] pedido_status_changed", event);

        setPedidos((prev) =>
          prev.map((p) =>
            p.nunota === event.nunota
              ? { ...p, statusConferencia: event.statusConferencia }
              : p
          )
        );

        setTimeout(() => {
          carregar();
        }, 800);
      },

      onPedidoFinalizado: (event) => {
        console.log("📩 [APP] pedido_finalizado", event);

        setPedidos((prev) =>
          prev.map((p) =>
            p.nunota === event.nunota
              ? { ...p, statusConferencia: event.statusConferencia }
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

  // Polling silencioso a cada 30s
  // — não mostra loading, não interrompe o usuário
  // — ignora se já tem uma chamada em andamento
  useEffect(() => {
    const id = setInterval(async () => {
      if (pollingEmAndamentoRef.current) {
        console.log("⏭️ [POLLING] chamada anterior ainda em andamento, pulando");
        return;
      }

      pollingEmAndamentoRef.current = true;
      console.log("🔁 [POLLING] refresh silencioso");

      try {
        await carregar();
      } finally {
        pollingEmAndamentoRef.current = false;
      }
    }, POLLING_INTERVAL_MS);

    return () => clearInterval(id);
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
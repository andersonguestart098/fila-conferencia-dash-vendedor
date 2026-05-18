// src/audio/audioManager.ts
import type { DetalhePedido } from "../../src/types/conferencia";

/* -----------------------------------------------------
   ÁUDIO POR VENDEDOR (nome COMPLETO normalizado)
----------------------------------------------------- */
const audioVendedores: Record<string, string> = {
  "GUILHERME RODRIGUES": "/audio/guilherme.mp3",
  "LUIS TIZONI": "/audio/luis.mp3",
  "ALINE GOMES": "/audio/felipe.mp3",
  "MARCIA MELLER": "/audio/marcia.mp3",
  "JONATHAS RODRIGUES": "/audio/jonathas.mp3",
  "PAULO FAGUNDES": "/audio/fagundes.mp3",
  "RAFAEL AZEVEDO": "/audio/rafael.mp3",
  "GB": "/audio/felipe.mp3",
  "GILIARD CAMPOS": "/audio/giliard.mp3",
  "SABINO BRESOLIN": "/audio/6+Sabino.mp3",
  "GUILHERME FRANCA": "/audio/guilherme.mp3",
  "LEONARDO MACHADO": "/audio/leonardo.mp3",
  "EDUARDO SANTOS": "/audio/eduardo.mp3",
  "RICARDO MULLER": "/audio/ricardo.mp3",
  "BRUNA SIQUEIRA": "/audio/felipe.mp3",
  "REBECA MOURA": "/audio/felipe.mp3",
  "GABRIEL AIRES": "/audio/gabriel.mp3",
  "GELSON MACHADO": "/audio/felipe.mp3",
  "GASPAR TARTARI": "/audio/gaspar.mp3",
  "FERNANDO SERAFIM": "/audio/fernando.mp3",
  "TREVISANI": "/audio/felipe.mp3",
  "DAIANE CAMPOS": "/audio/daiane.mp3",
  "JULIA TARTARI": "/audio/felipe.mp3",
  "FELIPE TARTARI": "/audio/felipe.mp3",
  "BETO TARTARI": "/audio/beto.mp3",
  "DANIEL MACCARI": "/audio/felipe.mp3",
};

function normalizarNome(nome?: string | null): string {
  if (!nome) return "";
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

/* -----------------------------------------------------
   ID DA INSTÂNCIA (pra ver se tem duas abas)
----------------------------------------------------- */
export const AUDIO_INSTANCE_ID = Math.random().toString(36).slice(2, 8);

/* -----------------------------------------------------
   LOG SIMPLES
----------------------------------------------------- */
export class AudioLogger {
  static log(type: string, message: string, data?: any) {
    const timestamp = new Date().toLocaleTimeString("pt-BR", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });

    // eslint-disable-next-line no-console
    console.log(
      `🔊 [${timestamp}] [INSTÂNCIA:${AUDIO_INSTANCE_ID}] [${type}] ${message}`,
      data ? data : ""
    );
  }
}

/* -----------------------------------------------------
   ESTADO GLOBAL EM MEMÓRIA (por aba)
----------------------------------------------------- */
const queueNunotas = new Set<number>();
const playedNunotas = new Set<number>();

let audioLock = false;
let audioQueue: Array<{ src: string; nunota: number; nomeVendedor: string }> =
  [];
let currentAudio: HTMLAudioElement | null = null;

/* -----------------------------------------------------
   CONTROLE DA FILA
----------------------------------------------------- */
export function limparFilaAudio() {
  AudioLogger.log("CLEAR", "Limpando fila de áudio", {
    filaAntes: audioQueue.map((q) => q.nunota),
    audioAtual: currentAudio ? "playing" : "none",
  });

  audioQueue = [];
  audioLock = false;

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }

  queueNunotas.clear();
  // playedNunotas NÃO é limpo aqui
}

function processarFilaAudio() {
  if (audioLock) {
    AudioLogger.log(
      "QUEUE_LOCKED",
      "Áudio travado, aguardando áudio atual terminar",
      { filaAtual: audioQueue.map((q) => q.nunota) }
    );
    return;
  }

  if (audioQueue.length === 0) {
    AudioLogger.log("QUEUE_EMPTY", "Fila vazia, nada para tocar");
    return;
  }

  audioLock = true;
  const proximo = audioQueue.shift()!;

  AudioLogger.log(
    "PLAY_START",
    `Iniciando áudio do pedido #${proximo.nunota}`,
    {
      nunota: proximo.nunota,
      vendedor: proximo.nomeVendedor,
      arquivo: proximo.src,
      filaRestante: audioQueue.map((q) => q.nunota),
    }
  );

  try {
    currentAudio = new Audio(proximo.src);

    currentAudio.onloadeddata = () => {
      AudioLogger.log(
        "LOADED",
        `Áudio carregado para pedido #${proximo.nunota}`
      );
    };

    currentAudio.onplaying = () => {
      AudioLogger.log(
        "PLAYING",
        `Áudio tocando para pedido #${proximo.nunota}`
      );
    };

    const finalizarPedidoDaFila = (motivo: string) => {
      AudioLogger.log(
        "FINISH_ITEM",
        `Finalizando pedido #${proximo.nunota} na fila (${motivo})`,
        { nunota: proximo.nunota }
      );

      playedNunotas.add(proximo.nunota);
      queueNunotas.delete(proximo.nunota);

      audioLock = false;
      currentAudio = null;

      setTimeout(() => {
        AudioLogger.log(
          "QUEUE_NEXT",
          "Verificando próximo da fila após finalização",
          { filaAtual: audioQueue.map((q) => q.nunota) }
        );
        if (audioQueue.length > 0) {
          processarFilaAudio();
        } else {
          AudioLogger.log("QUEUE_EMPTY_AFTER", "Fila vazia após finalização");
        }
      }, 300);
    };

    currentAudio.onended = () => {
      AudioLogger.log(
        "PLAY_END",
        `Áudio finalizado para pedido #${proximo.nunota}`
      );
      finalizarPedidoDaFila("onended");
    };

    currentAudio.onerror = (err) => {
      AudioLogger.log(
        "ERROR",
        `Erro ao tocar áudio do pedido #${proximo.nunota}`,
        { error: err, src: proximo.src }
      );
      finalizarPedidoDaFila("onerror");
    };

    currentAudio.play().catch((err) => {
      AudioLogger.log(
        "PLAY_FAIL",
        `Falha ao iniciar áudio do pedido #${proximo.nunota}`,
        { error: err, src: proximo.src }
      );
      finalizarPedidoDaFila("play.catch");
    });
  } catch (e) {
    AudioLogger.log(
      "CRITICAL",
      `Erro crítico ao criar áudio para pedido #${proximo.nunota}`,
      { error: e }
    );
    audioLock = false;
    currentAudio = null;

    setTimeout(() => {
      AudioLogger.log(
        "QUEUE_NEXT",
        "Tentando recuperar após erro crítico",
        { filaAtual: audioQueue.map((q) => q.nunota) }
      );
      if (audioQueue.length > 0) {
        processarFilaAudio();
      }
    }, 300);
  }
}

/* -----------------------------------------------------
   DISPARO DO ÁUDIO (1x por nunota por aba)
----------------------------------------------------- */
export function tocarAlertaCorte(
  nomeVendedor: string | null | undefined,
  nunota: number
): boolean {
  if (playedNunotas.has(nunota)) {
    AudioLogger.log(
      "SKIP_PLAYED",
      `Pulando pedido #${nunota} - já tocou nesta sessão`,
      { nunota, vendedor: nomeVendedor }
    );
    return false;
  }

  if (queueNunotas.has(nunota)) {
    AudioLogger.log(
      "SKIP_QUEUED",
      `Pulando pedido #${nunota} - já está na fila`,
      {
        nunota,
        vendedor: nomeVendedor,
        filaAtual: audioQueue.map((q) => q.nunota),
      }
    );
    return false;
  }

  const nomeNorm = normalizarNome(nomeVendedor);
  const src = (nomeNorm && audioVendedores[nomeNorm]) || "/audio/felipe.mp3";

  AudioLogger.log("TRIGGER", `Disparo de áudio solicitado`, {
    nunota,
    vendedor: nomeVendedor,
    normalizado: nomeNorm,
    arquivo: src,
    filaAntes: audioQueue.map((q) => q.nunota),
  });

  queueNunotas.add(nunota);

  audioQueue.push({
    src,
    nunota,
    nomeVendedor: nomeVendedor || "Desconhecido",
  });

  AudioLogger.log("QUEUE_ADD", `Pedido #${nunota} adicionado à fila`, {
    filaAtual: audioQueue.map((q) => q.nunota),
    audioTravado: audioLock,
  });

  if (!audioLock) {
    AudioLogger.log(
      "QUEUE_PROCESS",
      "Nenhum áudio tocando, iniciando processamento da fila"
    );
    processarFilaAudio();
  } else {
    AudioLogger.log(
      "QUEUE_WAIT",
      "Áudio atual em execução, aguardando para processar fila"
    );
  }

  return true;
}

/* -----------------------------------------------------
   API para o hook: disparar alertas em uma lista
   👉 Agora: SOMENTE statusConferencia === "C"
----------------------------------------------------- */
export function dispararAlertasVoz(lista: DetalhePedido[]) {
  AudioLogger.log("SCAN_START", `Iniciando scan de ${lista.length} pedidos`, {
    nunotas: lista.map((p) => p.nunota),
  });

  let enfileirouAlgum = false;

  for (const p of lista) {
    const estaAguardandoLiberacaoParaCorte = p.statusConferencia === "C";
    const jaTocou = playedNunotas.has(p.nunota);
    const jaNaFila = queueNunotas.has(p.nunota);

    AudioLogger.log("SCAN_ITEM", `Analisando pedido #${p.nunota}`, {
      nunota: p.nunota,
      status: p.statusConferencia,
      estaAguardandoLiberacaoParaCorte,
      jaTocou,
      jaNaFila,
    });

    // 🔥 NOVA REGRA:
    // Só dispara se estiver com status "C",
    // e ainda não tiver tocado nem estiver na fila
    if (estaAguardandoLiberacaoParaCorte && !jaTocou && !jaNaFila) {
      AudioLogger.log(
        "ALERT_TRIGGER_STATUS_C",
        `Pedido #${p.nunota} está AGUARDANDO LIBERAÇÃO PARA CORTE (status C). Enfileirando alerta.`,
        {
          nunota: p.nunota,
          status: p.statusConferencia,
          vendedor: p.nomeVendedor,
        }
      );

      tocarAlertaCorte(p.nomeVendedor, p.nunota);
      enfileirouAlgum = true;

      AudioLogger.log(
        "SCAN_BREAK",
        `Já enfileirou o pedido #${p.nunota}, interrompendo scan para evitar múltiplos disparos na mesma varredura.`
      );
      break; // mantém o break pra não enfileirar vários de uma vez
    }
  }

  if (!enfileirouAlgum) {
    AudioLogger.log(
      "SCAN_NO_ALERT",
      "Scan concluído: nenhum pedido com status C (aguardando liberação para corte) novo para enfileirar."
    );
  }
}

/* -----------------------------------------------------
   Marca nunotas como já tocados sem tocar áudio
   (usado na carga inicial pra ignorar pedidos históricos)
----------------------------------------------------- */
export function marcarJaTocados(nunotas: number[]) {
  for (const n of nunotas) {
    playedNunotas.add(n);
  }
  AudioLogger.log("SEED_PLAYED", `${nunotas.length} pedidos marcados como já tocados (sem áudio)`, { nunotas });
}

/* -----------------------------------------------------
   Utilitários para os botões de debug da UI
----------------------------------------------------- */
export function getEstadoFila() {
  return {
    emFila: Array.from(queueNunotas),
    jaTocaram: Array.from(playedNunotas),
    filaInterna: audioQueue.map((q) => q.nunota),
  };
}

export function verificarEstadoFila() {
  const estado = getEstadoFila();

  // eslint-disable-next-line no-console
  console.log("🎧 ESTADO ATUAL DE ÁUDIO:", estado);

  // debug visual simples
  alert(
    `Veja no console:\n- Em fila: ${
      estado.emFila.join(", ") || "nenhum"
    }\n- Já tocados: ${estado.jaTocaram.join(", ") || "nenhum"}`
  );
}

export function limparTudoAudio() {
  if (
    window.confirm(
      "Tem certeza que deseja limpar a fila e o estado de áudio? Os pedidos poderão tocar novamente nesta sessão."
    )
  ) {
    playedNunotas.clear();
    queueNunotas.clear();
    limparFilaAudio();
    alert("Fila e estado de áudio limpos com sucesso!");
  }
}

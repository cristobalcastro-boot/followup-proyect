/**
 * Ciclo de consultas periódicas (polling) con setTimeout encadenado.
 *
 * No depende de React: el hook usePanel lo crea al montar y lo detiene al desmontar.
 * Es el único temporizador del panel; en cada ciclo ejecuta la consulta coordinada de
 * coordinadorConsultas.ts (servidores, alertas activas y, cada 30 s, alertas resueltas).
 * Separarlo permite probarlo con temporizadores simulados y deja el hook más corto.
 *
 *   iniciar → consultar ──(responde)──> entregar resultado → esperar intervaloMs → consultar → …
 *
 * Reglas:
 * - Nunca hay dos consultas a la vez: la siguiente se programa cuando termina la anterior.
 * - Con la pestaña oculta no se programan consultas; al volver a ser visible se consulta de inmediato.
 * - detener() cancela el temporizador y la consulta en curso; después no se entrega ningún resultado.
 * - Cada instancia es de un solo uso: no debe reiniciarse después de detener(). Para volver a
 *   consultar se crea otra instancia, como hace usePanel cada vez que se monta.
 */

/** Permite saber si la página está oculta y enterarse cuando cambia. */
export interface FuenteVisibilidad {
  estaOculta(): boolean;
  /** Registra una función que se llama en cada cambio; devuelve la función para anular el registro. */
  suscribir(alCambiar: () => void): () => void;
}

export interface OpcionesCicloConsultas<Resultado> {
  intervaloMs: number;
  /** Ejecuta una consulta. No debe lanzar excepciones (obtenerServidores nunca lo hace). */
  consultar: (senal: AbortSignal) => Promise<Resultado>;
  /** Recibe cada resultado mientras el ciclo esté activo. */
  alObtenerResultado: (resultado: Resultado) => void;
  /** Opcional: sin ella, el ciclo consulta siempre, aunque la pestaña esté oculta. */
  visibilidad?: FuenteVisibilidad;
}

export interface CicloConsultas {
  iniciar(): void;
  detener(): void;
  /** Consulta de inmediato (por ejemplo, botón "Reintentar"). Si ya hay una en curso, no hace nada. */
  consultarAhora(): void;
}

export function crearCicloConsultas<Resultado>(opciones: OpcionesCicloConsultas<Resultado>): CicloConsultas {
  const { intervaloMs, consultar, alObtenerResultado, visibilidad } = opciones;

  let activo = false;
  let consultaEnCurso = false;
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  let controlador: AbortController | null = null;
  let anularSuscripcion: (() => void) | null = null;

  const estaOculta = () => visibilidad?.estaOculta() ?? false;

  function cancelarTemporizador(): void {
    if (temporizador !== undefined) {
      clearTimeout(temporizador);
      temporizador = undefined;
    }
  }

  function programarSiguiente(): void {
    cancelarTemporizador();
    // Con la pestaña oculta el ciclo queda en pausa hasta que vuelva a ser visible.
    if (activo && !estaOculta()) {
      temporizador = setTimeout(consultarAhora, intervaloMs);
    }
  }

  function consultarAhora(): void {
    if (!activo || consultaEnCurso) {
      return;
    }
    cancelarTemporizador();
    consultaEnCurso = true;
    const controladorDeEstaConsulta = new AbortController();
    controlador = controladorDeEstaConsulta;

    const terminar = (resultado?: { valor: Resultado }) => {
      consultaEnCurso = false;
      // Si se detuvo el ciclo mientras esperaba la respuesta, el resultado se descarta.
      if (!activo || controladorDeEstaConsulta.signal.aborted) {
        return;
      }
      if (resultado !== undefined) {
        alObtenerResultado(resultado.valor);
      }
      programarSiguiente();
    };

    consultar(controladorDeEstaConsulta.signal).then(
      (valor) => terminar({ valor }),
      // Defensa: si la consulta lanzara una excepción, el ciclo sigue funcionando.
      () => terminar(),
    );
  }

  function alCambiarVisibilidad(): void {
    if (estaOculta()) {
      cancelarTemporizador();
    } else {
      consultarAhora();
    }
  }

  return {
    iniciar() {
      if (activo) {
        return;
      }
      activo = true;
      anularSuscripcion = visibilidad?.suscribir(alCambiarVisibilidad) ?? null;
      if (!estaOculta()) {
        consultarAhora();
      }
    },
    detener() {
      activo = false;
      cancelarTemporizador();
      controlador?.abort();
      controlador = null;
      anularSuscripcion?.();
      anularSuscripcion = null;
    },
    consultarAhora,
  };
}

/** Visibilidad real del documento del navegador (Page Visibility API). */
export function visibilidadDelDocumento(): FuenteVisibilidad {
  return {
    estaOculta: () => document.visibilityState === "hidden",
    suscribir(alCambiar) {
      document.addEventListener("visibilitychange", alCambiar);
      return () => document.removeEventListener("visibilitychange", alCambiar);
    },
  };
}

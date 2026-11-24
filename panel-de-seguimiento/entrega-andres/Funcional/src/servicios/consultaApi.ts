import type { ConfiguracionApi } from "@/configuracion/entorno";

// Consulta HTTP común a todos los endpoints de lectura de followup-api (servidores y alertas).
// No tiene importaciones en tiempo de ejecución: así las pruebas con node:test pueden cargarla
// directamente, sin resolver el alias "@/".

/** Tiempo máximo de espera de una consulta antes de considerarla fallida. */
export const TIEMPO_MAXIMO_CONSULTA_MS = 10_000;

/**
 * Motivo por el que una consulta no entregó datos. `tipo` permite a la interfaz
 * distinguir "no hubo respuesta" (red) de "la API respondió con un error".
 */
export type FalloConsulta =
  | { readonly tipo: "configuracion"; readonly mensaje: string }
  /** Los parámetros de la consulta no cumplen el contrato; no se llegó a enviar. */
  | { readonly tipo: "consulta-invalida"; readonly mensaje: string }
  | { readonly tipo: "red"; readonly mensaje: string }
  | { readonly tipo: "tiempo-agotado"; readonly mensaje: string }
  | { readonly tipo: "almacenamiento-no-disponible"; readonly mensaje: string }
  | { readonly tipo: "http"; readonly estadoHttp: number; readonly mensaje: string }
  | { readonly tipo: "respuesta-invalida"; readonly mensaje: string }
  /** La consulta se canceló a propósito (desmontaje o una consulta más nueva); no es un error. */
  | { readonly tipo: "cancelada" };

export type ResultadoConsulta<Respuesta> =
  | { readonly exito: true; readonly respuesta: Respuesta }
  | { readonly exito: false; readonly fallo: FalloConsulta };

/** Validador de ejecución de un cuerpo JSON (por ejemplo, validarRespuestaServidores). */
export type ValidadorRespuesta<Respuesta> = (
  cuerpo: unknown,
) => { readonly valida: true; readonly respuesta: Respuesta } | { readonly valida: false; readonly problema: string };

/** Solo lo que la consulta usa de fetch; permite sustituirlo en las pruebas. */
export type ClienteHttp = (url: string, opciones: RequestInit) => Promise<Pick<Response, "ok" | "status" | "json">>;

export interface OpcionesConsultaApi<Respuesta> {
  /** Resultado de leerConfiguracionApi(); si no es válida, no se consulta. */
  readonly configuracion: ConfiguracionApi;
  /** Ruta con parámetros, por ejemplo "/api/v1/alerts?status=active&limit=500". */
  readonly ruta: string;
  /** Permite cancelar la consulta con un AbortController. */
  readonly senal: AbortSignal;
  readonly validar: ValidadorRespuesta<Respuesta>;
  /** Por defecto TIEMPO_MAXIMO_CONSULTA_MS. */
  readonly tiempoMaximoMs?: number;
  /** Por defecto, fetch del entorno. */
  readonly clienteHttp?: ClienteHttp;
}

function esTiempoAgotado(error: unknown): boolean {
  return error instanceof DOMException && error.name === "TimeoutError";
}

function fallo(fallo: FalloConsulta): { readonly exito: false; readonly fallo: FalloConsulta } {
  return { exito: false, fallo };
}

function mensajeHttp(estadoHttp: number, rutaSinParametros: string): string {
  if (estadoHttp === 400) {
    return `La API rechazó los parámetros de la consulta a ${rutaSinParametros} (HTTP 400).`;
  }
  if (estadoHttp === 401) {
    // Solo ocurre si la API tiene configurada DASHBOARD_API_KEY: el navegador no puede enviarla
    // (CORS no autoriza Authorization y la clave quedaría expuesta).
    return "La API exige una clave de lectura (HTTP 401). El dashboard consulta desde el navegador y no puede enviarla de forma segura: se requiere una integración en el servidor de Next.js, o dejar DASHBOARD_API_KEY sin configurar en la demostración local.";
  }
  if (estadoHttp === 404) {
    return `La API respondió 404: la ruta ${rutaSinParametros} no existe en esa dirección. Revisa NEXT_PUBLIC_URL_API.`;
  }
  if (estadoHttp >= 500) {
    return `La API respondió con un error interno (HTTP ${estadoHttp}).`;
  }
  return `La API respondió con un estado inesperado (HTTP ${estadoHttp}).`;
}

/**
 * Consulta un endpoint GET de followup-api. Nunca lanza excepciones: devuelve un resultado
 * con los datos validados o con el motivo del fallo.
 */
export async function consultarApi<Respuesta>(
  opciones: OpcionesConsultaApi<Respuesta>,
): Promise<ResultadoConsulta<Respuesta>> {
  const { configuracion, ruta, senal, validar } = opciones;
  const tiempoMaximoMs = opciones.tiempoMaximoMs ?? TIEMPO_MAXIMO_CONSULTA_MS;
  const clienteHttp: ClienteHttp = opciones.clienteHttp ?? ((url, init) => fetch(url, init));

  if (!configuracion.valida) {
    return fallo({ tipo: "configuracion", mensaje: configuracion.mensaje });
  }
  const url = `${configuracion.urlApi}${ruta}`;
  const rutaSinParametros = ruta.split("?")[0];
  const tiempoAgotado = () =>
    fallo({
      tipo: "tiempo-agotado",
      mensaje: `La API no respondió en ${tiempoMaximoMs / 1000} s (${configuracion.urlApi}).`,
    });

  // Se cancela si lo pide quien llama o si se supera el tiempo máximo.
  const senalCombinada = AbortSignal.any([senal, AbortSignal.timeout(tiempoMaximoMs)]);

  let respuestaHttp: Awaited<ReturnType<ClienteHttp>>;
  try {
    respuestaHttp = await clienteHttp(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: senalCombinada,
    });
  } catch (error) {
    if (senal.aborted) {
      return fallo({ tipo: "cancelada" });
    }
    if (esTiempoAgotado(error)) {
      return tiempoAgotado();
    }
    // El navegador no distingue (por seguridad) entre API detenida, red caída o CORS rechazado.
    return fallo({
      tipo: "red",
      mensaje: `No se pudo contactar con followup-api en ${configuracion.urlApi}. Verifica que la API esté en ejecución y que el dashboard se abra desde un origen permitido por CORS (http://localhost:3000).`,
    });
  }

  if (respuestaHttp.status === 503) {
    return fallo({
      tipo: "almacenamiento-no-disponible",
      mensaje:
        "La API está en ejecución, pero su almacenamiento (PostgreSQL) no está disponible temporalmente (HTTP 503).",
    });
  }
  if (!respuestaHttp.ok) {
    return fallo({
      tipo: "http",
      estadoHttp: respuestaHttp.status,
      mensaje: mensajeHttp(respuestaHttp.status, rutaSinParametros),
    });
  }

  let cuerpo: unknown;
  try {
    cuerpo = await respuestaHttp.json();
  } catch (error) {
    if (senal.aborted) {
      return fallo({ tipo: "cancelada" });
    }
    // El tiempo máximo también puede agotarse mientras llega el cuerpo de la respuesta.
    if (esTiempoAgotado(error)) {
      return tiempoAgotado();
    }
    return fallo({ tipo: "respuesta-invalida", mensaje: "La API respondió 200, pero el cuerpo no es JSON válido." });
  }

  const validacion = validar(cuerpo);
  if (!validacion.valida) {
    return fallo({
      tipo: "respuesta-invalida",
      mensaje: `La respuesta de la API no tiene la estructura esperada (${validacion.problema}).`,
    });
  }
  return { exito: true, respuesta: validacion.respuesta };
}

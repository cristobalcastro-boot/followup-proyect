import { leerConfiguracionApi } from "@/configuracion/entorno";
import type { FiltrosAlertas, RespuestaAlertas } from "@/tipos/alertas";
import { consultarApi, type FalloConsulta } from "./consultaApi";
import {
  construirRutaAlertas,
  FILTROS_ALERTAS_ACTIVAS,
  puedeHaberMasAlertas,
  validarRespuestaAlertas,
} from "./validarRespuestaAlertas";

/** Alertas validadas, junto con lo necesario para saber si la lista puede estar incompleta. */
export interface ConsultaAlertas {
  readonly respuesta: RespuestaAlertas;
  /** limit enviado a la API. */
  readonly limite: number;
  /**
   * true si la respuesta trae `limite` alertas: puede haber más (más antiguas) que no vinieron.
   * Con FILTROS_ALERTAS_ACTIVAS no ocurre en el escenario actual.
   */
  readonly posiblementeIncompleta: boolean;
}

export type ResultadoConsultaAlertas =
  | { readonly exito: true; readonly consulta: ConsultaAlertas }
  | { readonly exito: false; readonly fallo: FalloConsulta };

/**
 * Consulta GET /api/v1/alerts. Nunca lanza excepciones: devuelve las alertas validadas o el
 * motivo del fallo, con la misma clasificación que obtenerServidores.
 *
 * Seguridad: la consulta sale del navegador, sin Authorization. Funciona mientras la API no
 * tenga configurada DASHBOARD_API_KEY (demostración local). Si se configura, la API responde
 * 401 y hará falta una integración en el servidor de Next.js que envíe la clave sin exponerla.
 *
 * @param senal permite cancelar la consulta con un AbortController.
 * @param filtros por defecto, todas las alertas activas (status=active&limit=500).
 */
export async function obtenerAlertas(
  senal: AbortSignal,
  filtros: FiltrosAlertas = FILTROS_ALERTAS_ACTIVAS,
): Promise<ResultadoConsultaAlertas> {
  const ruta = construirRutaAlertas(filtros);
  if (!ruta.valida) {
    return {
      exito: false,
      fallo: { tipo: "consulta-invalida", mensaje: `Filtros de alertas inválidos (${ruta.problema}).` },
    };
  }
  const resultado = await consultarApi({
    configuracion: leerConfiguracionApi(),
    ruta: ruta.ruta,
    senal,
    validar: validarRespuestaAlertas,
  });
  if (!resultado.exito) {
    return resultado;
  }
  return {
    exito: true,
    consulta: {
      respuesta: resultado.respuesta,
      limite: ruta.limite,
      posiblementeIncompleta: puedeHaberMasAlertas(resultado.respuesta, ruta.limite),
    },
  };
}

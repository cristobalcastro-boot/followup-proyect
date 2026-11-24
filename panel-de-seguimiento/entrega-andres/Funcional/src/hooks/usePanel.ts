import { useCallback, useEffect, useRef, useState } from "react";
import { leerConfiguracionActualizacion } from "@/configuracion/entorno";
import { obtenerAlertas, type ConsultaAlertas, type ResultadoConsultaAlertas } from "@/servicios/apiAlertas";
import { obtenerServidores } from "@/servicios/apiServidores";
import type { ResultadoConsulta } from "@/servicios/consultaApi";
import { FILTROS_ALERTAS_ACTIVAS, FILTROS_ALERTAS_RESUELTAS } from "@/servicios/validarRespuestaAlertas";
import type { FuenteVista } from "@/tipos/conexion";
import type { RespuestaServidores } from "@/tipos/servidores";
import { crearCicloConsultas, visibilidadDelDocumento, type CicloConsultas } from "./cicloConsultas";
import { crearConsultaCoordinada } from "./coordinadorConsultas";
import {
  aplicarResultadoFuente,
  calcularConexionFuente,
  ESTADO_FUENTE_INICIAL,
  type EstadoFuente,
} from "./estadoFuente";

/** Se lee una sola vez: NEXT_PUBLIC_* queda fijo al iniciar `next dev` o al compilar. */
const CONFIGURACION_ACTUALIZACION = leerConfiguracionActualizacion();

/** Periodicidad mínima del historial de alertas resueltas (cambia poco; se consulta menos). */
export const INTERVALO_ALERTAS_RESUELTAS_MS = 30_000;

/** Datos válidos de cada fuente. */
interface DatosPanel {
  readonly servidores: RespuestaServidores;
  readonly activas: ConsultaAlertas;
  readonly resueltas: ConsultaAlertas;
}

type EstadoPanel = { readonly [Fuente in keyof DatosPanel]: EstadoFuente<DatosPanel[Fuente]> };

const ESTADO_INICIAL: EstadoPanel = {
  servidores: ESTADO_FUENTE_INICIAL,
  activas: ESTADO_FUENTE_INICIAL,
  resueltas: ESTADO_FUENTE_INICIAL,
};

export interface ResultadoUsePanel {
  readonly servidores: FuenteVista<RespuestaServidores>;
  readonly alertasActivas: FuenteVista<ConsultaAlertas>;
  readonly alertasResueltas: FuenteVista<ConsultaAlertas>;
  /** Consulta de inmediato, sin esperar al siguiente ciclo (botón "Reintentar"). */
  readonly consultar: () => void;
  /** Intervalo del ciclo: servidores y alertas activas. */
  readonly intervaloMs: number;
  /** Periodicidad efectiva de las alertas resueltas (nunca menor que el ciclo). */
  readonly intervaloResueltasMs: number;
  /** Aviso si la variable de intervalo estaba mal configurada; null si no. */
  readonly advertenciaConfiguracion: string | null;
}

/** Adapta el resultado de obtenerAlertas a la forma común de los resultados de consulta. */
function comoResultadoConsulta(resultado: ResultadoConsultaAlertas): ResultadoConsulta<ConsultaAlertas> {
  return resultado.exito ? { exito: true, respuesta: resultado.consulta } : resultado;
}

function vista<Datos>(estado: EstadoFuente<Datos>): FuenteVista<Datos> {
  return { datos: estado.datos, conexion: calcularConexionFuente(estado) };
}

/**
 * Consulta la API al montar y luego de forma periódica, con un único ciclo (cicloConsultas):
 * - GET /api/v1/servers y GET /api/v1/alerts?status=active&limit=500 en cada ciclo (5 s por defecto).
 * - GET /api/v1/alerts?status=resolved&limit=20 cada 30 s.
 *
 * Las consultas de una ronda van en paralelo y la siguiente ronda empieza cuando terminan todas,
 * así nunca hay dos consultas de la misma fuente a la vez. Cada fuente guarda su propio estado:
 * si una falla, conserva sus últimos datos válidos (desactualizados) y las demás siguen
 * actualizándose. Al desmontar se cancela todo y se descartan los resultados tardíos.
 */
export function usePanel(): ResultadoUsePanel {
  const [estado, setEstado] = useState<EstadoPanel>(ESTADO_INICIAL);
  const ciclo = useRef<CicloConsultas | null>(null);

  useEffect(() => {
    function aplicar<Fuente extends keyof DatosPanel>(
      fuente: Fuente,
      resultado: ResultadoConsulta<DatosPanel[Fuente]>,
    ): void {
      const ahoraIso = new Date().toISOString();
      setEstado(
        (anterior) =>
          ({ ...anterior, [fuente]: aplicarResultadoFuente(anterior[fuente], resultado, ahoraIso) }) as EstadoPanel,
      );
    }

    const consultaCoordinada = crearConsultaCoordinada({
      fuentes: {
        servidores: {
          cadaMs: 0,
          consultar: obtenerServidores,
          alRecibir: (resultado: ResultadoConsulta<RespuestaServidores>) => aplicar("servidores", resultado),
        },
        activas: {
          cadaMs: 0,
          consultar: (senal: AbortSignal) =>
            obtenerAlertas(senal, FILTROS_ALERTAS_ACTIVAS).then(comoResultadoConsulta),
          alRecibir: (resultado: ResultadoConsulta<ConsultaAlertas>) => aplicar("activas", resultado),
        },
        resueltas: {
          cadaMs: INTERVALO_ALERTAS_RESUELTAS_MS,
          consultar: (senal: AbortSignal) =>
            obtenerAlertas(senal, FILTROS_ALERTAS_RESUELTAS).then(comoResultadoConsulta),
          alRecibir: (resultado: ResultadoConsulta<ConsultaAlertas>) => aplicar("resueltas", resultado),
        },
      },
    });

    const nuevoCiclo = crearCicloConsultas({
      intervaloMs: CONFIGURACION_ACTUALIZACION.intervaloMs,
      consultar: consultaCoordinada,
      // Cada fuente ya entregó su resultado al llegar (alRecibir); la ronda completa no se usa.
      alObtenerResultado: () => {},
      visibilidad: visibilidadDelDocumento(),
    });
    ciclo.current = nuevoCiclo;
    nuevoCiclo.iniciar();
    return () => {
      nuevoCiclo.detener();
      ciclo.current = null;
    };
  }, []);

  const consultar = useCallback(() => {
    ciclo.current?.consultarAhora();
  }, []);

  return {
    servidores: vista(estado.servidores),
    alertasActivas: vista(estado.activas),
    alertasResueltas: vista(estado.resueltas),
    consultar,
    intervaloMs: CONFIGURACION_ACTUALIZACION.intervaloMs,
    intervaloResueltasMs: Math.max(INTERVALO_ALERTAS_RESUELTAS_MS, CONFIGURACION_ACTUALIZACION.intervaloMs),
    advertenciaConfiguracion: CONFIGURACION_ACTUALIZACION.advertencia,
  };
}

import { ResumenAlertas } from "@/componentes/alertas/ResumenAlertas";
import { SeccionAlertas } from "@/componentes/alertas/SeccionAlertas";
import { Encabezado } from "@/componentes/estructura/Encabezado";
import { InventarioFiltrable } from "@/componentes/servidores/InventarioFiltrable";
import type { ConsultaAlertas } from "@/servicios/apiAlertas";
import { LIMITE_ALERTAS_RESUELTAS } from "@/servicios/validarRespuestaAlertas";
import { esConexionFallida, type EstadoConexionApi, type FuenteVista, type OrigenDatos } from "@/tipos/conexion";
import type { RespuestaServidores } from "@/tipos/servidores";
import { formatearFechaHora, formatearHora, formatearIntervalo } from "@/utilidades/formato";
import { disponibilidadAlertas } from "@/utilidades/alertas";
import { resumirServidores } from "@/utilidades/resumen";
import { contarPorTipo } from "@/utilidades/tipoDispositivo";
import { BotonReintentar } from "./BotonReintentar";
import { IndicadorConexionApi } from "./IndicadorConexionApi";
import { MensajeEstado } from "./MensajeEstado";
import { TarjetaResumen } from "./TarjetaResumen";

interface PropiedadesPanelGlobal {
  /** Última respuesta válida de GET /api/v1/servers; null si todavía no hay ninguna. */
  respuesta: RespuestaServidores | null;
  /** Estado de la consulta de servidores (también el indicador del encabezado). */
  conexion: EstadoConexionApi;
  /** GET /api/v1/alerts?status=active: fuente independiente de los servidores. */
  alertasActivas: FuenteVista<ConsultaAlertas>;
  /** GET /api/v1/alerts?status=resolved (últimas N): fuente independiente. */
  alertasResueltas: FuenteVista<ConsultaAlertas>;
  origenDatos: OrigenDatos;
  /** Si se entrega, se muestra un botón "Reintentar" cuando una consulta falla. */
  alReintentar?: () => void;
  /** Actualización automática (solo con datos reales). */
  actualizacion?: {
    intervaloMs: number;
    intervaloResueltasMs: number;
    advertenciaConfiguracion: string | null;
  };
}

/**
 * Pantalla del dashboard global. Es presentacional: recibe los datos por props y
 * decide qué mostrar según la combinación de respuestas y estados de conexión.
 * No consulta la API ni usa temporizadores; eso lo hace usePanel (vía PanelEnVivo).
 * Servidores, alertas activas y alertas resueltas son fuentes independientes, cada una con su
 * propio generatedAt: no forman una fotografía atómica y cada sección indica su propia hora.
 * Los tiempos relativos ("hace 12 s") se recalculan con cada respuesta, porque usan generatedAt.
 */
export function PanelGlobal({
  respuesta,
  conexion,
  alertasActivas,
  alertasResueltas,
  origenDatos,
  alReintentar,
  actualizacion,
}: PropiedadesPanelGlobal) {
  const resumen = respuesta === null ? null : resumirServidores(respuesta.servers);
  const porTipo = respuesta === null ? null : contarPorTipo(respuesta.servers);
  const avisoReintento =
    actualizacion === undefined
      ? ""
      : ` Se reintenta automáticamente cada ${formatearIntervalo(actualizacion.intervaloMs)}.`;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <Encabezado>
        {origenDatos === "demostracion" && (
          <span className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-500/15 dark:text-amber-300">
            Datos demostrativos
          </span>
        )}
        <IndicadorConexionApi
          conexion={conexion}
          origenDatos={origenDatos}
          intervaloActualizacionMs={actualizacion?.intervaloMs}
        />
      </Encabezado>

      {respuesta !== null && esConexionFallida(conexion) && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <div>
            <p className="font-semibold">Inventario desactualizado</p>
            <p className="mt-0.5">
              {conexion.mensaje} Se muestran los datos calculados por la API a las{" "}
              {formatearHora(respuesta.generatedAt)}; los estados de los equipos pueden haber cambiado desde entonces.
              {avisoReintento}
            </p>
          </div>
          {alReintentar !== undefined && <BotonReintentar alReintentar={alReintentar} />}
        </div>
      )}

      <section aria-labelledby="titulo-resumen">
        <h2 id="titulo-resumen" className="sr-only">
          Resumen global
        </h2>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3 sm:gap-4">
          <TarjetaResumen
            titulo="Equipos registrados"
            valor={resumen?.registrados ?? null}
            descripcion="Todos los registros de la API, clasificados o no"
            tono="neutro"
          />
          <TarjetaResumen
            titulo="Online"
            valor={resumen?.online ?? null}
            descripcion="Reportando dentro del umbral"
            tono="online"
          />
          <TarjetaResumen
            titulo="Offline"
            valor={resumen?.offline ?? null}
            descripcion="Sin reportes dentro del umbral"
            tono="offline"
          />
        </div>
        <h3 className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Por tipo de dispositivo
        </h3>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <TarjetaResumen
            titulo="Computadores"
            valor={porTipo?.computadores ?? null}
            descripcion="Identificador -pc-NN"
            tono="computador"
            compacta
          />
          <TarjetaResumen
            titulo="Cámaras IP"
            valor={porTipo?.camaras ?? null}
            descripcion="Identificador -cam-NN"
            tono="camara"
            compacta
          />
          <TarjetaResumen
            titulo="Sin clasificar"
            valor={porTipo?.sinClasificar ?? null}
            descripcion="Otros identificadores, como registros históricos"
            tono="sin-clasificar"
            compacta
          />
        </div>
        <ResumenAlertas activas={alertasActivas} />
      </section>

      <SeccionAlertas
        activas={alertasActivas}
        resueltas={alertasResueltas}
        limiteResueltas={LIMITE_ALERTAS_RESUELTAS}
        daemonIdsInventario={respuesta === null ? null : respuesta.servers.map((servidor) => servidor.daemonId)}
        alReintentar={alReintentar}
        actualizacion={
          actualizacion === undefined
            ? undefined
            : { intervaloActivasMs: actualizacion.intervaloMs, intervaloResueltasMs: actualizacion.intervaloResueltasMs }
        }
      />

      <section aria-labelledby="titulo-inventario" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="titulo-inventario" className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            Inventario de equipos
          </h2>
          {respuesta !== null && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Estados calculados por la API el{" "}
              <time dateTime={respuesta.generatedAt}>{formatearFechaHora(respuesta.generatedAt)}</time>
            </p>
          )}
        </div>
        <ContenidoInventario
          respuesta={respuesta}
          conexion={conexion}
          alertasActivas={alertasActivas}
          alReintentar={alReintentar}
          avisoReintento={avisoReintento}
        />
      </section>

      <footer className="border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <p>
          <strong className="font-medium text-slate-700 dark:text-slate-300">Online / offline</strong> indica si el
          Daemon del equipo se comunica con la API: pasa a offline tras{" "}
          {respuesta === null
            ? "el número de intervalos sin comunicación que define la API"
            : `${respuesta.offlineAfterMissedIntervals} intervalos de reporte sin comunicación`}
          .
        </p>
        <p className="mt-1">
          <strong className="font-medium text-slate-700 dark:text-slate-300">Tipo de dispositivo</strong> se deduce
          del final del identificador (-pc-NN para computadores, -cam-NN para cámaras IP), porque la API no lo
          informa. Los demás registros, como los históricos, aparecen como «Sin clasificar» con el estado y las
          métricas que entrega la API.
        </p>
        <p className="mt-1">
          <strong className="font-medium text-slate-700 dark:text-slate-300">CPU, RAM y disco</strong> son valores
          simulados por followup-daemon: no son mediciones reales del equipo ni un diagnóstico de hardware, y un
          porcentaje alto no indica por sí mismo una falla.
        </p>
        <p className="mt-1">
          <strong className="font-medium text-slate-700 dark:text-slate-300">Alertas</strong> las abre y las resuelve
          followup-api con sus propios umbrales y rachas de muestras; el dashboard no las calcula. El inventario y las
          alertas se consultan por separado: cada sección indica la hora de sus propios datos. En el inventario,
          «Anomalía» marca la métrica con una alerta activa de la API, no un valor alto. Una alerta de conectividad y el
          estado online/offline pueden diferir durante unos segundos, porque la API los actualiza en momentos
          distintos; se muestran ambos tal como llegan.
        </p>
        {actualizacion !== undefined && (
          <p className="mt-1">
            <strong className="font-medium text-slate-700 dark:text-slate-300">Actualización automática</strong> cada{" "}
            {formatearIntervalo(actualizacion.intervaloMs)} (inventario y alertas activas) y cada{" "}
            {formatearIntervalo(actualizacion.intervaloResueltasMs)} (alertas resueltas); se pausa mientras la pestaña
            está oculta.
          </p>
        )}
        {actualizacion?.advertenciaConfiguracion && (
          <p className="mt-1 text-amber-700 dark:text-amber-300">{actualizacion.advertenciaConfiguracion}</p>
        )}
      </footer>
    </div>
  );
}

/** Elige entre cargando, error, sin equipos o la tabla de equipos. */
function ContenidoInventario({
  respuesta,
  conexion,
  alertasActivas,
  alReintentar,
  avisoReintento,
}: Pick<PropiedadesPanelGlobal, "respuesta" | "conexion" | "alertasActivas" | "alReintentar"> & {
  avisoReintento: string;
}) {
  if (respuesta === null) {
    if (esConexionFallida(conexion)) {
      const titulo =
        conexion.tipo === "sin-conexion" ? "No se pudo conectar con la API" : "La API no entregó datos válidos";
      return (
        <MensajeEstado tipo="error" titulo={titulo}>
          <p>{conexion.mensaje}</p>
          <p className="mt-2">
            El estado de los equipos es desconocido mientras la API no responda correctamente.{avisoReintento}
          </p>
          {alReintentar !== undefined && (
            <div className="mt-4">
              <BotonReintentar alReintentar={alReintentar} />
            </div>
          )}
        </MensajeEstado>
      );
    }
    return (
      <MensajeEstado tipo="cargando" titulo="Consultando equipos…">
        Esperando la primera respuesta de followup-api.
      </MensajeEstado>
    );
  }

  if (respuesta.servers.length === 0) {
    return (
      <MensajeEstado tipo="vacio" titulo="Sin equipos registrados">
        La API respondió correctamente, pero ningún Daemon ha enviado reportes todavía. Un equipo aparece aquí en
        cuanto la API acepta su primer reporte.
      </MensajeEstado>
    );
  }

  const datosAlertas = alertasActivas.datos;
  return (
    <InventarioFiltrable
      servidores={respuesta.servers}
      referenciaIso={respuesta.generatedAt}
      alertasActivas={datosAlertas === null ? null : datosAlertas.respuesta.alerts}
      disponibilidadAlertas={disponibilidadAlertas(datosAlertas !== null, esConexionFallida(alertasActivas.conexion))}
      horaAlertas={datosAlertas === null ? null : datosAlertas.respuesta.generatedAt}
    />
  );
}

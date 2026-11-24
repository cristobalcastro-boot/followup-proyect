import type { Servidor } from "@/tipos/servidores";
import { alertasDeDispositivo, type AlertasDispositivo } from "@/utilidades/alertas";
import { formatearIntervalo } from "@/utilidades/formato";
import { AvisoPasoAOffline, PrimerRegistro, UltimaComunicacion } from "./DetalleComunicacion";
import { EtiquetaSimulado } from "./EtiquetaSimulado";
import { EtiquetaTipoDispositivo } from "./EtiquetaTipoDispositivo";
import { IndicadorAlertasEquipo } from "./IndicadorAlertasEquipo";
import { IndicadorPorcentaje } from "./IndicadorPorcentaje";
import { InsigniaEstado } from "./InsigniaEstado";
import { TarjetaServidor } from "./TarjetaServidor";

interface PropiedadesTablaServidores {
  servidores: readonly Servidor[];
  /** generatedAt de la respuesta: los tiempos relativos se calculan con el reloj de la API. */
  referenciaIso: string;
  /** Alertas activas por daemonId (agruparAlertasActivas); null si se desconocen. */
  alertasPorDispositivo?: ReadonlyMap<string, AlertasDispositivo> | null;
  /** Las alertas provienen de una consulta anterior a un fallo. */
  alertasDesactualizadas?: boolean;
}

const CLASES_CABECERA = "px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400";

/**
 * Inventario de equipos: tabla en pantallas grandes (desde 1024 px), tarjetas en móviles y tabletas.
 * Ambas vistas reciben los mismos datos y comparten los componentes de cada celda.
 * Las alertas activas se asocian por daemonId; los valores de las métricas no se modifican.
 */
export function TablaServidores({
  servidores,
  referenciaIso,
  alertasPorDispositivo = null,
  alertasDesactualizadas = false,
}: PropiedadesTablaServidores) {
  const alertasDe = (daemonId: string) =>
    alertasPorDispositivo === null ? null : alertasDeDispositivo(alertasPorDispositivo, daemonId);
  return (
    <>
      <ul aria-label="Inventario de equipos" className="grid gap-3 sm:grid-cols-2 lg:hidden">
        {servidores.map((servidor) => (
          <li key={servidor.daemonId}>
            <TarjetaServidor
              servidor={servidor}
              referenciaIso={referenciaIso}
              alertas={alertasDe(servidor.daemonId)}
              alertasDesactualizadas={alertasDesactualizadas}
            />
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm lg:block dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[760px] border-collapse">
          <caption className="sr-only">
            Inventario de equipos: {servidores.length} {servidores.length === 1 ? "registro" : "registros"} con su
            tipo (computador, cámara IP o sin clasificar), estado de comunicación calculado por la API, última
            comunicación, intervalo de reporte y última muestra de CPU, RAM y disco (valores simulados).
          </caption>
          <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60">
            <tr>
              <th scope="col" rowSpan={2} className={CLASES_CABECERA}>
                Equipo
              </th>
              <th scope="col" rowSpan={2} className={CLASES_CABECERA}>
                Estado
              </th>
              <th scope="col" rowSpan={2} className={CLASES_CABECERA}>
                Última comunicación
              </th>
              <th scope="col" rowSpan={2} className={CLASES_CABECERA}>
                Intervalo
              </th>
              <th
                scope="colgroup"
                colSpan={3}
                className="border-l border-slate-200 px-4 pt-2 text-left text-xs font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400"
              >
                <span className="inline-flex items-center gap-2">
                  Recursos (última muestra) <EtiquetaSimulado />
                </span>
              </th>
            </tr>
            <tr>
              <th scope="col" className={`${CLASES_CABECERA} border-l border-slate-200 dark:border-slate-800`}>
                CPU
              </th>
              <th scope="col" className={CLASES_CABECERA}>
                RAM
              </th>
              <th scope="col" className={CLASES_CABECERA}>
                Disco
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {servidores.map((servidor) => {
              const { resources } = servidor.latestReport;
              const alertas = alertasDe(servidor.daemonId);
              const esOffline = servidor.status === "offline";
              const clasesMetricas = `px-4 py-3 align-top ${esOffline ? "opacity-60" : ""}`;
              // En la tabla la etiqueta solo la leen los lectores de pantalla: con el equipo offline
              // se aclara que es la última muestra recibida (en la tarjeta móvil ya lo dice el título).
              const sufijo = esOffline ? ", última muestra recibida" : "";
              return (
                <tr key={servidor.daemonId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <th
                    scope="row"
                    className="px-4 py-3 text-left align-top"
                  >
                    <span className="block font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {servidor.daemonId}
                    </span>
                    <span className="mt-1 block">
                      <EtiquetaTipoDispositivo daemonId={servidor.daemonId} />
                    </span>
                    <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
                      Registrado: <PrimerRegistro servidor={servidor} />
                    </span>
                  </th>
                  <td className="px-4 py-3 align-top">
                    <InsigniaEstado estado={servidor.status} />
                    <AvisoPasoAOffline servidor={servidor} referenciaIso={referenciaIso} />
                    <IndicadorAlertasEquipo alertas={alertas} desactualizadas={alertasDesactualizadas} />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <UltimaComunicacion servidor={servidor} referenciaIso={referenciaIso} />
                  </td>
                  <td className="px-4 py-3 align-top text-sm tabular-nums text-slate-700 dark:text-slate-300">
                    {formatearIntervalo(servidor.intervalMs)}
                  </td>
                  <td className={`${clasesMetricas} border-l border-slate-100 dark:border-slate-800`}>
                    <IndicadorPorcentaje
                      etiqueta={`CPU${sufijo}`}
                      valor={resources.cpuUsagePercent}
                      anomala={alertas?.cpu ?? false}
                    />
                  </td>
                  <td className={clasesMetricas}>
                    <IndicadorPorcentaje
                      etiqueta={`RAM${sufijo}`}
                      valor={resources.memoryUsagePercent}
                      anomala={alertas?.ram ?? false}
                    />
                  </td>
                  <td className={clasesMetricas}>
                    <IndicadorPorcentaje
                      etiqueta={`Disco${sufijo}`}
                      valor={resources.diskUsagePercent}
                      anomala={alertas?.disco ?? false}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

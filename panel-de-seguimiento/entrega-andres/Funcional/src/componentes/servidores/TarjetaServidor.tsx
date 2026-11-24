import type { Servidor } from "@/tipos/servidores";
import type { AlertasDispositivo } from "@/utilidades/alertas";
import { formatearIntervalo } from "@/utilidades/formato";
import { AvisoPasoAOffline, PrimerRegistro, UltimaComunicacion } from "./DetalleComunicacion";
import { EtiquetaSimulado } from "./EtiquetaSimulado";
import { EtiquetaTipoDispositivo } from "./EtiquetaTipoDispositivo";
import { IndicadorAlertasEquipo } from "./IndicadorAlertasEquipo";
import { IndicadorPorcentaje } from "./IndicadorPorcentaje";
import { InsigniaEstado } from "./InsigniaEstado";

interface PropiedadesTarjetaServidor {
  servidor: Servidor;
  referenciaIso: string;
  /** Alertas activas del equipo según /alerts; null si se desconocen. */
  alertas?: AlertasDispositivo | null;
  alertasDesactualizadas?: boolean;
}

/** Un equipo en formato de tarjeta, para móviles y tabletas (menos de 1024 px). */
export function TarjetaServidor({
  servidor,
  referenciaIso,
  alertas = null,
  alertasDesactualizadas = false,
}: PropiedadesTarjetaServidor) {
  const { resources } = servidor.latestReport;
  const esOffline = servidor.status === "offline";

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* Sin truncar: el sufijo (-pc-NN, -cam-NN) es lo que distingue a cada dispositivo. */}
          <h3 className="font-mono text-sm font-semibold [overflow-wrap:anywhere] text-slate-900 dark:text-slate-100">
            {servidor.daemonId}
          </h3>
          <div className="mt-1">
            <EtiquetaTipoDispositivo daemonId={servidor.daemonId} />
          </div>
          <AvisoPasoAOffline servidor={servidor} referenciaIso={referenciaIso} />
          <IndicadorAlertasEquipo alertas={alertas} desactualizadas={alertasDesactualizadas} />
        </div>
        <InsigniaEstado estado={servidor.status} />
      </header>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">Última comunicación</dt>
          <dd className="mt-0.5">
            <UltimaComunicacion servidor={servidor} referenciaIso={referenciaIso} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">Intervalo de reporte</dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums text-slate-900 dark:text-slate-100">
            {formatearIntervalo(servidor.intervalMs)}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-slate-500 dark:text-slate-400">Registrado desde</dt>
          <dd className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">
            <PrimerRegistro servidor={servidor} />
          </dd>
        </div>
      </dl>

      <section className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {esOffline ? "Recursos (última muestra recibida)" : "Recursos"}
          </h4>
          <EtiquetaSimulado />
        </div>
        <div className={`mt-2 grid gap-2.5 ${esOffline ? "opacity-60" : ""}`}>
          <IndicadorPorcentaje etiqueta="CPU" valor={resources.cpuUsagePercent} mostrarEtiqueta anomala={alertas?.cpu ?? false} />
          <IndicadorPorcentaje etiqueta="RAM" valor={resources.memoryUsagePercent} mostrarEtiqueta anomala={alertas?.ram ?? false} />
          <IndicadorPorcentaje etiqueta="Disco" valor={resources.diskUsagePercent} mostrarEtiqueta anomala={alertas?.disco ?? false} />
        </div>
      </section>
    </article>
  );
}

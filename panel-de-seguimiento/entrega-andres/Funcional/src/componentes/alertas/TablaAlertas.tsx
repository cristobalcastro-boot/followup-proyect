import { EtiquetaTipoDispositivo } from "@/componentes/servidores/EtiquetaTipoDispositivo";
import type { Alerta } from "@/tipos/alertas";
import { ETIQUETA_ESTADO_ALERTA } from "@/utilidades/alertas";
import {
  formatearDuracion,
  formatearFechaHora,
  formatearPorcentaje,
  formatearTiempoTranscurrido,
} from "@/utilidades/formato";
import { EtiquetaTipoAlerta, InsigniaSeveridad } from "./EtiquetasAlerta";

interface PropiedadesTablaAlertas {
  alertas: readonly Alerta[];
  /** generatedAt de la respuesta de alertas: los tiempos relativos usan el reloj de la API. */
  referenciaIso: string;
  /** Agrega la columna de resolución (historial de alertas resueltas). */
  resueltas?: boolean;
  /** Texto del caption para lectores de pantalla. */
  descripcion: string;
  /** daemonId del último inventario válido; null si se desconoce (entonces no se marca nada). */
  daemonIdsInventario?: readonly string[] | null;
}

const CLASES_CABECERA = "px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400";

/**
 * Dispositivo asociado: identificador y tipo visual (deducido del daemonId). Si el inventario se
 * conoce y no contiene ese daemonId, se indica; la alerta se muestra igual, sin inventar un equipo.
 */
function Dispositivo({ daemonId, enInventario }: { daemonId: string; enInventario: boolean | null }) {
  return (
    <div className="min-w-0">
      <span className="block font-mono text-sm font-semibold [overflow-wrap:anywhere] text-slate-900 dark:text-slate-100">
        {daemonId}
      </span>
      <span className="mt-1 block">
        <EtiquetaTipoDispositivo daemonId={daemonId} />
      </span>
      {enInventario === false && (
        <span className="mt-1 block text-xs italic text-slate-500 dark:text-slate-400">No figura en el inventario</span>
      )}
    </div>
  );
}

/** Momento de detección: relativo al generatedAt de la respuesta y absoluto. */
function Deteccion({ alerta, referenciaIso, relativa }: { alerta: Alerta; referenciaIso: string; relativa: boolean }) {
  return (
    <div>
      {relativa && (
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {formatearTiempoTranscurrido(alerta.detectedAt, referenciaIso)}
        </p>
      )}
      <p className={relativa ? "text-xs tabular-nums text-slate-500 dark:text-slate-400" : "text-sm tabular-nums text-slate-700 dark:text-slate-300"}>
        <time dateTime={alerta.detectedAt}>{formatearFechaHora(alerta.detectedAt)}</time>
      </p>
    </div>
  );
}

/** Momento de resolución y duración de la alerta (solo resueltas). */
function Resolucion({ alerta }: { alerta: Alerta }) {
  if (alerta.resolvedAt === null) {
    return null;
  }
  return (
    <div>
      <p className="text-sm tabular-nums text-slate-700 dark:text-slate-300">
        <time dateTime={alerta.resolvedAt}>{formatearFechaHora(alerta.resolvedAt)}</time>
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Duró {formatearDuracion(Date.parse(alerta.resolvedAt) - Date.parse(alerta.detectedAt))}
      </p>
    </div>
  );
}

/** Valor observado y umbral que informó la API; las alertas de conectividad no tienen. */
function ValorUmbral({ alerta }: { alerta: Alerta }) {
  if (alerta.observedValue === null || alerta.threshold === null) {
    return (
      <p className="text-sm text-slate-400 dark:text-slate-500">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Sin valor ni umbral: alerta de conectividad</span>
      </p>
    );
  }
  return (
    <div>
      <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
        {formatearPorcentaje(alerta.observedValue)}
      </p>
      <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
        umbral {formatearPorcentaje(alerta.threshold)}
      </p>
    </div>
  );
}

/** Una alerta en formato de tarjeta, para móviles y tabletas. */
function TarjetaAlerta({
  alerta,
  referenciaIso,
  resueltas,
  enInventario,
}: {
  alerta: Alerta;
  referenciaIso: string;
  resueltas: boolean;
  enInventario: boolean | null;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <EtiquetaTipoAlerta tipo={alerta.kind} />
        <InsigniaSeveridad severidad={alerta.severity} />
      </header>
      <div className="mt-3">
        <Dispositivo daemonId={alerta.daemonId} enInventario={enInventario} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">Detectada</dt>
          <dd className="mt-0.5">
            <Deteccion alerta={alerta} referenciaIso={referenciaIso} relativa={!resueltas} />
          </dd>
        </div>
        {resueltas ? (
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Resuelta</dt>
            <dd className="mt-0.5">
              <Resolucion alerta={alerta} />
            </dd>
          </div>
        ) : (
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Valor / umbral</dt>
            <dd className="mt-0.5">
              <ValorUmbral alerta={alerta} />
            </dd>
          </div>
        )}
        {resueltas && (
          <div className="col-span-2">
            <dt className="text-xs text-slate-500 dark:text-slate-400">Valor / umbral</dt>
            <dd className="mt-0.5">
              <ValorUmbral alerta={alerta} />
            </dd>
          </div>
        )}
      </dl>
      <p className="sr-only">Estado: {ETIQUETA_ESTADO_ALERTA[alerta.status]}</p>
    </article>
  );
}

/**
 * Lista de alertas: tabla en pantallas grandes (desde 1024 px) y tarjetas en móviles y tabletas,
 * con los mismos datos. Respeta el orden de la API (detección más reciente primero).
 */
export function TablaAlertas({
  alertas,
  referenciaIso,
  resueltas = false,
  descripcion,
  daemonIdsInventario = null,
}: PropiedadesTablaAlertas) {
  const inventario = daemonIdsInventario === null ? null : new Set(daemonIdsInventario);
  const enInventario = (daemonId: string) => (inventario === null ? null : inventario.has(daemonId));
  return (
    <>
      <ul aria-label={descripcion} className="grid gap-3 sm:grid-cols-2 lg:hidden">
        {alertas.map((alerta) => (
          <li key={alerta.id}>
            <TarjetaAlerta
              alerta={alerta}
              referenciaIso={referenciaIso}
              resueltas={resueltas}
              enInventario={enInventario(alerta.daemonId)}
            />
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm lg:block dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[760px] border-collapse">
          <caption className="sr-only">{descripcion}</caption>
          <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60">
            <tr>
              <th scope="col" className={CLASES_CABECERA}>
                Alerta
              </th>
              <th scope="col" className={CLASES_CABECERA}>
                Dispositivo
              </th>
              <th scope="col" className={CLASES_CABECERA}>
                Severidad
              </th>
              <th scope="col" className={CLASES_CABECERA}>
                Detectada
              </th>
              {resueltas && (
                <th scope="col" className={CLASES_CABECERA}>
                  Resuelta
                </th>
              )}
              <th scope="col" className={CLASES_CABECERA}>
                Valor / umbral
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {alertas.map((alerta) => (
              <tr key={alerta.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                <th scope="row" className="px-4 py-3 text-left align-top font-normal">
                  <EtiquetaTipoAlerta tipo={alerta.kind} />
                  <span className="sr-only">, {ETIQUETA_ESTADO_ALERTA[alerta.status]}</span>
                </th>
                <td className="px-4 py-3 align-top">
                  <Dispositivo daemonId={alerta.daemonId} enInventario={enInventario(alerta.daemonId)} />
                </td>
                <td className="px-4 py-3 align-top">
                  <InsigniaSeveridad severidad={alerta.severity} />
                </td>
                <td className="px-4 py-3 align-top">
                  <Deteccion alerta={alerta} referenciaIso={referenciaIso} relativa={!resueltas} />
                </td>
                {resueltas && (
                  <td className="px-4 py-3 align-top">
                    <Resolucion alerta={alerta} />
                  </td>
                )}
                <td className="px-4 py-3 align-top">
                  <ValorUmbral alerta={alerta} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { GrupoOpciones } from "@/componentes/panel/GrupoOpciones";
import { MensajeEstado } from "@/componentes/panel/MensajeEstado";
import type { Alerta } from "@/tipos/alertas";
import type { Servidor } from "@/tipos/servidores";
import { agruparAlertasActivas, type DisponibilidadAlertas } from "@/utilidades/alertas";
import {
  filtrarInventario,
  FILTROS_INVENTARIO_INICIALES,
  hayFiltrosInventario,
  type FiltroAlertasEquipo,
  type FiltroEstadoEquipo,
  type FiltrosInventario,
  type FiltroTipoEquipo,
} from "@/utilidades/filtrosInventario";
import { formatearHora } from "@/utilidades/formato";
import { clasificarDispositivo } from "@/utilidades/tipoDispositivo";
import { TablaServidores } from "./TablaServidores";

interface PropiedadesInventarioFiltrable {
  servidores: readonly Servidor[];
  /** generatedAt de /servers. */
  referenciaIso: string;
  /** Últimas alertas activas válidas, o null si nunca se obtuvieron. */
  alertasActivas: readonly Alerta[] | null;
  disponibilidadAlertas: DisponibilidadAlertas;
  /** generatedAt de las alertas activas, para indicar de cuándo son si están desactualizadas. */
  horaAlertas: string | null;
}

const OPCIONES_ESTADO = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "online", etiqueta: "Online" },
  { valor: "offline", etiqueta: "Offline" },
] as const satisfies readonly { valor: FiltroEstadoEquipo; etiqueta: string }[];

const OPCIONES_TIPO = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "computador", etiqueta: "Computador" },
  { valor: "camara", etiqueta: "Cámara IP" },
  { valor: "sin-clasificar", etiqueta: "Sin clasificar" },
] as const satisfies readonly { valor: FiltroTipoEquipo; etiqueta: string }[];

/**
 * Inventario con filtros locales (estado, tipo y alertas) e indicadores de alertas por equipo.
 * Los filtros no consultan la API ni cambian los conteos del resumen global.
 */
export function InventarioFiltrable({
  servidores,
  referenciaIso,
  alertasActivas,
  disponibilidadAlertas,
  horaAlertas,
}: PropiedadesInventarioFiltrable) {
  const [filtros, setFiltros] = useState<FiltrosInventario>(FILTROS_INVENTARIO_INICIALES);
  const porDispositivo = useMemo(
    () => (alertasActivas === null ? null : agruparAlertasActivas(alertasActivas)),
    [alertasActivas],
  );
  const visibles = filtrarInventario(servidores, filtros, {
    tipoDe: clasificarDispositivo,
    alertasActivas: porDispositivo,
  });
  const desconocidas = disponibilidadAlertas === "desconocida";
  const desactualizadas = disponibilidadAlertas === "desactualizada";
  const filtrando = hayFiltrosInventario(filtros);
  const cambiar = <Clave extends keyof FiltrosInventario>(clave: Clave, valor: FiltrosInventario[Clave]) =>
    setFiltros((anteriores) => ({ ...anteriores, [clave]: valor }));
  const limpiar = () => setFiltros(FILTROS_INVENTARIO_INICIALES);

  const notaAlertas = desconocidas
    ? "Alertas desconocidas: todavía no se obtuvieron, no se puede filtrar por ellas."
    : desactualizadas && horaAlertas !== null
      ? `Según alertas desactualizadas (datos de las ${formatearHora(horaAlertas)}).`
      : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-900">
        <GrupoOpciones
          leyenda="Estado"
          nombre="filtro-inventario-estado"
          opciones={OPCIONES_ESTADO}
          valor={filtros.estado}
          alCambiar={(valor) => cambiar("estado", valor)}
        />
        <GrupoOpciones
          leyenda="Tipo"
          nombre="filtro-inventario-tipo"
          opciones={OPCIONES_TIPO}
          valor={filtros.tipo}
          alCambiar={(valor) => cambiar("tipo", valor)}
        />
        <GrupoOpciones<FiltroAlertasEquipo>
          leyenda="Alertas"
          nombre="filtro-inventario-alertas"
          opciones={[
            { valor: "todos", etiqueta: "Todos" },
            { valor: "con-alertas", etiqueta: "Con alertas activas", deshabilitada: desconocidas },
          ]}
          valor={filtros.alertas}
          alCambiar={(valor) => cambiar("alertas", valor)}
          nota={notaAlertas}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p aria-live="polite" className="text-xs text-slate-600 dark:text-slate-400">
          Mostrando {visibles.length} de {servidores.length} {servidores.length === 1 ? "registro" : "registros"}
          {filtrando ? " (filtros aplicados)" : ""}.
        </p>
        {filtrando && (
          <button
            type="button"
            onClick={limpiar}
            className="rounded-md px-2 py-1 text-xs font-medium text-sky-700 underline underline-offset-2 hover:text-sky-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:text-sky-300"
          >
            Quitar filtros
          </button>
        )}
      </div>

      {desconocidas && (
        <p className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <strong className="font-semibold">Alertas por equipo: estado desconocido.</strong> Las alertas activas todavía
          no se obtuvieron, así que los equipos no muestran indicadores de alertas. No significa que no tengan.
        </p>
      )}
      {desactualizadas && horaAlertas !== null && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <strong className="font-semibold">Indicadores de alertas desactualizados.</strong> Corresponden a las alertas
          activas con datos de la API de las {formatearHora(horaAlertas)}; la última consulta de alertas falló.
        </p>
      )}

      {visibles.length === 0 ? (
        <MensajeEstado tipo="vacio" titulo="Ningún equipo cumple los filtros" compacto>
          <p>Prueba con otra combinación de estado, tipo o alertas.</p>
          <button
            type="button"
            onClick={limpiar}
            className="mt-3 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:bg-slate-100 dark:text-slate-900"
          >
            Quitar filtros
          </button>
        </MensajeEstado>
      ) : (
        <TablaServidores
          servidores={visibles}
          referenciaIso={referenciaIso}
          alertasPorDispositivo={porDispositivo}
          alertasDesactualizadas={desactualizadas}
        />
      )}
    </div>
  );
}

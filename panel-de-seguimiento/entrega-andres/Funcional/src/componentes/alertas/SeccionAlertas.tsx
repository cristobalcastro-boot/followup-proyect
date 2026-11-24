"use client";

import { useState } from "react";
import { BotonReintentar } from "@/componentes/panel/BotonReintentar";
import { GrupoOpciones } from "@/componentes/panel/GrupoOpciones";
import { MensajeEstado } from "@/componentes/panel/MensajeEstado";
import type { ConsultaAlertas } from "@/servicios/apiAlertas";
import { esConexionFallida, type FuenteVista } from "@/tipos/conexion";
import {
  filtrarAlertasPorCategoria,
  FILTROS_ALERTAS_INICIALES,
  gruposAlertasVisibles,
  type FiltroCategoriaAlertas,
  type FiltroEstadoAlertas,
  type FiltrosAlertasPanel,
} from "@/utilidades/alertas";
import { formatearHora, formatearIntervalo } from "@/utilidades/formato";
import { TablaAlertas } from "./TablaAlertas";

interface PropiedadesSeccionAlertas {
  activas: FuenteVista<ConsultaAlertas>;
  resueltas: FuenteVista<ConsultaAlertas>;
  /** Cantidad de alertas resueltas pedidas a la API (últimas N). */
  limiteResueltas: number;
  /** daemonId del último inventario válido; null si se desconoce. Marca alertas sin dispositivo. */
  daemonIdsInventario: readonly string[] | null;
  /** Si se entrega, se muestra "Reintentar" cuando una consulta falla. */
  alReintentar?: () => void;
  /** Periodicidad de cada consulta (solo con datos reales). */
  actualizacion?: { intervaloActivasMs: number; intervaloResueltasMs: number };
}

const OPCIONES_ESTADO = [
  { valor: "todas", etiqueta: "Todas las disponibles" },
  { valor: "activas", etiqueta: "Activas" },
  { valor: "resueltas", etiqueta: "Resueltas" },
] as const satisfies readonly { valor: FiltroEstadoAlertas; etiqueta: string }[];

const OPCIONES_CATEGORIA = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "conectividad", etiqueta: "Conectividad" },
  { valor: "rendimiento", etiqueta: "Rendimiento" },
] as const satisfies readonly { valor: FiltroCategoriaAlertas; etiqueta: string }[];

const NOMBRE_CATEGORIA: Record<Exclude<FiltroCategoriaAlertas, "todas">, string> = {
  conectividad: "de conectividad",
  rendimiento: "de rendimiento",
};

/**
 * Alertas persistentes de la API: activas e historial reciente de resueltas, con filtros locales.
 * Cada grupo muestra su propio estado: si /alerts falla, el resto del panel sigue funcionando,
 * y los últimos datos válidos se conservan marcados como desactualizados. Los filtros no
 * consultan la API: trabajan con las activas y las últimas resueltas ya recibidas.
 */
export function SeccionAlertas({
  activas,
  resueltas,
  limiteResueltas,
  daemonIdsInventario,
  alReintentar,
  actualizacion,
}: PropiedadesSeccionAlertas) {
  const [filtros, setFiltros] = useState<FiltrosAlertasPanel>(FILTROS_ALERTAS_INICIALES);
  const visibles = gruposAlertasVisibles(filtros.estado);

  return (
    <section aria-labelledby="titulo-alertas" className="flex flex-col gap-5">
      <div>
        <h2 id="titulo-alertas" className="text-lg font-semibold text-slate-900 dark:text-slate-50">
          Alertas
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Las abre y las resuelve followup-api (umbrales de CPU, RAM y disco, y pérdida de conectividad). El dashboard
          solo las muestra.
        </p>
      </div>

      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
        <GrupoOpciones
          leyenda="Mostrar"
          nombre="filtro-alertas-estado"
          opciones={OPCIONES_ESTADO}
          valor={filtros.estado}
          alCambiar={(estado) => setFiltros((anteriores) => ({ ...anteriores, estado }))}
          nota={
            filtros.estado === "activas"
              ? undefined
              : `Las resueltas disponibles son solo las últimas ${limiteResueltas}, no el historial completo.`
          }
        />
        <GrupoOpciones
          leyenda="Categoría"
          nombre="filtro-alertas-categoria"
          opciones={OPCIONES_CATEGORIA}
          valor={filtros.categoria}
          alCambiar={(categoria) => setFiltros((anteriores) => ({ ...anteriores, categoria }))}
        />
      </div>

      {visibles.activas && (
        <GrupoAlertas
          id="titulo-alertas-activas"
          titulo="Alertas activas"
          detalle={
            actualizacion === undefined
              ? "Todas las alertas vigentes."
              : `Todas las alertas vigentes. Se consultan cada ${formatearIntervalo(actualizacion.intervaloActivasMs)}.`
          }
          fuente={activas}
          resueltas={false}
          categoria={filtros.categoria}
          daemonIdsInventario={daemonIdsInventario}
          alReintentar={alReintentar}
        />
      )}
      {visibles.resueltas && (
        <GrupoAlertas
          id="titulo-alertas-resueltas"
          titulo={`Alertas resueltas · últimas ${limiteResueltas}`}
          detalle={`Historial limitado: las ${limiteResueltas} resueltas de detección más reciente, no el historial completo.${
            actualizacion === undefined
              ? ""
              : ` Se consultan cada ${formatearIntervalo(actualizacion.intervaloResueltasMs)}.`
          }`}
          fuente={resueltas}
          resueltas
          categoria={filtros.categoria}
          daemonIdsInventario={daemonIdsInventario}
          alReintentar={alReintentar}
        />
      )}
    </section>
  );
}

interface PropiedadesGrupoAlertas {
  id: string;
  titulo: string;
  detalle: string;
  fuente: FuenteVista<ConsultaAlertas>;
  resueltas: boolean;
  categoria: FiltroCategoriaAlertas;
  daemonIdsInventario: readonly string[] | null;
  alReintentar?: () => void;
}

function GrupoAlertas({
  id,
  titulo,
  detalle,
  fuente,
  resueltas,
  categoria,
  daemonIdsInventario,
  alReintentar,
}: PropiedadesGrupoAlertas) {
  const { datos, conexion } = fuente;
  const fallida = esConexionFallida(conexion);
  const nombre = resueltas ? "las alertas resueltas" : "las alertas activas";
  const recibidas = datos === null ? [] : datos.respuesta.alerts;
  const filtradas = filtrarAlertasPorCategoria(recibidas, categoria);
  const filtrando = categoria !== "todas";

  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 id={id} className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {titulo}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{detalle}</p>
        </div>
        {datos !== null && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Datos de la API de las{" "}
            <time dateTime={datos.respuesta.generatedAt}>{formatearHora(datos.respuesta.generatedAt)}</time>
          </p>
        )}
      </div>

      {datos === null && fallida && (
        <MensajeEstado tipo="error" titulo={`No se pudieron obtener ${nombre}`} compacto>
          <p>{conexion.mensaje}</p>
          <p className="mt-2">
            Mientras la consulta no responda correctamente, se desconocen {nombre}: no significa que no existan.
          </p>
          {alReintentar !== undefined && (
            <div className="mt-4">
              <BotonReintentar alReintentar={alReintentar} />
            </div>
          )}
        </MensajeEstado>
      )}

      {datos === null && !fallida && (
        <MensajeEstado tipo="cargando" titulo={`Consultando ${nombre}…`} compacto>
          Esperando la primera respuesta de followup-api.
        </MensajeEstado>
      )}

      {datos !== null && fallida && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <div>
            <p className="font-semibold">{resueltas ? "Historial desactualizado" : "Alertas desactualizadas"}</p>
            <p className="mt-0.5">
              {conexion.mensaje} Se muestran {nombre} con datos de la API de las{" "}
              {formatearHora(datos.respuesta.generatedAt)}; pueden haber cambiado desde entonces.
            </p>
          </div>
          {alReintentar !== undefined && <BotonReintentar alReintentar={alReintentar} />}
        </div>
      )}

      {datos !== null && filtrando && recibidas.length > 0 && (
        <p aria-live="polite" className="text-xs text-slate-600 dark:text-slate-400">
          Mostrando {filtradas.length} de {recibidas.length} {resueltas ? "resueltas disponibles" : "activas"} (solo{" "}
          {categoria === "conectividad" ? "conectividad" : "rendimiento"}).
        </p>
      )}

      {datos !== null && recibidas.length === 0 && (
        <MensajeEstado
          tipo="vacio"
          titulo={
            resueltas
              ? "Sin alertas resueltas"
              : fallida
                ? "Sin alertas activas en los últimos datos válidos"
                : "Sin alertas activas"
          }
          compacto
        >
          {resueltas
            ? "La API no informa alertas resueltas."
            : "La API no informa alertas activas de conectividad ni de rendimiento."}
        </MensajeEstado>
      )}

      {datos !== null && recibidas.length > 0 && filtradas.length === 0 && categoria !== "todas" && (
        <MensajeEstado
          tipo="vacio"
          titulo={`Ninguna alerta ${resueltas ? "resuelta" : "activa"} ${NOMBRE_CATEGORIA[categoria]}`}
          compacto
        >
          {resueltas
            ? `Entre las ${recibidas.length} resueltas disponibles no hay alertas ${NOMBRE_CATEGORIA[categoria]}.`
            : `Las ${recibidas.length} alertas activas son de otra categoría.`}
        </MensajeEstado>
      )}

      {datos !== null && filtradas.length > 0 && (
        <>
          <TablaAlertas
            alertas={filtradas}
            referenciaIso={datos.respuesta.generatedAt}
            resueltas={resueltas}
            daemonIdsInventario={daemonIdsInventario}
            descripcion={
              resueltas
                ? `Alertas resueltas: ${filtradas.length} de detección más reciente, con su resolución, severidad y valor.`
                : `Alertas activas: ${filtradas.length}, con su dispositivo, severidad, detección y valor.`
            }
          />
          {resueltas && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {datos.posiblementeIncompleta
                ? `Se recibieron ${recibidas.length} alertas resueltas (el máximo pedido); puede haber otras más antiguas que no se muestran.`
                : recibidas.length === 1
                  ? "Se recibió la única alerta resuelta que informa la API."
                  : `Se recibieron las ${recibidas.length} alertas resueltas que informa la API.`}
            </p>
          )}
        </>
      )}
    </section>
  );
}

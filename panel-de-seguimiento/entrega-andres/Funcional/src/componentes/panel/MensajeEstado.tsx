import type { ReactNode } from "react";

type TipoMensaje = "cargando" | "vacio" | "error";

const ESTILOS: Record<TipoMensaje, { contenedor: string; icono: string }> = {
  cargando: {
    contenedor: "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
    icono: "border-2 border-slate-300 border-t-sky-600 animate-spin dark:border-slate-700 dark:border-t-sky-400",
  },
  vacio: {
    contenedor: "border-dashed border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900",
    icono: "border-2 border-dashed border-slate-300 dark:border-slate-600",
  },
  error: {
    contenedor: "border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10",
    icono: "bg-rose-500",
  },
};

interface PropiedadesMensajeEstado {
  tipo: TipoMensaje;
  titulo: string;
  children: ReactNode;
  /** Menos alto, para secciones secundarias (alertas). */
  compacto?: boolean;
}

/** Bloque informativo para los estados sin tabla: cargando, sin datos y error. */
export function MensajeEstado({ tipo, titulo, children, compacto = false }: PropiedadesMensajeEstado) {
  const estilo = ESTILOS[tipo];
  return (
    <div
      role={tipo === "error" ? "alert" : "status"}
      className={`flex flex-col items-center rounded-xl border px-6 text-center ${compacto ? "py-6" : "py-12"} ${estilo.contenedor}`}
    >
      <span aria-hidden="true" className={`size-8 rounded-full ${estilo.icono}`} />
      <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">{titulo}</h3>
      <div className="mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">{children}</div>
    </div>
  );
}

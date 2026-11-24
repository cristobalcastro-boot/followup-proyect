import {
  clasificarDispositivo,
  DESCRIPCION_TIPO_DISPOSITIVO,
  NOMBRE_TIPO_DISPOSITIVO,
  type TipoDispositivo,
} from "@/utilidades/tipoDispositivo";

const CLASES: Record<TipoDispositivo, string> = {
  computador:
    "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/30",
  camara:
    "bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-600/20 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-400/30",
  // Borde punteado: se distingue sin depender del color.
  "sin-clasificar":
    "border border-dashed border-slate-400 bg-transparent text-slate-600 dark:border-slate-500 dark:text-slate-300",
};

/** Icono decorativo; el tipo siempre se lee en el texto. */
function IconoTipo({ tipo }: { tipo: TipoDispositivo }) {
  const comunes = {
    "aria-hidden": true,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "size-3 shrink-0",
  };
  if (tipo === "computador") {
    return (
      <svg {...comunes}>
        <rect x="2" y="3" width="12" height="8" rx="1" />
        <path d="M6 14h4M8 11v3" />
      </svg>
    );
  }
  if (tipo === "camara") {
    return (
      <svg {...comunes}>
        <rect x="1.5" y="4.5" width="9" height="7" rx="1" />
        <path d="M10.5 7l4-2v6l-4-2" />
      </svg>
    );
  }
  return (
    <svg {...comunes}>
      <circle cx="8" cy="8" r="6" />
      <path d="M6.5 6.5a1.5 1.5 0 1 1 2 1.4c-.4.2-.5.5-.5.9M8 11h.01" />
    </svg>
  );
}

/** Tipo de dispositivo deducido del daemonId: Computador, Cámara IP o Sin clasificar. */
export function EtiquetaTipoDispositivo({ daemonId }: { daemonId: string }) {
  const tipo = clasificarDispositivo(daemonId);
  return (
    <span
      title={DESCRIPCION_TIPO_DISPOSITIVO[tipo]}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[0.6875rem] font-semibold ${CLASES[tipo]}`}
    >
      <IconoTipo tipo={tipo} />
      {NOMBRE_TIPO_DISPOSITIVO[tipo]}
    </span>
  );
}

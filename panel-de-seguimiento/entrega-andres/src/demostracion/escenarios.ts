/**
 * DATOS DEMOSTRATIVOS. No provienen de la API ni de PostgreSQL.
 *
 * Se usan solo en la ruta /demostracion, para revisar el diseño en todos sus estados
 * sin depender de la API. Cada respuesta respeta exactamente los contratos
 * RespuestaServidores y RespuestaAlertas (lo verifica tests/escenarios.test.mjs);
 * los valores de CPU, RAM y disco y las alertas son inventados.
 * Solo hay importaciones de tipos: las pruebas cargan este archivo directamente.
 */
import type { ConsultaAlertas } from "@/servicios/apiAlertas";
import type { Alerta, TipoAnomalia } from "@/tipos/alertas";
import type { EstadoConexionApi, FuenteVista } from "@/tipos/conexion";
import type { RespuestaServidores, Servidor } from "@/tipos/servidores";

/** Instante fijo del "reloj de la API" demostrativo: hace las pantallas reproducibles. */
const GENERADO_EN = "2026-11-03T15:30:05.000Z";
const INTERVALOS_TOLERADOS = 3;

interface DatosEquipoDemostrativo {
  readonly daemonId: string;
  /** Segundos entre la última comunicación y GENERADO_EN. */
  readonly segundosDesdeUltimoContacto: number;
  readonly horasDesdePrimerRegistro: number;
  readonly intervalMs: number;
  readonly cpu: number;
  readonly ram: number;
  readonly disco: number;
  /** clockSkewMs del último reporte (receivedAt − sentAt). Por defecto 40 ms (solo latencia). */
  readonly desfaseRelojMs?: number;
}

function restarMilisegundos(fechaIso: string, milisegundos: number): string {
  return new Date(Date.parse(fechaIso) - milisegundos).toISOString();
}

/**
 * Construye un equipo coherente con las reglas de la API: offlineAt y status se
 * derivan igual que en followup-api/src/servers/server-status.ts. Solo se usa para
 * fabricar datos demostrativos; con datos reales el estado siempre lo decide la API.
 */
function crearEquipoDemostrativo(datos: DatosEquipoDemostrativo): Servidor {
  const lastContactAt = restarMilisegundos(GENERADO_EN, datos.segundosDesdeUltimoContacto * 1000);
  const offlineAtMs = Date.parse(lastContactAt) + datos.intervalMs * INTERVALOS_TOLERADOS;
  const desfaseRelojMs = datos.desfaseRelojMs ?? 40;
  const sentAt = restarMilisegundos(lastContactAt, desfaseRelojMs);

  return {
    daemonId: datos.daemonId,
    status: Date.parse(GENERADO_EN) <= offlineAtMs ? "online" : "offline",
    firstSeenAt: restarMilisegundos(GENERADO_EN, datos.horasDesdePrimerRegistro * 3_600_000),
    lastContactAt,
    intervalMs: datos.intervalMs,
    offlineAt: new Date(offlineAtMs).toISOString(),
    latestReport: {
      sentAt,
      receivedAt: lastContactAt,
      clockSkewMs: desfaseRelojMs,
      resources: {
        cpuUsagePercent: datos.cpu,
        memoryUsagePercent: datos.ram,
        diskUsagePercent: datos.disco,
        timestamp: restarMilisegundos(sentAt, 250),
      },
    },
  };
}

function crearRespuesta(servidores: Servidor[]): RespuestaServidores {
  return {
    generatedAt: GENERADO_EN,
    offlineAfterMissedIntervals: INTERVALOS_TOLERADOS,
    // El contrato entrega los equipos ordenados por daemonId.
    servers: [...servidores].sort((a, b) => (a.daemonId < b.daemonId ? -1 : 1)),
  };
}

const equipoOnline = crearEquipoDemostrativo({
  daemonId: "followup-local-01",
  segundosDesdeUltimoContacto: 12,
  horasDesdePrimerRegistro: 26,
  intervalMs: 30_000,
  cpu: 25.4,
  ram: 61.8,
  disco: 9.5,
});

const equipoOfflineReciente = crearEquipoDemostrativo({
  daemonId: "followup-local-01",
  segundosDesdeUltimoContacto: 7 * 60,
  horasDesdePrimerRegistro: 26,
  intervalMs: 30_000,
  cpu: 18.2,
  ram: 57.1,
  disco: 9.5,
});

const variosEquipos = [
  equipoOnline,
  crearEquipoDemostrativo({
    daemonId: "followup-local-02",
    segundosDesdeUltimoContacto: 4,
    horasDesdePrimerRegistro: 3,
    intervalMs: 30_000,
    cpu: 91.2,
    ram: 88.7,
    disco: 47.3,
  }),
  crearEquipoDemostrativo({
    daemonId: "followup-tienda-03",
    segundosDesdeUltimoContacto: 4 * 60,
    horasDesdePrimerRegistro: 72,
    intervalMs: 30_000,
    cpu: 33.0,
    ram: 45.6,
    disco: 71.9,
    // Reloj del Daemon atrasado 7 min: muestra el aviso informativo de desfase.
    desfaseRelojMs: 7 * 60_000,
  }),
  crearEquipoDemostrativo({
    daemonId: "followup-tienda-04",
    segundosDesdeUltimoContacto: 2 * 24 * 3600,
    horasDesdePrimerRegistro: 240,
    intervalMs: 60_000,
    // Valores extremos (0 % y 100 %) para revisar barras y formato en ambos límites.
    cpu: 0,
    ram: 22.4,
    disco: 100,
  }),
];

/**
 * Los 10 dispositivos simulados (2 computadores y 8 cámaras IP) con el prefijo por defecto
 * del Daemon y, opcionalmente, el registro histórico sin clasificar (offline desde hace días),
 * como en la base real tras B5.
 */
const PREFIJO_DISPOSITIVOS = "followup-local-01";

interface OpcionesInventario {
  /** Agrega el registro histórico "followup-local-01" (11 registros). */
  readonly conHistorico: boolean;
  /** cam-07 sin reportar desde hace 4 min (offline). */
  readonly camara07Offline: boolean;
  /** Valores altos en cam-03 (CPU), pc-02 (RAM) y cam-04 (disco), como en sus alertas. */
  readonly valoresAltos: boolean;
}

function crearInventario({ conHistorico, camara07Offline, valoresAltos }: OpcionesInventario): Servidor[] {
  const historico = crearEquipoDemostrativo({
    daemonId: PREFIJO_DISPOSITIVOS,
    segundosDesdeUltimoContacto: 3 * 24 * 3600,
    horasDesdePrimerRegistro: 21 * 24,
    intervalMs: 30_000,
    cpu: 18.2,
    ram: 57.1,
    disco: 9.5,
  });
  const dispositivos = [
    { sufijo: "pc-01", cpu: 34.7, ram: 62.3, disco: 48.1 },
    { sufijo: "pc-02", cpu: 41.0, ram: valoresAltos ? 90.4 : 58.4, disco: 51.6 },
    { sufijo: "cam-01", cpu: 12.5, ram: 38.9, disco: 22.0 },
    { sufijo: "cam-02", cpu: 15.8, ram: 41.2, disco: 23.4 },
    { sufijo: "cam-03", cpu: valoresAltos ? 89.6 : 16.3, ram: 44.0, disco: 21.7 },
    // Valores extremos (0 % y 100 %) para revisar barras y formato en ambos límites.
    { sufijo: "cam-04", cpu: 9.1, ram: 36.5, disco: valoresAltos ? 100 : 24.6 },
    { sufijo: "cam-05", cpu: 0, ram: 40.3, disco: 25.9 },
    { sufijo: "cam-06", cpu: 17.4, ram: 39.8, disco: 24.1 },
    { sufijo: "cam-07", cpu: 14.2, ram: 37.6, disco: 23.0, segundos: camara07Offline ? 4 * 60 : undefined },
    { sufijo: "cam-08", cpu: 11.9, ram: 42.7, disco: 26.8 },
  ].map(({ sufijo, cpu, ram, disco, segundos }, posicion) =>
    crearEquipoDemostrativo({
      daemonId: `${PREFIJO_DISPOSITIVOS}-${sufijo}`,
      segundosDesdeUltimoContacto: segundos ?? 3 + (posicion % 5) * 4,
      horasDesdePrimerRegistro: 2,
      intervalMs: 30_000,
      cpu,
      ram,
      disco,
    }),
  );
  return conHistorico ? [historico, ...dispositivos] : dispositivos;
}

/** 11 registros: el histórico y cam-07 offline, y tres métricas altas. */
const inventarioCompleto = crearInventario({ conHistorico: true, camara07Offline: true, valoresAltos: true });
/** Los 10 dispositivos online, sin valores altos. */
const diezEnLinea = crearInventario({ conHistorico: false, camara07Offline: false, valoresAltos: false });
/** Los 10 dispositivos online, con las tres métricas altas. */
const diezConValoresAltos = crearInventario({ conHistorico: false, camara07Offline: false, valoresAltos: true });

// ---------------------------------------------------------------------------------------------
// Alertas demostrativas: respetan el contrato de GET /api/v1/alerts (severidad fija por tipo,
// valor y umbral null en offline, resolvedAt null solo en activas, como máximo una activa por
// dispositivo y tipo). Los umbrales son los predeterminados de la API (85, 85 y 90).

let contadorAlertas = 0;
/** UUID determinista: las pantallas son reproducibles. */
function nuevoIdAlerta(): string {
  contadorAlertas += 1;
  return `6f1c2d3e-4a5b-4c6d-8e7f-${String(contadorAlertas).padStart(12, "0")}`;
}

function haceMinutos(minutos: number): string {
  return restarMilisegundos(GENERADO_EN, minutos * 60_000);
}

interface DatosAlertaRendimiento {
  readonly sufijo: string;
  readonly kind: TipoAnomalia;
  readonly valor: number;
  readonly umbral: number;
  readonly detectadaHaceMin: number;
  /** Ausente: alerta activa. */
  readonly resueltaHaceMin?: number;
}

function alertaRendimiento(datos: DatosAlertaRendimiento): Alerta {
  const base = {
    id: nuevoIdAlerta(),
    daemonId: `${PREFIJO_DISPOSITIVOS}-${datos.sufijo}`,
    kind: datos.kind,
    severity: "warning" as const,
    detectedAt: haceMinutos(datos.detectadaHaceMin),
    observedValue: datos.valor,
    threshold: datos.umbral,
  };
  return datos.resueltaHaceMin === undefined
    ? { ...base, status: "active", resolvedAt: null }
    : { ...base, status: "resolved", resolvedAt: haceMinutos(datos.resueltaHaceMin) };
}

/** Offline detectada en offlineAt (lastContactAt + intervalMs × 3), como hace la API. */
function alertaConectividad(daemonId: string, detectedAt: string, resolvedAt: string | null = null): Alerta {
  const base = {
    id: nuevoIdAlerta(),
    daemonId,
    kind: "offline" as const,
    severity: "critical" as const,
    detectedAt,
    observedValue: null,
    threshold: null,
  };
  return resolvedAt === null
    ? { ...base, status: "active", resolvedAt: null }
    : { ...base, status: "resolved", resolvedAt };
}

function offlineAtDe(inventario: readonly Servidor[], daemonId: string): string {
  const servidor = inventario.find((equipo) => equipo.daemonId === daemonId);
  if (servidor === undefined) {
    throw new Error(`Equipo demostrativo inexistente: ${daemonId}`);
  }
  return servidor.offlineAt;
}

/**
 * Respuesta de alertas como la entrega la API: de la detección más reciente a la más antigua
 * (id descendente ante empates) y recortada al límite pedido.
 */
function crearConsultaAlertas(alertas: readonly Alerta[], limite: number, generadoEn = GENERADO_EN): ConsultaAlertas {
  const ordenadas = [...alertas].sort((a, b) =>
    a.detectedAt !== b.detectedAt ? (a.detectedAt < b.detectedAt ? 1 : -1) : a.id < b.id ? 1 : -1,
  );
  const recortadas = ordenadas.slice(0, limite);
  return {
    respuesta: { generatedAt: generadoEn, alerts: recortadas },
    limite,
    posiblementeIncompleta: recortadas.length >= limite,
  };
}

/** Mismos límites que la consulta real: activas con 500 y resueltas con las últimas 20. */
const LIMITE_ACTIVAS = 500;
const LIMITE_RESUELTAS = 20;

const activasRendimiento = [
  alertaRendimiento({ sufijo: "cam-03", kind: "cpu_high", valor: 89.6, umbral: 85, detectadaHaceMin: 3 }),
  alertaRendimiento({ sufijo: "pc-02", kind: "memory_high", valor: 90.4, umbral: 85, detectadaHaceMin: 6 }),
  alertaRendimiento({ sufijo: "cam-04", kind: "disk_high", valor: 100, umbral: 90, detectadaHaceMin: 12 }),
];
const activasConectividad = [
  alertaConectividad(PREFIJO_DISPOSITIVOS, offlineAtDe(inventarioCompleto, PREFIJO_DISPOSITIVOS)),
  alertaConectividad(
    `${PREFIJO_DISPOSITIVOS}-cam-07`,
    offlineAtDe(inventarioCompleto, `${PREFIJO_DISPOSITIVOS}-cam-07`),
  ),
];

/** 24 resueltas en las últimas horas: la consulta de las últimas 20 deja fuera las 4 más antiguas. */
const historialResueltas: Alerta[] = Array.from({ length: 24 }, (_, posicion) => {
  const detectadaHaceMin = 20 + posicion * 17;
  const duracionMin = 2 + (posicion % 4) * 3;
  const resueltaHaceMin = detectadaHaceMin - duracionMin;
  const sufijos = ["cam-03", "pc-02", "cam-07", "cam-04", "pc-01", "cam-05"];
  const sufijo = sufijos[posicion % sufijos.length];
  if (posicion % 3 === 2) {
    return alertaConectividad(
      `${PREFIJO_DISPOSITIVOS}-${sufijo}`,
      haceMinutos(detectadaHaceMin),
      haceMinutos(resueltaHaceMin),
    );
  }
  // Cada 3 posiciones una es offline; el tipo de rendimiento rota por separado para incluir los tres.
  const tipos: readonly TipoAnomalia[] = ["cpu_high", "memory_high", "disk_high"];
  const kind = tipos[(posicion - Math.floor(posicion / 3)) % 3];
  return alertaRendimiento({
    sufijo,
    kind,
    valor: kind === "disk_high" ? 93.5 : 86 + (posicion % 10),
    umbral: kind === "disk_high" ? 90 : 85,
    detectadaHaceMin,
    resueltaHaceMin,
  });
});
const pocasResueltas = historialResueltas.slice(0, 3);

const conexionCorrecta: EstadoConexionApi = {
  tipo: "conectada",
  ultimaConsultaExitosa: GENERADO_EN,
};

/** Fuente de alertas que respondió correctamente. */
function alertasCorrectas(alertas: readonly Alerta[], limite: number): FuenteVista<ConsultaAlertas> {
  return { datos: crearConsultaAlertas(alertas, limite), conexion: conexionCorrecta };
}

const SIN_ALERTAS = {
  activas: alertasCorrectas([], LIMITE_ACTIVAS),
  resueltas: alertasCorrectas([], LIMITE_RESUELTAS),
};

const MENSAJE_503 =
  "La API está en ejecución, pero su almacenamiento (PostgreSQL) no está disponible temporalmente (HTTP 503).";
const MENSAJE_SIN_CONEXION =
  "No se pudo contactar con followup-api en http://127.0.0.1:3001. Verifica que la API esté en ejecución.";

/** La última consulta válida de alertas ocurrió 40 s antes que la de servidores. */
const ALERTAS_ANTERIORES_EN = restarMilisegundos(GENERADO_EN, 40_000);

export interface EscenarioDemostrativo {
  readonly id: string;
  readonly nombre: string;
  readonly respuesta: RespuestaServidores | null;
  readonly conexion: EstadoConexionApi;
  readonly alertasActivas: FuenteVista<ConsultaAlertas>;
  readonly alertasResueltas: FuenteVista<ConsultaAlertas>;
}

export const ESCENARIOS_DEMOSTRATIVOS: readonly EscenarioDemostrativo[] = [
  {
    id: "varios",
    nombre: "Varios equipos",
    respuesta: crearRespuesta(variosEquipos),
    conexion: conexionCorrecta,
    alertasActivas: SIN_ALERTAS.activas,
    alertasResueltas: SIN_ALERTAS.resueltas,
  },
  {
    id: "online",
    nombre: "Un equipo online",
    respuesta: crearRespuesta([equipoOnline]),
    conexion: conexionCorrecta,
    alertasActivas: SIN_ALERTAS.activas,
    alertasResueltas: SIN_ALERTAS.resueltas,
  },
  {
    id: "offline",
    nombre: "Un equipo offline",
    respuesta: crearRespuesta([equipoOfflineReciente]),
    conexion: conexionCorrecta,
    alertasActivas: alertasCorrectas(
      [alertaConectividad(PREFIJO_DISPOSITIVOS, equipoOfflineReciente.offlineAt)],
      LIMITE_ACTIVAS,
    ),
    alertasResueltas: SIN_ALERTAS.resueltas,
  },
  {
    id: "vacio",
    nombre: "Sin equipos",
    respuesta: crearRespuesta([]),
    conexion: conexionCorrecta,
    alertasActivas: SIN_ALERTAS.activas,
    alertasResueltas: SIN_ALERTAS.resueltas,
  },
  {
    id: "cargando",
    nombre: "Cargando",
    respuesta: null,
    conexion: { tipo: "cargando" },
    alertasActivas: { datos: null, conexion: { tipo: "cargando" } },
    alertasResueltas: { datos: null, conexion: { tipo: "cargando" } },
  },
  {
    id: "error",
    nombre: "Error de conexión",
    respuesta: null,
    conexion: { tipo: "sin-conexion", mensaje: MENSAJE_SIN_CONEXION, ultimaConsultaExitosa: null },
    alertasActivas: {
      datos: null,
      conexion: { tipo: "sin-conexion", mensaje: MENSAJE_SIN_CONEXION, ultimaConsultaExitosa: null },
    },
    alertasResueltas: {
      datos: null,
      conexion: { tipo: "sin-conexion", mensaje: MENSAJE_SIN_CONEXION, ultimaConsultaExitosa: null },
    },
  },
  {
    id: "error-api",
    nombre: "Error de la API (503)",
    respuesta: null,
    conexion: { tipo: "error-consulta", mensaje: MENSAJE_503, ultimaConsultaExitosa: null },
    alertasActivas: { datos: null, conexion: { tipo: "error-consulta", mensaje: MENSAJE_503, ultimaConsultaExitosa: null } },
    alertasResueltas: {
      datos: null,
      conexion: { tipo: "error-consulta", mensaje: MENSAJE_503, ultimaConsultaExitosa: null },
    },
  },
  {
    id: "desactualizado",
    nombre: "Datos desactualizados",
    respuesta: crearRespuesta(variosEquipos),
    conexion: {
      tipo: "sin-conexion",
      mensaje: "No se pudo contactar con followup-api en http://127.0.0.1:3001.",
      ultimaConsultaExitosa: GENERADO_EN,
    },
    alertasActivas: {
      datos: crearConsultaAlertas([], LIMITE_ACTIVAS),
      conexion: {
        tipo: "sin-conexion",
        mensaje: "No se pudo contactar con followup-api en http://127.0.0.1:3001.",
        ultimaConsultaExitosa: GENERADO_EN,
      },
    },
    alertasResueltas: {
      datos: crearConsultaAlertas([], LIMITE_RESUELTAS),
      conexion: {
        tipo: "sin-conexion",
        mensaje: "No se pudo contactar con followup-api en http://127.0.0.1:3001.",
        ultimaConsultaExitosa: GENERADO_EN,
      },
    },
  },
  {
    id: "inventario",
    nombre: "Inventario completo (11 registros)",
    respuesta: crearRespuesta(inventarioCompleto),
    conexion: conexionCorrecta,
    alertasActivas: alertasCorrectas([...activasConectividad, ...activasRendimiento], LIMITE_ACTIVAS),
    alertasResueltas: alertasCorrectas(historialResueltas, LIMITE_RESUELTAS),
  },
  {
    id: "sin-alertas",
    nombre: "Sin alertas",
    respuesta: crearRespuesta(diezEnLinea),
    conexion: conexionCorrecta,
    alertasActivas: SIN_ALERTAS.activas,
    alertasResueltas: SIN_ALERTAS.resueltas,
  },
  {
    id: "alertas-conectividad",
    nombre: "Alertas de conectividad",
    respuesta: crearRespuesta(inventarioCompleto),
    conexion: conexionCorrecta,
    alertasActivas: alertasCorrectas(activasConectividad, LIMITE_ACTIVAS),
    alertasResueltas: SIN_ALERTAS.resueltas,
  },
  {
    id: "alertas-rendimiento",
    nombre: "Alertas de CPU, RAM y disco",
    respuesta: crearRespuesta(diezConValoresAltos),
    conexion: conexionCorrecta,
    alertasActivas: alertasCorrectas(activasRendimiento, LIMITE_ACTIVAS),
    alertasResueltas: alertasCorrectas(pocasResueltas, LIMITE_RESUELTAS),
  },
  {
    id: "alertas-resueltas",
    nombre: "Historial de resueltas",
    respuesta: crearRespuesta(diezEnLinea),
    conexion: conexionCorrecta,
    alertasActivas: SIN_ALERTAS.activas,
    alertasResueltas: alertasCorrectas(historialResueltas, LIMITE_RESUELTAS),
  },
  {
    id: "fallo-alertas",
    nombre: "Fallo solo de /alerts",
    respuesta: crearRespuesta(inventarioCompleto),
    conexion: conexionCorrecta,
    // Activas: se conservan los últimos datos válidos, marcados como desactualizados.
    alertasActivas: {
      datos: crearConsultaAlertas([...activasConectividad, ...activasRendimiento], LIMITE_ACTIVAS, ALERTAS_ANTERIORES_EN),
      conexion: { tipo: "error-consulta", mensaje: MENSAJE_503, ultimaConsultaExitosa: ALERTAS_ANTERIORES_EN },
    },
    // Resueltas: nunca respondió correctamente; el historial es desconocido.
    alertasResueltas: {
      datos: null,
      conexion: { tipo: "error-consulta", mensaje: MENSAJE_503, ultimaConsultaExitosa: null },
    },
  },
  {
    id: "alertas-desconocidas",
    nombre: "Alertas desconocidas",
    respuesta: crearRespuesta(inventarioCompleto),
    conexion: conexionCorrecta,
    // /alerts nunca respondió bien: el inventario no muestra indicadores ni puede filtrar por alertas.
    alertasActivas: {
      datos: null,
      conexion: { tipo: "sin-conexion", mensaje: MENSAJE_SIN_CONEXION, ultimaConsultaExitosa: null },
    },
    alertasResueltas: {
      datos: null,
      conexion: { tipo: "sin-conexion", mensaje: MENSAJE_SIN_CONEXION, ultimaConsultaExitosa: null },
    },
  },
  {
    id: "divergencias",
    nombre: "Alerta y estado difieren",
    respuesta: crearRespuesta(diezEnLinea),
    conexion: conexionCorrecta,
    alertasActivas: alertasCorrectas(
      [
        // cam-07 ya volvió a reportar (online), pero la API aún no resolvió su alerta offline.
        alertaConectividad(`${PREFIJO_DISPOSITIVOS}-cam-07`, haceMinutos(2)),
        // Alerta de un daemonId que no está en el inventario recibido: se muestra sin inventar un equipo.
        alertaConectividad("followup-sede-02-cam-01", haceMinutos(9)),
      ],
      LIMITE_ACTIVAS,
    ),
    alertasResueltas: SIN_ALERTAS.resueltas,
  },
  {
    id: "fallo-servidores",
    nombre: "Fallo solo de /servers",
    respuesta: null,
    conexion: {
      tipo: "error-consulta",
      mensaje: "La respuesta de la API no tiene la estructura esperada (servers[3]: status distinto de online/offline).",
      ultimaConsultaExitosa: null,
    },
    alertasActivas: alertasCorrectas([...activasConectividad, ...activasRendimiento], LIMITE_ACTIVAS),
    alertasResueltas: alertasCorrectas(pocasResueltas, LIMITE_RESUELTAS),
  },
];

/** Devuelve el escenario pedido o, si no existe, el primero ("Varios equipos"). */
export function obtenerEscenario(id: string | undefined): EscenarioDemostrativo {
  return ESCENARIOS_DEMOSTRATIVOS.find((escenario) => escenario.id === id) ?? ESCENARIOS_DEMOSTRATIVOS[0];
}

// Validación en tiempo de ejecución de la respuesta de GET /api/v1/alerts y de sus filtros.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  construirRutaAlertas,
  FILTROS_ALERTAS_ACTIVAS,
  LIMITE_MAXIMO_ALERTAS,
  puedeHaberMasAlertas,
  validarRespuestaAlertas,
} from "../src/servicios/validarRespuestaAlertas.ts";

const GENERADA = "2026-11-20T20:00:00.000Z";
let secuencia = 0;

/** UUID distinto en cada llamada (formato 8-4-4-4-12). */
function nuevoId() {
  secuencia += 1;
  return `550e8400-e29b-41d4-a716-${String(secuencia).padStart(12, "0")}`;
}

function anomalia(cambios = {}) {
  return {
    id: nuevoId(),
    daemonId: "followup-local-01-cam-03",
    kind: "cpu_high",
    severity: "warning",
    status: "active",
    detectedAt: "2026-11-20T19:55:00.000Z",
    resolvedAt: null,
    observedValue: 89.6,
    threshold: 85,
    ...cambios,
  };
}

function conectividad(cambios = {}) {
  return {
    id: nuevoId(),
    daemonId: "followup-local-01-cam-07",
    kind: "offline",
    severity: "critical",
    status: "active",
    detectedAt: "2026-11-20T19:50:00.000Z",
    resolvedAt: null,
    observedValue: null,
    threshold: null,
    ...cambios,
  };
}

function respuesta(alerts) {
  return { generatedAt: GENERADA, alerts };
}

function sinCampo(objeto, campo) {
  const copia = { ...objeto };
  delete copia[campo];
  return copia;
}

function rechaza(cuerpo, patron, nombre) {
  const resultado = validarRespuestaAlertas(cuerpo);
  assert.equal(resultado.valida, false, nombre);
  if (patron !== undefined) assert.match(resultado.problema, patron, nombre);
}

test("acepta anomalías y conectividad, activas y resueltas, y devuelve el mismo contenido", () => {
  const cuerpo = respuesta([
    anomalia(),
    anomalia({ kind: "memory_high", daemonId: "followup-local-01-pc-02", observedValue: 90.4 }),
    anomalia({ kind: "disk_high", threshold: 90, observedValue: 100 }),
    conectividad(),
    anomalia({ status: "resolved", resolvedAt: "2026-11-20T19:56:00.000Z" }),
    conectividad({ status: "resolved", resolvedAt: "2026-11-20T19:51:00.000Z" }),
  ]);
  const resultado = validarRespuestaAlertas(cuerpo);
  assert.equal(resultado.valida, true, resultado.problema);
  assert.deepEqual(resultado.respuesta, cuerpo);
});

test("acepta una lista vacía de alertas", () => {
  assert.equal(validarRespuestaAlertas(respuesta([])).valida, true);
});

test("acepta resolvedAt igual a detectedAt, porcentajes extremos y campos adicionales", () => {
  const cuerpo = respuesta([
    anomalia({ status: "resolved", resolvedAt: "2026-11-20T19:55:00.000Z", observedValue: 0, threshold: 100 }),
    conectividad({ campoNuevo: true }),
  ]);
  assert.equal(validarRespuestaAlertas(cuerpo).valida, true);
});

test("rechaza cuerpos que no tienen la forma del contrato", () => {
  const cuerpos = [
    null,
    "texto",
    [],
    { alerts: [] },
    { generatedAt: "no es fecha", alerts: [] },
    { generatedAt: "2026-11-20T20:00:00+00:00", alerts: [] },
    { generatedAt: GENERADA },
    { generatedAt: GENERADA, alerts: {} },
    { generatedAt: GENERADA, alerts: [null] },
  ];
  for (const cuerpo of cuerpos) {
    rechaza(cuerpo, undefined, JSON.stringify(cuerpo));
  }
});

test("rechaza enumeraciones desconocidas", () => {
  rechaza(respuesta([anomalia({ kind: "gpu_high" })]), /kind/);
  rechaza(respuesta([anomalia({ status: "open" })]), /status/);
  rechaza(respuesta([anomalia({ severity: "info" })]), /severity/);
});

test("rechaza la severidad que no corresponde al tipo", () => {
  rechaza(respuesta([anomalia({ severity: "critical" })]), /severity debe ser warning/);
  rechaza(respuesta([conectividad({ severity: "warning" })]), /severity debe ser critical/);
});

test("rechaza campos obligatorios ausentes", () => {
  for (const campo of ["id", "daemonId", "kind", "severity", "status", "detectedAt", "resolvedAt", "observedValue", "threshold"]) {
    rechaza(respuesta([sinCampo(anomalia(), campo)]), undefined, `sin ${campo}`);
  }
  rechaza(respuesta([sinCampo(conectividad(), "observedValue")]), /null/);
});

test("rechaza identificadores inválidos o repetidos", () => {
  rechaza(respuesta([anomalia({ id: "123" })]), /UUID/);
  rechaza(respuesta([anomalia({ daemonId: "" })]), /daemonId/);
  rechaza(respuesta([anomalia({ daemonId: "cámara 1" })]), /daemonId/);
  const repetida = anomalia();
  rechaza(respuesta([repetida, conectividad(), { ...repetida, status: "resolved", resolvedAt: GENERADA }]), /alerts\[2\].*repetido/);
});

test("rechaza dos alertas activas del mismo tipo para un equipo, pero no resueltas", () => {
  rechaza(respuesta([anomalia(), anomalia()]), /más de una alerta activa cpu_high/);
  const resuelta = { status: "resolved", resolvedAt: "2026-11-20T19:56:00.000Z" };
  assert.equal(validarRespuestaAlertas(respuesta([anomalia(), anomalia(resuelta), anomalia(resuelta)])).valida, true);
});

test("rechaza porcentajes inválidos en anomalías, sin convertirlos en 0", () => {
  const invalidos = [
    ["nulo", null],
    ["texto", "90"],
    ["sobre el máximo", 100.1],
    ["bajo el mínimo", -1],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
  ];
  for (const [nombre, valor] of invalidos) {
    rechaza(respuesta([anomalia({ observedValue: valor })]), /observedValue/, nombre);
    rechaza(respuesta([anomalia({ threshold: valor })]), /threshold/, nombre);
  }
});

test("rechaza valor o umbral en una alerta offline", () => {
  rechaza(respuesta([conectividad({ observedValue: 0 })]), /offline/);
  rechaza(respuesta([conectividad({ threshold: 85 })]), /offline/);
});

test("exige coherencia entre status y resolvedAt", () => {
  rechaza(respuesta([anomalia({ resolvedAt: GENERADA })]), /null en una alerta activa/);
  rechaza(respuesta([anomalia({ status: "resolved" })]), /resolvedAt/);
  rechaza(respuesta([anomalia({ status: "resolved", resolvedAt: "2026-11-20T19:54:59.999Z" })]), /anterior a detectedAt/);
});

test("rechaza fechas que no son ISO UTC estrictas o no existen", () => {
  for (const fecha of ["2026-11-20", "2026-11-20T19:55:00", "2026-11-20T19:55:00.0000Z", "2026-13-20T19:55:00.000Z", 1763668500000]) {
    rechaza(respuesta([anomalia({ detectedAt: fecha })]), /detectedAt/, String(fecha));
  }
});

test("la consulta inicial pide todas las alertas activas con el límite máximo", () => {
  assert.deepEqual(construirRutaAlertas(FILTROS_ALERTAS_ACTIVAS), {
    valida: true,
    ruta: "/api/v1/alerts?status=active&limit=500",
    limite: 500,
  });
});

test("construye filtros combinados en orden fijo y envía siempre limit", () => {
  assert.deepEqual(construirRutaAlertas(), { valida: true, ruta: "/api/v1/alerts?limit=100", limite: 100 });
  const resultado = construirRutaAlertas({
    status: "resolved",
    daemonId: "followup-local-01-cam-07",
    kind: "offline",
    severity: "critical",
    from: "2026-11-20T00:00:00.000Z",
    to: "2026-11-20T23:59:59.999Z",
    limit: 20,
  });
  assert.equal(
    resultado.ruta,
    "/api/v1/alerts?status=resolved&daemonId=followup-local-01-cam-07&kind=offline&severity=critical&from=2026-11-20T00%3A00%3A00.000Z&to=2026-11-20T23%3A59%3A59.999Z&limit=20",
  );
});

test("rechaza filtros que la API respondería con 400", () => {
  const invalidos = [
    { limit: 0 },
    { limit: LIMITE_MAXIMO_ALERTAS + 1 },
    { limit: 1.5 },
    { status: "open" },
    { kind: "gpu_high" },
    { severity: "info" },
    { daemonId: "con espacio" },
    { from: "2026-11-20" },
    { from: "2026-11-21T00:00:00.000Z", to: "2026-11-20T00:00:00.000Z" },
  ];
  for (const filtros of invalidos) {
    assert.equal(construirRutaAlertas(filtros).valida, false, JSON.stringify(filtros));
  }
  assert.equal(construirRutaAlertas({ from: "2026-11-20T00:00:00.000Z", to: "2026-11-20T00:00:00.000Z" }).valida, true);
});

test("advierte que la lista puede estar incompleta solo si alcanza el límite", () => {
  const dos = { generatedAt: GENERADA, alerts: [anomalia(), conectividad()] };
  assert.equal(puedeHaberMasAlertas(dos, 2), true);
  assert.equal(puedeHaberMasAlertas(dos, 3), false);
});

// Estado independiente de cada fuente: conservación de datos válidos, desactualización,
// cancelación, reconexión y traducción al estado de conexión que muestra la interfaz.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aplicarResultadoFuente,
  calcularConexionFuente,
  DURACION_AVISO_RECONEXION_MS,
  ESTADO_FUENTE_INICIAL,
} from "../src/hooks/estadoFuente.ts";

const T0 = "2026-11-23T12:00:00.000Z";
const T1 = "2026-11-23T12:00:05.000Z";
const T2 = "2026-11-23T12:00:10.000Z";
const exito = (respuesta) => ({ exito: true, respuesta });
const fallo = (tipo, mensaje = `fallo ${tipo}`) => ({ exito: false, fallo: { tipo, mensaje } });

test("estado inicial: cargando y sin datos", () => {
  assert.deepEqual(calcularConexionFuente(ESTADO_FUENTE_INICIAL), { tipo: "cargando" });
  assert.equal(ESTADO_FUENTE_INICIAL.datos, null);
});

test("una respuesta válida guarda los datos y la hora de la última actualización", () => {
  const estado = aplicarResultadoFuente(ESTADO_FUENTE_INICIAL, exito({ alerts: [] }), T0);
  assert.deepEqual(estado.datos, { alerts: [] });
  assert.deepEqual(calcularConexionFuente(estado), { tipo: "conectada", ultimaConsultaExitosa: T0 });
});

test("un fallo conserva los últimos datos válidos y su hora, y los marca como desactualizados", () => {
  const conDatos = aplicarResultadoFuente(ESTADO_FUENTE_INICIAL, exito("v1"), T0);
  const fallido = aplicarResultadoFuente(conDatos, fallo("almacenamiento-no-disponible", "HTTP 503"), T1);
  assert.equal(fallido.datos, "v1", "los datos no se borran ni se reemplazan por vacío");
  assert.deepEqual(calcularConexionFuente(fallido), {
    tipo: "error-consulta",
    mensaje: "HTTP 503",
    ultimaConsultaExitosa: T0,
  });
});

test("un fallo sin datos previos no inventa datos", () => {
  const fallido = aplicarResultadoFuente(ESTADO_FUENTE_INICIAL, fallo("red"), T0);
  assert.equal(fallido.datos, null);
  assert.equal(calcularConexionFuente(fallido).ultimaConsultaExitosa, null);
});

test("conserva la clasificación de fallos: red y tiempo agotado son sin conexión; el resto, error de consulta", () => {
  const casos = [
    ["red", "sin-conexion"],
    ["tiempo-agotado", "sin-conexion"],
    ["almacenamiento-no-disponible", "error-consulta"],
    ["http", "error-consulta"],
    ["respuesta-invalida", "error-consulta"],
    ["configuracion", "error-consulta"],
    ["consulta-invalida", "error-consulta"],
  ];
  for (const [tipoFallo, tipoConexion] of casos) {
    const estado = aplicarResultadoFuente(ESTADO_FUENTE_INICIAL, fallo(tipoFallo), T0);
    assert.equal(calcularConexionFuente(estado).tipo, tipoConexion, tipoFallo);
  }
});

test("una consulta cancelada no cambia el estado", () => {
  const conDatos = aplicarResultadoFuente(ESTADO_FUENTE_INICIAL, exito("v1"), T0);
  assert.equal(aplicarResultadoFuente(conDatos, { exito: false, fallo: { tipo: "cancelada" } }, T1), conDatos);
});

test("recuperación: reemplaza los datos e indica la reconexión durante 30 s", () => {
  let estado = aplicarResultadoFuente(ESTADO_FUENTE_INICIAL, exito("v1"), T0);
  estado = aplicarResultadoFuente(estado, fallo("red"), T1);
  estado = aplicarResultadoFuente(estado, exito("v2"), T2);
  assert.equal(estado.datos, "v2");
  assert.deepEqual(calcularConexionFuente(estado), { tipo: "conectada", ultimaConsultaExitosa: T2, reconectadaEn: T2 });

  const despues = new Date(Date.parse(T2) + DURACION_AVISO_RECONEXION_MS).toISOString();
  estado = aplicarResultadoFuente(estado, exito("v3"), despues);
  assert.deepEqual(calcularConexionFuente(estado), { tipo: "conectada", ultimaConsultaExitosa: despues });
});

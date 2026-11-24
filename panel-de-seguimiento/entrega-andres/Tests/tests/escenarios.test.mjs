// Los escenarios de /demostracion respetan los contratos reales y cubren los casos de D3.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ESCENARIOS_DEMOSTRATIVOS, obtenerEscenario } from "../src/demostracion/escenarios.ts";
import { validarRespuestaAlertas } from "../src/servicios/validarRespuestaAlertas.ts";
import { validarRespuestaServidores } from "../src/servicios/validarRespuestaServidores.ts";
import { resumirAlertas } from "../src/utilidades/alertas.ts";
import { contarPorTipo } from "../src/utilidades/tipoDispositivo.ts";

const LIMITE_RESUELTAS = 20;

test("los identificadores de escenario son únicos", () => {
  const ids = ESCENARIOS_DEMOSTRATIVOS.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("todas las respuestas demostrativas cumplen los contratos de /servers y /alerts", () => {
  for (const escenario of ESCENARIOS_DEMOSTRATIVOS) {
    if (escenario.respuesta !== null) {
      const servidores = validarRespuestaServidores(escenario.respuesta);
      assert.equal(servidores.valida, true, `${escenario.id}: ${servidores.problema}`);
    }
    for (const [nombre, fuente, estado] of [
      ["activas", escenario.alertasActivas, "active"],
      ["resueltas", escenario.alertasResueltas, "resolved"],
    ]) {
      if (fuente.datos === null) continue;
      const alertas = validarRespuestaAlertas(fuente.datos.respuesta);
      assert.equal(alertas.valida, true, `${escenario.id} ${nombre}: ${alertas.problema}`);
      for (const alerta of fuente.datos.respuesta.alerts) {
        assert.equal(alerta.status, estado, `${escenario.id} ${nombre}: solo alertas ${estado}`);
      }
    }
  }
});

test("el historial de resueltas nunca supera las últimas 20 y se identifica como limitado", () => {
  for (const escenario of ESCENARIOS_DEMOSTRATIVOS) {
    const datos = escenario.alertasResueltas.datos;
    if (datos === null) continue;
    assert.ok(datos.respuesta.alerts.length <= LIMITE_RESUELTAS, escenario.id);
    assert.equal(datos.limite, LIMITE_RESUELTAS, escenario.id);
  }
  const historial = obtenerEscenario("alertas-resueltas").alertasResueltas.datos;
  assert.equal(historial.respuesta.alerts.length, 20);
  assert.equal(historial.posiblementeIncompleta, true, "con 20 de 20 puede haber más antiguas");
  const tipos = new Set(historial.respuesta.alerts.map((a) => a.kind));
  assert.deepEqual([...tipos].sort(), ["cpu_high", "disk_high", "memory_high", "offline"], "el historial incluye los cuatro tipos");
});

test("inventario completo: 11 registros (2 computadores, 8 cámaras y el histórico) con alertas de ambos tipos", () => {
  const escenario = obtenerEscenario("inventario");
  assert.deepEqual(contarPorTipo(escenario.respuesta.servers), { computadores: 2, camaras: 8, sinClasificar: 1 });
  assert.deepEqual(resumirAlertas(escenario.alertasActivas.datos.respuesta.alerts), {
    total: 5,
    conectividad: 2,
    rendimiento: 3,
  });
});

test("las alertas de conectividad corresponden a equipos offline según la API", () => {
  const escenario = obtenerEscenario("alertas-conectividad");
  const offline = new Set(escenario.respuesta.servers.filter((s) => s.status === "offline").map((s) => s.daemonId));
  const alertas = escenario.alertasActivas.datos.respuesta.alerts;
  assert.ok(alertas.length > 0);
  for (const alerta of alertas) {
    assert.equal(alerta.kind, "offline");
    assert.ok(offline.has(alerta.daemonId), alerta.daemonId);
  }
});

test("cubre CPU, RAM y disco, y el escenario sin alertas", () => {
  const tipos = new Set(obtenerEscenario("alertas-rendimiento").alertasActivas.datos.respuesta.alerts.map((a) => a.kind));
  assert.deepEqual([...tipos].sort(), ["cpu_high", "disk_high", "memory_high"]);
  const sinAlertas = obtenerEscenario("sin-alertas");
  assert.equal(sinAlertas.alertasActivas.datos.respuesta.alerts.length, 0);
  assert.equal(sinAlertas.alertasActivas.conexion.tipo, "conectada", "cero solo con una respuesta válida");
});

test("fallo exclusivo de /alerts: inventario correcto, activas desactualizadas y resueltas desconocidas", () => {
  const escenario = obtenerEscenario("fallo-alertas");
  assert.equal(escenario.conexion.tipo, "conectada");
  assert.notEqual(escenario.respuesta, null);
  assert.notEqual(escenario.alertasActivas.datos, null, "se conservan los últimos datos válidos");
  assert.equal(escenario.alertasActivas.conexion.tipo, "error-consulta");
  assert.notEqual(
    escenario.alertasActivas.datos.respuesta.generatedAt,
    escenario.respuesta.generatedAt,
    "cada fuente tiene su propio generatedAt",
  );
  assert.equal(escenario.alertasResueltas.datos, null);
});

test("alertas desconocidas: inventario correcto y alertas nunca obtenidas", () => {
  const escenario = obtenerEscenario("alertas-desconocidas");
  assert.notEqual(escenario.respuesta, null);
  assert.equal(escenario.alertasActivas.datos, null);
  assert.equal(escenario.alertasActivas.conexion.tipo, "sin-conexion");
});

test("divergencias: alerta offline en un equipo online y alerta sin dispositivo en el inventario", () => {
  const escenario = obtenerEscenario("divergencias");
  const estados = new Map(escenario.respuesta.servers.map((s) => [s.daemonId, s.status]));
  const alertas = escenario.alertasActivas.datos.respuesta.alerts;
  assert.ok(alertas.some((a) => a.kind === "offline" && estados.get(a.daemonId) === "online"));
  assert.ok(alertas.some((a) => !estados.has(a.daemonId)));
});

test("fallo exclusivo de /servers: alertas correctas sin inventario", () => {
  const escenario = obtenerEscenario("fallo-servidores");
  assert.equal(escenario.respuesta, null);
  assert.equal(escenario.conexion.tipo, "error-consulta");
  assert.equal(escenario.alertasActivas.conexion.tipo, "conectada");
  assert.ok(escenario.alertasActivas.datos.respuesta.alerts.length > 0);
});

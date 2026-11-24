// Consulta HTTP común (servidores y alertas): clasificación de fallos, tiempo máximo y cancelación.
// Usa un cliente HTTP simulado: no abre conexiones de red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { consultarApi } from "../src/servicios/consultaApi.ts";
import { validarRespuestaAlertas } from "../src/servicios/validarRespuestaAlertas.ts";
import { validarRespuestaServidores } from "../src/servicios/validarRespuestaServidores.ts";

const CONFIGURACION = { valida: true, urlApi: "http://127.0.0.1:3001" };
const RUTA_ALERTAS = "/api/v1/alerts?status=active&limit=500";
const ALERTAS = { generatedAt: "2026-11-20T20:00:00.000Z", alerts: [] };

function respuestaHttp(status, cuerpo) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => (typeof cuerpo === "function" ? cuerpo() : cuerpo),
  };
}

/** Cliente que nunca responde: solo termina cuando se aborta su señal, como fetch. */
function clienteSinRespuesta(init) {
  return new Promise((_, rechazar) => {
    init.signal.addEventListener("abort", () => rechazar(init.signal.reason), { once: true });
  });
}

function consultar(opciones = {}) {
  return consultarApi({
    configuracion: CONFIGURACION,
    ruta: RUTA_ALERTAS,
    senal: new AbortController().signal,
    validar: validarRespuestaAlertas,
    ...opciones,
  });
}

test("devuelve la respuesta validada y consulta la URL con GET, sin caché ni Authorization", async () => {
  const llamadas = [];
  const resultado = await consultar({
    clienteHttp: async (url, init) => {
      llamadas.push({ url, init });
      return respuestaHttp(200, ALERTAS);
    },
  });
  assert.deepEqual(resultado, { exito: true, respuesta: ALERTAS });
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].url, `http://127.0.0.1:3001${RUTA_ALERTAS}`);
  assert.equal(llamadas[0].init.method, "GET");
  assert.equal(llamadas[0].init.cache, "no-store");
  assert.deepEqual(llamadas[0].init.headers, { Accept: "application/json" });
});

test("no consulta si la configuración es inválida", async () => {
  let consultas = 0;
  const resultado = await consultar({
    configuracion: { valida: false, mensaje: "Falta la variable NEXT_PUBLIC_URL_API." },
    clienteHttp: async () => {
      consultas += 1;
      return respuestaHttp(200, ALERTAS);
    },
  });
  assert.deepEqual(resultado.fallo, { tipo: "configuracion", mensaje: "Falta la variable NEXT_PUBLIC_URL_API." });
  assert.equal(consultas, 0);
});

test("clasifica los errores HTTP", async () => {
  const casos = [
    [503, "almacenamiento-no-disponible", /PostgreSQL/],
    [500, "http", /error interno \(HTTP 500\)/],
    [400, "http", /parámetros.*\/api\/v1\/alerts \(HTTP 400\)/],
    [401, "http", /clave de lectura.*servidor de Next\.js/],
    [404, "http", /la ruta \/api\/v1\/alerts no existe/],
    [418, "http", /estado inesperado \(HTTP 418\)/],
  ];
  for (const [estado, tipo, mensaje] of casos) {
    const resultado = await consultar({ clienteHttp: async () => respuestaHttp(estado, {}) });
    assert.equal(resultado.exito, false, String(estado));
    assert.equal(resultado.fallo.tipo, tipo, String(estado));
    assert.match(resultado.fallo.mensaje, mensaje, String(estado));
    if (tipo === "http") assert.equal(resultado.fallo.estadoHttp, estado);
    // El mensaje 404 nombra la ruta, no los parámetros de la consulta.
    assert.equal(resultado.fallo.mensaje.includes("status=active"), false);
  }
});

test("conserva el mensaje 404 de /api/v1/servers", async () => {
  const resultado = await consultar({
    ruta: "/api/v1/servers",
    validar: validarRespuestaServidores,
    clienteHttp: async () => respuestaHttp(404, {}),
  });
  assert.equal(
    resultado.fallo.mensaje,
    "La API respondió 404: la ruta /api/v1/servers no existe en esa dirección. Revisa NEXT_PUBLIC_URL_API.",
  );
});

test("clasifica un fallo de red como sin respuesta, sin detalles internos", async () => {
  const resultado = await consultar({
    clienteHttp: async () => {
      throw new TypeError("Failed to fetch: detalle interno");
    },
  });
  assert.equal(resultado.fallo.tipo, "red");
  assert.match(resultado.fallo.mensaje, /No se pudo contactar con followup-api en http:\/\/127\.0\.0\.1:3001/);
  assert.equal(resultado.fallo.mensaje.includes("detalle interno"), false);
});

test("agota el tiempo máximo si la API no responde", async () => {
  const resultado = await consultar({ tiempoMaximoMs: 20, clienteHttp: async (_, init) => clienteSinRespuesta(init) });
  assert.equal(resultado.fallo.tipo, "tiempo-agotado");
  assert.match(resultado.fallo.mensaje, /no respondió en 0\.02 s/);
});

test("el tiempo máximo predeterminado es de 10 s", async () => {
  const resultado = await consultar({
    clienteHttp: async () => {
      throw new DOMException("tiempo agotado", "TimeoutError");
    },
  });
  assert.match(resultado.fallo.mensaje, /no respondió en 10 s/);
});

test("agota el tiempo máximo también mientras llega el cuerpo", async () => {
  const resultado = await consultar({
    clienteHttp: async () =>
      respuestaHttp(200, () => {
        throw new DOMException("tiempo agotado", "TimeoutError");
      }),
  });
  assert.equal(resultado.fallo.tipo, "tiempo-agotado");
});

test("clasifica un cuerpo que no es JSON", async () => {
  const resultado = await consultar({
    clienteHttp: async () =>
      respuestaHttp(200, () => {
        throw new SyntaxError("Unexpected token <");
      }),
  });
  assert.deepEqual(resultado.fallo, {
    tipo: "respuesta-invalida",
    mensaje: "La API respondió 200, pero el cuerpo no es JSON válido.",
  });
});

test("clasifica un JSON que no cumple el contrato e indica el problema", async () => {
  const resultado = await consultar({ clienteHttp: async () => respuestaHttp(200, { generatedAt: "x", alerts: [] }) });
  assert.equal(resultado.fallo.tipo, "respuesta-invalida");
  assert.match(resultado.fallo.mensaje, /generatedAt/);
});

test("una consulta cancelada por quien llama no es un error", async () => {
  const controlador = new AbortController();
  const pendiente = consultar({ senal: controlador.signal, clienteHttp: async (_, init) => clienteSinRespuesta(init) });
  controlador.abort();
  assert.deepEqual(await pendiente, { exito: false, fallo: { tipo: "cancelada" } });
});

test("una cancelación mientras llega el cuerpo tampoco es un error", async () => {
  const controlador = new AbortController();
  const resultado = await consultar({
    senal: controlador.signal,
    clienteHttp: async () =>
      respuestaHttp(200, () => {
        controlador.abort();
        throw new DOMException("cancelada", "AbortError");
      }),
  });
  assert.deepEqual(resultado, { exito: false, fallo: { tipo: "cancelada" } });
});

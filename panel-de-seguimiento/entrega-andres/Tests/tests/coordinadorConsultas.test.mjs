// Polling coordinado: un único ciclo consulta servidores y alertas activas cada 5 s y alertas
// resueltas cada 30 s, sin superposición, con entregas independientes y limpieza al detener.
// Usa temporizadores y reloj simulados de node:test, sin esperas reales.
import { test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { crearCicloConsultas } from "../src/hooks/cicloConsultas.ts";
import { crearConsultaCoordinada } from "../src/hooks/coordinadorConsultas.ts";

const INTERVALO = 5000;
const INTERVALO_RESUELTAS = 30_000;
const vaciarMicrotareas = () => new Promise((r) => setImmediate(r));

/** Fuente controlable: registra cada consulta, que queda pendiente hasta que la prueba la resuelve. */
function crearFuente(cadaMs) {
  const llamadas = [];
  const recibidos = [];
  let enCurso = 0;
  let maximoEnCurso = 0;
  return {
    llamadas,
    recibidos,
    get maximoEnCurso() {
      return maximoEnCurso;
    },
    fuente: {
      cadaMs,
      consultar: (senal) =>
        new Promise((resolver, rechazar) => {
          enCurso += 1;
          maximoEnCurso = Math.max(maximoEnCurso, enCurso);
          const terminar = (accion) => (valor) => {
            enCurso -= 1;
            accion(valor);
          };
          llamadas.push({ senal, resolver: terminar(resolver), rechazar: terminar(rechazar) });
        }),
      alRecibir: (resultado) => recibidos.push(resultado),
    },
  };
}

/** Fuente que responde de inmediato con el resultado indicado. */
function crearFuenteInmediata(cadaMs, resultado = { exito: true }) {
  const recibidos = [];
  let llamadas = 0;
  return {
    recibidos,
    get llamadas() {
      return llamadas;
    },
    fuente: {
      cadaMs,
      consultar: async () => {
        llamadas += 1;
        return typeof resultado === "function" ? resultado(llamadas) : resultado;
      },
      alRecibir: (r) => recibidos.push(r),
    },
  };
}

function crearPanel(fuentes) {
  const rondas = [];
  const ciclo = crearCicloConsultas({
    intervaloMs: INTERVALO,
    consultar: crearConsultaCoordinada({ fuentes, ahora: () => Date.now() }),
    alObtenerResultado: (ronda) => rondas.push(ronda),
  });
  return { ciclo, rondas };
}

beforeEach(() => mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 }));
afterEach(() => mock.timers.reset());

/** Avanza el reloj simulado de a un ciclo, dejando terminar las consultas inmediatas. */
async function avanzarCiclos(cantidad) {
  for (let i = 0; i < cantidad; i += 1) {
    mock.timers.tick(INTERVALO);
    await vaciarMicrotareas();
  }
}

test("servidores y alertas activas cada 5 s; resueltas cada 30 s, con un único ciclo", async () => {
  const servidores = crearFuenteInmediata(0);
  const activas = crearFuenteInmediata(0);
  const resueltas = crearFuenteInmediata(INTERVALO_RESUELTAS);
  const { ciclo, rondas } = crearPanel({
    servidores: servidores.fuente,
    activas: activas.fuente,
    resueltas: resueltas.fuente,
  });

  ciclo.iniciar();
  await vaciarMicrotareas();
  assert.deepEqual(rondas[0], ["servidores", "activas", "resueltas"], "la primera ronda consulta las tres fuentes");

  await avanzarCiclos(5); // t = 25 s
  assert.equal(servidores.llamadas, 6);
  assert.equal(activas.llamadas, 6);
  assert.equal(resueltas.llamadas, 1, "antes de 30 s no se repiten las resueltas");
  assert.deepEqual(rondas[1], ["servidores", "activas"]);

  await avanzarCiclos(1); // t = 30 s
  assert.equal(resueltas.llamadas, 2, "a los 30 s se consultan de nuevo las resueltas");

  await avanzarCiclos(6); // t = 60 s
  assert.equal(servidores.llamadas, 13, "13 consultas de servidores en 60 s (t = 0, 5, …, 60)");
  assert.equal(activas.llamadas, 13);
  assert.equal(resueltas.llamadas, 3, "3 consultas de resueltas en 60 s (t = 0, 30, 60)");
  ciclo.detener();
});

test("la periodicidad de 30 s se mide desde el inicio de la consulta anterior de esa fuente", async () => {
  let reloj = 0;
  const llamadas = [];
  const consulta = crearConsultaCoordinada({
    fuentes: {
      resueltas: { cadaMs: INTERVALO_RESUELTAS, consultar: async () => llamadas.push(reloj), alRecibir: () => {} },
    },
    ahora: () => reloj,
  });
  const senal = new AbortController().signal;
  for (const instante of [0, 5_000, 29_999, 30_000, 35_000, 59_999, 60_001]) {
    reloj = instante;
    await consulta(senal);
  }
  assert.deepEqual(llamadas, [0, 30_000, 60_001]);
});

test("no hay consultas superpuestas: la siguiente ronda espera a la fuente más lenta", async () => {
  const servidores = crearFuente(0);
  const activas = crearFuente(0);
  const resueltas = crearFuente(INTERVALO_RESUELTAS);
  const { ciclo } = crearPanel({ servidores: servidores.fuente, activas: activas.fuente, resueltas: resueltas.fuente });

  ciclo.iniciar();
  servidores.llamadas[0].resolver({ exito: true, respuesta: "s1" });
  resueltas.llamadas[0].resolver({ exito: true, respuesta: "r1" });
  await vaciarMicrotareas();

  // Alertas activas sigue pendiente: ni el tiempo ni "Reintentar" inician otra ronda.
  mock.timers.tick(INTERVALO * 4);
  ciclo.consultarAhora();
  ciclo.consultarAhora();
  assert.equal(servidores.llamadas.length, 1);
  assert.equal(activas.llamadas.length, 1);

  activas.llamadas[0].resolver({ exito: true, respuesta: "a1" });
  await vaciarMicrotareas();
  mock.timers.tick(INTERVALO);
  assert.equal(servidores.llamadas.length, 2, "la ronda siguiente empieza un intervalo después de terminar todas");
  assert.equal(activas.llamadas.length, 2);
  for (const fuente of [servidores, activas, resueltas]) {
    assert.equal(fuente.maximoEnCurso, 1, "nunca hay dos consultas de la misma fuente a la vez");
  }
  ciclo.detener();
});

test("cada fuente entrega su resultado al llegar, sin esperar a las demás", async () => {
  const servidores = crearFuente(0);
  const activas = crearFuente(0);
  const { ciclo } = crearPanel({ servidores: servidores.fuente, activas: activas.fuente });

  ciclo.iniciar();
  servidores.llamadas[0].resolver({ exito: true, respuesta: "inventario" });
  await vaciarMicrotareas();
  assert.deepEqual(servidores.recibidos, [{ exito: true, respuesta: "inventario" }], "el inventario se actualiza ya");
  assert.deepEqual(activas.recibidos, [], "las alertas lentas no bloquean al inventario");

  activas.llamadas[0].resolver({ exito: true, respuesta: "alertas" });
  await vaciarMicrotareas();
  assert.equal(activas.recibidos.length, 1);
  ciclo.detener();
});

test("fallos independientes: si /alerts falla, servidores sigue actualizándose y luego se recuperan", async () => {
  const fallo = { exito: false, fallo: { tipo: "almacenamiento-no-disponible", mensaje: "503" } };
  const servidores = crearFuenteInmediata(0, (n) => ({ exito: true, respuesta: `s${n}` }));
  const activas = crearFuenteInmediata(0, (n) => (n <= 2 ? fallo : { exito: true, respuesta: `a${n}` }));
  const { ciclo } = crearPanel({ servidores: servidores.fuente, activas: activas.fuente });

  ciclo.iniciar();
  await vaciarMicrotareas();
  await avanzarCiclos(2);
  assert.deepEqual(
    servidores.recibidos.map((r) => r.respuesta),
    ["s1", "s2", "s3"],
  );
  assert.deepEqual(
    activas.recibidos.map((r) => r.exito),
    [false, false, true],
    "las alertas fallan dos veces y se recuperan solas",
  );
  ciclo.detener();
});

test("una fuente que lanza una excepción no detiene a las demás ni al ciclo", async () => {
  const servidores = crearFuenteInmediata(0);
  const rota = {
    cadaMs: 0,
    consultar: async () => {
      throw new Error("inesperado");
    },
    alRecibir: () => assert.fail("no debe entregar nada"),
  };
  const { ciclo } = crearPanel({ servidores: servidores.fuente, rota });
  ciclo.iniciar();
  await vaciarMicrotareas();
  await avanzarCiclos(2);
  assert.equal(servidores.recibidos.length, 3);
  ciclo.detener();
});

test("detener cancela todas las consultas en curso y descarta los resultados tardíos", async () => {
  const servidores = crearFuente(0);
  const activas = crearFuente(0);
  const resueltas = crearFuente(INTERVALO_RESUELTAS);
  const { ciclo, rondas } = crearPanel({ servidores: servidores.fuente, activas: activas.fuente, resueltas: resueltas.fuente });

  ciclo.iniciar();
  servidores.llamadas[0].resolver({ exito: true });
  await vaciarMicrotareas();
  ciclo.detener();

  for (const fuente of [servidores, activas, resueltas]) {
    assert.equal(fuente.llamadas[0].senal.aborted, true, "las señales de la ronda quedan abortadas");
  }
  activas.llamadas[0].resolver({ exito: true });
  resueltas.llamadas[0].resolver({ exito: true });
  await vaciarMicrotareas();
  mock.timers.tick(INTERVALO * 10);
  assert.equal(activas.recibidos.length, 0, "sin entregas después de detener (equivale a no actualizar tras desmontar)");
  assert.equal(resueltas.recibidos.length, 0);
  assert.equal(rondas.length, 0);
  assert.equal(servidores.llamadas.length, 1, "no se programan más rondas");
});

test("cada montaje crea un coordinador nuevo: vuelve a consultar las resueltas al iniciar", async () => {
  const resueltas = crearFuenteInmediata(INTERVALO_RESUELTAS);
  for (let montaje = 1; montaje <= 2; montaje += 1) {
    const { ciclo } = crearPanel({ resueltas: resueltas.fuente });
    ciclo.iniciar();
    await vaciarMicrotareas();
    ciclo.detener();
    assert.equal(resueltas.llamadas, montaje);
  }
});

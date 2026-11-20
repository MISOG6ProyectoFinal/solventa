// Load for the ASR-09 experiment. Each iteration is a new payment, retried with the same key until it is confirmed.
// It logs one JSON line per payment; the experiment compares them with the database and the gateway.
import http from "k6/http";
import { sleep } from "k6";

const URL = __ENV.PAGOS_URL || "http://pagos.solventa.svc/pagos/cobros";
const CORRIDA = __ENV.CORRIDA || "local";
const REINTENTOS = 10;
const PLAZO_MS = 180_000;

export const options = {
  scenarios: {
    cobros: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.TASA || 5),
      timeUnit: "1s",
      duration: `${__ENV.DURACION_S || 240}s`,
      preAllocatedVUs: 50,
      maxVUs: 400,
      gracefulStop: `${PLAZO_MS / 1000}s`,
    },
  },
};

export default function () {
  const referencia = `asr09-${CORRIDA}-${__VU}-${__ITER}`;
  const clave = `asr09:${referencia}`;
  const cuerpo = JSON.stringify({
    cotizacion_id: referencia,
    cliente_id: "asr09",
    monto: "1000.00",
    moneda: "COP",
    idempotency_key: clave,
    medio_token: "demo-4242",
  });
  const inicio = Date.now();
  let http_status = 0;
  let estado = null;
  for (let intento = 1; intento <= REINTENTOS && Date.now() - inicio < PLAZO_MS; intento += 1) {
    const respuesta = http.post(URL, cuerpo, { headers: { "Content-Type": "application/json" }, timeout: "5s" });
    http_status = respuesta.status;
    if (http_status === 200) {
      estado = respuesta.json("estado");
      break;
    }
    sleep(Number(respuesta.headers["Retry-After"] || 2));
  }
  console.log(JSON.stringify({ clave, referencia, http: http_status, estado, ts: new Date().toISOString() }));
}

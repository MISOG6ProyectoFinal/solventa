import { kubeconfigPath } from "./rutas.mjs";
import { ejecutar, ejecutarAsync, jsonDe } from "./proceso.mjs";

// host.docker.internal no responde desde este Windows: resuelve a la IP de la LAN.
// Además el puerto publicado llega con el certificado de Norton, no con la CA de k3s.
export function kubeconfigLocal(texto) {
  return texto
    .replaceAll("host.docker.internal", "127.0.0.1")
    .replace(/^[ \t]*certificate-authority-data:.*\r?\n/m, "    insecure-skip-tls-verify: true\n");
}

const TRANSITORIO = /forcibly closed|wsarecv|wsasend|Unable to connect|connection reset|EOF|i\/o timeout|TLS handshake/i;

export function kubectl(args, { input, kubeconfig = kubeconfigPath, timeout } = {}) {
  let ultimo;
  for (let intento = 1; intento <= 5; intento += 1) {
    ultimo = ejecutar("kubectl", args, {
      input,
      timeout,
      env: { ...process.env, KUBECONFIG: kubeconfig },
    });
    if (ultimo.ok || !TRANSITORIO.test(`${ultimo.stderr}\n${ultimo.stdout}`)) return ultimo;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
  }
  return ultimo;
}

export async function kubectlAsync(args, { input, kubeconfig = kubeconfigPath, timeout } = {}) {
  let ultimo;
  for (let intento = 1; intento <= 5; intento += 1) {
    ultimo = await ejecutarAsync("kubectl", args, {
      input,
      timeout,
      env: { ...process.env, KUBECONFIG: kubeconfig },
    });
    if (ultimo.ok || !TRANSITORIO.test(`${ultimo.stderr}\n${ultimo.stdout}`)) return ultimo;
    await new Promise((resolver) => setTimeout(resolver, 2000));
  }
  return ultimo;
}

export function kubectlJson(args, opciones) {
  return jsonDe(kubectl([...args, "-o", "json"], opciones), args.join(" "));
}

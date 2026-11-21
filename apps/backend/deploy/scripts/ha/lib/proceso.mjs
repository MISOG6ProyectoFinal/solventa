import { spawn, spawnSync } from "node:child_process";

export function ejecutar(comando, args, { cwd, env, input, timeout } = {}) {
  const resultado = spawnSync(comando, args, {
    cwd,
    env,
    input,
    timeout,
    encoding: "utf8",
    windowsHide: true,
    // Evidence reads (k6 logs, gateway charges) grow past the 1 MB default.
    maxBuffer: 256 * 1024 * 1024,
  });
  const fallo = resultado.error ? resultado.error.message : "";
  return {
    ok: resultado.status === 0,
    status: resultado.status,
    stdout: resultado.stdout ?? "",
    stderr: `${resultado.stderr ?? ""}${fallo}`,
  };
}

export function ejecutarAsync(comando, args, { cwd, env, input, timeout } = {}) {
  return new Promise((resolver) => {
    const proceso = spawn(comando, args, { cwd, env, windowsHide: true });
    let stdout = "";
    let stderr = "";
    const temporizador = timeout ? setTimeout(() => proceso.kill(), timeout) : null;
    proceso.stdout.on("data", (dato) => { stdout += dato; });
    proceso.stderr.on("data", (dato) => { stderr += dato; });
    if (input != null) proceso.stdin.end(input);
    proceso.on("error", (error) => {
      if (temporizador) clearTimeout(temporizador);
      resolver({ ok: false, status: null, stdout, stderr: `${stderr}${error.message}` });
    });
    proceso.on("close", (status) => {
      if (temporizador) clearTimeout(temporizador);
      resolver({ ok: status === 0, status, stdout, stderr });
    });
  });
}

export function jsonDe(resultado, contexto) {
  if (!resultado.ok) {
    throw new Error(`${contexto}: ${resultado.stderr.trim() || resultado.stdout.trim() || "sin salida"}`);
  }
  return JSON.parse(resultado.stdout || "null");
}

import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function crearBitacora(directorio) {
  mkdirSync(directorio, { recursive: true });
  const ruta = join(directorio, "eventos.json");
  const eventos = [];
  const guardar = () => writeFileSync(ruta, JSON.stringify(eventos, null, 2));
  guardar();
  return {
    ruta,
    eventos,
    anotar(tipo, detalle = {}) {
      const evento = { ts: new Date().toISOString(), tipo, ...detalle };
      eventos.push(evento);
      guardar();
      appendFileSync(join(directorio, "eventos.jsonl"), `${JSON.stringify(evento)}\n`);
      return evento;
    },
  };
}

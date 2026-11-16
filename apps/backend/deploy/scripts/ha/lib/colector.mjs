import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { CLUSTER_PG, NAMESPACE, SERVICIOS_CRITICOS } from "./constantes.mjs";
import { nodosDesde, podsDesde, postgresDesde } from "./estado.mjs";
import { empujar } from "./metricas.mjs";
import { kubectlJson } from "./kube.mjs";

export async function publicarCluster(ctx) {
  const nodos = nodosDesde(kubectlJson(["get", "nodes"]));
  const pods = podsDesde(kubectlJson(["-n", NAMESPACE, "get", "pods"]), nodos);
  const cluster = kubectlJson(["-n", NAMESPACE, "get", "cluster", CLUSTER_PG]);
  const pgPods = podsDesde(
    kubectlJson(["-n", NAMESPACE, "get", "pods", "-l", `cnpg.io/cluster=${CLUSTER_PG}`]),
    nodos,
  );
  const postgres = postgresDesde(pgPods, cluster);
  const lineas = ["# TYPE ha_cluster_scrape_up gauge", "ha_cluster_scrape_up 1", "# TYPE ha_falla_activa gauge", `ha_falla_activa ${ctx.falla?.() ? 1 : 0}`];
  lineas.push("# TYPE ha_nodo_listo gauge");
  for (const nodo of nodos) {
    lineas.push(`ha_nodo_listo{nodo="${nodo.nombre}",zona="${nodo.zona || ""}"} ${nodo.listo ? 1 : 0}`);
  }
  lineas.push("# TYPE ha_replicas_listas gauge");
  for (const servicio of SERVICIOS_CRITICOS) {
    for (const zona of ["ha-zone-a", "ha-zone-b"]) {
      const listas = pods.filter((pod) => pod.servicio === servicio && pod.zona === zona && pod.listo).length;
      lineas.push(`ha_replicas_listas{servicio="${servicio}",zona="${zona}"} ${listas}`);
    }
  }
  lineas.push("# TYPE ha_pg_replicas_listas gauge", `ha_pg_replicas_listas ${postgres.replicasListas}`);
  lineas.push("# TYPE ha_pg_primario gauge");
  if (postgres.primario) {
    lineas.push(
      `ha_pg_primario{instancia="${postgres.primario.instancia}",zona="${postgres.primario.zona || ""}"} 1`,
    );
  }
  const ok = await empujar(`${ctx.pushgateway}/metrics/job/ha_cluster`, lineas.join("\n"));
  if (ctx.salida) {
    const zonas = {};
    for (const zona of ["ha-zone-a", "ha-zone-b"]) {
      zonas[zona] = {
        nodo: nodos.some((nodo) => nodo.zona === zona && nodo.listo) ? 1 : 0,
        replicas: pods.filter((pod) => SERVICIOS_CRITICOS.includes(pod.servicio) && pod.zona === zona && pod.listo).length,
      };
    }
    appendFileSync(join(ctx.salida, "infra.jsonl"), `${JSON.stringify({
      ts: new Date().toISOString(),
      zonas,
      pgReplicas: postgres.replicasListas,
      primario: postgres.primario?.instancia ?? null,
      zonaPrimario: postgres.primario?.zona ?? null,
      fase: postgres.fase,
    })}\n`);
  }
  return { ok, nodos, pods, postgres };
}

export function iniciarColector(ctx) {
  let vivo = true;
  const ciclo = () => {
    if (!vivo) return;
    publicarCluster(ctx).catch((error) => {
      ctx.bitacora?.anotar("colector-error", { mensaje: error.message });
      empujar(
        `${ctx.pushgateway}/metrics/job/ha_cluster`,
        `# TYPE ha_cluster_scrape_up gauge\nha_cluster_scrape_up 0\n# TYPE ha_falla_activa gauge\nha_falla_activa ${ctx.falla?.() ? 1 : 0}\n`,
      ).catch(() => {});
    });
  };
  const temporizador = setInterval(ciclo, 5000);
  ciclo();
  return () => {
    vivo = false;
    clearInterval(temporizador);
  };
}

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));

export const backend = resolve(aqui, "../../../..");
export const evidenciasRaiz = resolve(backend, "../../experimentation/ha/evidencias");
export const kubeconfigPath = resolve(backend, "../../experimentation/ha/kubeconfig");
export const credencialesPath = resolve(backend, "../../experimentation/ha/credenciales.json");
export const overlayHa = resolve(backend, "deploy/k8s/overlays/local-ha");
export const observabilidad = resolve(backend, "deploy/observability/ha");
export const sqlBases = resolve(backend, "deploy/k8s/components/k3s/init-databases.sql");

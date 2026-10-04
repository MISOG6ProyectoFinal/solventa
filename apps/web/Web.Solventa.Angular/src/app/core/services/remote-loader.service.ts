import { Injectable, Type } from '@angular/core';
import { loadRemoteModule } from '@angular-architects/native-federation';
import { RemoteConfig } from '../interfaces/remote-config.interface';

/**
 * Carga un componente expuesto por un remoto MFE. Si el remoto no está disponible
 * (no desplegado, caído, manifest sin entrada) devuelve el componente de respaldo
 * para que el shell nunca se rompa.
 */
@Injectable({ providedIn: 'root' })
export class RemoteLoaderService {
  async load(remote: RemoteConfig, fallback: Type<unknown>): Promise<Type<unknown>> {
    try {
      const mod = await loadRemoteModule(remote.name, remote.exposed);
      return (mod.AppComponent ?? mod.default ?? fallback) as Type<unknown>;
    } catch (error) {
      console.warn(`[MFE] Remoto "${remote.name}" no disponible; usando respaldo.`, error);
      return fallback;
    }
  }
}

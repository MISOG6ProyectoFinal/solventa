import { create } from 'zustand';

import { setAccessToken } from '../../../shared/api/accessToken';
import { loadApiBaseUrl } from '../../../shared/api/apiBaseUrl';
import { ApiError } from '../../../shared/api/client';
import { setUnauthorizedHandler } from '../../../shared/api/unauthorized';
import { getSession, type ClientProfile } from '../api/getSession';
import { registerClient } from '../api/registerClient';
import { startSession } from '../api/startSession';
import { deleteToken, readToken, saveToken } from '../storage';

type Status = 'checking' | 'signedIn' | 'signedOut';

type SessionState = {
  status: Status;
  clienteId: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  restore: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  signOut: () => Promise<void>;
};

let restoreGeneration = 0;

type SessionSnapshot = {
  status: Status;
  clienteId: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
};

function withProfile(profile: ClientProfile): SessionSnapshot {
  return {
    status: 'signedIn',
    clienteId: profile.cliente_id,
    email: profile.correo,
    firstName: profile.nombre,
    lastName: profile.apellido,
  };
}

function withoutProfile(): SessionSnapshot {
  return {
    status: 'signedIn',
    clienteId: null,
    email: null,
    firstName: null,
    lastName: null,
  };
}

function signedOut(): SessionSnapshot {
  setAccessToken(null);
  return {
    status: 'signedOut',
    clienteId: null,
    email: null,
    firstName: null,
    lastName: null,
  };
}

async function rememberProfile(token: string, generation: number): Promise<void> {
  setAccessToken(token);
  try {
    const profile = await getSession();
    if (generation !== restoreGeneration) {
      return;
    }
    useSessionStore.setState(withProfile(profile));
  } catch (error) {
    if (generation !== restoreGeneration) {
      return;
    }
    if (error instanceof ApiError && error.status === 401) {
      await deleteToken();
      useSessionStore.setState(signedOut());
      throw error;
    }
    // Offline, the stored token still opens the app.
    useSessionStore.setState(withoutProfile());
  }
}

export const useSessionStore = create<SessionState>((set) => ({
  status: 'checking',
  clienteId: null,
  email: null,
  firstName: null,
  lastName: null,
  restore: async () => {
    const generation = ++restoreGeneration;
    const [, token] = await Promise.all([loadApiBaseUrl(), readToken()]);
    if (generation !== restoreGeneration) {
      return;
    }
    if (!token) {
      set(signedOut());
      return;
    }
    try {
      await rememberProfile(token, generation);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        return;
      }
      throw error;
    }
  },
  signIn: async (email, password) => {
    const generation = ++restoreGeneration;
    const session = await startSession(email.trim(), password);
    await saveToken(session.token);
    if (generation !== restoreGeneration) {
      return;
    }
    await rememberProfile(session.token, generation);
  },
  register: async (email, password, firstName, lastName) => {
    const generation = ++restoreGeneration;
    const session = await registerClient(email.trim(), password, firstName.trim(), lastName.trim());
    await saveToken(session.token);
    if (generation !== restoreGeneration) {
      return;
    }
    await rememberProfile(session.token, generation);
  },
  signOut: async () => {
    restoreGeneration += 1;
    await deleteToken();
    set(signedOut());
  },
}));

// Restore and sign-in handle their own 401, so only an open session signs out here.
setUnauthorizedHandler(() => {
  const { status, signOut } = useSessionStore.getState();
  if (status === 'signedIn') {
    signOut().catch(() => undefined);
  }
});

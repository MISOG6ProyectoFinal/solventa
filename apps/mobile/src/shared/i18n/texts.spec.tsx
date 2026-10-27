import { en as claimsEn } from '../../features/claims/texts/en';
import { es as claimsEs } from '../../features/claims/texts/es';
import { en as homeEn } from '../../features/home/texts/en';
import { es as homeEs } from '../../features/home/texts/es';
import { en as providersEn } from '../../features/providers/texts/en';
import { es as providersEs } from '../../features/providers/texts/es';
import { en as quoteEn } from '../../features/quote/texts/en';
import { es as quoteEs } from '../../features/quote/texts/es';
import { en as sessionEn } from '../../features/session/texts/en';
import { es as sessionEs } from '../../features/session/texts/es';
import { en as settingsEn } from '../../features/settings/texts/en';
import { es as settingsEs } from '../../features/settings/texts/es';
import { en as sharedEn } from '../texts/en';
import { es as sharedEs } from '../texts/es';

type Tree = { [key: string]: unknown };

function shape(node: unknown): unknown {
  if (typeof node === 'function') return 'function';
  if (Array.isArray(node)) return node.map(shape);
  if (node !== null && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node as Tree).map(([key, value]) => [key, shape(value)]));
  }
  return typeof node;
}

function emptyStrings(node: unknown, path = ''): string[] {
  if (typeof node === 'string') return node.trim() === '' ? [path] : [];
  if (Array.isArray(node)) return node.flatMap((item, index) => emptyStrings(item, `${path}[${index}]`));
  if (node !== null && typeof node === 'object') {
    return Object.entries(node as Tree).flatMap(([key, value]) => emptyStrings(value, `${path}.${key}`));
  }
  return [];
}

describe('texts', () => {
  it.each([
    ['claims', claimsEs, claimsEn],
    ['home', homeEs, homeEn],
    ['providers', providersEs, providersEn],
    ['quote', quoteEs, quoteEn],
    ['session', sessionEs, sessionEn],
    ['settings', settingsEs, settingsEn],
    ['shared', sharedEs, sharedEn],
  ])('%s has the same keys in both languages and no empty English value', (_name, es, en) => {
    expect(shape(en)).toEqual(shape(es));
    expect(emptyStrings(en)).toEqual([]);
  });
});

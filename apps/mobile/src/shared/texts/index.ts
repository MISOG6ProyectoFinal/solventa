import { createTexts } from '../i18n/createTexts';
import { en } from './en';
import { es } from './es';

export const { useTexts, getTexts } = createTexts({ es, en });

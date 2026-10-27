import { type Texts } from './es';

export const en: Texts = {
  checking: {
    loading: 'Loading',
  },
  login: {
    title: 'Sign in',
    emailLabel: 'Email',
    credentialLabel: 'Password',
    submit: 'Sign in',
    createAccount: 'Create account',
    failed: 'Could not sign in.',
    devToolsLabel: 'Developer tools',
  },
  register: {
    title: 'Create account',
    firstNameLabel: 'First name',
    lastNameLabel: 'Last name',
    emailLabel: 'Email',
    emailInvalid: 'Enter a valid email.',
    documentTypeLabel: 'Document type',
    documentTypes: {
      CC: 'Citizenship card',
      CE: 'Foreigner ID card',
      Pasaporte: 'Passport',
    },
    documentNumberLabel: 'Document number',
    phoneLabel: 'Phone',
    birthDateLabel: 'Date of birth',
    birthDateInvalid: 'The date must be before today.',
    credentialLabel: 'Password',
    passwordTooShort: (min: number) => `The password must be at least ${min} characters.`,
    submit: 'Create account',
    signIn: 'I already have an account',
    failed: 'Could not create the account.',
  },
};

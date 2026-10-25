export const es = {
  checking: {
    loading: 'Cargando',
  },
  login: {
    title: 'Iniciar sesión',
    emailLabel: 'Correo',
    credentialLabel: 'Contraseña',
    submit: 'Iniciar sesión',
    createAccount: 'Crear cuenta',
    failed: 'No se pudo iniciar sesión.',
    devToolsLabel: 'Herramientas de desarrollo',
  },
  register: {
    title: 'Crear cuenta',
    firstNameLabel: 'Nombre',
    lastNameLabel: 'Apellido',
    emailLabel: 'Correo',
    documentTypeLabel: 'Tipo de documento',
    documentTypes: {
      CC: 'Cédula de ciudadanía',
      CE: 'Cédula de extranjería',
      Pasaporte: 'Pasaporte',
    },
    documentNumberLabel: 'Número de documento',
    phoneLabel: 'Teléfono',
    birthDateLabel: 'Fecha de nacimiento',
    birthDateInvalid: 'La fecha debe ser anterior a hoy.',
    credentialLabel: 'Contraseña',
    passwordTooShort: (min: number) => `La contraseña debe tener al menos ${min} caracteres.`,
    submit: 'Crear cuenta',
    signIn: 'Ya tengo cuenta',
    failed: 'No se pudo crear la cuenta.',
  },
};

export type Texts = typeof es;

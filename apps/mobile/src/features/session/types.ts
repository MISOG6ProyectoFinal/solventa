export type DocumentType = 'CC' | 'CE' | 'Pasaporte';

export type RegisterValues = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  documentType: DocumentType;
  documentNumber: string;
  phone: string;
  birthDate: string;
};

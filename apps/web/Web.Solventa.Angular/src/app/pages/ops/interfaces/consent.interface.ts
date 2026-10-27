export interface SolicitudConsentimiento {
  cliente_id?: string;
  tipo_documento?: string;
  numero_documento?: string;
  nombre?: string;
  apellido?: string;
  email?: string;
  telefono?: string;
  fecha_nacimiento?: string;
  pais?: string;
  ramo: string;
  canal: 'sms' | 'email';
  contacto?: string;
  contacto_mask?: string;
  alcance?: string[];
  open_finance: boolean;
  open_data: boolean;
  asesor: string;
}

export interface RespuestaSolicitud {
  consentimiento_id: string;
  cliente_id?: string;
  estado: string;
  alcance?: string[];
  fuente?: string;
  contacto?: string;
  contacto_mask: string;
  codigo_demo: string;
  expira_en: string;
}

export interface SolicitudValidacionOTP {
  consentimiento_id: string;
  codigo: string;
}

export interface RespuestaValidacion {
  consentimiento_id: string;
  cliente_id?: string;
  estado: string;
  fuente?: string;
  fecha_otorgamiento?: string;
  validado_en: string;
  asesor: string;
  canal: string;
  alcance?: string[];
  open_finance: boolean;
  open_data: boolean;
}

export interface RespuestaConsultaConsentimiento {
  consentimiento_id: string;
  cliente_id?: string;
  cliente_nombre?: string;
  cliente_documento?: string;
  estado: string;
  fuente?: string;
  fecha_otorgamiento?: string;
  fecha_revocacion?: string;
  fecha_hora: string;
  asesor: string;
  canal: string;
  contacto?: string;
  alcance: string;
}

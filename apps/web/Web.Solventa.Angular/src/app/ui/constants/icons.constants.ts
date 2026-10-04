/**
 * Catálogo de íconos Solventa — portado de `src/design-system/icons.tsx` (mockups).
 * Grilla común: viewBox 24×24, trazo 1.5px, round caps/joins, `currentColor`.
 * Cada ícono es una lista de formas SVG para renderizarse sin `innerHTML`.
 */
export type IconCategory = 'Navegación' | 'Acciones' | 'Estados' | 'Negocio' | 'Ramos' | 'Plataforma';

export type IconShape =
  | { readonly t: 'path'; readonly d: string }
  | { readonly t: 'circle'; readonly cx: number; readonly cy: number; readonly r: number }
  | { readonly t: 'rect'; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly rx: number };

export interface IconDef {
  readonly label: string;
  readonly category: IconCategory;
  readonly shapes: readonly IconShape[];
}

const p = (d: string): IconShape => ({ t: 'path', d });
const c = (cx: number, cy: number, r: number): IconShape => ({ t: 'circle', cx, cy, r });
const r = (x: number, y: number, w: number, h: number, rx: number): IconShape => ({ t: 'rect', x, y, w, h, rx });

export const ICONS = {
  // Navegación
  inicio: { label: 'Inicio', category: 'Navegación', shapes: [p('M3 10.5 12 3l9 7.5'), p('M5 9.5V21h14V9.5'), p('M10 21v-6h4v6')] },
  polizas: { label: 'Pólizas', category: 'Navegación', shapes: [p('M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z'), p('m9 12 2 2 4-4')] },
  siniestros: { label: 'Siniestros', category: 'Navegación', shapes: [p('M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z'), p('M14 3v5h5'), p('M12 11v4'), p('M12 18h.01')] },
  comprar: { label: 'Comprar', category: 'Navegación', shapes: [p('M6 7h12l1 14H5L6 7z'), p('M9 7a3 3 0 0 1 6 0')] },
  operaciones: { label: 'Operaciones', category: 'Navegación', shapes: [r(3, 7, 18, 13, 2), p('M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2'), p('M3 13h18')] },
  socios: { label: 'Socios', category: 'Navegación', shapes: [c(9, 8, 3.5), p('M2.5 20a6.5 6.5 0 0 1 13 0'), p('M16 4.5a3.5 3.5 0 0 1 0 7'), p('M18 14.5a6.5 6.5 0 0 1 3.5 5.5')] },
  menu: { label: 'Menú', category: 'Navegación', shapes: [p('M4 6h16M4 12h16M4 18h16')] },
  volver: { label: 'Volver', category: 'Navegación', shapes: [p('m15 18-6-6 6-6')] },
  cerrar: { label: 'Cerrar', category: 'Navegación', shapes: [p('M6 6l12 12M18 6 6 18')] },
  buscar: { label: 'Buscar', category: 'Navegación', shapes: [c(11, 11, 7), p('m20 20-3.5-3.5')] },
  filtro: { label: 'Filtrar', category: 'Navegación', shapes: [p('M4 5h16l-6 7.5V19l-4 2v-8.5L4 5z')] },

  // Acciones
  agregar: { label: 'Agregar', category: 'Acciones', shapes: [p('M12 5v14M5 12h14')] },
  editar: { label: 'Editar / endoso', category: 'Acciones', shapes: [p('M4 20h4L19 9l-4-4L4 16v4z'), p('m13.5 6.5 4 4')] },
  cancelar: { label: 'Cancelar póliza', category: 'Acciones', shapes: [c(12, 12, 9), p('m5.6 5.6 12.8 12.8')] },
  eliminar: { label: 'Eliminar', category: 'Acciones', shapes: [p('M4 7h16'), p('M9 7V4h6v3'), p('M6 7l1 13h10l1-13')] },
  enviar: { label: 'Enviar', category: 'Acciones', shapes: [p('M21 3 10 14'), p('M21 3 14.5 21l-4.5-7-7-4.5L21 3z')] },
  camara: { label: 'Tomar foto', category: 'Acciones', shapes: [p('M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z'), c(12, 13.5, 3.5)] },
  video: { label: 'Grabar video', category: 'Acciones', shapes: [r(3, 6, 13, 12, 2), p('m16 10 5-3v10l-5-3')] },
  repetir: { label: 'Repetir captura', category: 'Acciones', shapes: [p('M3 12a9 9 0 1 0 3-6.7'), p('M3 4v5h5')] },
  sincronizar: { label: 'Sincronizar', category: 'Acciones', shapes: [p('M20 11a8 8 0 0 0-14.6-4.5'), p('M4 4v4h4'), p('M4 13a8 8 0 0 0 14.6 4.5'), p('M20 20v-4h-4')] },

  // Estados
  exito: { label: 'Éxito', category: 'Estados', shapes: [c(12, 12, 9), p('m8 12 3 3 5-6')] },
  info: { label: 'Información', category: 'Estados', shapes: [c(12, 12, 9), p('M12 11v5'), p('M12 8h.01')] },
  advertencia: { label: 'Advertencia', category: 'Estados', shapes: [p('M12 3 2 20h20L12 3z'), p('M12 10v4'), p('M12 17h.01')] },
  error: { label: 'Error', category: 'Estados', shapes: [c(12, 12, 9), p('m9 9 6 6M15 9l-6 6')] },
  pendiente: { label: 'Pendiente', category: 'Estados', shapes: [c(12, 12, 9), p('M12 7v5l3 2')] },
  enLinea: { label: 'En línea', category: 'Estados', shapes: [p('M2 9a15 15 0 0 1 20 0'), p('M5 12.5a10 10 0 0 1 14 0'), p('M8.5 16a5 5 0 0 1 7 0'), p('M12 20h.01')] },
  sinConexion: { label: 'Sin conexión', category: 'Estados', shapes: [p('M3 3l18 18'), p('M5 12.5a10 10 0 0 1 4-2.3'), p('M14.5 10.2A10 10 0 0 1 19 12.5'), p('M8.5 16a5 5 0 0 1 7 0'), p('M12 20h.01')] },
  notificacion: { label: 'Notificación', category: 'Estados', shapes: [p('M6 16v-5a6 6 0 0 1 12 0v5l2 2H4l2-2z'), p('M10 21h4')] },

  // Negocio
  cotizacion: { label: 'Cotización', category: 'Negocio', shapes: [r(5, 3, 14, 18, 2), p('M8 7h8'), p('M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01')] },
  pago: { label: 'Pago', category: 'Negocio', shapes: [r(3, 5, 18, 14, 2), p('M3 10h18'), p('M7 15h4')] },
  documento: { label: 'Documento', category: 'Negocio', shapes: [p('M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z'), p('M14 3v5h5'), p('M8 13h8M8 17h5')] },
  consentimiento: { label: 'Consentimiento', category: 'Negocio', shapes: [r(5, 11, 14, 10, 2), p('M8 11V8a4 4 0 0 1 8 0v3'), p('M12 15v2')] },
  credencial: { label: 'Credencial API', category: 'Negocio', shapes: [c(8, 15, 4), p('m11 12 9-9'), p('m17 6 3 3'), p('m15 8 2 2')] },
  api: { label: 'Integración API', category: 'Negocio', shapes: [p('m8 8-5 4 5 4'), p('m16 8 5 4-5 4'), p('m14 5-4 14')] },
  ubicacion: { label: 'Ubicación', category: 'Negocio', shapes: [p('M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z'), c(12, 9, 2.5)] },
  grua: { label: 'Grúa', category: 'Negocio', shapes: [p('M3 6h11v10H3z'), p('M14 10h4l3 3v3h-7'), c(7, 18, 2), c(17, 18, 2)] },
  ambulancia: { label: 'Ambulancia', category: 'Negocio', shapes: [r(3, 7, 18, 13, 2), p('M9 7V5h6v2'), p('M12 11v5M9.5 13.5h5')] },
  perito: { label: 'Perito', category: 'Negocio', shapes: [c(9, 8, 3.5), p('M2.5 20a6.5 6.5 0 0 1 13 0'), p('m16 11 2 2 4-4')] },
  calendario: { label: 'Vigencia', category: 'Negocio', shapes: [r(3, 5, 18, 16, 2), p('M3 10h18'), p('M8 3v4M16 3v4')] },
  usuario: { label: 'Usuario', category: 'Negocio', shapes: [c(12, 8, 4), p('M4 21a8 8 0 0 1 16 0')] },

  // Ramos
  viaje: { label: 'Viaje', category: 'Ramos', shapes: [p('M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z')] },
  dispositivos: { label: 'Protección de dispositivos', category: 'Ramos', shapes: [r(6, 2, 12, 20, 2), p('M11 18h2')] },
  microseguroVida: { label: 'Microseguro de vida', category: 'Ramos', shapes: [p('M12 20s-7-4.4-9-9a4.5 4.5 0 0 1 9-3 4.5 4.5 0 0 1 9 3c-2 4.6-9 9-9 9z')] },
  parametrico: { label: 'Paramétrico', category: 'Ramos', shapes: [p('M7 15a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 6a4.5 4.5 0 0 1 1 9z'), p('M8 18l-1 3M12 18l-1 3M16 18l-1 3')] },
  proteccionPagos: { label: 'Protección de pagos', category: 'Ramos', shapes: [p('M19 7V5a1 1 0 0 0-1-1H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1H5'), c(16, 13.5, 1)] },
  vidaHipotecario: { label: 'Vida hipotecario', category: 'Ramos', shapes: [p('M3 10.5 12 3l9 7.5'), p('M5 9.5V21h14V9.5'), p('M12 17.5s-3-1.8-3-3.7a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 1.9-3 3.7-3 3.7z')] },

  // Plataforma
  web: { label: 'Web App', category: 'Plataforma', shapes: [r(2, 3, 20, 14, 2), p('M8 21h8M12 17v4')] },
  movil: { label: 'Mobile App', category: 'Plataforma', shapes: [r(6, 2, 12, 20, 2), p('M11 18h2')] },
  designSystem: { label: 'Design System', category: 'Plataforma', shapes: [p('M12 2 2 7l10 5 10-5-10-5z'), p('m2 17 10 5 10-5M2 12l10 5 10-5')] },
  historias: { label: 'Historias de usuario', category: 'Plataforma', shapes: [r(5, 4, 14, 17, 2), p('M9 4V3h6v1'), p('M9 11h6M9 15h4')] },
  paleta: { label: 'Colores', category: 'Plataforma', shapes: [p('M12 3a9 9 0 0 0 0 18c1 0 1.5-.8 1.5-1.5 0-1.2-1-1.5-1-2.5a1.5 1.5 0 0 1 1.5-1.5H16a5 5 0 0 0 5-5c0-4.1-4-7.5-9-7.5z'), c(7.5, 11, 1), c(10, 7, 1), c(15, 7.5, 1)] },
  tipografia: { label: 'Tipografía', category: 'Plataforma', shapes: [p('M4 7V4h16v3M9 20h6M12 4v16')] },
  componentes: { label: 'Componentes', category: 'Plataforma', shapes: [p('M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z'), p('M3.3 7 12 12l8.7-5M12 22V12')] },
  cuadricula: { label: 'Íconos', category: 'Plataforma', shapes: [r(3, 3, 7, 7, 1), r(14, 3, 7, 7, 1), r(3, 14, 7, 7, 1), r(14, 14, 7, 7, 1)] },
} as const satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;

export type IconSize = 16 | 20 | 24 | 32;

export const ICON_CATEGORIES: readonly IconCategory[] = ['Navegación', 'Acciones', 'Estados', 'Negocio', 'Ramos', 'Plataforma'];

import { ReactNode } from 'react';
import { View } from 'react-native';

import { theme } from '../../shared/theme';
import {
  Amount,
  AppText,
  Banner,
  Button,
  Card,
  CheckboxField,
  CoverageList,
  DateField,
  Icon,
  IconColor,
  IconName,
  Indicator,
  KeyValue,
  OptionList,
  SelectField,
  Stat,
  StatusChip,
  Switch,
  TextField,
  Thumbnail,
} from '../../shared/ui';
import { icons } from '../../shared/ui/icons';

export type PlaygroundValues = Record<string, string | boolean>;

type Choice = {
  id: string;
  label: string;
};

type Field =
  | { kind: 'text'; key: string; label: string }
  | { kind: 'switch'; key: string; label: string }
  | { kind: 'choice'; key: string; label: string; options: Choice[] };

export type PlaygroundItem = {
  id: string;
  title: string;
  initial: PlaygroundValues;
  fields: Field[];
  render: (values: PlaygroundValues, update: (key: string, value: string | boolean) => void) => ReactNode;
};

const textVariants: Choice[] = [
  { id: 'screenTitle', label: 'Título de pantalla' },
  { id: 'sectionTitle', label: 'Título de sección' },
  { id: 'subtitle', label: 'Subtítulo' },
  { id: 'body', label: 'Cuerpo' },
  { id: 'bodySmall', label: 'Cuerpo pequeño' },
  { id: 'caption', label: 'Leyenda' },
  { id: 'label', label: 'Etiqueta' },
  { id: 'labelAccent', label: 'Etiqueta de acento' },
  { id: 'button', label: 'Botón' },
  { id: 'amount', label: 'Monto' },
];

const buttonVariants: Choice[] = [
  { id: 'primary', label: 'Primario' },
  { id: 'secondary', label: 'Secundario' },
  { id: 'accent', label: 'Acento' },
  { id: 'outlined', label: 'Contorno' },
  { id: 'primaryOutline', label: 'Contorno primario' },
  { id: 'text', label: 'Texto' },
  { id: 'accentLink', label: 'Enlace' },
];

const iconLabels: Record<IconName, string> = {
  inicio: 'Inicio',
  polizas: 'Pólizas',
  siniestros: 'Siniestros',
  comprar: 'Comprar',
  operaciones: 'Operaciones',
  socios: 'Socios',
  menu: 'Menú',
  volver: 'Volver',
  siguiente: 'Siguiente',
  desplegar: 'Desplegar',
  cerrar: 'Cerrar',
  buscar: 'Buscar',
  filtro: 'Filtrar',
  agregar: 'Agregar',
  editar: 'Editar',
  cancelar: 'Cancelar',
  eliminar: 'Eliminar',
  enviar: 'Enviar',
  camara: 'Cámara',
  video: 'Video',
  reproducir: 'Reproducir',
  pausar: 'Pausar',
  repetir: 'Repetir',
  sincronizar: 'Sincronizar',
  exito: 'Éxito',
  info: 'Información',
  advertencia: 'Advertencia',
  error: 'Error',
  pendiente: 'Pendiente',
  enLinea: 'En línea',
  sinConexion: 'Sin conexión',
  notificacion: 'Notificación',
  cotizacion: 'Cotización',
  pago: 'Pago',
  documento: 'Documento',
  consentimiento: 'Consentimiento',
  credencial: 'Credencial',
  api: 'API',
  ubicacion: 'Ubicación',
  grua: 'Grúa',
  ambulancia: 'Ambulancia',
  perito: 'Perito',
  calendario: 'Calendario',
  usuario: 'Usuario',
  viaje: 'Viaje',
  dispositivos: 'Dispositivos',
  microseguroVida: 'Microseguro de vida',
  parametrico: 'Paramétrico',
  proteccionPagos: 'Protección de pagos',
  vidaHipotecario: 'Vida hipotecario',
  web: 'Web',
  movil: 'Móvil',
  designSystem: 'Sistema de diseño',
  historias: 'Historias',
  paleta: 'Paleta',
  tipografia: 'Tipografía',
  componentes: 'Componentes',
  cuadricula: 'Cuadrícula',
};

const iconChoices: Choice[] = (Object.keys(icons) as IconName[]).map((id) => ({
  id,
  label: iconLabels[id],
}));

const iconColors: Choice[] = [
  { id: 'dark', label: 'Texto' },
  { id: 'gray', label: 'Gris' },
  { id: 'primary', label: 'Primario' },
  { id: 'secondary', label: 'Secundario' },
  { id: 'accent', label: 'Acento' },
  { id: 'warning', label: 'Advertencia' },
  { id: 'error', label: 'Error' },
  { id: 'onNavy', label: 'Sobre azul' },
  { id: 'onNavyMuted', label: 'Sobre azul tenue' },
];

const bannerVariants: Choice[] = [
  { id: 'success', label: 'Éxito' },
  { id: 'info', label: 'Información' },
  { id: 'warning', label: 'Advertencia' },
  { id: 'error', label: 'Error' },
];

const chipVariants: Choice[] = [
  { id: 'tag', label: 'Etiqueta' },
  { id: 'active', label: 'Activa' },
  { id: 'paid', label: 'Pagado' },
  { id: 'pending', label: 'Pendiente' },
];

const surfaceVariants: Choice[] = [
  { id: 'default', label: 'Predeterminada' },
  { id: 'inverse', label: 'Inversa' },
];

const indicatorTones: Choice[] = [
  { id: 'primary', label: 'Primario' },
  { id: 'secondary', label: 'Secundario' },
  { id: 'accent', label: 'Acento' },
];

function text(values: PlaygroundValues, key: string) {
  return String(values[key] ?? '');
}

function flag(values: PlaygroundValues, key: string) {
  return Boolean(values[key]);
}

export const catalog: PlaygroundItem[] = [
  {
    id: 'text',
    title: 'Texto',
    initial: { variant: 'body', text: 'Prima mensual' },
    fields: [
      { kind: 'choice', key: 'variant', label: 'Estilo', options: textVariants },
      { kind: 'text', key: 'text', label: 'Texto' },
    ],
    render: (values) => (
      <AppText variant={text(values, 'variant') as keyof typeof theme.type}>{text(values, 'text')}</AppText>
    ),
  },
  {
    id: 'button',
    title: 'Botón',
    initial: { title: 'Continuar', variant: 'primary', disabled: false, icon: '' },
    fields: [
      { kind: 'text', key: 'title', label: 'Título' },
      { kind: 'choice', key: 'variant', label: 'Variante', options: buttonVariants },
      { kind: 'switch', key: 'disabled', label: 'Deshabilitado' },
      {
        kind: 'choice',
        key: 'icon',
        label: 'Ícono',
        options: [
          { id: '', label: 'Ninguno' },
          { id: 'cotizacion', label: 'Cotización' },
          { id: 'camara', label: 'Cámara' },
          { id: 'exito', label: 'Éxito' },
          { id: 'enviar', label: 'Enviar' },
        ],
      },
    ],
    render: (values) => (
      <Button
        testID="component-preview"
        title={text(values, 'title')}
        variant={text(values, 'variant') as 'primary'}
        disabled={flag(values, 'disabled')}
        icon={text(values, 'icon') ? (text(values, 'icon') as IconName) : undefined}
      />
    ),
  },
  {
    id: 'icon',
    title: 'Ícono',
    initial: { name: 'polizas', size: '24', color: 'primary' },
    fields: [
      { kind: 'choice', key: 'name', label: 'Ícono', options: iconChoices },
      {
        kind: 'choice',
        key: 'size',
        label: 'Tamaño',
        options: [
          { id: '16', label: '16 px' },
          { id: '20', label: '20 px' },
          { id: '24', label: '24 px' },
          { id: '32', label: '32 px' },
        ],
      },
      { kind: 'choice', key: 'color', label: 'Color', options: iconColors },
    ],
    render: (values) => (
      <View
        style={
          text(values, 'color') === 'onNavy' || text(values, 'color') === 'onNavyMuted'
            ? { backgroundColor: theme.colors.navy, padding: theme.space.md }
            : undefined
        }
      >
        <Icon
          name={text(values, 'name') as IconName}
          size={Number(text(values, 'size')) as 16 | 20 | 24 | 32}
          color={text(values, 'color') as IconColor}
        />
      </View>
    ),
  },
  {
    id: 'banner',
    title: 'Aviso',
    initial: { variant: 'success', message: 'Tu póliza fue emitida', icon: 'exito' },
    fields: [
      { kind: 'choice', key: 'variant', label: 'Variante', options: bannerVariants },
      { kind: 'text', key: 'message', label: 'Mensaje' },
      {
        kind: 'choice',
        key: 'icon',
        label: 'Ícono',
        options: [
          { id: '', label: 'Ninguno' },
          { id: 'exito', label: 'Éxito' },
          { id: 'info', label: 'Información' },
          { id: 'advertencia', label: 'Advertencia' },
          { id: 'error', label: 'Error' },
          { id: 'sinConexion', label: 'Sin conexión' },
        ],
      },
    ],
    render: (values) => (
      <Banner
        variant={text(values, 'variant') as 'success'}
        icon={text(values, 'icon') ? (text(values, 'icon') as IconName) : undefined}
      >
        {text(values, 'message')}
      </Banner>
    ),
  },
  {
    id: 'card',
    title: 'Tarjeta',
    initial: { variant: 'default', text: 'Contenido de la tarjeta' },
    fields: [
      { kind: 'choice', key: 'variant', label: 'Variante', options: surfaceVariants },
      { kind: 'text', key: 'text', label: 'Texto' },
    ],
    render: (values) => (
      <Card variant={text(values, 'variant') as 'default'}>
        <AppText
          variant="body"
          style={text(values, 'variant') === 'inverse' ? { color: theme.colors.onNavy } : undefined}
        >
          {text(values, 'text')}
        </AppText>
      </Card>
    ),
  },
  {
    id: 'stat',
    title: 'Estadística',
    initial: { variant: 'default', label: 'Próxima prima', value: '$ 154.167', detail: 'Vence el 15 oct 2026' },
    fields: [
      { kind: 'choice', key: 'variant', label: 'Variante', options: surfaceVariants },
      { kind: 'text', key: 'label', label: 'Etiqueta' },
      { kind: 'text', key: 'value', label: 'Valor' },
      { kind: 'text', key: 'detail', label: 'Detalle' },
    ],
    render: (values) => (
      <Stat
        variant={text(values, 'variant') as 'default'}
        label={text(values, 'label')}
        value={text(values, 'value')}
        detail={text(values, 'detail')}
      />
    ),
  },
  {
    id: 'chip',
    title: 'Chip',
    initial: { variant: 'tag', label: 'En línea' },
    fields: [
      { kind: 'choice', key: 'variant', label: 'Variante', options: chipVariants },
      { kind: 'text', key: 'label', label: 'Texto' },
    ],
    render: (values) => (
      <StatusChip variant={text(values, 'variant') as 'tag'}>{text(values, 'label')}</StatusChip>
    ),
  },
  {
    id: 'indicator',
    title: 'Indicador',
    initial: { tone: 'primary', text: 'Principal' },
    fields: [
      { kind: 'choice', key: 'tone', label: 'Tono', options: indicatorTones },
      { kind: 'text', key: 'text', label: 'Texto' },
    ],
    render: (values) => (
      <Indicator tone={text(values, 'tone') as 'primary'}>{text(values, 'text')}</Indicator>
    ),
  },
  {
    id: 'switch',
    title: 'Interruptor',
    initial: { value: false },
    fields: [],
    render: (values, update) => (
      <Switch value={flag(values, 'value')} onValueChange={(value) => update('value', value)} />
    ),
  },
  {
    id: 'textField',
    title: 'Campo de texto',
    initial: { label: 'Nombre completo', value: '', required: true, error: false },
    fields: [
      { kind: 'text', key: 'label', label: 'Etiqueta' },
      { kind: 'switch', key: 'required', label: 'Obligatorio' },
      { kind: 'switch', key: 'error', label: 'Error' },
    ],
    render: (values, update) => (
      <TextField
        label={text(values, 'label')}
        value={text(values, 'value')}
        onChangeText={(value) => update('value', value)}
        required={flag(values, 'required')}
        error={flag(values, 'error')}
      />
    ),
  },
  {
    id: 'select',
    title: 'Selector',
    initial: { label: 'Destino', value: 'España', required: false, error: false },
    fields: [
      { kind: 'text', key: 'label', label: 'Etiqueta' },
      { kind: 'text', key: 'value', label: 'Valor' },
      { kind: 'switch', key: 'required', label: 'Obligatorio' },
      { kind: 'switch', key: 'error', label: 'Error' },
    ],
    render: (values, update) => (
      <SelectField
        label={text(values, 'label')}
        value={text(values, 'value')}
        options={[
          { value: 'España', label: 'España' },
          { value: 'México', label: 'México' },
          { value: 'Colombia', label: 'Colombia' },
        ]}
        onChange={(value) => update('value', value)}
        required={flag(values, 'required')}
        error={flag(values, 'error')}
      />
    ),
  },
  {
    id: 'date',
    title: 'Fecha',
    initial: { label: 'Fecha de salida', value: '10/10/2026', required: false, error: false, yearSelection: true, timeSelection: false },
    fields: [
      { kind: 'text', key: 'label', label: 'Etiqueta' },
      { kind: 'text', key: 'value', label: 'Valor' },
      { kind: 'switch', key: 'required', label: 'Obligatorio' },
      { kind: 'switch', key: 'error', label: 'Error' },
      { kind: 'switch', key: 'yearSelection', label: 'Elegir año' },
      { kind: 'switch', key: 'timeSelection', label: 'Elegir hora' },
    ],
    render: (values, update) => (
      <DateField
        label={text(values, 'label')}
        value={text(values, 'value')}
        onChange={(value) => update('value', value)}
        required={flag(values, 'required')}
        error={flag(values, 'error')}
        yearSelection={flag(values, 'yearSelection')}
        timeSelection={flag(values, 'timeSelection')}
      />
    ),
  },
  {
    id: 'checkbox',
    title: 'Casilla',
    initial: { label: 'Simular pago rechazado', checked: false, required: false, error: false },
    fields: [
      { kind: 'text', key: 'label', label: 'Etiqueta' },
      { kind: 'switch', key: 'required', label: 'Obligatorio' },
      { kind: 'switch', key: 'error', label: 'Error' },
    ],
    render: (values, update) => (
      <CheckboxField
        label={text(values, 'label')}
        checked={flag(values, 'checked')}
        onPress={() => update('checked', !flag(values, 'checked'))}
        required={flag(values, 'required')}
        error={flag(values, 'error')}
      />
    ),
  },
  {
    id: 'options',
    title: 'Lista de opciones',
    initial: { value: 'perito' },
    fields: [],
    render: (values, update) => (
      <OptionList
        options={[
          { id: 'grua', label: 'Grúa' },
          { id: 'ambulancia', label: 'Ambulancia' },
          { id: 'perito', label: 'Perito' },
        ]}
        value={text(values, 'value')}
        onChange={(id) => update('value', id)}
      />
    ),
  },
  {
    id: 'amount',
    title: 'Monto',
    initial: { value: '$ 149.940', align: 'left' },
    fields: [
      { kind: 'text', key: 'value', label: 'Valor' },
      {
        kind: 'choice',
        key: 'align',
        label: 'Alineación',
        options: [
          { id: 'left', label: 'Izquierda' },
          { id: 'center', label: 'Centro' },
        ],
      },
    ],
    render: (values) => <Amount value={text(values, 'value')} align={text(values, 'align') as 'left'} />,
  },
  {
    id: 'keyValue',
    title: 'Dato',
    initial: { label: 'Prima actual', value: '$ 420.000' },
    fields: [
      { kind: 'text', key: 'label', label: 'Etiqueta' },
      { kind: 'text', key: 'value', label: 'Valor' },
    ],
    render: (values) => <KeyValue label={text(values, 'label')} value={text(values, 'value')} />,
  },
  {
    id: 'coverage',
    title: 'Coberturas',
    initial: { items: 'Gastos médicos, Cancelación de viaje' },
    fields: [{ kind: 'text', key: 'items', label: 'Líneas' }],
    render: (values) => (
      <CoverageList items={text(values, 'items').split(',').map((item) => item.trim()).filter(Boolean)} />
    ),
  },
  {
    id: 'thumbnail',
    title: 'Miniatura',
    initial: { name: 'Foto 1', size: '1,6 MB' },
    fields: [
      { kind: 'text', key: 'name', label: 'Nombre' },
      { kind: 'text', key: 'size', label: 'Tamaño' },
    ],
    render: (values) => <Thumbnail name={text(values, 'name')} size={text(values, 'size')} />,
  },
];

export function findComponent(id: string) {
  return catalog.find((item) => item.id === id);
}

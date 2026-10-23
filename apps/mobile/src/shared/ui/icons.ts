// Each icon comes from its own file. The package index would put every Lucide icon in the bundle.
import { type LucideIcon } from 'lucide-react-native';
import Ambulance from 'lucide-react-native/icons/ambulance';
import Ban from 'lucide-react-native/icons/ban';
import Bell from 'lucide-react-native/icons/bell';
import Box from 'lucide-react-native/icons/box';
import Briefcase from 'lucide-react-native/icons/briefcase';
import Calculator from 'lucide-react-native/icons/calculator';
import Calendar from 'lucide-react-native/icons/calendar';
import Camera from 'lucide-react-native/icons/camera';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import CircleX from 'lucide-react-native/icons/circle-x';
import Clock from 'lucide-react-native/icons/clock';
import CloudRain from 'lucide-react-native/icons/cloud-rain';
import Code from 'lucide-react-native/icons/code';
import CreditCard from 'lucide-react-native/icons/credit-card';
import FileExclamationPoint from 'lucide-react-native/icons/file-exclamation-point';
import FileText from 'lucide-react-native/icons/file-text';
import Funnel from 'lucide-react-native/icons/funnel';
import Heart from 'lucide-react-native/icons/heart';
import House from 'lucide-react-native/icons/house';
import HouseHeart from 'lucide-react-native/icons/house-heart';
import Info from 'lucide-react-native/icons/info';
import Key from 'lucide-react-native/icons/key';
import Layers from 'lucide-react-native/icons/layers';
import LayoutGrid from 'lucide-react-native/icons/layout-grid';
import Lock from 'lucide-react-native/icons/lock';
import MapPin from 'lucide-react-native/icons/map-pin';
import Menu from 'lucide-react-native/icons/menu';
import Monitor from 'lucide-react-native/icons/monitor';
import Notebook from 'lucide-react-native/icons/notebook';
import Palette from 'lucide-react-native/icons/palette';
import Pause from 'lucide-react-native/icons/pause';
import Pencil from 'lucide-react-native/icons/pencil';
import Plane from 'lucide-react-native/icons/plane';
import Play from 'lucide-react-native/icons/play';
import Plus from 'lucide-react-native/icons/plus';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import RotateCcw from 'lucide-react-native/icons/rotate-ccw';
import Search from 'lucide-react-native/icons/search';
import Settings from 'lucide-react-native/icons/settings';
import Send from 'lucide-react-native/icons/send';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import ShoppingBag from 'lucide-react-native/icons/shopping-bag';
import Smartphone from 'lucide-react-native/icons/smartphone';
import Trash from 'lucide-react-native/icons/trash';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import Truck from 'lucide-react-native/icons/truck';
import Type from 'lucide-react-native/icons/type';
import User from 'lucide-react-native/icons/user';
import UserCheck from 'lucide-react-native/icons/user-check';
import Users from 'lucide-react-native/icons/users';
import Video from 'lucide-react-native/icons/video';
import Wallet from 'lucide-react-native/icons/wallet';
import Wifi from 'lucide-react-native/icons/wifi';
import WifiOff from 'lucide-react-native/icons/wifi-off';
import Wrench from 'lucide-react-native/icons/wrench';
import X from 'lucide-react-native/icons/x';

export const icons = {
  inicio: House,
  polizas: ShieldCheck,
  siniestros: FileExclamationPoint,
  comprar: ShoppingBag,
  operaciones: Briefcase,
  socios: Users,
  menu: Menu,
  volver: ChevronLeft,
  siguiente: ChevronRight,
  desplegar: ChevronDown,
  cerrar: X,
  buscar: Search,
  filtro: Funnel,
  agregar: Plus,
  editar: Pencil,
  cancelar: Ban,
  eliminar: Trash,
  enviar: Send,
  camara: Camera,
  video: Video,
  reproducir: Play,
  pausar: Pause,
  repetir: RotateCcw,
  sincronizar: RefreshCw,
  exito: CircleCheck,
  info: Info,
  advertencia: TriangleAlert,
  error: CircleX,
  pendiente: Clock,
  enLinea: Wifi,
  sinConexion: WifiOff,
  notificacion: Bell,
  cotizacion: Calculator,
  pago: CreditCard,
  documento: FileText,
  consentimiento: Lock,
  credencial: Key,
  api: Code,
  ubicacion: MapPin,
  grua: Truck,
  taller: Wrench,
  ajustes: Settings,
  ambulancia: Ambulance,
  perito: UserCheck,
  calendario: Calendar,
  usuario: User,
  viaje: Plane,
  dispositivos: Smartphone,
  microseguroVida: Heart,
  parametrico: CloudRain,
  proteccionPagos: Wallet,
  vidaHipotecario: HouseHeart,
  web: Monitor,
  movil: Smartphone,
  designSystem: Layers,
  historias: Notebook,
  paleta: Palette,
  tipografia: Type,
  componentes: Box,
  cuadricula: LayoutGrid,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

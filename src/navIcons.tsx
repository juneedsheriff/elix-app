import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Upload,
  Users,
  UserCircle,
  Video,
  CreditCard,
  Repeat,
  Bell,
  Clock,
  Sparkles,
  Settings,
  ClipboardList,
  Calendar,
  BarChart3,
  ShieldAlert,
  FileText,
  ScrollText,
  FolderOpen,
  User,
  Siren,
  HeartPulse,
  Globe,
  Moon,
  Sun,
  Menu,
  X,
  Mail,
  Lock,
  KeyRound,
  Activity,
  Star,
  Wallet
} from 'lucide-react';

export const SCREEN_ICONS: Record<string, LucideIcon> = {
  'patient-dashboard': LayoutDashboard,
  'upload-records': Upload,
  'doctor-list': Users,
  'doctor-profile': UserCircle,
  payments: CreditCard,
  subscriptions: Repeat,
  notifications: Bell,
  timeline: Clock,
  'ai-insights': Sparkles,
  'my-requests': ClipboardList,
  settings: Settings,
  'doctor-dashboard': LayoutDashboard,
  'case-review': ClipboardList,
  availability: Calendar,
  'doctor-analytics': BarChart3,
  'admin-dashboard': LayoutDashboard,
  'user-management': Users,
  'fraud-monitoring': ShieldAlert,
  'admin-analytics': BarChart3,
  cms: FileText,
  audit: ScrollText
};

export const BOTTOM_TAB_ICONS = {
  upload: Upload,
  records: FolderOpen,
  askAI: Sparkles,
  profile: User
} as const;

export const ONBOARDING_ICONS = [Upload, Users, Video] as const;

export {
  Activity,
  Bell,
  Clock,
  HeartPulse,
  Globe,
  Moon,
  Sun,
  Menu,
  X,
  Mail,
  Lock,
  KeyRound,
  Siren,
  Star,
  Upload,
  FolderOpen,
  Sparkles,
  User,
  ShieldAlert,
  Wallet
} from 'lucide-react';

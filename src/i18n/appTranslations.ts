export type Language = 'en' | 'es' | 'ar';
export type Role = 'patient' | 'doctor' | 'admin';

export const LANGUAGES: Language[] = ['en', 'es', 'ar'];

export const LANGUAGE_OPTIONS: { code: Language; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'es', label: 'Spanish', native: 'Español' },
  { code: 'ar', label: 'Arabic', native: 'العربية' }
];

export function nextLanguage(current: Language): Language {
  const index = LANGUAGES.indexOf(current);
  return LANGUAGES[(index + 1) % LANGUAGES.length]!;
}

type NavLabels = Record<string, string>;

type AppCopy = {
  welcome: string;
  tagline: string;
  continue: string;
  skip: string;
  getStarted: string;
  signIn: string;
  emergency: string;
  upload: string;
  profile: string;
  records: string;
  askAI: string;
  dashboard: string;
  patient: string;
  doctor: string;
  admin: string;
  patientTab: string;
  doctorTab: string;
  doctorSignIn: string;
  signInAsDoctor: string;
  signInAsPatient: string;
  createPatientAccount: string;
  fullNamePlaceholder: string;
  connected: string;
  languageLabel: string;
  chooseLanguage: string;
  close: string;
  nav: Record<Role, NavLabels>;
  bottom: {
    home: string;
    cases: string;
    schedule: string;
    users: string;
    stats: string;
    requests: string;
  };
  onboard: { title: string; body: string }[];
};

export const TRANSLATIONS: Record<Language, AppCopy> = {
  en: {
    welcome: 'Second Opinion Doctor',
    tagline: 'Global second opinions with trusted specialists.',
    continue: 'Continue',
    skip: 'Skip',
    getStarted: 'Get Started',
    signIn: 'Sign in to your secure health workspace',
    emergency: 'Emergency',
    upload: 'Upload',
    profile: 'Profile',
    records: 'Records',
    askAI: 'Ask AI',
    dashboard: 'Dashboard',
    patient: 'Patient',
    doctor: 'Doctor',
    admin: 'Admin',
    patientTab: 'Patient',
    doctorTab: 'Doctor',
    doctorSignIn: 'Doctor sign in',
    signInAsDoctor: 'Sign in as doctor',
    signInAsPatient: 'Sign in as patient',
    createPatientAccount: 'Create patient account',
    fullNamePlaceholder: 'Full name (for new accounts)',
    connected: 'Supabase connected',
    languageLabel: 'Language',
    chooseLanguage: 'Choose language',
    close: 'Close',
    nav: {
      patient: {
        'patient-dashboard': 'Dashboard',
        'upload-records': 'Upload Records',
        'my-requests': 'My Requests',
        'doctor-list': 'Doctors',
        payments: 'Payments',
        subscriptions: 'Subscriptions',
        notifications: 'Notifications',
        timeline: 'Reports Timeline',
        'ai-insights': 'AI Insights',
        settings: 'Settings'
      },
      doctor: {
        'doctor-dashboard': 'Dashboard',
        'case-review': 'Incoming Requests',
        availability: 'Availability',
        'doctor-analytics': 'Performance',
        settings: 'Settings'
      },
      admin: {
        'admin-dashboard': 'Dashboard',
        'user-management': 'User Management',
        'fraud-monitoring': 'Fraud Monitoring',
        'admin-analytics': 'Analytics',
        cms: 'CMS',
        audit: 'Audit Logs',
        settings: 'Settings'
      }
    },
    bottom: { home: 'Home', cases: 'Cases', schedule: 'Schedule', users: 'Users', stats: 'Stats', requests: 'Requests' },
    onboard: [
      {
        title: 'Upload once, share globally',
        body: 'Encrypted records vault with OCR, AI summaries, and multilingual medical translation.'
      },
      {
        title: 'Verified specialists network',
        body: 'Cross-border experts with licenses, KYC checks, ratings, and success metrics.'
      },
      {
        title: 'Consult anywhere, anytime',
        body: 'Video/audio/chat consultations, e-prescriptions, wallet, and emergency routing.'
      }
    ]
  },
  es: {
    welcome: 'Second Opinion Doctor',
    tagline: 'Segundas opiniones globales con especialistas confiables.',
    continue: 'Continuar',
    skip: 'Omitir',
    getStarted: 'Comenzar',
    signIn: 'Inicia sesión en tu espacio de salud seguro',
    emergency: 'Emergencia',
    upload: 'Subir',
    profile: 'Perfil',
    records: 'Historial',
    askAI: 'Preguntar a IA',
    dashboard: 'Panel',
    patient: 'Paciente',
    doctor: 'Médico',
    admin: 'Administrador',
    patientTab: 'Paciente',
    doctorTab: 'Médico',
    doctorSignIn: 'Inicio médico',
    signInAsDoctor: 'Entrar como médico',
    signInAsPatient: 'Entrar como paciente',
    createPatientAccount: 'Crear cuenta de paciente',
    fullNamePlaceholder: 'Nombre completo (cuenta nueva)',
    connected: 'Supabase conectado',
    languageLabel: 'Idioma',
    chooseLanguage: 'Elegir idioma',
    close: 'Cerrar',
    nav: {
      patient: {
        'patient-dashboard': 'Panel',
        'upload-records': 'Subir registros',
        'my-requests': 'Mis solicitudes',
        'doctor-list': 'Médicos',
        payments: 'Pagos',
        subscriptions: 'Suscripciones',
        notifications: 'Notificaciones',
        timeline: 'Línea de informes',
        'ai-insights': 'Perspectivas IA',
        settings: 'Ajustes'
      },
      doctor: {
        'doctor-dashboard': 'Panel',
        'case-review': 'Solicitudes',
        availability: 'Disponibilidad',
        'doctor-analytics': 'Rendimiento',
        settings: 'Ajustes'
      },
      admin: {
        'admin-dashboard': 'Panel',
        'user-management': 'Usuarios',
        'fraud-monitoring': 'Fraude',
        'admin-analytics': 'Analítica',
        cms: 'CMS',
        audit: 'Auditoría',
        settings: 'Ajustes'
      }
    },
    bottom: { home: 'Inicio', cases: 'Casos', schedule: 'Agenda', users: 'Usuarios', stats: 'Estadísticas', requests: 'Solicitudes' },
    onboard: [
      {
        title: 'Sube una vez, comparte en todo el mundo',
        body: 'Bóveda cifrada con OCR, resúmenes con IA y traducción médica multilingüe.'
      },
      {
        title: 'Red de especialistas verificados',
        body: 'Expertos internacionales con licencias, KYC, valoraciones y métricas de éxito.'
      },
      {
        title: 'Consulta en cualquier lugar',
        body: 'Video/audio/chat, recetas electrónicas, monedero y rutas de emergencia.'
      }
    ]
  },
  ar: {
    welcome: 'Second Opinion Doctor',
    tagline: 'آراء طبية ثانية عالمية مع أطباء موثوقين.',
    continue: 'متابعة',
    skip: 'تخطي',
    getStarted: 'ابدأ',
    signIn: 'سجّل الدخول إلى مساحة الرعاية الصحية الآمنة',
    emergency: 'طوارئ',
    upload: 'رفع',
    profile: 'الملف',
    records: 'السجلات',
    askAI: 'اسأل الذكاء',
    dashboard: 'لوحة التحكم',
    patient: 'مريض',
    doctor: 'طبيب',
    admin: 'مسؤول',
    patientTab: 'مريض',
    doctorTab: 'طبيب',
    doctorSignIn: 'تسجيل دخول الطبيب',
    signInAsDoctor: 'دخول كطبيب',
    signInAsPatient: 'دخول كمريض',
    createPatientAccount: 'إنشاء حساب مريض',
    fullNamePlaceholder: 'الاسم الكامل (حساب جديد)',
    connected: 'Supabase متصل',
    languageLabel: 'اللغة',
    chooseLanguage: 'اختر اللغة',
    close: 'إغلاق',
    nav: {
      patient: {
        'patient-dashboard': 'لوحة التحكم',
        'upload-records': 'رفع السجلات',
        'my-requests': 'طلباتي',
        'doctor-list': 'الأطباء',
        payments: 'المدفوعات',
        subscriptions: 'الاشتراكات',
        notifications: 'الإشعارات',
        timeline: 'الجدول الزمني',
        'ai-insights': 'رؤى الذكاء',
        settings: 'الإعدادات'
      },
      doctor: {
        'doctor-dashboard': 'لوحة التحكم',
        'case-review': 'الطلبات الواردة',
        availability: 'التوفر',
        'doctor-analytics': 'الأداء',
        settings: 'الإعدادات'
      },
      admin: {
        'admin-dashboard': 'لوحة التحكم',
        'user-management': 'إدارة المستخدمين',
        'fraud-monitoring': 'مراقبة الاحتيال',
        'admin-analytics': 'التحليلات',
        cms: 'CMS',
        audit: 'سجلات التدقيق',
        settings: 'الإعدادات'
      }
    },
    bottom: { home: 'الرئيسية', cases: 'الحالات', schedule: 'الجدول', users: 'المستخدمون', stats: 'إحصائيات', requests: 'الطلبات' },
    onboard: [
      {
        title: 'ارفع مرة واحدة وشارك عالمياً',
        body: 'خزنة مشفرة مع OCR وملخصات ذكاء اصطناعي وترجمة طبية متعددة اللغات.'
      },
      {
        title: 'شبكة أطباء موثوقين',
        body: 'خبراء دوليون بتراخيص وفحص KYC وتقييمات ومؤشرات نجاح.'
      },
      {
        title: 'استشر في أي مكان',
        body: 'فيديو/صوت/دردشة ووصفات إلكترونية ومحفظة ومسارات طوارئ.'
      }
    ]
  }
};

const NAV_IDS: Record<Role, string[]> = {
  patient: [
    'patient-dashboard',
    'upload-records',
    'my-requests',
    'doctor-list',
    'payments',
    'subscriptions',
    'notifications',
    'timeline',
    'ai-insights',
    'settings'
  ],
  doctor: ['doctor-dashboard', 'case-review', 'availability', 'doctor-analytics', 'settings'],
  admin: ['admin-dashboard', 'user-management', 'fraud-monitoring', 'admin-analytics', 'cms', 'audit', 'settings']
};

export function getNavItems(role: Role, language: Language) {
  const labels = TRANSLATIONS[language].nav[role];
  return NAV_IDS[role].map((id) => ({ id, label: labels[id] ?? id }));
}

export function roleLabel(language: Language, role: Role): string {
  const t = TRANSLATIONS[language];
  if (role === 'doctor') return t.doctor;
  if (role === 'admin') return t.admin;
  return t.patient;
}

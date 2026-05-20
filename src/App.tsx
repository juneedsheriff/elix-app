import { useEffect, useMemo, useState, type ReactNode } from 'react';

type Role = 'patient' | 'doctor' | 'admin';
type Theme = 'light' | 'dark';
type Stage = 'splash' | 'onboarding' | 'auth' | 'app';
type Language = 'en' | 'es' | 'ar';

type NavItem = {
  id: string;
  label: string;
};

const NAV_ITEMS: Record<Role, NavItem[]> = {
  patient: [
    { id: 'patient-dashboard', label: 'Dashboard' },
    { id: 'upload-records', label: 'Upload Records' },
    { id: 'doctor-list', label: 'Doctors' },
    { id: 'doctor-profile', label: 'Doctor Profile' },
    { id: 'consultation', label: 'Consultation' },
    { id: 'chat', label: 'Chat' },
    { id: 'video', label: 'Video Call' },
    { id: 'payments', label: 'Payments' },
    { id: 'subscriptions', label: 'Subscriptions' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'timeline', label: 'Reports Timeline' },
    { id: 'ai-insights', label: 'AI Insights' },
    { id: 'settings', label: 'Settings' }
  ],
  doctor: [
    { id: 'doctor-dashboard', label: 'Doctor Dashboard' },
    { id: 'case-review', label: 'Incoming Requests' },
    { id: 'availability', label: 'Availability' },
    { id: 'consultation', label: 'Consultations' },
    { id: 'chat', label: 'Patient Chat' },
    { id: 'doctor-analytics', label: 'Performance' },
    { id: 'settings', label: 'Settings' }
  ],
  admin: [
    { id: 'admin-dashboard', label: 'Admin Dashboard' },
    { id: 'user-management', label: 'User Management' },
    { id: 'fraud-monitoring', label: 'Fraud Monitoring' },
    { id: 'admin-analytics', label: 'Analytics' },
    { id: 'cms', label: 'CMS' },
    { id: 'audit', label: 'Audit Logs' },
    { id: 'settings', label: 'Settings' }
  ]
};

const TRANSLATIONS: Record<Language, Record<string, string>> = {
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
    askAI: 'Ask AI'
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
    askAI: 'Preguntar a IA'
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
    askAI: 'اسأل الذكاء'
  }
};

function MetricCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <article className='metric-card'>
      <span>{title}</span>
      <h3>{value}</h3>
      <p>{subtitle}</p>
    </article>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className='section-card'>
      <div className='section-head'>
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Tag({ label }: { label: string }) {
  return <span className='tag'>{label}</span>;
}

function ScreenContent({ screenId }: { screenId: string }) {
  if (screenId === 'patient-dashboard') {
    return (
      <div className='screen-grid'>
        <SectionCard title='Patient Command Center' subtitle='Track every opinion request in one place'>
          <div className='metrics-grid'>
            <MetricCard title='Open requests' value='4' subtitle='2 urgent, 2 standard' />
            <MetricCard title='Doctor replies' value='7' subtitle='Average 6.2 hours' />
            <MetricCard title='Wallet balance' value='$420' subtitle='Supports Stripe & Razorpay' />
            <MetricCard title='Satisfaction score' value='98%' subtitle='From 142 patient reviews' />
          </div>
        </SectionCard>
        <SectionCard title='AI Case Summary' subtitle='Auto-generated from uploaded records'>
          <p className='muted'>
            AI extracted a probable endocrine pattern and suggests consulting an endocrinologist and nephrologist.
            Reports were translated from French to English and symptom clusters were timeline-mapped.
          </p>
          <div className='tag-row'>
            <Tag label='Symptom extraction' />
            <Tag label='Medical translation' />
            <Tag label='Specialist recommendation' />
            <Tag label='Timeline generation' />
          </div>
        </SectionCard>
        <SectionCard title='Upcoming schedule' subtitle='Global timezone aware appointments'>
          <ul className='list'>
            <li>
              <strong>Dr. A. Menon (Cardiology)</strong>
              <span>Today, 17:30 GST • Video consultation</span>
            </li>
            <li>
              <strong>Dr. Elena Rossi (Neurology)</strong>
              <span>Tomorrow, 12:00 CET • Follow-up review</span>
            </li>
          </ul>
        </SectionCard>
      </div>
    );
  }

  if (screenId === 'upload-records') {
    return (
      <div className='screen-grid'>
        <SectionCard title='Medical records vault' subtitle='HIPAA and GDPR compliant encrypted storage'>
          <div className='dropzone'>
            <h4>Drag and drop files here</h4>
            <p>Supports PDF, MRI/X-ray, lab reports, image scans, voice notes, and camera scans.</p>
            <button className='primary-btn'>Select files</button>
          </div>
          <div className='feature-row'>
            <Tag label='Multi-file upload' />
            <Tag label='OCR extraction' />
            <Tag label='Voice transcription' />
            <Tag label='Auto categorization' />
          </div>
        </SectionCard>
        <SectionCard title='Recent uploads'>
          <ul className='list'>
            <li>
              <strong>MRI Brain Report.pdf</strong>
              <span>Uploaded 12 mins ago • AI summary ready</span>
            </li>
            <li>
              <strong>Blood Panel - March 2026.jpg</strong>
              <span>Uploaded 1 day ago • Translated to English</span>
            </li>
          </ul>
        </SectionCard>
      </div>
    );
  }

  if (screenId === 'doctor-list' || screenId === 'doctor-profile') {
    return (
      <div className='screen-grid'>
        <SectionCard title='Verified doctor network' subtitle='Filter by specialty, language, country, and fee'>
          <div className='doctor-grid'>
            <article className='doctor-card'>
              <h4>Dr. Sarah Mitchell</h4>
              <p>Oncology • 16 years • Mayo Clinic affiliate</p>
              <div className='tag-row'>
                <Tag label='4.9 rating' />
                <Tag label='English/Spanish' />
                <Tag label='$120' />
              </div>
            </article>
            <article className='doctor-card'>
              <h4>Dr. Rajeev Nair</h4>
              <p>Cardiology • 13 years • Apollo Hospitals</p>
              <div className='tag-row'>
                <Tag label='4.8 rating' />
                <Tag label='English/Hindi' />
                <Tag label='$95' />
              </div>
            </article>
          </div>
        </SectionCard>
        <SectionCard title='Doctor profile details'>
          <p className='muted'>
            Includes KYC verification status, licenses, degrees, success metrics, patient reviews, and specialist
            case outcomes.
          </p>
        </SectionCard>
      </div>
    );
  }

  if (screenId === 'consultation' || screenId === 'chat' || screenId === 'video') {
    return (
      <div className='screen-grid'>
        <SectionCard title='Consultation workspace' subtitle='Video, audio, secure chat, and e-prescription in one flow'>
          <div className='consultation-layout'>
            <div className='chat-pane'>
              <strong>Secure Chat</strong>
              <p>Patient: Can this medication interact with metformin?</p>
              <p>Doctor: No direct conflict, but monitor blood sugar and hydration levels.</p>
            </div>
            <div className='video-pane'>
              <strong>Video room (Agora/Twilio)</strong>
              <p>Adaptive bitrate, recording consent, encrypted streams.</p>
              <button className='primary-btn'>Start secure call</button>
            </div>
          </div>
        </SectionCard>
        <SectionCard title='Prescription and follow-up'>
          <ul className='list'>
            <li>
              <strong>Rx-22091.pdf</strong>
              <span>Shared securely • 30 day medication plan</span>
            </li>
            <li>
              <strong>Follow-up requested</strong>
              <span>7 days after treatment response check</span>
            </li>
          </ul>
        </SectionCard>
      </div>
    );
  }

  if (screenId === 'payments' || screenId === 'subscriptions') {
    return (
      <div className='screen-grid'>
        <SectionCard title='Global payments' subtitle='Stripe + Razorpay with wallet, coupons, and subscriptions'>
          <div className='metrics-grid'>
            <MetricCard title='Last payment' value='$140' subtitle='Visa ending 2242' />
            <MetricCard title='Wallet credits' value='$75' subtitle='Referral + loyalty bonus' />
            <MetricCard title='Active plan' value='Family Plus' subtitle='4 members, AI copilot included' />
            <MetricCard title='Discounts' value='3 coupons' subtitle='2 expiring this month' />
          </div>
        </SectionCard>
        <SectionCard title='Billing history'>
          <ul className='list'>
            <li>
              <strong>CONSULT-2026-0912</strong>
              <span>Neurology second opinion • Paid via Stripe</span>
            </li>
            <li>
              <strong>SUB-2026-0044</strong>
              <span>Quarterly subscription • Paid via Razorpay</span>
            </li>
          </ul>
        </SectionCard>
      </div>
    );
  }

  if (screenId === 'notifications') {
    return (
      <SectionCard title='Notifications center' subtitle='Push, SMS, and Email orchestration'>
        <ul className='list'>
          <li>
            <strong>Appointment reminder</strong>
            <span>Dr. Rossi in 2 hours • Push + SMS sent</span>
          </li>
          <li>
            <strong>AI summary updated</strong>
            <span>3 translated reports added to timeline</span>
          </li>
          <li>
            <strong>Prescription available</strong>
            <span>Secure download enabled for 72 hours</span>
          </li>
        </ul>
      </SectionCard>
    );
  }

  if (screenId === 'timeline' || screenId === 'ai-insights') {
    return (
      <div className='screen-grid'>
        <SectionCard title='Medical timeline + AI insights' subtitle='Chronological, searchable, multilingual history'>
          <div className='timeline'>
            <div>
              <strong>Mar 11</strong>
              <p>Lab report uploaded, OCR complete, symptom extraction generated.</p>
            </div>
            <div>
              <strong>Mar 14</strong>
              <p>Second opinion from cardiology: recommend additional echocardiogram.</p>
            </div>
            <div>
              <strong>Mar 16</strong>
              <p>AI recommendation engine matched top endocrinology specialists in UK and India.</p>
            </div>
          </div>
        </SectionCard>
        <SectionCard title='AI assistant' subtitle='Ask contextual questions across your records'>
          <p className='muted'>
            "What changed between my two blood reports?" • "Translate this MRI note to Arabic" • "Prepare questions for
            my next consultation"
          </p>
          <button className='primary-btn'>Open AI health assistant</button>
        </SectionCard>
      </div>
    );
  }

  if (screenId === 'doctor-dashboard' || screenId === 'case-review' || screenId === 'doctor-analytics') {
    return (
      <div className='screen-grid'>
        <SectionCard title='Doctor operating console' subtitle='Prioritize urgent cases and maximize quality outcomes'>
          <div className='metrics-grid'>
            <MetricCard title='Pending reviews' value='12' subtitle='3 urgent oncology cases' />
            <MetricCard title='Monthly earnings' value='$12,480' subtitle='Across 96 consultations' />
            <MetricCard title='Avg response time' value='2h 14m' subtitle='Top 5% globally' />
            <MetricCard title='Patient rating' value='4.92' subtitle='From 380 verified reviews' />
          </div>
        </SectionCard>
        <SectionCard title='Case queue'>
          <ul className='list'>
            <li>
              <strong>Case #SO-22021 • Cardiology</strong>
              <span>Urgent • 4 files • AI triage complete</span>
            </li>
            <li>
              <strong>Case #SO-22011 • Neurology</strong>
              <span>Standard • Follow-up video requested</span>
            </li>
          </ul>
        </SectionCard>
      </div>
    );
  }

  if (screenId === 'availability') {
    return (
      <SectionCard title='Availability and global scheduling' subtitle='Timezone-smart calendar with slot automation'>
        <div className='metrics-grid'>
          <MetricCard title='Next open slot' value='14:30 UTC' subtitle='Automatically synced to patient timezone' />
          <MetricCard title='Booked this week' value='27' subtitle='11 video, 16 async reviews' />
        </div>
      </SectionCard>
    );
  }

  if (screenId === 'admin-dashboard' || screenId === 'admin-analytics') {
    return (
      <div className='screen-grid'>
        <SectionCard title='Platform operations dashboard' subtitle='Revenue, compliance, growth, and quality in real-time'>
          <div className='metrics-grid'>
            <MetricCard title='Total users' value='182K' subtitle='Patients across 42 countries' />
            <MetricCard title='Verified doctors' value='5,620' subtitle='License and KYC validated' />
            <MetricCard title='Active consultations' value='1,448' subtitle='Across chat, audio, and video' />
            <MetricCard title='MRR' value='$2.3M' subtitle='12.2% growth MoM' />
          </div>
        </SectionCard>
        <SectionCard title='Country-wise activity'>
          <div className='bar-chart'>
            <div style={{ width: '82%' }}>India 82%</div>
            <div style={{ width: '71%' }}>United States 71%</div>
            <div style={{ width: '54%' }}>UAE 54%</div>
            <div style={{ width: '49%' }}>UK 49%</div>
          </div>
        </SectionCard>
      </div>
    );
  }

  if (screenId === 'user-management' || screenId === 'fraud-monitoring') {
    return (
      <div className='screen-grid'>
        <SectionCard title='Admin controls' subtitle='Verify doctors, moderate content, resolve disputes'>
          <ul className='list'>
            <li>
              <strong>Doctor verification queue</strong>
              <span>41 licenses pending manual validation</span>
            </li>
            <li>
              <strong>Fraud alerts</strong>
              <span>6 suspicious payment flows flagged by AI risk engine</span>
            </li>
            <li>
              <strong>Support tickets</strong>
              <span>112 open tickets • SLA 96% on target</span>
            </li>
          </ul>
        </SectionCard>
      </div>
    );
  }

  if (screenId === 'cms' || screenId === 'audit') {
    return (
      <SectionCard title='CMS and audit center' subtitle='Manage healthcare content, legal pages, and audit trails'>
        <ul className='list'>
          <li>
            <strong>CMS</strong>
            <span>Blogs, FAQ, health articles, and campaign notifications.</span>
          </li>
          <li>
            <strong>Audit logs</strong>
            <span>Immutable event streams for HIPAA/GDPR and SOC2 controls.</span>
          </li>
        </ul>
      </SectionCard>
    );
  }

  if (screenId === 'settings') {
    return (
      <div className='screen-grid'>
        <SectionCard title='Security and privacy settings' subtitle='Enterprise healthcare-grade controls'>
          <div className='feature-row'>
            <Tag label='2FA enabled' />
            <Tag label='Role-based access' />
            <Tag label='Encrypted storage' />
            <Tag label='Consent tracking' />
            <Tag label='Data residency controls' />
          </div>
        </SectionCard>
        <SectionCard title='Profile'>
          <p className='muted'>
            Includes personal details, blood group, allergies, medications, emergency contacts, family account members,
            insurance details, and language preferences.
          </p>
        </SectionCard>
      </div>
    );
  }

  return (
    <SectionCard title='No data yet' subtitle='Beautiful empty state'>
      <p className='muted'>Nothing to show on this screen right now.</p>
    </SectionCard>
  );
}

function App() {
  const [theme, setTheme] = useState<Theme>('light');
  const [role, setRole] = useState<Role>('patient');
  const [stage, setStage] = useState<Stage>('splash');
  const [language, setLanguage] = useState<Language>('en');
  const [activeScreen, setActiveScreen] = useState<string>(NAV_ITEMS.patient[0].id);

  const copy = useMemo(() => TRANSLATIONS[language], [language]);
  const navItems = NAV_ITEMS[role];

  useEffect(() => {
    setActiveScreen(NAV_ITEMS[role][0].id);
  }, [role]);

  useEffect(() => {
    if (stage !== 'splash') return;
    const timeout = window.setTimeout(() => setStage('onboarding'), 1700);
    return () => window.clearTimeout(timeout);
  }, [stage]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <main className='app'>
      {stage === 'splash' ? (
        <section className='splash'>
          <div className='logo-badge'>SOD</div>
          <h1>{copy.welcome}</h1>
          <p>{copy.tagline}</p>
        </section>
      ) : null}

      {stage === 'onboarding' ? (
        <section className='auth-stage'>
          <h1>{copy.welcome}</h1>
          <p>{copy.tagline}</p>
          <div className='onboard-grid'>
            <article>
              <h3>Upload once, share globally</h3>
              <p>Encrypted records vault with OCR, AI summaries, and multilingual medical translation.</p>
            </article>
            <article>
              <h3>Verified specialists network</h3>
              <p>Cross-border experts with licenses, KYC checks, ratings, and success metrics.</p>
            </article>
            <article>
              <h3>Consult anywhere, anytime</h3>
              <p>Video/audio/chat consultations, e-prescriptions, wallet, and emergency routing.</p>
            </article>
          </div>
          <div className='row'>
            <button className='secondary-btn' onClick={() => setStage('auth')}>
              {copy.skip}
            </button>
            <button className='primary-btn' onClick={() => setStage('auth')}>
              {copy.continue}
            </button>
          </div>
        </section>
      ) : null}

      {stage === 'auth' ? (
        <section className='auth-stage'>
          <h2>{copy.signIn}</h2>
          <div className='auth-form'>
            <input type='email' placeholder='Email address' aria-label='Email address' />
            <input type='password' placeholder='Password' aria-label='Password' />
            <div className='otp-row'>
              <input type='text' placeholder='OTP' aria-label='OTP verification' />
              <button className='secondary-btn'>Verify OTP</button>
            </div>
            <button className='primary-btn'>{copy.getStarted}</button>
            <div className='social-row'>
              <button className='secondary-btn'>Google Login</button>
              <button className='secondary-btn'>Apple Login</button>
            </div>
            <button className='text-btn'>Forgot password?</button>
          </div>
          <button className='primary-btn wide' onClick={() => setStage('app')}>
            Enter Platform
          </button>
        </section>
      ) : null}

      {stage === 'app' ? (
        <section className='workspace'>
          <header className='topbar'>
            <div>
              <h1>{copy.welcome}</h1>
              <p>Healthcare-grade second opinion platform</p>
            </div>
            <div className='topbar-controls'>
              <select value={role} onChange={(event) => setRole(event.target.value as Role)} aria-label='Role selector'>
                <option value='patient'>Patient</option>
                <option value='doctor'>Doctor</option>
                <option value='admin'>Admin</option>
              </select>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as Language)}
                aria-label='Language selector'
              >
                <option value='en'>EN</option>
                <option value='es'>ES</option>
                <option value='ar'>AR</option>
              </select>
              <button className='secondary-btn' onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
                {theme === 'light' ? 'Dark mode' : 'Light mode'}
              </button>
            </div>
          </header>

          <div className='layout'>
            <nav className='sidebar'>
              {navItems.map((item) => (
                <button
                  key={item.id}
                  className={`nav-btn ${item.id === activeScreen ? 'active' : ''}`}
                  onClick={() => setActiveScreen(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <section className='content-area'>
              <ScreenContent screenId={activeScreen} />
            </section>
          </div>

          <nav className='bottom-nav'>
            <button>{copy.upload}</button>
            <button>{copy.records}</button>
            <button>{copy.askAI}</button>
            <button>{copy.profile}</button>
          </nav>

          <button className='fab'>{copy.emergency}</button>
        </section>
      ) : null}
    </main>
  );
}

export default App;

import { useEffect, useMemo, useState } from 'react';
import { adminMetrics, doctorMetrics, doctors, notifications, opinionRequests, patientMetrics, patientProfile, records, timelineEvents } from './data/mockData';
import { AppButton, BarChart, Card, Chip, EmptyState, MetricCard, SectionTitle } from './components/ui';
import { Role, ThemeMode } from './types';

const patientScreens = [
  { id: 'splash', label: 'Splash' },
  { id: 'onboarding', label: 'Onboarding' },
  { id: 'auth', label: 'Login / Signup' },
  { id: 'dashboard', label: 'Patient Dashboard' },
  { id: 'upload', label: 'Upload Medical Records' },
  { id: 'doctors', label: 'Doctor Listing' },
  { id: 'doctorProfile', label: 'Doctor Profile' },
  { id: 'consultation', label: 'Consultation' },
  { id: 'chat', label: 'Chat' },
  { id: 'video', label: 'Video Consultation' },
  { id: 'payment', label: 'Payment' },
  { id: 'subscription', label: 'Subscription' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'settings', label: 'Settings' },
  { id: 'timeline', label: 'Reports Timeline' },
  { id: 'ai', label: 'AI Insights' },
] as const;

const doctorViews = ['onboarding', 'dashboard', 'availability', 'profile'] as const;
const adminViews = ['dashboard', 'controls', 'analytics', 'cms'] as const;

function App() {
  const [role, setRole] = useState<Role>('patient');
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [patientScreen, setPatientScreen] = useState<(typeof patientScreens)[number]['id']>('dashboard');
  const [doctorView, setDoctorView] = useState<(typeof doctorViews)[number]>('dashboard');
  const [adminView, setAdminView] = useState<(typeof adminViews)[number]>('dashboard');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const roleSubtitle = useMemo(() => {
    if (role === 'patient') return 'Global second opinions in a calm, secure, mobile-first experience.';
    if (role === 'doctor') return 'Healthcare expert workspace with KYC, triage, and outcome analytics.';
    return 'Enterprise admin command center with compliance-grade governance.';
  }, [role]);

  return (
    <div className="app-shell">
      <div className="bg-blur bg-blur-one" />
      <div className="bg-blur bg-blur-two" />
      <header className="top-header">
        <div>
          <p className="eyebrow">Second Opinion Doctor</p>
          <h1>AI-powered global second-opinion platform</h1>
          <span>{roleSubtitle}</span>
        </div>
        <div className="header-actions">
          <AppButton variant="secondary">Emergency Consult</AppButton>
          <button className="theme-toggle" onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}>
            {theme === 'light' ? 'Dark mode' : 'Light mode'}
          </button>
        </div>
      </header>

      <main className="workspace">
        <aside className="role-panel">
          <SectionTitle title="Personas" subtitle="Patient • Doctor • Admin" />
          <div className="role-buttons">
            {(['patient', 'doctor', 'admin'] as Role[]).map((item) => (
              <button
                key={item}
                className={`role-button ${role === item ? 'role-button-active' : ''}`}
                onClick={() => setRole(item)}
              >
                {item.toUpperCase()}
              </button>
            ))}
          </div>

          <Card title="Security & Compliance" subtitle="HIPAA + GDPR + enterprise security">
            <div className="stack">
              <Chip tone="success">AES-256 encrypted storage</Chip>
              <Chip tone="info">RBAC for patient/doctor/admin</Chip>
              <Chip tone="warning">SOC-style audit trails</Chip>
              <Chip tone="neutral">2FA, OTP, SSO, biometrics ready</Chip>
            </div>
          </Card>

          <Card title="Design DNA" subtitle="Practo x Stripe x Linear polish">
            <ul className="clean-list">
              <li>Healthcare gradients and trust-centric white space</li>
              <li>Rounded premium cards and enterprise typography</li>
              <li>Motion-driven micro interactions and clarity-first UX</li>
            </ul>
          </Card>
        </aside>

        <section className="content-panel">
          {role === 'patient' && (
            <PatientExperience selected={patientScreen} onChange={setPatientScreen} />
          )}
          {role === 'doctor' && <DoctorExperience selected={doctorView} onChange={setDoctorView} />}
          {role === 'admin' && <AdminExperience selected={adminView} onChange={setAdminView} />}
        </section>
      </main>
    </div>
  );
}

function PatientExperience({
  selected,
  onChange,
}: {
  selected: (typeof patientScreens)[number]['id'];
  onChange: (screen: (typeof patientScreens)[number]['id']) => void;
}) {
  const selectedDoctor = doctors[0];

  return (
    <div className="experience">
      <SectionTitle
        title="Patient Super App"
        subtitle="Cross-platform mobile-first flow with AI, payments, video and multilingual support."
        action={<AppButton>Book Second Opinion</AppButton>}
      />

      <div className="pill-scroll">
        {patientScreens.map((screen) => (
          <button
            key={screen.id}
            className={`pill ${selected === screen.id ? 'pill-active' : ''}`}
            onClick={() => onChange(screen.id)}
          >
            {screen.label}
          </button>
        ))}
      </div>

      {selected === 'splash' && (
        <Card title="Splash Screen" subtitle="Healthcare-grade first impression">
          <div className="splash-card">
            <h2>Second Opinion Doctor</h2>
            <p>Trusted doctors worldwide. Secure records. Answers in hours, not weeks.</p>
            <Chip tone="info">HIPAA-ready encrypted platform</Chip>
          </div>
        </Card>
      )}

      {selected === 'onboarding' && (
        <Card title="Onboarding" subtitle="Guided setup with family accounts and insurance">
          <div className="grid-two">
            <article className="mini-card">
              <h4>Step 1: Create account</h4>
              <p>Email/Google/Apple signup with OTP and 2FA bootstrap.</p>
            </article>
            <article className="mini-card">
              <h4>Step 2: Health profile</h4>
              <p>Collect age, blood group, medications, allergies and history.</p>
            </article>
            <article className="mini-card">
              <h4>Step 3: Upload records</h4>
              <p>PDF, scans, MRI, X-ray and voice notes with camera scan support.</p>
            </article>
            <article className="mini-card">
              <h4>Step 4: Get matched</h4>
              <p>AI recommends specialists with timezone-aligned availability.</p>
            </article>
          </div>
        </Card>
      )}

      {selected === 'auth' && (
        <Card title="Authentication" subtitle="Email, Google, Apple, OTP, password recovery">
          <div className="grid-two">
            <article className="auth-panel">
              <label>Email</label>
              <input value="ava@example.com" readOnly />
              <label>Password</label>
              <input value="••••••••••" readOnly />
              <div className="inline">
                <AppButton>Login</AppButton>
                <AppButton variant="secondary">Forgot password</AppButton>
              </div>
            </article>
            <article className="auth-panel">
              <h4>Instant sign in options</h4>
              <div className="stack">
                <AppButton variant="secondary">Continue with Google</AppButton>
                <AppButton variant="secondary">Continue with Apple</AppButton>
                <AppButton variant="ghost">Verify via OTP</AppButton>
              </div>
            </article>
          </div>
        </Card>
      )}

      {selected === 'dashboard' && (
        <>
          <div className="metric-grid">
            {patientMetrics.map((metric) => (
              <MetricCard key={metric.label} {...metric} />
            ))}
          </div>
          <div className="grid-two">
            <Card title="Current requests" subtitle="Track status, responses and follow-up">
              <div className="stack">
                {opinionRequests.map((request) => (
                  <article className="list-row" key={request.id}>
                    <div>
                      <h4>{request.specialty}</h4>
                      <p>
                        {request.id} • {request.doctor}
                      </p>
                    </div>
                    <div className="stack-end">
                      <Chip tone={request.urgency === 'urgent' ? 'danger' : 'info'}>{request.urgency}</Chip>
                      <small>{request.status.replace('_', ' ')}</small>
                    </div>
                  </article>
                ))}
              </div>
            </Card>
            <Card title="Profile snapshot" subtitle="Global patient profile and health metadata">
              <ul className="clean-list">
                <li>Name: {patientProfile.name}</li>
                <li>Age: {patientProfile.age}</li>
                <li>Gender: {patientProfile.gender}</li>
                <li>Country: {patientProfile.country}</li>
                <li>Blood group: {patientProfile.bloodGroup}</li>
                <li>Allergies: {patientProfile.allergies.join(', ')}</li>
                <li>Current meds: {patientProfile.medications.join(', ')}</li>
              </ul>
            </Card>
          </div>
        </>
      )}

      {selected === 'upload' && (
        <Card title="Medical record upload" subtitle="Drag-drop, camera scan, OCR extraction and AI tagging">
          <div className="upload-zone">
            <p>Drop PDF, MRI/X-ray, labs, scans or voice notes</p>
            <div className="inline">
              <AppButton>Select Files</AppButton>
              <AppButton variant="secondary">Camera Scan</AppButton>
              <AppButton variant="ghost">Record Voice Note</AppButton>
            </div>
          </div>
          <div className="stack">
            {records.map((record) => (
              <article className="list-row" key={record.id}>
                <div>
                  <h4>{record.title}</h4>
                  <p>
                    {record.type.toUpperCase()} • {record.size} • {record.uploadedAt}
                  </p>
                </div>
                <Chip tone={record.status === 'processing' ? 'warning' : 'success'}>{record.status}</Chip>
              </article>
            ))}
          </div>
        </Card>
      )}

      {selected === 'doctors' && (
        <Card title="Doctor listing" subtitle="AI-ranked specialists with language and timezone matching">
          <div className="grid-two">
            {doctors.map((doctor) => (
              <article className="mini-card" key={doctor.id}>
                <h4>{doctor.name}</h4>
                <p>{doctor.specialty}</p>
                <p>
                  {doctor.country} • {doctor.languages.join(', ')}
                </p>
                <p>
                  Rating {doctor.rating} • {doctor.experienceYears} years
                </p>
                <div className="inline">
                  <Chip tone="success">{doctor.successRate}% success</Chip>
                  <Chip tone="info">${doctor.fee}</Chip>
                </div>
              </article>
            ))}
          </div>
        </Card>
      )}

      {selected === 'doctorProfile' && (
        <Card title={selectedDoctor.name} subtitle="Profile, credentials, ratings, fee and outcomes">
          <div className="grid-two">
            <ul className="clean-list">
              <li>Specialty: {selectedDoctor.specialty}</li>
              <li>Languages: {selectedDoctor.languages.join(', ')}</li>
              <li>Experience: {selectedDoctor.experienceYears} years</li>
              <li>Consultation fee: ${selectedDoctor.fee}</li>
              <li>Success metrics: {selectedDoctor.successRate}% positive outcomes</li>
            </ul>
            <div className="stack">
              <AppButton>Request Second Opinion</AppButton>
              <AppButton variant="secondary">Schedule Video Consultation</AppButton>
              <AppButton variant="ghost">View medical license</AppButton>
            </div>
          </div>
        </Card>
      )}

      {selected === 'consultation' && (
        <Card title="Consultation request" subtitle="Specialty, urgency, symptoms, questions and attachments">
          <div className="grid-two">
            <article className="mini-card">
              <h4>Case form</h4>
              <ul className="clean-list">
                <li>Specialty: Cardiology</li>
                <li>Urgency: Urgent (under 6h SLA)</li>
                <li>Symptoms: chest pain, fatigue, shortness of breath</li>
                <li>Question: Is angiography immediately required?</li>
              </ul>
            </article>
            <article className="mini-card">
              <h4>Attachments</h4>
              <p>3 reports linked. AI summary and symptom extraction added automatically.</p>
              <div className="inline">
                <Chip tone="info">Video requested</Chip>
                <Chip tone="success">Translation enabled</Chip>
              </div>
            </article>
          </div>
        </Card>
      )}

      {selected === 'chat' && (
        <Card title="Secure chat" subtitle="Encrypted messaging, voice notes, prescriptions and follow-ups">
          <div className="chat-window">
            <p className="bubble bubble-doctor">
              Doctor: I reviewed the MRI. Please schedule a follow-up video consult within 24h.
            </p>
            <p className="bubble bubble-patient">
              Patient: Can I continue current medication until consultation?
            </p>
            <p className="bubble bubble-doctor">
              Doctor: Yes, continue. I have shared an interim prescription and alert notes.
            </p>
          </div>
          <div className="inline">
            <AppButton variant="secondary">Attach report</AppButton>
            <AppButton variant="secondary">Send voice note</AppButton>
            <AppButton>Send secure message</AppButton>
          </div>
        </Card>
      )}

      {selected === 'video' && (
        <Card title="Video consultation" subtitle="Low-latency global calls with in-session notes">
          <div className="video-stage">
            <div className="video-tile">Doctor Live Feed</div>
            <div className="video-tile">Patient Preview</div>
          </div>
          <div className="inline">
            <Chip tone="success">Agora / Twilio compatible</Chip>
            <Chip tone="info">Realtime transcription enabled</Chip>
            <Chip tone="warning">Recording consent required</Chip>
          </div>
        </Card>
      )}

      {selected === 'payment' && (
        <Card title="Payments" subtitle="Stripe, Razorpay, coupons, wallet and international support">
          <div className="grid-two">
            <article className="mini-card">
              <h4>Checkout</h4>
              <p>Case SO-1204 • Cardiology second opinion</p>
              <p>Doctor fee: $220</p>
              <p>Platform fee: $18</p>
              <h3>Total: $238</h3>
            </article>
            <article className="mini-card">
              <h4>Methods</h4>
              <ul className="clean-list">
                <li>Stripe cards + wallets</li>
                <li>Razorpay UPI / netbanking</li>
                <li>Insurance copay integration</li>
              </ul>
              <AppButton>Pay now</AppButton>
            </article>
          </div>
        </Card>
      )}

      {selected === 'subscription' && (
        <Card title="Subscription plans" subtitle="Personal, family and enterprise care bundles">
          <div className="grid-three">
            {['Starter', 'Family+', 'Global Priority'].map((plan, idx) => (
              <article className="mini-card" key={plan}>
                <h4>{plan}</h4>
                <p>{idx === 0 ? '$29/mo' : idx === 1 ? '$79/mo' : '$149/mo'}</p>
                <ul className="clean-list">
                  <li>Unlimited record storage</li>
                  <li>AI timeline and translation</li>
                  <li>Priority specialist matching</li>
                </ul>
              </article>
            ))}
          </div>
        </Card>
      )}

      {selected === 'notifications' && (
        <Card title="Notifications center" subtitle="Push, SMS, email and appointment reminders">
          <div className="stack">
            {notifications.map((item) => (
              <article className="list-row" key={item.id}>
                <div>
                  <h4>{item.title}</h4>
                  <p>{item.message}</p>
                </div>
                <div className="stack-end">
                  <Chip tone="info">{item.channel.toUpperCase()}</Chip>
                  <small>{item.timestamp}</small>
                </div>
              </article>
            ))}
          </div>
        </Card>
      )}

      {selected === 'settings' && (
        <Card title="Settings" subtitle="Accessibility, language, family profiles and security controls">
          <div className="grid-two">
            <article className="mini-card">
              <h4>Account controls</h4>
              <ul className="clean-list">
                <li>Two-factor authentication: Enabled</li>
                <li>Biometric unlock: Enabled</li>
                <li>Data export for GDPR requests</li>
                <li>Family member access control</li>
              </ul>
            </article>
            <article className="mini-card">
              <h4>Preferences</h4>
              <ul className="clean-list">
                <li>Language: English + Spanish</li>
                <li>Realtime translation: Enabled</li>
                <li>Voice transcription: Enabled</li>
                <li>Emergency mode shortcut: Enabled</li>
              </ul>
            </article>
          </div>
        </Card>
      )}

      {selected === 'timeline' && (
        <Card title="Medical reports timeline" subtitle="Chronological patient history with AI milestones">
          <div className="timeline">
            {timelineEvents.map((event) => (
              <article className="timeline-item" key={event.date + event.title}>
                <span>{event.date}</span>
                <div>
                  <h4>{event.title}</h4>
                  <p>{event.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </Card>
      )}

      {selected === 'ai' && (
        <div className="grid-two">
          <Card title="AI insights" subtitle="Summary, symptom extraction and recommendation engine">
            <ul className="clean-list">
              <li>Clinical summary confidence: 96%</li>
              <li>Detected symptom clusters: Cardiovascular + endocrine overlap</li>
              <li>Recommended specialty: Interventional Cardiology</li>
              <li>Suggested urgency: 6-hour window</li>
              <li>Translated languages available: 42</li>
            </ul>
          </Card>
          <Card title="AI assistant chatbot" subtitle="Guided Q&A and care journey support">
            <EmptyState
              title="Ask anything about your report"
              detail="The assistant provides contextual guidance, not final diagnosis, and escalates to a doctor when risk is high."
              action={<AppButton variant="secondary">Open AI assistant</AppButton>}
            />
          </Card>
        </div>
      )}

      <nav className="bottom-nav">
        <button onClick={() => onChange('dashboard')}>Home</button>
        <button onClick={() => onChange('upload')}>Records</button>
        <button onClick={() => onChange('doctors')}>Doctors</button>
        <button onClick={() => onChange('chat')}>Chat</button>
        <button onClick={() => onChange('ai')}>AI</button>
      </nav>
      <button className="fab" onClick={() => onChange('consultation')}>
        +
      </button>
    </div>
  );
}

function DoctorExperience({
  selected,
  onChange,
}: {
  selected: (typeof doctorViews)[number];
  onChange: (screen: (typeof doctorViews)[number]) => void;
}) {
  return (
    <div className="experience">
      <SectionTitle
        title="Doctor Workspace"
        subtitle="KYC onboarding, triage queue, global scheduling, tele-consult workflows."
        action={<AppButton>New Availability Slot</AppButton>}
      />
      <div className="pill-scroll">
        {doctorViews.map((view) => (
          <button key={view} className={`pill ${selected === view ? 'pill-active' : ''}`} onClick={() => onChange(view)}>
            {view}
          </button>
        ))}
      </div>

      {selected === 'dashboard' && (
        <>
          <div className="metric-grid">
            {doctorMetrics.map((metric) => (
              <MetricCard key={metric.label} {...metric} />
            ))}
          </div>
          <div className="grid-two">
            <Card title="Incoming requests" subtitle="Prioritized by urgency and fit score">
              <div className="stack">
                {opinionRequests.map((request) => (
                  <article className="list-row" key={request.id}>
                    <div>
                      <h4>{request.specialty}</h4>
                      <p>{request.id} • Requested by patient in UK</p>
                    </div>
                    <div className="inline">
                      <AppButton variant="secondary">Reject</AppButton>
                      <AppButton>Accept</AppButton>
                    </div>
                  </article>
                ))}
              </div>
            </Card>
            <Card title="Doctor analytics" subtitle="Case quality and patient outcomes">
              <BarChart
                items={[
                  { label: 'Response SLA', value: 96, highlight: true },
                  { label: 'Patient Satisfaction', value: 94 },
                  { label: 'Follow-up Closure', value: 91 },
                  { label: 'Prescription Accuracy', value: 97, highlight: true },
                ]}
              />
            </Card>
          </div>
        </>
      )}

      {selected === 'onboarding' && (
        <Card title="Doctor onboarding" subtitle="KYC + license + specialization verification">
          <div className="grid-two">
            <article className="mini-card">
              <h4>Verification checklist</h4>
              <ul className="clean-list">
                <li>Identity KYC document upload</li>
                <li>Medical license verification</li>
                <li>Degree and certification documents</li>
                <li>Hospital affiliation confirmation</li>
              </ul>
            </article>
            <article className="mini-card">
              <h4>Profile setup</h4>
              <ul className="clean-list">
                <li>Specializations and treatment domains</li>
                <li>Consultation fees by region</li>
                <li>Timezone-aware availability matrix</li>
                <li>Languages and telehealth preferences</li>
              </ul>
            </article>
          </div>
        </Card>
      )}

      {selected === 'availability' && (
        <Card title="Availability manager" subtitle="Global calendar slots with timezone intelligence">
          <div className="grid-two">
            <article className="mini-card">
              <h4>This week</h4>
              <p>Tue 09:00-12:00 UTC</p>
              <p>Wed 14:00-18:00 UTC</p>
              <p>Fri 07:00-11:00 UTC</p>
            </article>
            <article className="mini-card">
              <h4>Booking settings</h4>
              <ul className="clean-list">
                <li>Auto-convert across patient timezone</li>
                <li>Emergency consult override</li>
                <li>Slot type: video/audio/written opinion</li>
              </ul>
            </article>
          </div>
        </Card>
      )}

      {selected === 'profile' && (
        <Card title="Doctor profile" subtitle="Public profile shown to global patients">
          <div className="grid-two">
            <article className="mini-card">
              <h4>Expertise</h4>
              <p>Interventional cardiology and critical care treatment planning.</p>
              <p>Languages: English, Spanish</p>
            </article>
            <article className="mini-card">
              <h4>Performance</h4>
              <p>Rating 4.92 with 4,800+ reviews.</p>
              <p>Case success: 97% with 11-hour average turnaround.</p>
            </article>
          </div>
        </Card>
      )}
    </div>
  );
}

function AdminExperience({
  selected,
  onChange,
}: {
  selected: (typeof adminViews)[number];
  onChange: (screen: (typeof adminViews)[number]) => void;
}) {
  return (
    <div className="experience">
      <SectionTitle
        title="Admin SaaS Control Tower"
        subtitle="Operations, fraud controls, subscriptions, CMS and compliance monitoring."
        action={<AppButton variant="secondary">Export Audit Log</AppButton>}
      />
      <div className="pill-scroll">
        {adminViews.map((view) => (
          <button key={view} className={`pill ${selected === view ? 'pill-active' : ''}`} onClick={() => onChange(view)}>
            {view}
          </button>
        ))}
      </div>

      {selected === 'dashboard' && (
        <>
          <div className="metric-grid">
            {adminMetrics.map((metric) => (
              <MetricCard key={metric.label} {...metric} />
            ))}
          </div>
          <div className="grid-two">
            <Card title="Platform analytics" subtitle="Country usage, revenue and care quality">
              <BarChart
                items={[
                  { label: 'North America', value: 88, highlight: true },
                  { label: 'Europe', value: 79 },
                  { label: 'Middle East', value: 66 },
                  { label: 'Asia Pacific', value: 84, highlight: true },
                ]}
              />
            </Card>
            <Card title="Fraud & risk monitoring" subtitle="Behavioral signals and transaction controls">
              <ul className="clean-list">
                <li>High-risk payment attempts: 0.04%</li>
                <li>Suspicious account clusters auto-flagged: 14</li>
                <li>Realtime moderation queue SLA: 6 min</li>
                <li>Audit event ingestion: 1.2M events/day</li>
              </ul>
            </Card>
          </div>
        </>
      )}

      {selected === 'controls' && (
        <Card title="Admin controls" subtitle="Doctors, accounts, disputes, subscriptions and moderation">
          <div className="grid-two">
            <article className="mini-card">
              <h4>Verification and trust</h4>
              <ul className="clean-list">
                <li>Doctor license verification queue</li>
                <li>Account suspension and appeal workflows</li>
                <li>Content moderation with escalation ladders</li>
              </ul>
            </article>
            <article className="mini-card">
              <h4>Revenue operations</h4>
              <ul className="clean-list">
                <li>Stripe/Razorpay settlement controls</li>
                <li>Coupon and subscription policy manager</li>
                <li>Dispute resolution and refund automation</li>
              </ul>
            </article>
          </div>
        </Card>
      )}

      {selected === 'analytics' && (
        <Card title="Admin analytics" subtitle="Doctor performance, patient satisfaction, AI insight KPIs">
          <div className="grid-three">
            <article className="mini-card">
              <h4>Doctor performance</h4>
              <p>Median response time: 9.6h</p>
              <p>Top specialty: Cardiology</p>
            </article>
            <article className="mini-card">
              <h4>Patient satisfaction</h4>
              <p>NPS: +71</p>
              <p>CSAT: 4.8 / 5</p>
            </article>
            <article className="mini-card">
              <h4>AI quality</h4>
              <p>Summary confidence mean: 93%</p>
              <p>Escalation precision: 96%</p>
            </article>
          </div>
        </Card>
      )}

      {selected === 'cms' && (
        <Card title="CMS and communication center" subtitle="Blogs, FAQs, articles, legal and alerts">
          <div className="grid-two">
            <article className="mini-card">
              <h4>Content modules</h4>
              <ul className="clean-list">
                <li>Healthcare blog editor</li>
                <li>FAQ knowledge base manager</li>
                <li>Terms/privacy versioning and release notes</li>
              </ul>
            </article>
            <article className="mini-card">
              <h4>Notification campaigns</h4>
              <p>Send policy updates, feature launches and country-specific advisories.</p>
              <AppButton>Create campaign</AppButton>
            </article>
          </div>
        </Card>
      )}
    </div>
  );
}

export default App;

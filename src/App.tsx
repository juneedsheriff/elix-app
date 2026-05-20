import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';

type Role = 'patient' | 'doctor' | 'admin';
type Theme = 'light' | 'dark';
type Stage = 'splash' | 'auth' | 'app';

type Credential = {
  role: Role;
  email: string;
  password: string;
  label: string;
};

type TabItem = {
  id: string;
  label: string;
  icon: string;
};

type Session = {
  role: Role;
  email: string;
};

type Doctor = {
  id: string;
  name: string;
  email: string;
  country: 'Canada' | 'USA' | 'UK' | 'Australia';
  city: string;
  specialty: string;
  experience: number;
  rating: number;
  fee: number;
  image: string;
  bio: string;
  hospital: string;
};

type UploadedRecord = {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadedAt: string;
};

type ChatMessage = {
  id: string;
  sender: 'patient' | 'doctor';
  text: string;
  timestamp: string;
};

type OpinionRequest = {
  id: string;
  doctorId: string;
  doctorName: string;
  patientEmail: string;
  symptoms: string;
  question: string;
  recordIds: string[];
  status: 'submitted' | 'in-review' | 'responded';
  createdAt: string;
  messages: ChatMessage[];
};

type PatientProfile = {
  name: string;
  age: string;
  gender: string;
  country: string;
  bloodGroup: string;
  medicalHistory: string;
  allergies: string;
  medications: string;
};

const CREDENTIALS: Credential[] = [
  { role: 'patient', email: 'patient@elix.app', password: 'Elix@123', label: 'Patient' },
  { role: 'doctor', email: 'doctor@elix.app', password: 'Elix@123', label: 'Doctor' },
  { role: 'admin', email: 'admin@elix.app', password: 'Admin@123', label: 'Admin' }
];

const PATIENT_TABS: TabItem[] = [
  { id: 'dashboard', label: 'Home', icon: 'HM' },
  { id: 'upload', label: 'Upload', icon: 'UP' },
  { id: 'doctors', label: 'Doctors', icon: 'DR' },
  { id: 'requests', label: 'Requests', icon: 'RQ' },
  { id: 'chat', label: 'Chat', icon: 'CH' },
  { id: 'profile', label: 'Profile', icon: 'ME' }
];

const DOCTOR_TABS: TabItem[] = [
  { id: 'dashboard', label: 'Home', icon: 'HM' },
  { id: 'requests', label: 'Requests', icon: 'RQ' },
  { id: 'chat', label: 'Chat', icon: 'CH' },
  { id: 'profile', label: 'Profile', icon: 'DR' }
];

const ADMIN_TABS: TabItem[] = [
  { id: 'dashboard', label: 'Home', icon: 'HM' },
  { id: 'doctors', label: 'Doctors', icon: 'DR' },
  { id: 'requests', label: 'Requests', icon: 'RQ' },
  { id: 'metrics', label: 'Metrics', icon: 'AN' }
];

const DOC_TYPES = ['X-Ray', 'ECG', 'MRI', 'Lab Report', 'Prescription', 'Discharge Summary', 'Other'];

const DOCTORS: Doctor[] = [
  {
    id: 'dr-01',
    name: 'Dr. Mia Harper',
    email: 'doctor@elix.app',
    country: 'Canada',
    city: 'Toronto',
    specialty: 'Cardiology',
    experience: 14,
    rating: 4.9,
    fee: 160,
    image: 'https://i.pravatar.cc/200?img=12',
    bio: 'Specialist in preventive cardiology and ECG interpretation.',
    hospital: 'Toronto General Hospital'
  },
  {
    id: 'dr-02',
    name: 'Dr. Lucas Ford',
    email: 'doctor02@elix.app',
    country: 'Canada',
    city: 'Vancouver',
    specialty: 'Neurology',
    experience: 11,
    rating: 4.8,
    fee: 175,
    image: 'https://i.pravatar.cc/200?img=15',
    bio: 'Focused on stroke management and neurological second opinions.',
    hospital: 'Vancouver General Hospital'
  },
  {
    id: 'dr-03',
    name: 'Dr. Nora Singh',
    email: 'doctor03@elix.app',
    country: 'Canada',
    city: 'Montreal',
    specialty: 'Oncology',
    experience: 16,
    rating: 4.9,
    fee: 190,
    image: 'https://i.pravatar.cc/200?img=20',
    bio: 'Expert in treatment planning for complex oncology cases.',
    hospital: 'Jewish General Hospital'
  },
  {
    id: 'dr-04',
    name: 'Dr. Evan Clark',
    email: 'doctor04@elix.app',
    country: 'Canada',
    city: 'Calgary',
    specialty: 'Orthopedics',
    experience: 10,
    rating: 4.7,
    fee: 145,
    image: 'https://i.pravatar.cc/200?img=60',
    bio: 'Leads musculoskeletal trauma and imaging-based opinions.',
    hospital: 'Foothills Medical Centre'
  },
  {
    id: 'dr-05',
    name: 'Dr. Chloe Adams',
    email: 'doctor05@elix.app',
    country: 'Canada',
    city: 'Ottawa',
    specialty: 'Endocrinology',
    experience: 13,
    rating: 4.8,
    fee: 155,
    image: 'https://i.pravatar.cc/200?img=47',
    bio: 'Specialized in diabetes and thyroid complex case review.',
    hospital: 'The Ottawa Hospital'
  },
  {
    id: 'dr-06',
    name: 'Dr. James Patel',
    email: 'doctor06@elix.app',
    country: 'USA',
    city: 'New York',
    specialty: 'Cardiology',
    experience: 18,
    rating: 4.9,
    fee: 220,
    image: 'https://i.pravatar.cc/200?img=64',
    bio: 'International consultant for high-risk cardiac second opinions.',
    hospital: 'Mount Sinai Hospital'
  },
  {
    id: 'dr-07',
    name: 'Dr. Sophia Reed',
    email: 'doctor07@elix.app',
    country: 'USA',
    city: 'Boston',
    specialty: 'Pulmonology',
    experience: 12,
    rating: 4.8,
    fee: 180,
    image: 'https://i.pravatar.cc/200?img=23',
    bio: 'Known for respiratory diagnostics and critical care reviews.',
    hospital: 'Massachusetts General Hospital'
  },
  {
    id: 'dr-08',
    name: 'Dr. Liam Brooks',
    email: 'doctor08@elix.app',
    country: 'USA',
    city: 'Chicago',
    specialty: 'Gastroenterology',
    experience: 15,
    rating: 4.8,
    fee: 170,
    image: 'https://i.pravatar.cc/200?img=70',
    bio: 'Delivers concise treatment paths for complex GI cases.',
    hospital: 'Northwestern Memorial Hospital'
  },
  {
    id: 'dr-09',
    name: 'Dr. Grace Morgan',
    email: 'doctor09@elix.app',
    country: 'USA',
    city: 'San Francisco',
    specialty: 'Neurology',
    experience: 17,
    rating: 4.9,
    fee: 210,
    image: 'https://i.pravatar.cc/200?img=31',
    bio: 'Subspecialist in migraines, seizures, and cognitive conditions.',
    hospital: 'UCSF Medical Center'
  },
  {
    id: 'dr-10',
    name: 'Dr. Noah Diaz',
    email: 'doctor10@elix.app',
    country: 'USA',
    city: 'Seattle',
    specialty: 'Nephrology',
    experience: 9,
    rating: 4.7,
    fee: 150,
    image: 'https://i.pravatar.cc/200?img=67',
    bio: 'Renal disease and electrolyte disorder opinion specialist.',
    hospital: 'UW Medical Center'
  },
  {
    id: 'dr-11',
    name: 'Dr. Amelia Price',
    email: 'doctor11@elix.app',
    country: 'UK',
    city: 'London',
    specialty: 'Oncology',
    experience: 19,
    rating: 4.9,
    fee: 205,
    image: 'https://i.pravatar.cc/200?img=44',
    bio: 'Multi-disciplinary cancer review consultant.',
    hospital: 'The Royal Marsden'
  },
  {
    id: 'dr-12',
    name: 'Dr. Benjamin Cole',
    email: 'doctor12@elix.app',
    country: 'UK',
    city: 'Manchester',
    specialty: 'Cardiology',
    experience: 14,
    rating: 4.8,
    fee: 185,
    image: 'https://i.pravatar.cc/200?img=51',
    bio: 'Focused on heart failure and structural heart reviews.',
    hospital: 'Manchester Royal Infirmary'
  },
  {
    id: 'dr-13',
    name: 'Dr. Isla Cooper',
    email: 'doctor13@elix.app',
    country: 'UK',
    city: 'Birmingham',
    specialty: 'Dermatology',
    experience: 10,
    rating: 4.7,
    fee: 140,
    image: 'https://i.pravatar.cc/200?img=9',
    bio: 'Second opinions for complex chronic skin disorders.',
    hospital: 'Queen Elizabeth Hospital Birmingham'
  },
  {
    id: 'dr-14',
    name: 'Dr. Arthur Lewis',
    email: 'doctor14@elix.app',
    country: 'UK',
    city: 'Leeds',
    specialty: 'Orthopedics',
    experience: 13,
    rating: 4.8,
    fee: 165,
    image: 'https://i.pravatar.cc/200?img=36',
    bio: 'Reviews imaging for spine and sports injury management.',
    hospital: 'Leeds General Infirmary'
  },
  {
    id: 'dr-15',
    name: 'Dr. Zoe Turner',
    email: 'doctor15@elix.app',
    country: 'UK',
    city: 'Edinburgh',
    specialty: 'Endocrinology',
    experience: 12,
    rating: 4.8,
    fee: 150,
    image: 'https://i.pravatar.cc/200?img=25',
    bio: 'Specialized in endocrine and metabolic second opinions.',
    hospital: 'Royal Infirmary of Edinburgh'
  },
  {
    id: 'dr-16',
    name: 'Dr. Oliver White',
    email: 'doctor16@elix.app',
    country: 'Australia',
    city: 'Sydney',
    specialty: 'Cardiology',
    experience: 15,
    rating: 4.9,
    fee: 195,
    image: 'https://i.pravatar.cc/200?img=68',
    bio: 'Heart rhythm and ECG-focused international consultant.',
    hospital: 'Royal Prince Alfred Hospital'
  },
  {
    id: 'dr-17',
    name: 'Dr. Ruby Carter',
    email: 'doctor17@elix.app',
    country: 'Australia',
    city: 'Melbourne',
    specialty: 'Pediatrics',
    experience: 11,
    rating: 4.7,
    fee: 155,
    image: 'https://i.pravatar.cc/200?img=55',
    bio: 'Pediatric specialist for chronic condition second opinions.',
    hospital: "Royal Children's Hospital"
  },
  {
    id: 'dr-18',
    name: 'Dr. Henry Watson',
    email: 'doctor18@elix.app',
    country: 'Australia',
    city: 'Brisbane',
    specialty: 'Pulmonology',
    experience: 10,
    rating: 4.7,
    fee: 150,
    image: 'https://i.pravatar.cc/200?img=65',
    bio: 'Respiratory medicine expert for COPD and asthma cases.',
    hospital: 'Princess Alexandra Hospital'
  },
  {
    id: 'dr-19',
    name: 'Dr. Lily Bell',
    email: 'doctor19@elix.app',
    country: 'Australia',
    city: 'Perth',
    specialty: 'Neurology',
    experience: 14,
    rating: 4.8,
    fee: 180,
    image: 'https://i.pravatar.cc/200?img=33',
    bio: 'Neuroimaging and treatment decision support consultant.',
    hospital: 'Fiona Stanley Hospital'
  },
  {
    id: 'dr-20',
    name: 'Dr. Mason Ross',
    email: 'doctor20@elix.app',
    country: 'Australia',
    city: 'Adelaide',
    specialty: 'Nephrology',
    experience: 12,
    rating: 4.8,
    fee: 160,
    image: 'https://i.pravatar.cc/200?img=71',
    bio: 'Advanced kidney care and chronic disease second opinions.',
    hospital: 'Royal Adelaide Hospital'
  }
];

const INITIAL_RECORDS: UploadedRecord[] = [
  {
    id: 'rec-1',
    name: 'chest_xray_march.pdf',
    type: 'X-Ray',
    size: '1.2 MB',
    uploadedAt: 'Today, 09:40'
  },
  {
    id: 'rec-2',
    name: 'ecg_report_latest.png',
    type: 'ECG',
    size: '0.9 MB',
    uploadedAt: 'Today, 09:45'
  }
];

const INITIAL_REQUESTS: OpinionRequest[] = [
  {
    id: 'REQ-1001',
    doctorId: 'dr-01',
    doctorName: 'Dr. Mia Harper',
    patientEmail: 'patient@elix.app',
    symptoms: 'Chest discomfort after climbing stairs.',
    question: 'Could this indicate early cardiac risk and what tests should I repeat?',
    recordIds: ['rec-1', 'rec-2'],
    status: 'in-review',
    createdAt: 'Today, 09:50',
    messages: [
      {
        id: 'msg-1',
        sender: 'patient',
        text: 'Doctor, I have uploaded ECG and X-Ray. Please review.',
        timestamp: '09:51'
      }
    ]
  }
];

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / 1024).toFixed(0)} KB`;
}

function getTabs(role: Role): TabItem[] {
  if (role === 'patient') return PATIENT_TABS;
  if (role === 'doctor') return DOCTOR_TABS;
  return ADMIN_TABS;
}

function roleLabel(role: Role) {
  if (role === 'patient') return 'Patient Workspace';
  if (role === 'doctor') return 'Doctor Workspace';
  return 'Admin Workspace';
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

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article className='stat-card'>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function App() {
  const [theme, setTheme] = useState<Theme>('light');
  const [stage, setStage] = useState<Stage>('splash');
  const [session, setSession] = useState<Session | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loginEmail, setLoginEmail] = useState('patient@elix.app');
  const [loginPassword, setLoginPassword] = useState('Elix@123');
  const [loginError, setLoginError] = useState('');

  const [records, setRecords] = useState<UploadedRecord[]>(INITIAL_RECORDS);
  const [requests, setRequests] = useState<OpinionRequest[]>(INITIAL_REQUESTS);
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [uploadNotice, setUploadNotice] = useState('');

  const [doctorSearch, setDoctorSearch] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState(DOCTORS[0].id);
  const [requestDoctorId, setRequestDoctorId] = useState(DOCTORS[0].id);
  const [requestRecordIds, setRequestRecordIds] = useState<string[]>([]);
  const [requestSymptoms, setRequestSymptoms] = useState('');
  const [requestQuestion, setRequestQuestion] = useState('');
  const [requestNotice, setRequestNotice] = useState('');

  const [patientChatRequestId, setPatientChatRequestId] = useState(INITIAL_REQUESTS[0].id);
  const [doctorChatRequestId, setDoctorChatRequestId] = useState(INITIAL_REQUESTS[0].id);
  const [patientMessageInput, setPatientMessageInput] = useState('');
  const [doctorMessageInput, setDoctorMessageInput] = useState('');

  const [profileSaved, setProfileSaved] = useState('');
  const [profile, setProfile] = useState<PatientProfile>({
    name: 'Alex Carter',
    age: '34',
    gender: 'Male',
    country: 'Canada',
    bloodGroup: 'O+',
    medicalHistory: 'Mild hypertension and family history of heart disease.',
    allergies: 'Penicillin',
    medications: 'Metoprolol 25mg'
  });

  const tabs = useMemo(() => (session ? getTabs(session.role) : []), [session]);
  const filteredDoctors = useMemo(() => {
    const key = doctorSearch.trim().toLowerCase();
    if (!key) return DOCTORS;
    return DOCTORS.filter((doctor) =>
      [doctor.name, doctor.specialty, doctor.city, doctor.country].some((value) => value.toLowerCase().includes(key))
    );
  }, [doctorSearch]);

  const selectedDoctor = useMemo(
    () => DOCTORS.find((doctor) => doctor.id === selectedDoctorId) ?? DOCTORS[0],
    [selectedDoctorId]
  );
  const recordMap = useMemo(() => new Map(records.map((record) => [record.id, record])), [records]);

  const patientRequests = requests.filter((request) => request.patientEmail === 'patient@elix.app');
  const activePatientRequest = patientRequests.find((request) => request.id === patientChatRequestId) ?? null;
  const activeDoctorRequest = requests.find((request) => request.id === doctorChatRequestId) ?? null;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (stage !== 'splash') return;
    const timeout = window.setTimeout(() => setStage('auth'), 1300);
    return () => window.clearTimeout(timeout);
  }, [stage]);

  useEffect(() => {
    if (!session) return;
    setActiveTab(getTabs(session.role)[0].id);
  }, [session]);

  function quickLogin(credential: Credential) {
    setSession({ role: credential.role, email: credential.email });
    setStage('app');
    setLoginError('');
  }

  function login(event: FormEvent) {
    event.preventDefault();
    const found = CREDENTIALS.find(
      (credential) => credential.email === loginEmail.trim() && credential.password === loginPassword.trim()
    );
    if (!found) {
      setLoginError('Invalid credentials. Please use the provided account details.');
      return;
    }
    setSession({ role: found.role, email: found.email });
    setStage('app');
    setLoginError('');
  }

  function logout() {
    setSession(null);
    setStage('auth');
    setLoginEmail('patient@elix.app');
    setLoginPassword('Elix@123');
  }

  function onUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const now = new Date();
    const nextRecords = Array.from(files).map((file) => ({
      id: createId('rec'),
      name: file.name,
      type: docType,
      size: formatSize(file.size),
      uploadedAt: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));
    setRecords((previous) => [...nextRecords, ...previous]);
    setUploadNotice(`${nextRecords.length} file(s) uploaded as ${docType}.`);
    event.target.value = '';
  }

  function toggleRecord(recordId: string) {
    setRequestRecordIds((previous) =>
      previous.includes(recordId) ? previous.filter((item) => item !== recordId) : [...previous, recordId]
    );
  }

  function submitSecondOpinion(event: FormEvent) {
    event.preventDefault();
    if (!requestDoctorId || requestRecordIds.length === 0 || !requestQuestion.trim()) {
      setRequestNotice('Select doctor, at least one record, and add your question.');
      return;
    }
    const doctor = DOCTORS.find((item) => item.id === requestDoctorId);
    if (!doctor) return;

    const newRequest: OpinionRequest = {
      id: `REQ-${Math.floor(1000 + Math.random() * 9000)}`,
      doctorId: doctor.id,
      doctorName: doctor.name,
      patientEmail: 'patient@elix.app',
      symptoms: requestSymptoms || 'No additional symptoms provided.',
      question: requestQuestion,
      recordIds: requestRecordIds,
      status: 'submitted',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      messages: [
        {
          id: createId('msg'),
          sender: 'patient',
          text: requestQuestion,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]
    };

    setRequests((previous) => [newRequest, ...previous]);
    setRequestNotice('Second opinion request submitted successfully.');
    setRequestRecordIds([]);
    setRequestSymptoms('');
    setRequestQuestion('');
    setPatientChatRequestId(newRequest.id);
    setDoctorChatRequestId(newRequest.id);
  }

  function sendPatientMessage(event: FormEvent) {
    event.preventDefault();
    if (!patientMessageInput.trim() || !activePatientRequest) return;
    setRequests((previous) =>
      previous.map((request) =>
        request.id === activePatientRequest.id
          ? {
              ...request,
              messages: [
                ...request.messages,
                {
                  id: createId('msg'),
                  sender: 'patient',
                  text: patientMessageInput.trim(),
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
              ],
              status: request.status === 'responded' ? 'in-review' : request.status
            }
          : request
      )
    );
    setPatientMessageInput('');
  }

  function sendDoctorMessage(message?: string) {
    const text = (message ?? doctorMessageInput).trim();
    if (!text || !activeDoctorRequest) return;
    setRequests((previous) =>
      previous.map((request) =>
        request.id === activeDoctorRequest.id
          ? {
              ...request,
              status: 'responded',
              messages: [
                ...request.messages,
                {
                  id: createId('msg'),
                  sender: 'doctor',
                  text,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
              ]
            }
          : request
      )
    );
    setDoctorMessageInput('');
  }

  function saveProfile(event: FormEvent) {
    event.preventDefault();
    setProfileSaved('Profile updated successfully.');
  }

  function renderPatientTab() {
    if (activeTab === 'dashboard') {
      return (
        <div className='screen-grid'>
          <SectionCard title='Patient Dashboard' subtitle='Your second opinion journey at a glance'>
            <div className='stats-grid'>
              <StatCard label='Uploaded docs' value={records.length} />
              <StatCard label='Requests submitted' value={patientRequests.length} />
              <StatCard label='Responses received' value={patientRequests.filter((item) => item.status === 'responded').length} />
            </div>
          </SectionCard>
          <SectionCard title='Latest request updates'>
            <ul className='list'>
              {patientRequests.map((request) => (
                <li key={request.id}>
                  <strong>
                    {request.id} | {request.doctorName}
                  </strong>
                  <span>{request.status.toUpperCase()} | {request.recordIds.length} documents attached</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      );
    }

    if (activeTab === 'upload') {
      return (
        <div className='screen-grid'>
          <SectionCard title='Upload Medical Records' subtitle='Attach X-Ray, ECG, MRI and more'>
            <div className='field-grid'>
              <label>
                Document Type
                <select value={docType} onChange={(event) => setDocType(event.target.value)}>
                  {DOC_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className='file-label'>
                Choose Files
                <input type='file' multiple onChange={onUpload} />
              </label>
            </div>
            {uploadNotice ? <p className='notice'>{uploadNotice}</p> : null}
          </SectionCard>
          <SectionCard title='Uploaded Documents'>
            <ul className='list'>
              {records.map((record) => (
                <li key={record.id}>
                  <strong>{record.name}</strong>
                  <span>
                    {record.type} | {record.size} | {record.uploadedAt}
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      );
    }

    if (activeTab === 'doctors') {
      return (
        <div className='screen-grid'>
          <SectionCard title='Find Doctors (Canada, USA, UK, Australia)' subtitle='Search by location or specialty'>
            <input
              value={doctorSearch}
              onChange={(event) => setDoctorSearch(event.target.value)}
              placeholder='Search city, country, doctor name, specialty'
            />
            <p className='muted'>{filteredDoctors.length} doctors found</p>
            <div className='doctor-list'>
              {filteredDoctors.map((doctor) => (
                <button
                  className={`doctor-item ${doctor.id === selectedDoctorId ? 'active' : ''}`}
                  key={doctor.id}
                  onClick={() => {
                    setSelectedDoctorId(doctor.id);
                    setRequestDoctorId(doctor.id);
                  }}
                >
                  <img src={doctor.image} alt={doctor.name} />
                  <div>
                    <strong>{doctor.name}</strong>
                    <span>
                      {doctor.specialty} | {doctor.city}, {doctor.country}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </SectionCard>
          <SectionCard title='Doctor Profile'>
            <div className='profile-head'>
              <img src={selectedDoctor.image} alt={selectedDoctor.name} />
              <div>
                <h4>{selectedDoctor.name}</h4>
                <p>
                  {selectedDoctor.specialty} | {selectedDoctor.experience} yrs | Rating {selectedDoctor.rating}
                </p>
                <p>
                  {selectedDoctor.hospital} | {selectedDoctor.city}, {selectedDoctor.country}
                </p>
              </div>
            </div>
            <p className='muted'>{selectedDoctor.bio}</p>
            <button
              className='primary-btn'
              onClick={() => {
                setRequestDoctorId(selectedDoctor.id);
                setActiveTab('requests');
              }}
            >
              Request second opinion from {selectedDoctor.name}
            </button>
          </SectionCard>
        </div>
      );
    }

    if (activeTab === 'requests') {
      return (
        <div className='screen-grid'>
          <SectionCard title='Submit Second Opinion Request' subtitle='Select doctor + records and send details'>
            <form className='form-stack' onSubmit={submitSecondOpinion}>
              <label>
                Select Doctor
                <select value={requestDoctorId} onChange={(event) => setRequestDoctorId(event.target.value)}>
                  {DOCTORS.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name} ({doctor.city}, {doctor.country})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Symptoms
                <textarea
                  value={requestSymptoms}
                  onChange={(event) => setRequestSymptoms(event.target.value)}
                  placeholder='Describe symptoms'
                />
              </label>
              <label>
                Questions for doctor
                <textarea
                  value={requestQuestion}
                  onChange={(event) => setRequestQuestion(event.target.value)}
                  placeholder='What second opinion do you need?'
                />
              </label>
              <div className='check-grid'>
                <p>Select records to attach:</p>
                {records.map((record) => (
                  <label key={record.id} className='check-item'>
                    <input
                      type='checkbox'
                      checked={requestRecordIds.includes(record.id)}
                      onChange={() => toggleRecord(record.id)}
                    />
                    {record.name} ({record.type})
                  </label>
                ))}
              </div>
              {requestNotice ? <p className='notice'>{requestNotice}</p> : null}
              <button className='primary-btn' type='submit'>
                Submit request
              </button>
            </form>
          </SectionCard>
          <SectionCard title='My Requests'>
            <ul className='list'>
              {patientRequests.map((request) => (
                <li key={request.id}>
                  <strong>
                    {request.id} | {request.doctorName}
                  </strong>
                  <span>
                    Status: {request.status} | Docs: {request.recordIds.length}
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      );
    }

    if (activeTab === 'chat') {
      return (
        <div className='screen-grid'>
          <SectionCard title='Doctor Chat' subtitle='Secure messaging for your submitted requests'>
            <select value={patientChatRequestId} onChange={(event) => setPatientChatRequestId(event.target.value)}>
              {patientRequests.map((request) => (
                <option key={request.id} value={request.id}>
                  {request.id} - {request.doctorName}
                </option>
              ))}
            </select>
            <div className='chat-box'>
              {(activePatientRequest?.messages ?? []).map((message) => (
                <article className={`chat-message ${message.sender}`} key={message.id}>
                  <p>{message.text}</p>
                  <span>{message.timestamp}</span>
                </article>
              ))}
            </div>
            <form className='chat-compose' onSubmit={sendPatientMessage}>
              <input
                value={patientMessageInput}
                onChange={(event) => setPatientMessageInput(event.target.value)}
                placeholder='Write message to doctor'
              />
              <button className='primary-btn'>Send</button>
            </form>
          </SectionCard>
        </div>
      );
    }

    return (
      <SectionCard title='My Profile'>
        <form className='form-stack' onSubmit={saveProfile}>
          <label>
            Name
            <input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} />
          </label>
          <div className='two-col'>
            <label>
              Age
              <input value={profile.age} onChange={(event) => setProfile({ ...profile, age: event.target.value })} />
            </label>
            <label>
              Gender
              <input value={profile.gender} onChange={(event) => setProfile({ ...profile, gender: event.target.value })} />
            </label>
          </div>
          <div className='two-col'>
            <label>
              Country
              <input value={profile.country} onChange={(event) => setProfile({ ...profile, country: event.target.value })} />
            </label>
            <label>
              Blood Group
              <input
                value={profile.bloodGroup}
                onChange={(event) => setProfile({ ...profile, bloodGroup: event.target.value })}
              />
            </label>
          </div>
          <label>
            Medical history
            <textarea
              value={profile.medicalHistory}
              onChange={(event) => setProfile({ ...profile, medicalHistory: event.target.value })}
            />
          </label>
          <label>
            Allergies
            <textarea value={profile.allergies} onChange={(event) => setProfile({ ...profile, allergies: event.target.value })} />
          </label>
          <label>
            Current medications
            <textarea
              value={profile.medications}
              onChange={(event) => setProfile({ ...profile, medications: event.target.value })}
            />
          </label>
          {profileSaved ? <p className='notice'>{profileSaved}</p> : null}
          <button className='primary-btn'>Save Profile</button>
        </form>
      </SectionCard>
    );
  }

  function renderDoctorTab() {
    if (activeTab === 'dashboard') {
      return (
        <div className='screen-grid'>
          <SectionCard title='Doctor Dashboard' subtitle='Incoming second opinion requests'>
            <div className='stats-grid'>
              <StatCard label='Total requests' value={requests.length} />
              <StatCard label='Pending' value={requests.filter((item) => item.status !== 'responded').length} />
              <StatCard label='Responded' value={requests.filter((item) => item.status === 'responded').length} />
            </div>
          </SectionCard>
          <SectionCard title='Latest received requests'>
            <ul className='list'>
              {requests.map((request) => (
                <li key={request.id}>
                  <strong>
                    {request.id} | {request.patientEmail}
                  </strong>
                  <span>
                    {request.doctorName} | {request.recordIds.length} files
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      );
    }

    if (activeTab === 'requests') {
      const selected = requests.find((request) => request.id === doctorChatRequestId) ?? requests[0];
      const attached = selected ? selected.recordIds.map((id) => recordMap.get(id)).filter(Boolean) : [];
      return (
        <div className='screen-grid'>
          <SectionCard title='Review Patient Requests' subtitle='Open records and provide real doctor suggestions'>
            <select value={doctorChatRequestId} onChange={(event) => setDoctorChatRequestId(event.target.value)}>
              {requests.map((request) => (
                <option key={request.id} value={request.id}>
                  {request.id} - {request.doctorName} ({request.status})
                </option>
              ))}
            </select>
            {selected ? (
              <>
                <p className='muted'>
                  <strong>Symptoms:</strong> {selected.symptoms}
                </p>
                <p className='muted'>
                  <strong>Question:</strong> {selected.question}
                </p>
                <h4>Attached documents</h4>
                <ul className='list'>
                  {attached.map((record) =>
                    record ? (
                      <li key={record.id}>
                        <strong>{record.name}</strong>
                        <span>
                          {record.type} | {record.size}
                        </span>
                      </li>
                    ) : null
                  )}
                </ul>
                <div className='quick-actions'>
                  <button
                    className='secondary-btn'
                    onClick={() =>
                      sendDoctorMessage(
                        'Based on your ECG and X-Ray, I recommend repeating troponin and 2D echo within 48 hours.'
                      )
                    }
                  >
                    Suggest cardiac follow-up
                  </button>
                  <button
                    className='secondary-btn'
                    onClick={() =>
                      sendDoctorMessage(
                        'Continue current medicines, monitor symptoms daily, and share blood pressure logs for 7 days.'
                      )
                    }
                  >
                    Send monitoring plan
                  </button>
                </div>
              </>
            ) : null}
          </SectionCard>
        </div>
      );
    }

    if (activeTab === 'chat') {
      return (
        <SectionCard title='Respond to Patient via Chat'>
          <select value={doctorChatRequestId} onChange={(event) => setDoctorChatRequestId(event.target.value)}>
            {requests.map((request) => (
              <option key={request.id} value={request.id}>
                {request.id} - {request.patientEmail}
              </option>
            ))}
          </select>
          <div className='chat-box'>
            {(activeDoctorRequest?.messages ?? []).map((message) => (
              <article className={`chat-message ${message.sender}`} key={message.id}>
                <p>{message.text}</p>
                <span>{message.timestamp}</span>
              </article>
            ))}
          </div>
          <form
            className='chat-compose'
            onSubmit={(event) => {
              event.preventDefault();
              sendDoctorMessage();
            }}
          >
            <input
              value={doctorMessageInput}
              onChange={(event) => setDoctorMessageInput(event.target.value)}
              placeholder='Type medical suggestion for patient'
            />
            <button className='primary-btn'>Reply</button>
          </form>
        </SectionCard>
      );
    }

    return (
      <SectionCard title='Doctor Profile'>
        <ul className='list'>
          <li>
            <strong>Login account</strong>
            <span>doctor@elix.app</span>
          </li>
          <li>
            <strong>License status</strong>
            <span>Verified</span>
          </li>
          <li>
            <strong>Consultation mode</strong>
            <span>In-app secure chat for second opinions</span>
          </li>
        </ul>
      </SectionCard>
    );
  }

  function renderAdminTab() {
    if (activeTab === 'dashboard') {
      return (
        <SectionCard title='Admin Dashboard'>
          <div className='stats-grid'>
            <StatCard label='Total doctors' value={DOCTORS.length} />
            <StatCard label='Total requests' value={requests.length} />
            <StatCard label='Open requests' value={requests.filter((item) => item.status !== 'responded').length} />
            <StatCard label='Uploaded docs' value={records.length} />
          </div>
        </SectionCard>
      );
    }

    if (activeTab === 'doctors') {
      return (
        <SectionCard title='All Doctors + Requests Received'>
          <ul className='list'>
            {DOCTORS.map((doctor) => {
              const count = requests.filter((request) => request.doctorId === doctor.id).length;
              return (
                <li key={doctor.id}>
                  <strong>
                    {doctor.name} | {doctor.specialty}
                  </strong>
                  <span>
                    {doctor.city}, {doctor.country} | Requests received: {count}
                  </span>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      );
    }

    if (activeTab === 'requests') {
      return (
        <SectionCard title='All Request Activity'>
          <ul className='list'>
            {requests.map((request) => (
              <li key={request.id}>
                <strong>
                    {request.id} | {request.patientEmail} {'->'} {request.doctorName}
                </strong>
                <span>
                  {request.status} | {request.recordIds.length} docs | {request.messages.length} chat messages
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      );
    }

    const countryCounts = DOCTORS.reduce<Record<string, number>>((accumulator, doctor) => {
      accumulator[doctor.country] = (accumulator[doctor.country] ?? 0) + 1;
      return accumulator;
    }, {});

    return (
      <SectionCard title='Doctor Country Metrics'>
        <ul className='list'>
          {Object.entries(countryCounts).map(([country, count]) => (
            <li key={country}>
              <strong>{country}</strong>
              <span>{count} doctors</span>
            </li>
          ))}
        </ul>
      </SectionCard>
    );
  }

  function renderContent() {
    if (!session) return null;
    if (session.role === 'patient') return renderPatientTab();
    if (session.role === 'doctor') return renderDoctorTab();
    return renderAdminTab();
  }

  return (
    <main className='app-root'>
      {stage === 'splash' ? (
        <section className='splash'>
          <div className='logo-badge'>elix</div>
          <h1>Second Opinion Doctor</h1>
          <p>Secure global healthcare opinions in one mobile app.</p>
        </section>
      ) : null}

      {stage === 'auth' ? (
        <section className='phone-shell auth-shell'>
          <header className='mobile-header'>
            <h2>Login to Elix</h2>
            <p>Use provided credentials</p>
          </header>
          <form className='form-stack' onSubmit={login}>
            <label>
              Email
              <input value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} />
            </label>
            <label>
              Password
              <input
                type='password'
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
              />
            </label>
            {loginError ? <p className='error-text'>{loginError}</p> : null}
            <button className='primary-btn'>Login</button>
          </form>
          <div className='credential-list'>
            {CREDENTIALS.map((credential) => (
              <button key={credential.role} className='credential-item' onClick={() => quickLogin(credential)}>
                <strong>{credential.label}</strong>
                <span>
                  {credential.email} | {credential.password}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {stage === 'app' && session ? (
        <section className='phone-shell'>
          <header className='mobile-header top-sticky'>
            <div>
              <h2>{roleLabel(session.role)}</h2>
              <p>{session.email}</p>
            </div>
            <div className='header-actions'>
              <button className='secondary-btn' onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
                {theme === 'light' ? 'Dark' : 'Light'}
              </button>
              <button className='secondary-btn' onClick={logout}>
                Logout
              </button>
            </div>
          </header>

          <section className='phone-content'>{renderContent()}</section>

          <nav className='bottom-tabs'>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={tab.id === activeTab ? 'active' : ''}
                onClick={() => setActiveTab(tab.id)}
              >
                <span>{tab.icon}</span>
                <small>{tab.label}</small>
              </button>
            ))}
          </nav>
        </section>
      ) : null}
    </main>
  );
}

export default App;

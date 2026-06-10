import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Bot, Send } from 'lucide-react';
import { ageFromDateOfBirth } from '../../lib/patientProfileCompleteness';
import { isExistingUserEmailMessage } from '../../lib/authEmailOtp';
import type { Patient } from '../../types/patient';
import './chat-signup.css';

type ChatMessage = {
  id: string;
  role: 'bot' | 'user';
  text: string;
};

type ProfileStep = 'phone' | 'gender' | 'dob' | 'address' | 'height' | 'weight' | 'bloodGroup';

type AuthStep = 'intro' | 'name' | 'email' | 'verifyEmail' | 'password';

type Step = AuthStep | ProfileStep | 'done';

type ChatPatientOnboardingProps = {
  mode: 'signup' | 'profile-only';
  configured: boolean;
  authBusy: boolean;
  session: Session | null;
  patientProfile: Patient | null;
  onSendEmailOtp: (
    email: string,
    fullName: string
  ) => Promise<{ error: string | null; skipVerification?: boolean }>;
  onVerifyEmailCode: (email: string, code: string, fullName: string) => Promise<{ error: string | null }>;
  onSetPassword: (password: string, fullName: string, email: string) => Promise<{ error: string | null }>;
  onResendEmailOtp: (email: string) => Promise<{ error: string | null }>;
  onCompleteProfile: (input: {
    phone: string;
    gender: string;
    date_of_birth: string;
    address: string;
    blood_group: string;
    height_cm?: number | null;
    weight_kg?: number | null;
  }) => Promise<{ error: string | null }>;
  onBack: () => void;
  onFinished: () => void;
};

const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];

let messageCounter = 0;
function nextMessageId() {
  messageCounter += 1;
  return `msg-${messageCounter}`;
}

function firstProfileStep(profile: Patient | null): ProfileStep {
  if (!profile?.phone?.trim()) return 'phone';
  if (!profile?.gender?.trim()) return 'gender';
  if (!profile?.date_of_birth?.trim()) return 'dob';
  if (!profile?.address?.trim() && !profile?.city?.trim()) return 'address';
  if (!profile?.blood_group?.trim()) return 'bloodGroup';
  return 'bloodGroup';
}

function botPrompt(step: Step, name?: string): string {
  switch (step) {
    case 'intro':
      return "Hi! I'm Elix Assistant. I'll help you create your patient account in a few quick steps.";
    case 'name':
      return "Let's start — what's your full name?";
    case 'email':
      return name ? `Nice to meet you, ${name.split(' ')[0]}! What email should we use for your account?` : 'What email should we use for your account?';
    case 'verifyEmail':
      return "I've sent a 6-digit verification code to your email. Check your inbox and spam folder, then enter the code here.";
    case 'password':
      return 'Email verified! Choose a secure password (at least 8 characters).';
    case 'phone':
      return 'Great! What is your mobile number?';
    case 'gender':
      return 'How do you identify? Pick one option below.';
    case 'dob':
      return 'What is your date of birth? (YYYY-MM-DD)';
    case 'address':
      return 'Please share your full address (street, city, country).';
    case 'height':
      return 'What is your height in cm? (optional — type "skip" to continue)';
    case 'weight':
      return 'What is your weight in kg? (optional — type "skip" to continue)';
    case 'bloodGroup':
      return 'Almost done! Select your blood group.';
    case 'done':
      return 'Your profile is all set. Taking you to your dashboard now…';
    default:
      return '';
  }
}

export default function ChatPatientOnboarding({
  mode,
  configured,
  authBusy,
  patientProfile,
  onSendEmailOtp,
  onVerifyEmailCode,
  onSetPassword,
  onResendEmailOtp,
  onCompleteProfile,
  onBack,
  onFinished
}: ChatPatientOnboardingProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const bootstrappedRef = useRef(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [step, setStep] = useState<Step>(mode === 'profile-only' ? 'phone' : 'intro');
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [profileDraft, setProfileDraft] = useState({
    phone: '',
    gender: '',
    date_of_birth: '',
    address: '',
    height_cm: null as number | null,
    weight_kg: null as number | null,
    blood_group: ''
  });

  const pushBot = useCallback((text: string, delay = 500) => {
    setTyping(true);
    return new Promise<void>((resolve) => {
      window.setTimeout(() => {
        setMessages((prev) => [...prev, { id: nextMessageId(), role: 'bot', text }]);
        setTyping(false);
        resolve();
      }, delay);
    });
  }, []);

  const pushUser = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: nextMessageId(), role: 'user', text }]);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, typing, scrollToBottom]);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    const bootstrap = async () => {
      if (mode === 'profile-only') {
        const resume = firstProfileStep(patientProfile);
        setProfileDraft({
          phone: patientProfile?.phone ?? '',
          gender: patientProfile?.gender ?? '',
          date_of_birth: patientProfile?.date_of_birth ?? '',
          address: patientProfile?.address ?? patientProfile?.city ?? '',
          height_cm: patientProfile?.height_cm ?? null,
          weight_kg: patientProfile?.weight_kg ?? null,
          blood_group: patientProfile?.blood_group ?? ''
        });
        setStep(resume);
        await pushBot("Welcome back! Let's finish setting up your health profile.");
        await pushBot(botPrompt(resume));
        return;
      }

      await pushBot(botPrompt('intro'));
      await pushBot(botPrompt('name'));
      setStep('name');
    };

    void bootstrap();
  }, [mode, patientProfile, pushBot]);

  const startProfileQuestions = useCallback(async () => {
    const resume = firstProfileStep(patientProfile);
    setStep(resume);
    await pushBot('Password saved! Now a few health profile questions.');
    await pushBot(botPrompt(resume));
  }, [patientProfile, pushBot]);

  const inputType = useMemo(() => {
    if (step === 'verifyEmail') return 'text';
    if (step === 'email') return 'email';
    if (step === 'password') return 'password';
    if (step === 'phone') return 'tel';
    if (step === 'dob') return 'date';
    if (step === 'height' || step === 'weight') return 'number';
    return 'text';
  }, [step]);

  const inputPlaceholder = useMemo(() => {
    switch (step) {
      case 'name':
        return 'Your full name';
      case 'email':
        return 'you@email.com';
      case 'verifyEmail':
        return '6-digit verification code';
      case 'password':
        return 'Password (min. 8 characters)';
      case 'phone':
        return '+1 555 000 0000';
      case 'dob':
        return 'YYYY-MM-DD';
      case 'address':
        return 'Street, city, country';
      case 'height':
        return 'Height in cm or skip';
      case 'weight':
        return 'Weight in kg or skip';
      default:
        return 'Type a message…';
    }
  }, [step]);

  const showComposer = step !== 'done' && !(step === 'gender' || step === 'bloodGroup');

  const finishProfile = async (draft: typeof profileDraft) => {
    setTyping(true);
    const { error } = await onCompleteProfile(draft);
    setTyping(false);

    if (error) {
      setLocalError(error);
      await pushBot(`Something went wrong: ${error}. Please try again.`);
      return;
    }

    setStep('done');
    await pushBot(botPrompt('done'));
    window.setTimeout(() => onFinished(), 1200);
  };

  const advanceProfile = async (next: ProfileStep | 'done', draft: typeof profileDraft) => {
    if (next === 'done') {
      await finishProfile(draft);
      return;
    }
    setStep(next);
    await pushBot(botPrompt(next));
  };

  const handleProfileAnswer = async (raw: string) => {
    const value = raw.trim();
    if (!value && step !== 'height' && step !== 'weight') {
      setLocalError('Please enter a value.');
      return;
    }

    setLocalError(null);
    pushUser(step === 'password' ? '••••••••' : raw);

    if (step === 'phone') {
      const phone = value.replace(/\s+/g, ' ');
      const draft = { ...profileDraft, phone };
      setProfileDraft(draft);
      await advanceProfile('gender', draft);
      return;
    }

    if (step === 'dob') {
      const age = ageFromDateOfBirth(value);
      if (age == null) {
        setLocalError('Enter a valid date (YYYY-MM-DD).');
        await pushBot('That date does not look valid. Please use YYYY-MM-DD.');
        return;
      }
      const draft = { ...profileDraft, date_of_birth: value };
      setProfileDraft(draft);
      await pushBot(`Thanks! That makes you ${age} years old.`);
      await advanceProfile('address', draft);
      return;
    }

    if (step === 'address') {
      const draft = { ...profileDraft, address: value };
      setProfileDraft(draft);
      await advanceProfile('height', draft);
      return;
    }

    if (step === 'height') {
      const draft =
        value.toLowerCase() === 'skip'
          ? { ...profileDraft, height_cm: null }
          : { ...profileDraft, height_cm: Number(value) };
      if (value.toLowerCase() !== 'skip' && (!draft.height_cm || draft.height_cm <= 0)) {
        setLocalError('Enter height in cm or type skip.');
        await pushBot('Enter a number in centimeters, or type "skip".');
        return;
      }
      setProfileDraft(draft);
      await advanceProfile('weight', draft);
      return;
    }

    if (step === 'weight') {
      const draft =
        value.toLowerCase() === 'skip'
          ? { ...profileDraft, weight_kg: null }
          : { ...profileDraft, weight_kg: Number(value) };
      if (value.toLowerCase() !== 'skip' && (!draft.weight_kg || draft.weight_kg <= 0)) {
        setLocalError('Enter weight in kg or type skip.');
        await pushBot('Enter a number in kilograms, or type "skip".');
        return;
      }
      setProfileDraft(draft);
      await advanceProfile('bloodGroup', draft);
    }
  };

  const handleAuthAnswer = async (raw: string) => {
    const value = raw.trim();
    setLocalError(null);

    if (step === 'name') {
      if (!value) {
        setLocalError('Enter your full name.');
        return;
      }
      pushUser(value);
      setFullName(value);
      setStep('email');
      await pushBot(botPrompt('email', value));
      return;
    }

    if (step === 'email') {
      if (!value || !value.includes('@')) {
        setLocalError('Enter a valid email.');
        return;
      }
      pushUser(value);
      setEmail(value);

      setTyping(true);
      const { error, skipVerification } = await onSendEmailOtp(value, fullName);
      setTyping(false);

      if (error) {
        setLocalError(error);
        setEmail('');
        if (isExistingUserEmailMessage(error)) {
          await pushBot(error);
        } else {
          await pushBot(`I couldn't send the verification code: ${error}`);
        }
        return;
      }

      if (skipVerification) {
        setStep('password');
        await pushBot('Your email is ready — no code needed for this project.');
        await pushBot(botPrompt('password'));
        return;
      }

      setStep('verifyEmail');
      await pushBot(botPrompt('verifyEmail'));
      return;
    }

    if (step === 'password') {
      if (value.length < 8) {
        setLocalError('Password must be at least 8 characters.');
        await pushBot('Your password needs at least 8 characters. Try again.');
        return;
      }
      pushUser('••••••••');

      setTyping(true);
      const { error } = await onSetPassword(value, fullName, email);
      setTyping(false);

      if (error) {
        setLocalError(error);
        await pushBot(`I couldn't save your password: ${error}`);
        return;
      }

      await startProfileQuestions();
    }
  };

  const handleVerifyCode = async (raw: string) => {
    const code = raw.replace(/\D/g, '');
    setLocalError(null);

    if (code.length !== 6) {
      setLocalError('Enter the 6-digit code from your email.');
      await pushBot('Please enter all 6 digits from the verification email.');
      return;
    }

    pushUser(code);
    setTyping(true);
    const { error } = await onVerifyEmailCode(email, code, fullName);
    setTyping(false);

    if (error) {
      setLocalError(error);
      await pushBot('That code is invalid or expired. Try again or tap Resend code for a new one.');
      return;
    }

    setStep('password');
    await pushBot('Email verified successfully!');
    await pushBot(botPrompt('password'));
  };

  const handleSubmit = async () => {
    if (!input.trim() || authBusy || typing) return;
    const value = input;
    setInput('');

    if (step === 'verifyEmail') {
      await handleVerifyCode(value);
      return;
    }

    if (step === 'phone' || step === 'dob' || step === 'address' || step === 'height' || step === 'weight') {
      await handleProfileAnswer(value);
      return;
    }

    await handleAuthAnswer(value);
  };

  const handleChip = async (value: string) => {
    if (typing || authBusy) return;
    setLocalError(null);
    pushUser(value);

    if (step === 'gender') {
      const draft = { ...profileDraft, gender: value };
      setProfileDraft(draft);
      await advanceProfile('dob', draft);
      return;
    }

    if (step === 'bloodGroup') {
      const draft = { ...profileDraft, blood_group: value };
      setProfileDraft(draft);
      await finishProfile(draft);
    }
  };

  const handleSkipOptional = async () => {
    if (step === 'height') await handleProfileAnswer('skip');
    if (step === 'weight') await handleProfileAnswer('skip');
  };

  const handleResend = async () => {
    if (!email.trim() || !fullName.trim()) return;
    setResendBusy(true);
    const { error } = await onResendEmailOtp(email.trim());
    setResendBusy(false);
    if (error) {
      setLocalError(error);
      return;
    }
    await pushBot('A new verification code was sent. Check your inbox and enter it above.');
  };

  return (
    <div className='mobile-shell onboarding-shell'>
      <div className='chat-onboarding'>
        <header className='chat-onboarding__header'>
          <button type='button' className='chat-onboarding__back' onClick={onBack} disabled={authBusy}>
            ← Back
          </button>
          <div className='chat-onboarding__bot-avatar' aria-hidden>
            <Bot size={18} />
          </div>
          <div className='chat-onboarding__header-text'>
            <h2>Elix Assistant</h2>
            <p>Patient account setup</p>
          </div>
        </header>

        <div className='chat-onboarding__messages' aria-live='polite'>
          {messages.map((message) => (
            <div
              key={message.id}
              className={`chat-onboarding__row chat-onboarding__row--${message.role}`}
            >
              {message.role === 'bot' ? (
                <div className='chat-onboarding__bot-avatar' aria-hidden>
                  <Bot size={14} />
                </div>
              ) : null}
              <div className='chat-onboarding__bubble'>{message.text}</div>
            </div>
          ))}

          {typing ? (
            <div className='chat-onboarding__row chat-onboarding__row--bot'>
              <div className='chat-onboarding__bot-avatar' aria-hidden>
                <Bot size={14} />
              </div>
              <div className='chat-onboarding__bubble'>
                <span className='chat-onboarding__typing' aria-label='Assistant is typing'>
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            </div>
          ) : null}

          <div ref={messagesEndRef} />
        </div>

        <footer className='chat-onboarding__composer'>
          {!configured ? (
            <p className='chat-onboarding__status warn'>Add VITE_SUPABASE_* to .env.local and restart dev server</p>
          ) : null}
          {localError ? (
            <p className='chat-onboarding__status warn' role='alert'>
              {localError}
            </p>
          ) : null}

          {step === 'verifyEmail' ? (
            <div className='chat-onboarding__verify-actions'>
              <button
                type='button'
                className='secondary-btn'
                onClick={() => void handleResend()}
                disabled={resendBusy || !configured || authBusy}
              >
                {resendBusy ? 'Sending…' : 'Resend code'}
              </button>
            </div>
          ) : null}

          {step === 'gender' || step === 'bloodGroup' ? (
            <div className='chat-onboarding__chips'>
              {(step === 'gender' ? GENDER_OPTIONS : BLOOD_GROUPS).map((option) => (
                <button
                  key={option}
                  type='button'
                  className='chat-onboarding__chip'
                  onClick={() => void handleChip(option)}
                  disabled={authBusy || typing}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : null}

          {step === 'height' || step === 'weight' ? (
            <div className='chat-onboarding__chips'>
              <button
                type='button'
                className='chat-onboarding__chip chat-onboarding__chip--skip'
                onClick={() => void handleSkipOptional()}
                disabled={authBusy || typing}
              >
                Skip
              </button>
            </div>
          ) : null}

          {showComposer ? (
            <div className='chat-onboarding__input-row'>
              <input
                type={inputType}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={inputPlaceholder}
                inputMode={step === 'verifyEmail' ? 'numeric' : undefined}
                autoComplete={step === 'verifyEmail' ? 'one-time-code' : undefined}
                maxLength={step === 'verifyEmail' ? 6 : undefined}
                disabled={!configured || authBusy || typing}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleSubmit();
                  }
                }}
                aria-label={inputPlaceholder}
              />
              <button
                type='button'
                className='chat-onboarding__send'
                onClick={() => void handleSubmit()}
                disabled={!configured || authBusy || typing || !input.trim()}
                aria-label='Send'
              >
                <Send size={18} />
              </button>
            </div>
          ) : null}
        </footer>
      </div>
    </div>
  );
}

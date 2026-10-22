import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { DashboardView } from './views/DashboardView';
import { PatientRegistrationView } from './views/PatientRegistrationView';
import { ImageCaptureView } from './views/ImageCaptureView';
import { ScreeningResultView } from './views/ScreeningResultView';
import { ReferralConfirmationView } from './views/ReferralConfirmationView';
import { ReferralsListView } from './views/ReferralsListView';
import { SyncCentreView } from './views/SyncCentreView';
import { HelpView } from './views/HelpView';
import { ProgramCapacityView } from './views/ProgramCapacityView';
import { AuthView } from './views/AuthView';
import { TransitionPanel } from './components/motion-primitives/transition-panel';
import AIAssistant from './components/AIAssistant';
import { 
  setOfflineMode, 
  getOfflineMode, 
  fetchPatientById, 
  fetchScreeningById, 
  fetchCurrentUser, 
  setAuthToken 
} from './services/api';
import { Building2, User, Wifi, WifiOff, LogOut, UserCheck } from 'lucide-react';

export function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [isOffline, setIsOfflineState] = useState(getOfflineMode());
  const [activePatient, setActivePatient] = useState(null);
  const [screeningResult, setScreeningResult] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    checkAuthSession();
  }, []);

  const checkAuthSession = async () => {
    try {
      const user = await fetchCurrentUser();
      if (user) {
        setCurrentUser(user);
      }
    } catch (e) {
      console.warn('Auth session check:', e);
    } finally {
      setAuthChecking(false);
    }
  };

  const handleSetOffline = (offline) => {
    setIsOfflineState(offline);
    setOfflineMode(offline);
  };

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    setAuthToken(null);
    setCurrentUser(null);
    setActivePatient(null);
    setScreeningResult(null);
    setCurrentView('dashboard');
  };

  const handleNavigation = (viewId) => {
    if (['dashboard', 'register', 'referrals'].includes(viewId)) {
      setActivePatient(null);
      setScreeningResult(null);
    }
    setCurrentView(viewId);
  };

  // Screening Workflow Triggers
  const handleStartNewScreening = () => {
    setActivePatient(null);
    setScreeningResult(null);
    setCurrentView('register');
  };

  const handlePatientRegistered = (patient) => {
    setActivePatient(patient);
    setCurrentView('capture');
  };

  const handleScreeningComplete = (result) => {
    setScreeningResult(result);
    setCurrentView('result');
  };

  const handleCreateReferral = () => {
    setCurrentView('referral_confirm');
  };

  const handleFinishReferral = () => {
    setActivePatient(null);
    setScreeningResult(null);
    setCurrentView('dashboard');
  };

  const handleSelectRecentPatient = async (patient) => {
    try {
      const fullPat = await fetchPatientById(patient.id);
      setActivePatient(fullPat);
    } catch {
      setActivePatient(patient);
    }

    if (patient.screening_id) {
      try {
        const scr = await fetchScreeningById(patient.screening_id);
        setScreeningResult(scr);
        setCurrentView('result');
        return;
      } catch {
        // Fall through to capture if screening fetch fails
      }
    }
    setCurrentView('capture');
  };

  const handleSelectReferralSlip = async (ref) => {
    try {
      const [pat, scr] = await Promise.all([
        fetchPatientById(ref.patient_id).catch(() => null),
        fetchScreeningById(ref.screening_id).catch(() => null)
      ]);

      if (pat) setActivePatient(pat);
      if (scr) setScreeningResult(scr);
      setCurrentView('referral_confirm');
    } catch (e) {
      console.warn('Error resolving referral slip data:', e);
      setCurrentView('referral_confirm');
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-forest border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-semibold text-espresso">Verifying DISHA Clinical Station Session...</p>
        </div>
      </div>
    );
  }

  // Mandatory Authentication Gate (Bug 4)
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-4">
        <AuthView onAuthSuccess={handleAuthSuccess} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-cream text-charcoal font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <Navigation
        currentView={currentView}
        setCurrentView={handleNavigation}
        isOffline={isOffline}
        setIsOffline={handleSetOffline}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Persistent Top Bar */}
        <header className="h-16 bg-cream/90 backdrop-blur-md border-b border-border-soft px-6 flex items-center justify-between flex-shrink-0 z-10 select-none">
          <div className="flex items-center gap-3">
            <Building2 className="w-4 h-4 text-forest" />
            <div className="text-xs font-semibold text-espresso">
              {currentUser.clinic_location} · <span className="text-dark-brown/70 font-normal">Telemedicine Station</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            {/* Active Screening Patient Pill */}
            {activePatient && (
              <div className="hidden sm:flex items-center gap-2 bg-sand/60 px-3 py-1.5 rounded-lg border border-border-soft font-medium">
                <User className="w-3.5 h-3.5 text-forest" />
                <span className="text-espresso font-bold">{activePatient.full_name}</span>
                <span className="font-mono text-dark-brown/70">({activePatient.patient_code})</span>
              </div>
            )}

            {/* Logged in Staff Badge */}
            <div className="flex items-center gap-2 bg-sage/20 border border-sage/60 px-3 py-1.5 rounded-lg text-forest font-semibold">
              <UserCheck className="w-3.5 h-3.5" />
              <span>{currentUser.full_name}</span>
              <button
                onClick={handleLogout}
                title="Sign out of station"
                className="ml-1 text-dark-brown/60 hover:text-terracotta transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Offline Status Pill */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-sand/40 border border-border-soft">
              <span className={`w-2 h-2 rounded-full ${isOffline ? 'bg-terracotta' : 'bg-sage animate-pulse'}`}></span>
              <span className="text-dark-brown font-semibold text-[11px]">
                {isOffline ? 'Local Mode' : 'Online'}
              </span>
            </div>
          </div>
        </header>

        {/* Dynamic Screen Viewport */}
        <main className="flex-1 overflow-y-auto bg-cream">
          {['register', 'capture', 'result', 'referral_confirm'].includes(currentView) ? (
            <TransitionPanel
              activeIndex={['register', 'capture', 'result', 'referral_confirm'].indexOf(currentView)}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              variants={{
                enter: { opacity: 0, y: 10 },
                center: { opacity: 1, y: 0 },
                exit: { opacity: 0, y: -10 }
              }}
            >
              {[
                <PatientRegistrationView
                  key="register"
                  onPatientRegistered={handlePatientRegistered}
                  onCancel={() => setCurrentView('dashboard')}
                />,
                <ImageCaptureView
                  key="capture"
                  activePatient={activePatient}
                  onScreeningComplete={handleScreeningComplete}
                  onBack={() => setCurrentView('register')}
                />,
                <ScreeningResultView
                  key="result"
                  screeningResult={screeningResult}
                  activePatient={activePatient}
                  onCreateReferral={handleCreateReferral}
                  onRetake={() => setCurrentView('capture')}
                  onComplete={() => {
                    setActivePatient(null);
                    setScreeningResult(null);
                    setCurrentView('dashboard');
                  }}
                />,
                <ReferralConfirmationView
                  key="referral_confirm"
                  activePatient={activePatient}
                  screeningResult={screeningResult}
                  onFinish={handleFinishReferral}
                />
              ]}
            </TransitionPanel>
          ) : (
            <>
              {currentView === 'dashboard' && (
                <DashboardView
                  onStartNewScreening={handleStartNewScreening}
                  onSelectPatient={handleSelectRecentPatient}
                  onViewReferrals={() => setCurrentView('referrals')}
                />
              )}

              {currentView === 'referrals' && (
                <ReferralsListView
                  onSelectReferralSlip={handleSelectReferralSlip}
                />
              )}

              {currentView === 'sync' && (
                <SyncCentreView
                  isOffline={isOffline}
                  setIsOffline={handleSetOffline}
                />
              )}

              {currentView === 'help' && (
                <HelpView />
              )}

              {currentView === 'capacity' && (
                <ProgramCapacityView />
              )}

              {currentView === 'auth' && (
                <div className="flex flex-col items-center justify-center h-full p-6">
                  <div className="bg-cream border border-border-soft rounded-2xl p-8 max-w-md w-full shadow-sm">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-16 h-16 bg-sage/20 rounded-full flex items-center justify-center text-forest">
                        <UserCheck className="w-8 h-8" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-espresso">{currentUser.full_name}</h2>
                        <p className="text-sm font-medium text-forest uppercase tracking-wider mt-1">{currentUser.role}</p>
                      </div>
                      
                      <div className="flex items-center gap-2 text-dark-brown/80 bg-sand/30 px-4 py-2 rounded-lg border border-border-soft w-full justify-center">
                        <Building2 className="w-4 h-4" />
                        <span className="text-sm font-medium">{currentUser.clinic_location}</span>
                      </div>

                      <div className="pt-4 w-full border-t border-border-soft/50 mt-4">
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-terracotta text-cream font-bold hover:bg-terracotta/90 transition-colors shadow-sm"
                        >
                          <LogOut className="w-5 h-5" />
                          Sign Out of Station
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Floating AI Assistant — always visible when logged in */}
      <AIAssistant />
    </div>
  );
}

export default App;

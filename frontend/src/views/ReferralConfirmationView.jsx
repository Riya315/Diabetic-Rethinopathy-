import React, { useState, useEffect, useRef } from 'react';
import { 
  Printer, 
  Download, 
  CheckCircle2, 
  Building2, 
  Calendar, 
  User, 
  MapPin, 
  FileText, 
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Eye,
  Activity
} from 'lucide-react';
import { createReferral, getFullImageUrl } from '../services/api';
import { motion, useReducedMotion } from 'motion/react';
import Loader from '../components/ui/Loader';

export const ReferralConfirmationView = ({ activePatient, screeningResult, onFinish }) => {
  const reduceMotion = useReducedMotion();
  const [referral, setReferral] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [targetFacility, setTargetFacility] = useState('District Eye Hospital, Tele-Ophthalmology Unit');
  const [notes, setNotes] = useState('');
  const creatingRef = useRef(false);

  useEffect(() => {
    generateReferralRecord();
  }, []);

  const generateReferralRecord = async () => {
    if (!activePatient || !screeningResult) {
      setLoading(false);
      return;
    }
    if (creatingRef.current || referral) return;

    creatingRef.current = true;
    try {
      setLoading(true);
      setError(null);
      const res = await createReferral({
        patient_id: activePatient.id,
        screening_id: screeningResult.id,
        urgency: screeningResult.urgency_tier,
        target_facility: targetFacility,
        notes: notes
      });
      setReferral(res);
    } catch (err) {
      console.error(err);
      setError('Failed to generate referral slip. Please try again.');
    } finally {
      creatingRef.current = false;
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading || !referral) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <Loader size="lg" text="Generating official referral record..." />
      </div>
    );
  }

  const referralDate = new Date(referral.created_at).toLocaleDateString('en-IN', { 
    day: 'numeric', month: 'short', year: 'numeric' 
  });

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8 animate-fadeIn">
      {error && (
        <div className="p-4 bg-terracotta/10 border border-terracotta/30 text-terracotta-dark rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Top Banner (hidden on print) */}
      <div className="no-print bg-sage/20 border border-sage/60 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <motion.div 
            initial={{ opacity: reduceMotion ? 1 : 0, scale: reduceMotion ? 1 : 0.5 }} 
            animate={{ opacity: 1, scale: 1 }} 
            transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
            className="w-10 h-10 rounded-xl bg-forest text-cream flex items-center justify-center flex-shrink-0"
          >
            <CheckCircle2 className="w-6 h-6" />
          </motion.div>
          <div>
            <h1 className="text-xl font-bold text-espresso">
              Referral Slip Generated Successfully
            </h1>
            <p className="text-xs text-dark-brown/80">
              Official tele-ophthalmology triage document prepared for patient presentation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="bg-forest hover:bg-forest-hover text-cream px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {/* Official Referral Letterhead Slip (Prints Cleanly) */}
      <div className="print-card bg-cream border-2 border-border-soft rounded-2xl p-8 shadow-sm space-y-6 text-charcoal">
        {/* Letterhead Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b-2 border-border-soft pb-6 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Eye className="w-6 h-6 text-forest" />
              <span className="text-xl font-bold tracking-tight text-espresso">DrishtiCare Tele-Ophthalmology Network</span>
            </div>
            <p className="text-xs text-dark-brown/70 font-medium">
              National Health Mission · Rural Diabetic Retinopathy Screening Programme
            </p>
            <p className="text-[11px] text-dark-brown/60">
              Primary Health Centre (PHC) Chittoor · Tele-Triage Unit
            </p>
          </div>

          <div className="sm:text-right space-y-1">
            <div className="text-xs font-bold text-espresso uppercase tracking-wider">Referral Code</div>
            <div className="text-sm font-mono font-bold text-forest bg-sand/60 px-2.5 py-1 rounded-md border border-border-soft inline-block break-all">
              {referral.referral_code}
            </div>
            <div className="text-[11px] text-dark-brown/60">
              Date: {referralDate}
            </div>
          </div>
        </div>

        {/* Urgency & Status Band */}
        <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          screeningResult?.urgency_tier === 'Urgent'
            ? 'bg-terracotta/15 border-terracotta text-terracotta-dark'
            : screeningResult?.referable
              ? 'bg-sand border-terracotta/30 text-espresso'
              : 'bg-sage/20 border-sage/40 text-forest'
        }`}>
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider">
                Triage Urgency: {screeningResult?.urgency_tier || 'Priority'}
              </div>
              <div className="text-xs">
                Recommended Action: <strong>{screeningResult?.suggested_timeframe || 'Within 30 days'}</strong>
              </div>
            </div>
          </div>
          <div className="sm:text-right font-mono text-xs font-bold">
            DR Finding: {screeningResult?.dr_grade_name}
            <div className="text-[10px] opacity-80 mt-0.5">Model Certainty: {screeningResult?.confidence}%</div>
          </div>
        </div>

        {/* Patient Demographic Details Table */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-sand/30 border border-border-soft text-xs">
          <div>
            <span className="text-dark-brown/60 block text-[10px] uppercase font-bold">Patient Name</span>
            <span className="font-bold text-espresso text-sm break-words">{activePatient?.full_name}</span>
          </div>
          <div>
            <span className="text-dark-brown/60 block text-[10px] uppercase font-bold">Patient Code</span>
            <span className="font-mono font-bold text-espresso break-all">{activePatient?.patient_code}</span>
          </div>
          <div>
            <span className="text-dark-brown/60 block text-[10px] uppercase font-bold">Age / Gender</span>
            <span className="font-semibold text-espresso">{activePatient?.age} Years · {activePatient?.gender}</span>
          </div>
          <div>
            <span className="text-dark-brown/60 block text-[10px] uppercase font-bold">Village / Panchayat</span>
            <span className="font-semibold text-espresso break-words">{activePatient?.village}</span>
          </div>
          <div>
            <span className="text-dark-brown/60 block text-[10px] uppercase font-bold">Diabetes Duration</span>
            <span className="font-semibold text-espresso">{activePatient?.diabetes_duration_years || 0} Years</span>
          </div>
          <div>
            <span className="text-dark-brown/60 block text-[10px] uppercase font-bold">Contact Phone</span>
            <span className="font-mono text-espresso">{activePatient?.phone || 'Not recorded'}</span>
          </div>
          <div className="sm:col-span-2">
            <span className="text-dark-brown/60 block text-[10px] uppercase font-bold">Target Clinical Facility</span>
            <span className="font-bold text-forest break-words">{targetFacility}</span>
          </div>
        </div>

        {/* Retinal Fundus & Grad-CAM Heatmap Exhibit for Attending Ophthalmologist */}
        {(screeningResult?.left_gradcam_path || screeningResult?.right_gradcam_path || screeningResult?.left_image_path || screeningResult?.right_image_path) && (
          <div className="space-y-3 p-4 rounded-xl bg-sand/20 border border-border-soft">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-soft/60 pb-2">
              <h3 className="font-bold text-espresso uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-forest" />
                Retinal Fundus Scans &amp; AI Grad-CAM Lesion Heatmap Exhibit
              </h3>
              <div className="flex items-center gap-1.5 text-[10px] text-dark-brown/70 font-mono">
                <span>Normal Tissue</span>
                <div className="h-2 w-16 rounded-full bg-gradient-to-r from-blue-600 via-yellow-400 to-red-600"></div>
                <span className="text-terracotta-dark font-bold">Lesion Hotspot</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Eye Pair / Heatmap */}
              {(screeningResult?.left_image_path || screeningResult?.left_gradcam_path) && (
                <div className="bg-cream p-3 rounded-lg border border-border-soft space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-espresso border-b border-border-soft/50 pb-1">
                    <span>Left Eye (OS) — Grade {screeningResult?.left_dr_grade ?? screeningResult?.dr_grade}</span>
                    <span className="text-[10px] text-dark-brown/70 font-mono">{screeningResult?.left_dr_grade_name || screeningResult?.dr_grade_name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <div className="aspect-[4/3] bg-black rounded overflow-hidden flex items-center justify-center">
                        <img 
                          src={getFullImageUrl(screeningResult?.left_image_path)} 
                          alt="Left Eye Raw" 
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <span className="text-[9px] text-dark-brown/70 block text-center font-mono uppercase font-semibold">Raw Fundus</span>
                    </div>
                    <div className="space-y-1">
                      <div className="aspect-[4/3] bg-black rounded overflow-hidden flex items-center justify-center border border-terracotta/40">
                        <img 
                          src={getFullImageUrl(screeningResult?.left_gradcam_path || screeningResult?.left_image_path)} 
                          alt="Left Eye Heatmap" 
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <span className="text-[9px] text-terracotta-dark font-bold block text-center font-mono uppercase">Grad-CAM Heatmap</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Right Eye Pair / Heatmap */}
              {(screeningResult?.right_image_path || screeningResult?.right_gradcam_path) && (
                <div className="bg-cream p-3 rounded-lg border border-border-soft space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-espresso border-b border-border-soft/50 pb-1">
                    <span>Right Eye (OD) — Grade {screeningResult?.right_dr_grade ?? screeningResult?.dr_grade}</span>
                    <span className="text-[10px] text-dark-brown/70 font-mono">{screeningResult?.right_dr_grade_name || screeningResult?.dr_grade_name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <div className="aspect-[4/3] bg-black rounded overflow-hidden flex items-center justify-center">
                        <img 
                          src={getFullImageUrl(screeningResult?.right_image_path)} 
                          alt="Right Eye Raw" 
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <span className="text-[9px] text-dark-brown/70 block text-center font-mono uppercase font-semibold">Raw Fundus</span>
                    </div>
                    <div className="space-y-1">
                      <div className="aspect-[4/3] bg-black rounded overflow-hidden flex items-center justify-center border border-terracotta/40">
                        <img 
                          src={getFullImageUrl(screeningResult?.right_gradcam_path || screeningResult?.right_image_path)} 
                          alt="Right Eye Heatmap" 
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <span className="text-[9px] text-terracotta-dark font-bold block text-center font-mono uppercase">Grad-CAM Heatmap</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <p className="text-[10px] text-dark-brown/70 italic">
              *Grad-CAM heatmaps highlight focal areas of lesion concentration (hemorrhages, exudates, IRMA, neovascularization) driving the neural activation score.
            </p>
          </div>
        )}

        {/* Clinical Rationale & Finding */}
        <div className="space-y-2 text-xs leading-relaxed">
          <h3 className="font-bold text-espresso uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            Clinical AI Findings &amp; Specialist Rationale
          </h3>
          <p className="p-3 bg-sand/20 rounded-lg border border-border-soft text-dark-brown whitespace-pre-line leading-relaxed">
            {screeningResult?.explanation_text}
          </p>
        </div>

        {/* Instructions for Patient & Medical Staff */}
        <div className="border-t border-border-soft pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <span className="font-bold text-espresso block">Instructions for Patient:</span>
            <p className="text-dark-brown/80 text-[11px] leading-relaxed">
              Please present this official referral slip at the District Eye Hospital Ophthalmology Registration counter. 
              Do not drive alone on the examination day as pupil-dilating eye drops may be administered.
            </p>
          </div>

          <div className="space-y-1">
            <span className="font-bold text-espresso block">Hospital Clinical Action Required:</span>
            <p className="text-dark-brown/80 text-[11px] leading-relaxed">
              Dilated slit-lamp biomicroscopy, macular OCT assessment, and tele-ophthalmology triage confirmation.
            </p>
          </div>
        </div>

        {/* Signatures & Seal Block */}
        <div className="border-t border-border-soft pt-8 flex items-end justify-between text-xs">
          <div className="space-y-1">
            <div className="text-[11px] text-dark-brown/70">AI-assisted screening result</div>
          </div>

          <div className="text-right space-y-3">
            <div className="w-40 border-b border-dark-brown/50 pb-4">
            </div>
            <div className="text-[10px] text-dark-brown/70">
              Screening Officer Signature
            </div>
          </div>
        </div>
      </div>

      {/* Done & Return Action (hidden on print) */}
      <div className="no-print flex items-center justify-end pt-4">
        <button
          onClick={onFinish}
          className="bg-forest hover:bg-forest-hover text-cream font-bold px-7 py-3 rounded-xl shadow-sm transition-all flex items-center gap-2"
        >
          <span>Complete &amp; Return to Dashboard</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

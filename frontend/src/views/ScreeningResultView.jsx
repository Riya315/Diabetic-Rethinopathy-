import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon, 
  Layers, 
  SplitSquareVertical, 
  FilePlus2, 
  RefreshCw, 
  Info, 
  ShieldAlert, 
  Eye, 
  Check, 
  ChevronDown, 
  ChevronUp,
  Sparkles,
  MapPin,
  Stethoscope,
  Activity
} from 'lucide-react';
import { getFullImageUrl } from '../services/api';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import SlideTextButton from '../components/ui/SlideTextButton';

export const ScreeningResultView = ({ screeningResult, activePatient, onCreateReferral, onRetake, onComplete }) => {
  const reduceMotion = useReducedMotion();
  const imageTransition = reduceMotion ? { duration: 0 } : { duration: 0.2 };
  const hasLeft = Boolean(screeningResult?.left_image_path);
  const hasRight = Boolean(screeningResult?.right_image_path);
  const hasBoth = hasLeft && hasRight;

  const [activeEyeTab, setActiveEyeTab] = useState(hasBoth ? 'both' : (hasLeft ? 'left' : 'right'));
  const [displayMode, setDisplayMode] = useState('overlay'); // 'raw', 'overlay', 'side_by_side'


  if (!screeningResult) return null;

  const isReferable = screeningResult.referable;
  const isUrgent = screeningResult.urgency_tier === 'Urgent';

  const leftRaw = getFullImageUrl(screeningResult.left_image_path);
  const leftCam = getFullImageUrl(screeningResult.left_gradcam_path || screeningResult.left_image_path);
  const rightRaw = getFullImageUrl(screeningResult.right_image_path);
  const rightCam = getFullImageUrl(screeningResult.right_gradcam_path || screeningResult.right_image_path);

  const leftGrade = screeningResult.left_dr_grade ?? screeningResult.dr_grade;
  const leftGradeName = screeningResult.left_dr_grade_name || screeningResult.dr_grade_name;
  const leftConf = screeningResult.left_confidence ?? screeningResult.confidence;
  const leftRef = screeningResult.left_referable ?? screeningResult.referable;

  const rightGrade = screeningResult.right_dr_grade ?? screeningResult.dr_grade;
  const rightGradeName = screeningResult.right_dr_grade_name || screeningResult.dr_grade_name;
  const rightConf = screeningResult.right_confidence ?? screeningResult.confidence;
  const rightRef = screeningResult.right_referable ?? screeningResult.referable;

  const maxGrade = Math.max(leftGrade ?? 0, rightGrade ?? 0, screeningResult.dr_grade ?? 0);
  const isSevere = maxGrade >= 3;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8 animate-fadeIn">
      {/* Workflow Stepper */}
      <div className="flex items-center justify-between border-b border-border-soft pb-4">
        <div className="flex items-center gap-2 md:gap-4 text-xs md:text-sm font-medium">
          <div className="flex items-center gap-2 text-forest">
            <Check className="w-4 h-4 text-forest" />
            <span>Registration</span>
          </div>
          <span className="text-border-soft">/</span>
          <div className="flex items-center gap-2 text-forest">
            <Check className="w-4 h-4 text-forest" />
            <span>Capture</span>
          </div>
          <span className="text-border-soft">/</span>
          <div className="flex items-center gap-2 text-forest font-bold">
            <span className="w-6 h-6 rounded-full bg-forest text-cream flex items-center justify-center text-xs">3</span>
            <span>AI Result &amp; Lesion Map</span>
          </div>
          <span className="text-border-soft">/</span>
          <div className="flex items-center gap-2 text-dark-brown/40">
            <span className="w-6 h-6 rounded-full bg-sand text-dark-brown flex items-center justify-center text-xs">4</span>
            <span>Referral</span>
          </div>
        </div>

        {/* Patient Pill */}
        <div className="bg-sand px-3 py-1.5 rounded-lg border border-border-soft text-xs flex items-center gap-2">
          <span className="text-dark-brown/60">Patient:</span>
          <span className="font-bold text-espresso">{activePatient?.full_name || screeningResult.patient_code}</span>
          <span className="font-mono text-dark-brown/70">({activePatient?.patient_code || screeningResult.patient_code})</span>
        </div>
      </div>

      {/* Top Clinical Decision Banner */}
      <div className={`p-6 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm ${
        isUrgent
          ? 'bg-terracotta/15 border-terracotta text-terracotta-dark'
          : isReferable
            ? 'bg-sand border-terracotta/40 text-espresso'
            : 'bg-sage/20 border-sage/60 text-forest'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
            isUrgent 
              ? 'bg-terracotta text-cream' 
              : isReferable 
                ? 'bg-terracotta/80 text-cream' 
                : 'bg-forest text-cream'
          }`}>
            {isUrgent ? (
              <AlertOctagon className="w-7 h-7" />
            ) : isReferable ? (
              <AlertTriangle className="w-7 h-7" />
            ) : (
              <CheckCircle2 className="w-7 h-7" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full ${
                isReferable ? 'bg-terracotta/20 text-terracotta-dark font-mono' : 'bg-forest/15 text-forest font-mono'
              }`}>
                {screeningResult.urgency_tier} · {screeningResult.confidence_tier}
              </span>
              <span className="text-xs text-dark-brown/60 font-mono">[{screeningResult.screening_code}]</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold mt-1 text-espresso">
              {isReferable ? 'Refer for Specialist Tele-Ophthalmology Review' : 'No Specialist Referral Required (Routine)'}
            </h1>
            <p className="text-xs text-dark-brown/80 mt-0.5">
              Protocol: <span className="font-semibold">{screeningResult.suggested_timeframe}</span>
            </p>
          </div>
        </div>

        {/* Primary Action Button */}
        {isReferable ? (
          <SlideTextButton
            onClick={onCreateReferral}
            text="Generate Referral Slip"
            hoverText="Proceed"
            icon={FilePlus2}
          />
        ) : (
          <SlideTextButton
            onClick={onComplete}
            text="Complete Screening"
            hoverText="Back to Dashboard"
            icon={CheckCircle2}
          />
        )}
      </div>

      {/* Eye Selector Tabs */}
      <div className="flex items-center justify-between border-b border-border-soft pb-3">
        <div className="flex items-center gap-2">
          {hasLeft && (
            <button
              onClick={() => setActiveEyeTab('left')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeEyeTab === 'left'
                  ? 'bg-espresso text-cream shadow-sm'
                  : 'bg-sand/60 text-dark-brown hover:bg-sand'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Left Eye (OS): Grade {leftGrade} ({leftGradeName})</span>
              <span className={`w-2 h-2 rounded-full ${leftRef ? 'bg-terracotta' : 'bg-sage'}`}></span>
            </button>
          )}

          {hasRight && (
            <button
              onClick={() => setActiveEyeTab('right')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeEyeTab === 'right'
                  ? 'bg-espresso text-cream shadow-sm'
                  : 'bg-sand/60 text-dark-brown hover:bg-sand'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Right Eye (OD): Grade {rightGrade} ({rightGradeName})</span>
              <span className={`w-2 h-2 rounded-full ${rightRef ? 'bg-terracotta' : 'bg-sage'}`}></span>
            </button>
          )}

          {hasBoth && (
            <button
              onClick={() => setActiveEyeTab('both')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeEyeTab === 'both'
                  ? 'bg-espresso text-cream shadow-sm'
                  : 'bg-sand/60 text-dark-brown hover:bg-sand'
              }`}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              <span>Dual-Eye Side-by-Side</span>
            </button>
          )}
        </div>

        {/* Display Mode Switcher (Always available across both eyes and single eye tabs) */}
        <div className="flex items-center gap-1 bg-sand/60 p-1 rounded-xl border border-border-soft text-xs font-semibold">
          <button
            onClick={() => setDisplayMode('raw')}
            className={`px-3 py-1 rounded-lg transition-all ${displayMode === 'raw' ? 'bg-forest text-cream font-bold' : 'text-dark-brown'}`}
          >
            Raw Fundus
          </button>
          <button
            onClick={() => setDisplayMode('overlay')}
            className={`px-3 py-1 rounded-lg transition-all ${displayMode === 'overlay' ? 'bg-forest text-cream font-bold' : 'text-dark-brown'}`}
          >
            Grad-CAM Heatmap
          </button>
          <button
            onClick={() => setDisplayMode('side_by_side')}
            className={`px-3 py-1 rounded-lg transition-all ${displayMode === 'side_by_side' ? 'bg-forest text-cream font-bold' : 'text-dark-brown'}`}
          >
            Comparison
          </button>
        </div>
      </div>

      {/* DUAL-EYE SIDE-BY-SIDE VIEW */}
      {activeEyeTab === 'both' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Eye Card */}
            <div className="bg-cream border border-border-soft rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border-soft/60 pb-3">
                <div className="flex items-center gap-2 font-bold text-espresso text-sm">
                  <Eye className="w-4 h-4 text-forest" />
                  <span>Left Eye (OS) Retinal Scan</span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  leftRef ? 'bg-terracotta/20 text-terracotta-dark' : 'bg-sage/30 text-forest'
                }`}>
                  Grade {leftGrade} · Conf {leftConf}%
                </span>
              </div>

              <div className="aspect-[4/3] bg-black rounded-xl overflow-hidden relative flex items-center justify-center border border-border-soft/40">
                <AnimatePresence mode="wait">
                  {displayMode === 'raw' && (
                    <motion.img 
                      key="raw-both-left"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={imageTransition}
                      src={leftRaw} alt="Left eye Raw" className="max-h-full max-w-full object-contain" 
                    />
                  )}
                  {displayMode === 'overlay' && (
                    <motion.img 
                      key="cam-both-left"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={imageTransition}
                      src={leftCam} alt="Left eye Grad-CAM" className="max-h-full max-w-full object-contain" 
                    />
                  )}
                  {displayMode === 'side_by_side' && (
                    <motion.div 
                      key="sbs-both-left"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={imageTransition}
                      className="grid grid-cols-2 w-full h-full gap-1 p-1"
                    >
                      <div className="relative flex items-center justify-center bg-black rounded overflow-hidden">
                        <img src={leftRaw} alt="Left Raw" className="max-h-full max-w-full object-contain" />
                        <span className="absolute bottom-2 left-2 bg-espresso/80 text-sand text-[10px] px-2 py-0.5 rounded font-mono">Raw</span>
                      </div>
                      <div className="relative flex items-center justify-center bg-black rounded overflow-hidden">
                        <img src={leftCam} alt="Left Grad-CAM" className="max-h-full max-w-full object-contain" />
                        <span className="absolute bottom-2 left-2 bg-espresso/80 text-sand text-[10px] px-2 py-0.5 rounded font-mono">Grad-CAM</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="absolute top-2 left-2 bg-espresso/80 text-sand px-2 py-1 rounded text-[10px] font-mono">
                  {displayMode === 'raw' ? 'Raw Fundus Photo' : (displayMode === 'overlay' ? 'Grad-CAM Lesion Heatmap' : 'Raw vs Heatmap')}
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <div className="font-bold text-espresso">{leftGradeName}</div>
                <p className="text-dark-brown/80 whitespace-pre-line leading-relaxed">{screeningResult.left_explanation || screeningResult.explanation_text}</p>
              </div>
            </div>

            {/* Right Eye Card */}
            <div className="bg-cream border border-border-soft rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border-soft/60 pb-3">
                <div className="flex items-center gap-2 font-bold text-espresso text-sm">
                  <Eye className="w-4 h-4 text-forest" />
                  <span>Right Eye (OD) Retinal Scan</span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  rightRef ? 'bg-terracotta/20 text-terracotta-dark' : 'bg-sage/30 text-forest'
                }`}>
                  Grade {rightGrade} · Conf {rightConf}%
                </span>
              </div>

              <div className="aspect-[4/3] bg-black rounded-xl overflow-hidden relative flex items-center justify-center border border-border-soft/40">
                <AnimatePresence mode="wait">
                  {displayMode === 'raw' && (
                    <motion.img 
                      key="raw-both-right"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={imageTransition}
                      src={rightRaw} alt="Right eye Raw" className="max-h-full max-w-full object-contain" 
                    />
                  )}
                  {displayMode === 'overlay' && (
                    <motion.img 
                      key="cam-both-right"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={imageTransition}
                      src={rightCam} alt="Right eye Grad-CAM" className="max-h-full max-w-full object-contain" 
                    />
                  )}
                  {displayMode === 'side_by_side' && (
                    <motion.div 
                      key="sbs-both-right"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={imageTransition}
                      className="grid grid-cols-2 w-full h-full gap-1 p-1"
                    >
                      <div className="relative flex items-center justify-center bg-black rounded overflow-hidden">
                        <img src={rightRaw} alt="Right Raw" className="max-h-full max-w-full object-contain" />
                        <span className="absolute bottom-2 left-2 bg-espresso/80 text-sand text-[10px] px-2 py-0.5 rounded font-mono">Raw</span>
                      </div>
                      <div className="relative flex items-center justify-center bg-black rounded overflow-hidden">
                        <img src={rightCam} alt="Right Grad-CAM" className="max-h-full max-w-full object-contain" />
                        <span className="absolute bottom-2 left-2 bg-espresso/80 text-sand text-[10px] px-2 py-0.5 rounded font-mono">Grad-CAM</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="absolute top-2 left-2 bg-espresso/80 text-sand px-2 py-1 rounded text-[10px] font-mono">
                  {displayMode === 'raw' ? 'Raw Fundus Photo' : (displayMode === 'overlay' ? 'Grad-CAM Lesion Heatmap' : 'Raw vs Heatmap')}
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <div className="font-bold text-espresso">{rightGradeName}</div>
                <p className="text-dark-brown/80 whitespace-pre-line leading-relaxed">{screeningResult.right_explanation || screeningResult.explanation_text}</p>
              </div>
            </div>
          </div>

          {/* Grad-CAM Color Bar Legend in Dual-Eye View */}
          <div className="flex items-center justify-between bg-sand/30 p-3 rounded-xl border border-border-soft text-xs">
            <span className="font-bold text-espresso text-[11px] uppercase tracking-wider">AI Lesion Sensitivity:</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-dark-brown/60 font-mono">Normal Background</span>
              <div className="h-3 w-32 rounded-full bg-gradient-to-r from-blue-600 via-yellow-400 to-red-600 shadow-inner"></div>
              <span className="text-[10px] text-terracotta-dark font-bold font-mono">Active Lesions</span>
            </div>
          </div>
        </div>
      )}

      {/* SINGLE EYE DETAILED VIEW (Left or Right) */}
      {activeEyeTab !== 'both' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Visual Display */}
          <div className="lg:col-span-2 bg-cream border border-border-soft rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border-soft/60 pb-3">
              <div className="flex items-center gap-2 font-bold text-espresso text-sm">
                <Eye className="w-4 h-4 text-forest" />
                <span>{activeEyeTab === 'left' ? 'Left Eye (OS)' : 'Right Eye (OD)'} Retinal Assessment</span>
              </div>
              <div className="text-xs font-mono text-dark-brown/70">
                Grade {activeEyeTab === 'left' ? leftGrade : rightGrade}: {activeEyeTab === 'left' ? leftGradeName : rightGradeName}
              </div>
            </div>

            <div className="aspect-[4/3] bg-black rounded-xl overflow-hidden relative flex items-center justify-center border border-border-soft/40">
              <AnimatePresence mode="wait">
                {displayMode === 'raw' && (
                  <motion.img 
                    key={`raw-${activeEyeTab}`}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={imageTransition}
                    src={activeEyeTab === 'left' ? leftRaw : rightRaw} alt="Raw fundus" className="max-h-full max-w-full object-contain" 
                  />
                )}
                {displayMode === 'overlay' && (
                  <motion.img 
                    key={`overlay-${activeEyeTab}`}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={imageTransition}
                    src={activeEyeTab === 'left' ? leftCam : rightCam} alt="Grad-CAM overlay" className="max-h-full max-w-full object-contain" 
                  />
                )}
                {displayMode === 'side_by_side' && (
                  <motion.div 
                    key={`sbs-${activeEyeTab}`}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={imageTransition}
                    className="grid grid-cols-2 w-full h-full gap-1 p-1"
                  >
                    <div className="relative flex items-center justify-center bg-black rounded overflow-hidden">
                      <img src={activeEyeTab === 'left' ? leftRaw : rightRaw} alt="Raw" className="max-h-full max-w-full object-contain" />
                      <span className="absolute bottom-2 left-2 bg-espresso/80 text-sand text-[10px] px-2 py-0.5 rounded font-mono">Raw</span>
                    </div>
                    <div className="relative flex items-center justify-center bg-black rounded overflow-hidden">
                      <img src={activeEyeTab === 'left' ? leftCam : rightCam} alt="Grad-CAM" className="max-h-full max-w-full object-contain" />
                      <span className="absolute bottom-2 left-2 bg-espresso/80 text-sand text-[10px] px-2 py-0.5 rounded font-mono">Grad-CAM</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Grad-CAM Color Bar Legend */}
            <div className="flex items-center justify-between bg-sand/30 p-3 rounded-xl border border-border-soft text-xs">
              <span className="font-bold text-espresso text-[11px] uppercase tracking-wider">AI Lesion Sensitivity:</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-dark-brown/60 font-mono">Normal Background</span>
                <div className="h-3 w-32 rounded-full bg-gradient-to-r from-blue-600 via-yellow-400 to-red-600 shadow-inner"></div>
                <span className="text-[10px] text-terracotta-dark font-bold font-mono">Active Lesions</span>
              </div>
            </div>
          </div>

          {/* Diagnostic Details Panel */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-cream border border-border-soft rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="font-bold text-espresso text-sm border-b border-border-soft/60 pb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-forest" />
                <span>AI Clinical Narrative</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-dark-brown/60 uppercase block text-[10px] font-bold">Predicted DR Stage</span>
                  <span className="font-bold text-espresso text-base">
                    {activeEyeTab === 'left' ? leftGradeName : rightGradeName}
                  </span>
                </div>

                <div>
                  <span className="text-dark-brown/60 uppercase block text-[10px] font-bold">Model Prediction Confidence</span>
                  <span className="font-bold text-espresso text-base font-mono">
                    {activeEyeTab === 'left' ? leftConf : rightConf}%
                  </span>
                  <span className="text-[10px] text-dark-brown/50 block mt-0.5">
                    Softmax probability for predicted class — not a clinical certainty measure.
                  </span>
                  {(activeEyeTab === 'left' ? leftConf : rightConf) < 30 && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-terracotta font-semibold bg-terracotta/10 px-2 py-1 rounded-lg border border-terracotta/20">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                      <span>Low certainty — prediction may be unreliable</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-border-soft/60">
                  <span className="text-dark-brown/60 uppercase block text-[10px] font-bold">Clinical Explanation</span>
                  <p className="text-dark-brown text-xs mt-1 leading-relaxed whitespace-pre-line">
                    {activeEyeTab === 'left' ? (screeningResult.left_explanation || screeningResult.explanation_text) : (screeningResult.right_explanation || screeningResult.explanation_text)}
                  </p>
                </div>
              </div>
            </div>

            {/* Retake / Actions */}
            <div className="bg-sand/30 border border-border-soft rounded-2xl p-4 space-y-3 text-xs">
              <button
                onClick={onRetake}
                className="w-full py-2.5 bg-cream hover:bg-border-soft border border-border-soft rounded-xl font-semibold text-espresso flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Recapture Retinal Scan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Doctor Guidance & Clinical Decision Support Section */}
      <div className="bg-cream border-2 border-border-soft rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-soft pb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${
              isSevere 
                ? 'bg-terracotta/20 text-terracotta-dark' 
                : isReferable 
                  ? 'bg-terracotta/15 text-terracotta-dark' 
                  : 'bg-sage/20 text-forest'
            }`}>
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-espresso flex items-center gap-2">
                <span>AI Clinical Summary &amp; Doctor Referral Protocol</span>
              </h2>
              <p className="text-xs text-dark-brown/70">
                Automated clinical decision support &amp; triaging guidance for health workers and attending ophthalmologists.
              </p>
            </div>
          </div>

          {/* Need for Doctor Status Badge */}
          <div className={`px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 ${
            isSevere
              ? 'bg-terracotta text-cream border-terracotta shadow-sm'
              : isReferable
                ? 'bg-terracotta/15 text-terracotta-dark border-terracotta/30'
                : 'bg-sage/20 text-forest border-sage/40'
          }`}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              {isSevere 
                ? '🚨 DOCTOR CONSULTATION URGENTLY REQUIRED' 
                : isReferable 
                  ? '⚠️ DOCTOR CONSULTATION RECOMMENDED' 
                  : '✅ NO SPECIALIST REQUIRED (ROUTINE CARE)'}
            </span>
          </div>
        </div>

        {/* Structured Grid: AI Case Summary & Doctor Action Plan */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Column 1: AI Case Summary & Grad-CAM Heatmap Interpretation */}
          <div className="bg-sand/30 border border-border-soft rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 font-bold text-espresso uppercase tracking-wider text-[11px]">
              <Sparkles className="w-4 h-4 text-forest" />
              <span>AI Pathology &amp; Heatmap Summary</span>
            </div>
            <div className="space-y-2 text-dark-brown leading-relaxed">
              <p className="whitespace-pre-line bg-cream p-3 rounded-lg border border-border-soft">
                {screeningResult.explanation_text}
              </p>
              <div className="p-3 bg-sand/40 rounded-lg border border-border-soft text-[11px] space-y-1">
                <span className="font-bold text-espresso block">📍 Where is the Heatmap?</span>
                <p className="text-dark-brown/80">
                  The <strong>Grad-CAM Lesion Heatmap</strong> is displayed in the viewer above. Warm red and yellow highlights pinpoint lesion clusters (hemorrhages, exudates, IRMA, neovascularization) driving the model's severity grading. Use the <em>"Raw Fundus"</em> / <em>"Grad-CAM Heatmap"</em> / <em>"Comparison"</em> buttons above to inspect focal pathology against raw retinal tissue.
                </p>
              </div>
            </div>
          </div>

          {/* Column 2: Specific Doctor / Ophthalmologist Workup */}
          <div className="bg-sand/30 border border-border-soft rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 font-bold text-espresso uppercase tracking-wider text-[11px]">
              <Activity className="w-4 h-4 text-forest" />
              <span>Recommended Specialist Clinical Workup</span>
            </div>
            <div className="space-y-2.5">
              <div className="bg-cream p-3 rounded-lg border border-border-soft space-y-2">
                <span className="font-bold text-espresso block text-[11px]">Key Recommended Examinations:</span>
                <ul className="space-y-1.5 list-disc list-inside text-dark-brown/90 text-[11px]">
                  <li><strong>Dilated Slit-Lamp Biomicroscopy:</strong> Non-contact 78D/90D lens fundus exam to inspect posterior pole and peripheral retina.</li>
                  <li><strong>Macular Spectral-Domain OCT:</strong> High-resolution optical coherence tomography to quantify central macular thickness and rule out Diabetic Macular Edema (DME).</li>
                  {maxGrade >= 3 && (
                    <li><strong>Fundus Fluorescein Angiography (FFA):</strong> Assess retinal capillary non-perfusion zones and confirm neovascularization (NVD/NVE).</li>
                  )}
                </ul>
              </div>

              <div className="bg-cream p-3 rounded-lg border border-border-soft space-y-1.5">
                <span className="font-bold text-espresso block text-[11px]">Therapeutic Considerations:</span>
                <p className="text-dark-brown/80 text-[11px] leading-relaxed">
                  {maxGrade >= 4 ? (
                    <strong className="text-terracotta-dark">Immediate tertiary vitreoretinal evaluation. Urgent consideration of anti-VEGF intravitreal injections (Aflibercept/Ranibizumab) or prompt Panretinal Photocoagulation (PRP) laser to prevent tractional detachment and severe vision loss.</strong>
                  ) : maxGrade === 3 ? (
                    <span>Close ophthalmologic surveillance (every 2–4 weeks), evaluate for early Panretinal Photocoagulation (PRP) laser, and enforce strict glycemic (HbA1c &lt; 7%) and blood pressure control.</span>
                  ) : maxGrade === 2 ? (
                    <span>Schedule formal ophthalmology appointment within 30 days. Evaluate for DME and optimize systemic metabolic risk factors.</span>
                  ) : (
                    <span>Annual dilated retinal re-screening at the Primary Health Centre. Reinforce standard diabetes self-management.</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mandatory Non-collapsible Clinical Disclaimer */}
      <div className="bg-sand/30 border border-border-soft rounded-2xl p-5 flex items-start gap-3.5 text-xs text-dark-brown/80 shadow-sm">
        <ShieldAlert className="w-5 h-5 text-forest flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-espresso block">
            Statutory Clinical Decision Support Disclaimer (DISHA &amp; Telemedicine Guidelines)
          </span>
          <p className="leading-relaxed text-[11px]">
            DrishtiCare is a triaging and screening assistance tool intended to filter referable pathology in primary healthcare settings. 
            AI outputs do not constitute a definitive medical diagnosis. All patients flagged with Moderate NPDR, Severe NPDR, or PDR 
            (Grades 2–4) must receive a comprehensive dilated slit-lamp and OCT examination by a certified ophthalmologist.
          </p>
        </div>
      </div>
    </div>
  );
};

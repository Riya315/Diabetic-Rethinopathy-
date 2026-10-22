/**
 * DrishtiCare AI Assistant — fully client-side, knowledge-base powered chatbot.
 * No external API key required. Uses a structured knowledge base about DR, heatmaps,
 * clinical protocols, and the DrishtiCare app.
 */

const KNOWLEDGE_BASE = [
  // Grading
  { keywords: ['grade 0', 'normal', 'no dr', 'no diabetic retinopathy', 'healthy eye'],
    answer: `**Grade 0 — No Diabetic Retinopathy (Normal)**\n\n✅ The retina shows no signs of diabetic damage. No microaneurysms, hemorrhages, or exudates detected.\n\n**Action:** No specialist referral needed. Schedule routine annual re-screening and encourage glycemic control (target HbA1c < 7%).` },

  { keywords: ['grade 1', 'mild', 'mild npdr', 'mild non-proliferative'],
    answer: `**Grade 1 — Mild NPDR**\n\nℹ️ A few isolated microaneurysms visible. Below the referable threshold — no immediate specialist visit needed.\n\n**Action:** Re-screen in 6–12 months. Advise the patient to maintain blood sugar and blood pressure control.` },

  { keywords: ['grade 2', 'moderate', 'moderate npdr'],
    answer: `**Grade 2 — Moderate NPDR (Referable)**\n\n⚠️ Multiple dot/blot hemorrhages and hard exudates detected. This case **requires specialist review**.\n\n**Action:** Generate a referral slip (button at top of results screen). Patient must see an ophthalmologist **within 30 days** for dilated slit-lamp exam and macular OCT.` },

  { keywords: ['grade 3', 'severe', 'severe npdr', 'urgent'],
    answer: `**Grade 3 — Severe NPDR (Urgent Referral)**\n\n🚨 Extensive retinal hemorrhages in 4 quadrants detected (4-2-1 rule). High risk of progressing to PDR.\n\n**Action:** Priority referral required — patient must see an ophthalmologist **within 2–4 weeks**. Recommend FFA and SD-OCT at the specialist centre.` },

  { keywords: ['grade 4', 'pdr', 'proliferative', 'neovascular', 'nvd', 'nve'],
    answer: `**Grade 4 — Proliferative DR (Immediate Intervention)**\n\n🚨 **CRITICAL:** New blood vessels (neovascularization) growing on the retina. Risk of vitreous hemorrhage or retinal detachment.\n\n**Action:** Emergency referral — patient must see a vitreoretinal specialist **within 48–72 hours**. Anti-VEGF injections or urgent laser (PRP) therapy may be required.` },

  // Heatmap
  { keywords: ['heatmap', 'grad-cam', 'gradcam', 'heat map', 'lesion map', 'where is heatmap', 'show heatmap'],
    answer: `**📍 Grad-CAM Lesion Heatmap**\n\nThe Grad-CAM heatmap shows *exactly where* the AI detected lesions on the retina.\n\n**How to find it:**\n1. After AI screening completes, go to the **Results screen**.\n2. Use the toggle above the image viewer:\n   - **Raw Fundus** — original retinal photograph\n   - **Grad-CAM Heatmap** — AI attention overlay\n   - **Comparison** — side-by-side view\n\n**Color meaning:**\n- 🔵 Blue/cool = Normal background retina\n- 🟡 Yellow = Moderate lesion activity\n- 🔴 Red/warm = High-intensity lesion hotspot\n\nThe heatmap is also embedded in the **official referral slip** so the ophthalmologist can see it.` },

  // Referral slip
  { keywords: ['referral', 'referral slip', 'generate referral', 'send to doctor', 'how to refer'],
    answer: `**📋 Generating a Referral Slip**\n\n1. After AI screening, if the case is **Grade 2, 3, or 4**, the top banner will show **"Refer for Specialist Review"**.\n2. Click **"Generate Referral Slip"** (green button).\n3. The system creates an official slip with:\n   - Patient demographics\n   - DR grade & AI confidence\n   - Grad-CAM heatmap images\n   - Clinical action plan for the ophthalmologist\n4. Click **"Print Official Slip"** to print or save as PDF.\n\nAll referrals are tracked in the **Referrals tab** on the left sidebar.` },

  // Quality check
  { keywords: ['quality', 'blurry', 'image rejected', 'poor quality', 'retake', 'quality fail'],
    answer: `**📷 Image Quality Issues**\n\nIf the image is rejected by the Quality Gatekeeper:\n\n**Common causes:**\n- Image too blurry (low sharpness score)\n- Under/overexposed (brightness out of range)\n- Lens not properly focused on the fundus\n\n**Fixes:**\n1. Ask patient to rest chin firmly on the slit lamp rest\n2. Ask patient to blink once, then hold gaze on the internal LED\n3. Refocus the lens slowly before capturing\n4. Ensure the room is dimly lit to dilate the pupil naturally\n\nClick **"Recapture Retinal Scan"** on the results screen to try again.` },

  // Offline mode
  { keywords: ['offline', 'no internet', 'internet outage', 'sync', 'local mode'],
    answer: `**📡 Offline / Local Mode**\n\nDrishtiCare works **fully offline**. All AI inference runs locally on this computer.\n\n**In offline mode:**\n- Patient registration and screenings are saved to local SQLite database\n- The Grad-CAM AI model runs on-device (no cloud needed)\n- Records queue up in the Sync Centre\n\n**When internet returns:**\n- Go to **Sync Centre** (left sidebar)\n- Click **Sync Now** to push all pending records to the district server\n\nThe Online/Local indicator is shown in the top-right corner.` },

  // Doctor / need for doctor
  { keywords: ['doctor', 'need doctor', 'should i refer', 'do i need specialist', 'when to refer', 'ophthalmologist'],
    answer: `**👨‍⚕️ When is a Doctor Required?**\n\n| Grade | DR Stage | Refer? | Timeframe |\n|-------|----------|--------|-----------|\n| 0 | No DR | ❌ No | Annual screening |\n| 1 | Mild NPDR | ❌ No | Re-screen 6–12 months |\n| 2 | Moderate NPDR | ✅ Yes | Within 30 days |\n| 3 | Severe NPDR | 🚨 Urgent | Within 2–4 weeks |\n| 4 | Proliferative DR | 🚨 Emergency | Within 48–72 hours |\n\nThe AI result screen shows a clear banner: **"Doctor Consultation Required"** or **"No Specialist Required"**.` },

  // Confidence score
  { keywords: ['confidence', 'confidence score', 'certainty', 'accuracy', 'how sure', 'percentage'],
    answer: `**📊 AI Confidence Score**\n\nThe confidence % shown (e.g. "87% confidence") is the AI model's **softmax probability** for the predicted DR grade.\n\n**Important caveats:**\n- High confidence (>75%) = model is fairly certain\n- Low confidence (<30%) = prediction may be unreliable → consider retaking the image\n- This is NOT a clinical certainty — always follow up referable cases with a qualified ophthalmologist\n\nThe confidence tier is shown as "High Confidence" or "Moderate Confidence" on the results card.` },

  // New screening
  { keywords: ['new patient', 'new screening', 'start screening', 'register patient', 'how to start'],
    answer: `**▶️ Starting a New Screening**\n\n1. Click **"New Screening"** on the Dashboard or use the sidebar\n2. **Register the patient** — enter name, age, gender, village, phone, diabetes duration\n3. **Capture image** — upload retinal fundus photo or use sample images\n4. The AI automatically runs quality check, DR grading, and Grad-CAM heatmap generation\n5. Review results, then generate a referral slip if needed\n\nThe whole workflow takes ~2–3 minutes per patient.` },

  // About DrishtiCare
  { keywords: ['what is drishticare', 'about', 'how does it work', 'drishti', 'platform'],
    answer: `**👁️ About DrishtiCare**\n\nDrishtiCare is an **AI-powered Diabetic Retinopathy (DR) screening platform** designed for rural India under the National Health Mission.\n\n**How it works:**\n1. A frontline health worker (ASHA/ANM) captures retinal fundus photos\n2. An on-device **PyTorch EfficientNet-B0** model grades DR severity (Grade 0–4)\n3. **Grad-CAM** generates explainability heatmaps showing lesion locations\n4. The system auto-generates referral slips for specialist tele-ophthalmology\n5. Works **fully offline** with automatic sync to district hubs\n\nBuilt for Smart India Hackathon 2026 · Problem Statement 26038.` },

  // Diabetes
  { keywords: ['diabetes', 'blood sugar', 'hba1c', 'glycemic', 'sugar control'],
    answer: `**🩺 Diabetes & Eye Health**\n\nHigh blood sugar over time damages tiny blood vessels in the retina, causing **Diabetic Retinopathy (DR)**.\n\n**Key targets to advise patients:**\n- Blood sugar (HbA1c) < 7.0%\n- Blood pressure < 130/80 mmHg\n- Regular annual eye screening if diabetic > 5 years\n\nEarly detection (Grade 0–1) can prevent vision loss with lifestyle management. Grades 2–4 require specialist treatment.` },

  // Default fallback
  { keywords: [],
    answer: `I'm the **DrishtiCare AI Assistant** 🤖\n\nI can help you with:\n- 📊 Understanding DR grades (Grade 0–4)\n- 🔬 Reading the Grad-CAM heatmap\n- 📋 Generating and printing referral slips\n- 📷 Fixing image quality issues\n- 📡 Offline mode and sync\n- 👨‍⚕️ Knowing when to refer a patient to a doctor\n\nJust type your question below!` }
];

export function getAIResponse(userMessage) {
  const msg = userMessage.toLowerCase().trim();

  // Find best matching knowledge base entry
  for (const entry of KNOWLEDGE_BASE.slice(0, -1)) {
    if (entry.keywords.some(kw => msg.includes(kw))) {
      return entry.answer;
    }
  }

  // Fallback — check for greetings
  if (/^(hi|hello|hey|namaste|good|help)\b/.test(msg)) {
    return KNOWLEDGE_BASE[KNOWLEDGE_BASE.length - 1].answer;
  }

  // Generic fallback
  return `I don't have specific information about that. Here's what I can help with:\n\n- **DR Grades** — ask "What is grade 3?" or "When do I need a doctor?"\n- **Heatmap** — ask "Where is the heatmap?" or "How to read heatmap?"\n- **Referral** — ask "How to generate referral slip?"\n- **Quality issues** — ask "Image rejected, what do I do?"\n- **Offline mode** — ask "How does offline mode work?"\n\nTry rephrasing your question!`;
}

export const SUGGESTED_QUESTIONS = [
  "What is Grade 3 DR?",
  "Where is the heatmap?",
  "When should I refer a patient?",
  "Image quality rejected — what to do?",
  "How does offline mode work?",
  "How do I generate a referral slip?",
];

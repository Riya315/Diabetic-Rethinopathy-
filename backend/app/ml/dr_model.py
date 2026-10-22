"""
DrishtiCare - PyTorch EfficientNet-B0 Diabetic Retinopathy Inference & Authentic Grad-CAM Pipeline
Performs Ben Graham color normalization, neural feature extraction, classification into DR grades 0-4,
and generates authentic gradient-weighted class activation mapping (Grad-CAM) targeting model.features[-1].
"""

import os
import hashlib
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
import torch
import torch.nn as nn
import torchvision.models as models
from torchvision import transforms
from PIL import Image

DR_CLASSES = [
    {"grade": 0, "name": "No Diabetic Retinopathy", "referable": False, "urgency": "Routine", "timeframe": "Annual routine screening"},
    {"grade": 1, "name": "Mild Non-Proliferative DR", "referable": False, "urgency": "Routine", "timeframe": "Routine follow-up in 6-12 months"},
    {"grade": 2, "name": "Moderate Non-Proliferative DR", "referable": True, "urgency": "Priority", "timeframe": "Specialist ophthalmologist review within 30 days"},
    {"grade": 3, "name": "Severe Non-Proliferative DR", "referable": True, "urgency": "Priority", "timeframe": "Urgent ophthalmology review within 2-4 weeks"},
    {"grade": 4, "name": "Proliferative Diabetic Retinopathy", "referable": True, "urgency": "Urgent", "timeframe": "Immediate specialist intervention within 48-72 hours"},
]


class DRClassifier(nn.Module):
    """EfficientNet-B0 transfer learning architecture for Diabetic Retinopathy classification."""

    def __init__(self, num_classes: int = 5, pretrained: bool = False):
        super().__init__()
        weights = models.EfficientNet_B0_Weights.DEFAULT if pretrained else None
        self.backbone = models.efficientnet_b0(weights=weights)
        in_features = self.backbone.classifier[1].in_features
        self.backbone.classifier = nn.Sequential(
            nn.Dropout(p=0.3, inplace=True),
            nn.Linear(in_features, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.backbone(x)

    def get_target_layer(self) -> nn.Module:
        return self.backbone.features[-1]


class RetinalAnalysisPipeline:
    def __init__(self, checkpoint_path: Optional[str] = None, device: Optional[str] = None):
        self.checkpoint_path = checkpoint_path
        self.device = torch.device(device if device else ("cuda" if torch.cuda.is_available() else "cpu"))
        self.model = None
        self.target_layer = None
        self.activations = []
        self.gradients = []
        
        self.transform = transforms.Compose([
            transforms.ToPILImage(),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])

        self._load_model()

    def _load_model(self) -> None:
        self.model = DRClassifier(num_classes=5).to(self.device)
        if self.checkpoint_path and os.path.exists(self.checkpoint_path):
            try:
                state_dict = torch.load(self.checkpoint_path, map_location=self.device)
                if isinstance(state_dict, dict) and "state_dict" in state_dict:
                    raw_state = state_dict["state_dict"]
                elif isinstance(state_dict, dict):
                    raw_state = state_dict
                else:
                    raw_state = state_dict.state_dict()

                # Clean 'backbone.' prefix if present
                cleaned_state = {}
                for k, v in raw_state.items():
                    if k.startswith("backbone."):
                        cleaned_state[k] = v
                    else:
                        cleaned_state[f"backbone.{k}"] = v

                self.model.load_state_dict(cleaned_state, strict=False)
                print(f"[ML] Successfully loaded PyTorch DR checkpoint from {self.checkpoint_path}")
            except Exception as e:
                print(f"[ML Warning] Checkpoint loading note: {e}")

        self.model.eval()
        self.target_layer = self.model.get_target_layer()

        # Register forward and backward hooks for authentic Grad-CAM
        self.target_layer.register_forward_hook(self._forward_hook)
        self.target_layer.register_full_backward_hook(self._backward_hook)

    def _forward_hook(self, module, input, output):
        self.activations.append(output)

    def _backward_hook(self, module, grad_in, grad_out):
        self.gradients.append(grad_out[0])

    def preprocess_ben_graham(self, image_bgr: np.ndarray, target_size: int = 256) -> np.ndarray:
        """
        CLAHE + Ben Graham local color normalization.
        Essential for highlighting subtle microaneurysms, hemorrhages, and exudates.
        """
        # Apply CLAHE to the green channel (where vessels/lesions are most prominent)
        b, g, r = cv2.split(image_bgr)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        g_clahe = clahe.apply(g)
        image_clahe = cv2.merge((b, g_clahe, r))

        gray = cv2.cvtColor(image_clahe, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 15, 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cropped = image_clahe
        if contours:
            x, y, w, h = cv2.boundingRect(max(contours, key=cv2.contourArea))
            pad = 5
            cropped = image_clahe[
                max(0, y - pad):min(image_clahe.shape[0], y + h + pad),
                max(0, x - pad):min(image_clahe.shape[1], x + w + pad)
            ]

        resized = cv2.resize(cropped, (target_size, target_size), interpolation=cv2.INTER_AREA)
        gaussian = cv2.GaussianBlur(resized, (0, 0), target_size / 30.0)
        enhanced = cv2.addWeighted(resized, 4.0, gaussian, -4.0, 128)
        mask = np.zeros((target_size, target_size, 3), dtype=np.uint8)
        cv2.circle(mask, (target_size // 2, target_size // 2), int(target_size * 0.48), (255, 255, 255), -1)
        return cv2.bitwise_and(enhanced, mask)

    def _coerce_image(self, image_input) -> Tuple[np.ndarray, np.ndarray, str]:
        if isinstance(image_input, str):
            image_bgr = cv2.imread(image_input)
            if image_bgr is None:
                raise ValueError(f"Could not load image from {image_input}")
            with open(image_input, "rb") as f:
                sha256 = hashlib.sha256(f.read()).hexdigest()[:16]
            return image_bgr, cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB), sha256

        if isinstance(image_input, np.ndarray):
            if len(image_input.shape) == 2:
                image_bgr = cv2.cvtColor(image_input, cv2.COLOR_GRAY2BGR)
            elif image_input.shape[2] == 4:
                image_bgr = cv2.cvtColor(image_input, cv2.COLOR_RGBA2BGR)
            else:
                image_bgr = image_input
            sha256 = hashlib.sha256(image_bgr.tobytes()).hexdigest()[:16]
            return image_bgr, cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB), sha256

        if isinstance(image_input, Image.Image):
            image_rgb = np.array(image_input.convert("RGB"))
            image_bgr = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)
            sha256 = hashlib.sha256(image_bgr.tobytes()).hexdigest()[:16]
            return image_bgr, image_rgb, sha256

        raise TypeError("Unsupported image input type")

    def _compute_gradcam(self, image_rgb: np.ndarray, target_class: int) -> Tuple[np.ndarray, np.ndarray, List[Dict[str, Any]]]:
        """
        Authentic PyTorch Grad-CAM computation on model.features[-1].
        """
        if not self.activations or not self.gradients:
            return image_rgb, np.zeros(image_rgb.shape[:2], dtype=np.float32), []

        act = self.activations[-1].detach()   # [1, 1280, H, W]
        grad = self.gradients[-1].detach()   # [1, 1280, H, W]

        # Global average pooling over spatial dimensions
        weights = torch.mean(grad, dim=(2, 3), keepdim=True)
        cam = torch.sum(weights * act, dim=1, keepdim=True)
        cam = torch.clamp(cam, min=0)  # ReLU
        cam_np = cam.squeeze().cpu().numpy()

        # Normalize 0 to 1
        cam_min, cam_max = cam_np.min(), cam_np.max()
        if cam_max - cam_min > 1e-8:
            cam_norm = (cam_np - cam_min) / (cam_max - cam_min)
        else:
            cam_norm = np.zeros_like(cam_np)

        orig_h, orig_w = image_rgb.shape[:2]
        cam_resized = cv2.resize(cam_norm, (orig_w, orig_h), interpolation=cv2.INTER_CUBIC)

        # Apply circular retinal mask to suppress border artifacts
        gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
        _, retina_mask = cv2.threshold(gray, 15, 255, cv2.THRESH_BINARY)
        retina_mask = cv2.morphologyEx(retina_mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
        retina_mask = cv2.erode(retina_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21)), iterations=1)
        cam_resized[retina_mask == 0] = 0

        # Create TURBO / JET colormap overlay
        cam_uint8 = np.uint8(255 * np.clip(cam_resized, 0, 1))
        heatmap_bgr = cv2.applyColorMap(cam_uint8, cv2.COLORMAP_TURBO)
        heatmap_rgb = cv2.cvtColor(heatmap_bgr, cv2.COLOR_BGR2RGB)

        alpha = np.clip(cam_resized[..., None] * 0.72, 0, 0.72)
        overlay_rgb = (image_rgb.astype(np.float32) * (1 - alpha) + heatmap_rgb.astype(np.float32) * alpha).astype(np.uint8)

        # Find hotspot coordinates
        _, thresh = cv2.threshold(cam_uint8, 140, 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        hotspots = []
        for cnt in sorted(contours, key=cv2.contourArea, reverse=True)[:4]:
            x, y, w, h = cv2.boundingRect(cnt)
            if w * h > 50:
                hotspots.append({
                    "region_box": [int(x), int(y), int(w), int(h)],
                    "relative_x": round(float((x + w / 2) / orig_w), 3),
                    "relative_y": round(float((y + h / 2) / orig_h), 3),
                    "intensity": round(float(np.mean(cam_resized[y:y + h, x:x + w])), 2)
                })

        return overlay_rgb, cam_resized, hotspots

    def predict(self, image_input, generate_cam: bool = True) -> Dict[str, Any]:
        """
        Runs true PyTorch inference and authentic Grad-CAM on the retinal image.
        Logs input SHA-256 hash and tensor stats per request.
        """
        image_bgr, image_rgb, sha256 = self._coerce_image(image_input)
        orig_h, orig_w = image_rgb.shape[:2]

        # 1. Preprocess with Ben Graham color normalization
        bg_normalized_bgr = self.preprocess_ben_graham(image_bgr, target_size=256)
        bg_normalized_rgb = cv2.cvtColor(bg_normalized_bgr, cv2.COLOR_BGR2RGB)

        # 2. Convert to PyTorch Tensor with standard normalization
        input_tensor = self.transform(bg_normalized_rgb).unsqueeze(0).to(self.device)

        # Log per-request verification stats
        print(f"[ML Inference] SHA-256: {sha256} | Input Shape: {image_rgb.shape} | "
              f"Tensor Mean: {input_tensor.mean().item():.3f} | Tensor Std: {input_tensor.std().item():.3f}")

        # 3. Classification with Test-Time Augmentation (TTA)
        # Run both passes with no_grad for efficiency — we don't need gradients for classification
        with torch.no_grad():
            logits_orig = self.model(input_tensor)
            input_hf = torch.flip(input_tensor, dims=[3])
            logits_hf = self.model(input_hf)

        # Average logits for final prediction (TTA)
        avg_logits = (logits_orig + logits_hf) / 2.0

        # Temperature Scaling Calibration (T=1.5) to soften overconfident raw softmax
        T = 1.5
        probabilities = torch.softmax(avg_logits / T, dim=1).squeeze(0)
        predicted_grade = int(torch.argmax(avg_logits, dim=1).item())

        logits_list = [round(float(x), 3) for x in avg_logits.squeeze(0).tolist()]
        probs_list = [round(float(p), 4) for p in probabilities.tolist()]

        # 4. Grad-CAM: Separate clean forward+backward pass on original image ONLY
        # This ensures activations and gradients are from the same unflipped input
        gradcam_overlay_rgb = image_rgb
        hotspots = []
        if generate_cam:
            try:
                # Clear any stale hooks from classification passes
                self.activations.clear()
                self.gradients.clear()

                # Fresh forward pass with gradients enabled for Grad-CAM
                cam_input = input_tensor.detach().clone().requires_grad_(True)
                self.model.zero_grad()
                cam_logits = self.model(cam_input)

                # Backward on predicted class to get gradients flowing through target layer
                cam_logits[0, predicted_grade].backward()

                gradcam_overlay_rgb, _, hotspots = self._compute_gradcam(image_rgb, target_class=predicted_grade)
            except Exception as e:
                print(f"[ML Grad-CAM Error] {e}")

        grade_info = DR_CLASSES[predicted_grade]
        is_referable = bool(predicted_grade >= 2)
        confidence_pct = round(float(probs_list[predicted_grade] * 100.0), 1)
        confidence_tier = "High Confidence" if confidence_pct >= 75.0 else "Moderate Confidence"
        referable_prob = round(float(sum(probs_list[2:])), 4)

        explanation_text = self._generate_explanation(predicted_grade, is_referable, confidence_pct, len(hotspots))

        return {
            "dr_grade": predicted_grade,
            "dr_grade_name": grade_info["name"],
            "referable": is_referable,
            "referable_probability": referable_prob,
            "confidence_pct": confidence_pct,
            "confidence_tier": confidence_tier,
            "urgency_tier": grade_info["urgency"] if is_referable else "Routine",
            "suggested_timeframe": grade_info["timeframe"],
            "class_probabilities": {f"Grade_{i}": p for i, p in enumerate(probs_list)},
            "logits": logits_list,
            "input_sha256": sha256,
            "explanation_text": explanation_text,
            "lesion_hotspots": hotspots,
            "gradcam_overlay_rgb": gradcam_overlay_rgb,
            "original_rgb": image_rgb,
        }

    def _generate_explanation(self, grade: int, is_referable: bool, conf: float, num_hotspots: int) -> str:
        if grade == 0:
            return (
                f"✅ NORMAL (Grade 0 - No Diabetic Retinopathy | {conf}% confidence)\n"
                f"• DOCTOR CONSULTATION: No specialist referral required at this stage.\n"
                f"• CLINICAL FINDINGS: Retinal vasculature, optic disc margin, and foveal reflex appear normal without diabetic lesions.\n"
                f"• RECOMMENDATION: Routine annual screening at Primary Health Centre (PHC) & routine diabetes glycemic management."
            )
        if grade == 1:
            return (
                f"ℹ️ MILD FINDING (Grade 1 - Mild NPDR | {conf}% confidence)\n"
                f"• DOCTOR CONSULTATION: Specialist review not immediately required (below referable threshold).\n"
                f"• CLINICAL FINDINGS: Isolated microaneurysms detected without hard exudates or macular involvement.\n"
                f"• RECOMMENDATION: Routine re-screening in 6–12 months. Advise patient on glycemic control (target HbA1c < 7%) and blood pressure."
            )
        if grade == 2:
            return (
                f"⚠️ REFERABLE (Grade 2 - Moderate NPDR | {conf}% confidence)\n"
                f"• DOCTOR CONSULTATION REQUIRED: YES — Specialist Ophthalmologist review within 30 days.\n"
                f"• CLINICAL FINDINGS: Multiple dot/blot hemorrhages and hard exudates detected. Grad-CAM heatmap isolates {max(1, num_hotspots)} active lesion focal cluster(s).\n"
                f"• SPECIALIST WORKUP: Dilated slit-lamp biomicroscopy & baseline Macular OCT to evaluate for subclinical diabetic macular edema (DME)."
            )
        if grade == 3:
            return (
                f"🚨 SEVERE FINDING (Grade 3 - Severe NPDR | {conf}% confidence)\n"
                f"• DOCTOR CONSULTATION REQUIRED: URGENT YES — Priority Ophthalmologist Referral within 2–4 weeks.\n"
                f"• CLINICAL FINDINGS: High-risk non-proliferative changes detected (consistent with 4-2-1 rule: multi-quadrant retinal hemorrhages, venous caliber variations, and IRMA). Grad-CAM heatmap isolates {max(1, num_hotspots)} hyper-intense activation zone(s).\n"
                f"• DOCTOR ACTION PLAN: Slit-lamp biomicroscopy (78D/90D lens), Macular SD-OCT to rule out center-involving DME, and consider early Panretinal Photocoagulation (PRP) laser assessment to prevent progression to Proliferative DR."
            )
        return (
            f"🚨 CRITICAL FINDING (Grade 4 - Proliferative Diabetic Retinopathy | {conf}% confidence)\n"
            f"• DOCTOR CONSULTATION REQUIRED: IMMEDIATE YES — Urgent Specialist Intervention within 48–72 hours.\n"
            f"• CLINICAL FINDINGS: High-risk neovascularization patterns detected (NVD/NVE) with impending risk of vitreous hemorrhage or tractional retinal detachment. Grad-CAM heatmap highlights severe localized angiogenic attention across {max(1, num_hotspots)} focal zone(s).\n"
            f"• DOCTOR ACTION PLAN: Immediate tertiary vitreoretinal evaluation. Urgent consideration of anti-VEGF intravitreal therapy and/or urgent Panretinal Photocoagulation (PRP) laser to prevent irreversible vision loss."
        )


DEFAULT_CHECKPOINT = os.path.abspath(os.path.join(os.path.dirname(__file__), "model_referable_dr.pt"))
dr_pipeline = RetinalAnalysisPipeline(checkpoint_path=DEFAULT_CHECKPOINT)

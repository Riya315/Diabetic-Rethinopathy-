import os
import sys
import shutil
import urllib.request
import json
import cv2
import numpy as np
from PIL import Image

# Ensure project root is on path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend.app.ml.dr_model import dr_pipeline, DR_CLASSES
from backend.app.ml.quality import quality_checker

DATASET_DIR = os.path.join(ROOT_DIR, "sample_dataset_for_upload")
STATIC_SAMPLES_DIR = os.path.join(ROOT_DIR, "backend", "app", "static", "samples")

FOLDERS = {
    0: "0_Normal_No_DR",
    1: "1_Mild_NPDR",
    2: "2_Moderate_NPDR",
    3: "3_Severe_NPDR",
    4: "4_Proliferative_PDR",
    -1: "Quality_Failures"
}

def setup_directories():
    os.makedirs(DATASET_DIR, exist_ok=True)
    for f in FOLDERS.values():
        os.makedirs(os.path.join(DATASET_DIR, f), exist_ok=True)

def download_github_samples():
    print("[1/4] Downloading real fundus images from clinical repository...")
    base_url = "https://raw.githubusercontent.com/souravs17031999/Retinal_blindness_detection_Pytorch/master/sampleimages/"
    
    downloaded_files = []
    temp_dir = os.path.join(ROOT_DIR, "sample_dataset_for_upload", "_raw_downloads")
    os.makedirs(temp_dir, exist_ok=True)
    
    images = [
        "eye1.png", "eye2.png", "eye3.png", "eye4.jpg", "eye5.jpg",
        "eye6.jpg", "eye7.jpg", "eye8.jpg", "eye9.jpg", "eye10.jpg",
        "eye11.png", "eye12.jpg", "eye13.jpg", "eye14.jpg", "eye15.jpg",
        "eye16.png", "eye17.png", "eye18.png", "eye19.png", "eye20.png"
    ]
    
    for img_name in images:
        url = base_url + img_name
        dest_path = os.path.join(temp_dir, img_name)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read()
                with open(dest_path, "wb") as f:
                    f.write(data)
            downloaded_files.append(dest_path)
            print(f"  ✓ Downloaded {img_name} ({len(data) // 1024} KB)")
        except Exception as e:
            print(f"  ✗ Failed to download {img_name}: {e}")
            
    return downloaded_files

def process_and_categorize(files):
    print("\n[2/4] Running DR Inference & Quality Gatekeeper to categorize images...")
    catalog = []
    
    # Also include the bundled samples
    bundled = [
        ("Grade_0_Normal.jpg", 0, "Normal fundus with clear optic cup and macula"),
        ("Grade_1_Mild.jpg", 1, "Mild NPDR with isolated microaneurysms"),
        ("Grade_2_Moderate_Referable.jpg", 2, "Moderate NPDR with dot hemorrhages & hard exudates"),
        ("Grade_3_Severe_Referable.jpg", 3, "Severe NPDR with 4-quadrant hemorrhages"),
        ("Grade_4_PDR_Urgent.jpg", 4, "Proliferative DR with neovascularization"),
        ("Quality_Fail_Blurry.jpg", -1, "Defocused capture failing Laplacian sharpness"),
        ("Quality_Fail_Underexposed.jpg", -1, "Underexposed capture failing illumination checks"),
    ]
    
    for filename, true_grade, desc in bundled:
        src = os.path.join(STATIC_SAMPLES_DIR, filename)
        if os.path.exists(src):
            folder_name = FOLDERS[true_grade]
            dest = os.path.join(DATASET_DIR, folder_name, filename)
            shutil.copy2(src, dest)
            catalog.append({
                "filename": filename,
                "folder": folder_name,
                "relative_path": f"{folder_name}/{filename}",
                "grade": true_grade,
                "grade_name": DR_CLASSES[true_grade]["name"] if true_grade >= 0 else "Quality Check Failure",
                "referable": DR_CLASSES[true_grade]["referable"] if true_grade >= 0 else False,
                "description": desc
            })
            print(f"  ✓ Bundled Case: {filename} -> {folder_name}/")

    # Now evaluate downloaded files
    for idx, filepath in enumerate(files, 1):
        filename = os.path.basename(filepath)
        # Read with cv2
        cv_img = cv2.imread(filepath)
        if cv_img is None:
            continue
            
        # Run quality check
        q_res = quality_checker.evaluate(cv_img)
        
        if not q_res["passed"]:
            target_folder = FOLDERS[-1]
            out_name = f"Quality_Fail_{filename.replace('.png', '.jpg')}"
            dest = os.path.join(DATASET_DIR, target_folder, out_name)
            # Save as jpg
            cv2.imwrite(dest, cv_img, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
            catalog.append({
                "filename": out_name,
                "folder": target_folder,
                "relative_path": f"{target_folder}/{out_name}",
                "grade": -1,
                "grade_name": "Quality Check Failure",
                "referable": False,
                "description": f"Rejected by gatekeeper: {q_res['message']}"
            })
            print(f"  ✓ Analyzed {filename}: Quality Failure -> {target_folder}/{out_name}")
        else:
            # Predict DR grade
            pred = dr_pipeline.predict(cv_img, generate_cam=False)
            grade = pred["grade"]
            target_folder = FOLDERS[grade]
            out_name = f"Case_{idx:02d}_Grade_{grade}_{filename.replace('.png', '.jpg')}"
            dest = os.path.join(DATASET_DIR, target_folder, out_name)
            cv2.imwrite(dest, cv_img, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
            
            catalog.append({
                "filename": out_name,
                "folder": target_folder,
                "relative_path": f"{target_folder}/{out_name}",
                "grade": grade,
                "grade_name": pred["grade_name"],
                "referable": pred["referable"],
                "confidence": round(pred["confidence"] * 100, 1),
                "description": f"Classified as {pred['grade_name']} ({round(pred['confidence']*100, 1)}% confidence)"
            })
            print(f"  ✓ Analyzed {filename}: Grade {grade} ({pred['grade_name']}) -> {target_folder}/{out_name}")

    # Clean raw downloads folder
    temp_dir = os.path.join(ROOT_DIR, "sample_dataset_for_upload", "_raw_downloads")
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir, ignore_errors=True)

    return catalog

def create_catalog_and_readme(catalog):
    print("\n[3/4] Creating Dataset Catalog and Documentation...")
    # Write JSON catalog
    catalog_path = os.path.join(DATASET_DIR, "dataset_manifest.json")
    with open(catalog_path, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2)
    print(f"  ✓ Wrote {catalog_path}")

    # Write Markdown README
    readme_path = os.path.join(DATASET_DIR, "README_DATASET.md")
    lines = [
        "# 👁️ DrishtiCare Retinal Fundus Test Dataset",
        "",
        "This dataset contains authentic clinical retinal fundus images for uploading and testing in the DrishtiCare AI Screening web application.",
        "",
        "## 📁 Folder Structure",
        "",
        "- `0_Normal_No_DR/` - Healthy retinal scans (No Diabetic Retinopathy, Routine)",
        "- `1_Mild_NPDR/` - Mild Non-Proliferative DR (Isolated microaneurysms, Non-referable)",
        "- `2_Moderate_NPDR/` - Moderate NPDR (Dot hemorrhages, Hard exudates, Referable)",
        "- `3_Severe_NPDR/` - Severe NPDR (4-quadrant intraretinal hemorrhages, Urgent Referral)",
        "- `4_Proliferative_PDR/` - Proliferative DR (Neovascularization, Immediate Intervention)",
        "- `Quality_Failures/` - Intentional blurry/underexposed scans to test the automatic Quality Gatekeeper",
        "",
        "## 🧪 How to Upload in DrishtiCare",
        "",
        "1. Open **http://localhost:5173** in your browser.",
        "2. Register or log in (or use `asha_worker_1` / `password123`).",
        "3. Start a new screening intake session.",
        "4. Click **'Upload Image File'**.",
        f"5. Browse to this folder: `{DATASET_DIR}`.",
        "6. Pick any image from `0_Normal_No_DR`, `1_Mild_NPDR`, `2_Moderate_NPDR`, `3_Severe_NPDR`, or `4_Proliferative_PDR`.",
        "7. Click **'Run Automated AI Screening'** to see the real-time PyTorch diagnosis & authentic Grad-CAM heatmap!",
        "",
        "## 📋 File Listing",
        "",
        "| Folder | File Name | DR Grade | Referable | Description |",
        "|---|---|---|---|---|"
    ]
    for item in catalog:
        lines.append(f"| `{item['folder']}` | `{item['filename']}` | **{item['grade']}** ({item['grade_name']}) | {'⚠️ Yes' if item['referable'] else '✅ No'} | {item['description']} |")

    with open(readme_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"  ✓ Wrote {readme_path}")

def update_backend_manifest(catalog):
    print("\n[4/4] Updating backend static manifest so web app can also quick-load them...")
    manifest_file = os.path.join(STATIC_SAMPLES_DIR, "manifest.json")
    
    # Copy all images to backend/app/static/samples so they are reachable via HTTP
    manifest_entries = []
    for item in catalog:
        src = os.path.join(DATASET_DIR, item["folder"], item["filename"])
        dest = os.path.join(STATIC_SAMPLES_DIR, item["filename"])
        if not os.path.exists(dest):
            shutil.copy2(src, dest)
            
        manifest_entries.append({
            "id": f"SAMPLE-{len(manifest_entries)+1:02d}",
            "grade": item["grade"],
            "grade_name": item["grade_name"],
            "file_name": item["filename"],
            "url": f"/static/samples/{item['filename']}",
            "referable": item["referable"],
            "description": item["description"],
            "patient_meta": {
                "name": f"Test Patient ({item['grade_name']})",
                "age": 45 + (item["grade"] * 5) if item["grade"] >= 0 else 50,
                "gender": "Female" if len(manifest_entries) % 2 == 0 else "Male",
                "village": ["Rampur", "Dharampur", "Sonpur", "Kishanpur", "Madhavpur"][max(0, item["grade"])],
                "diabetes_years": max(1.0, float(3 + item["grade"] * 3.5)) if item["grade"] >= 0 else 5.0
            }
        })
        
    with open(manifest_file, "w", encoding="utf-8") as f:
        json.dump(manifest_entries, f, indent=2)
    print(f"  ✓ Updated {manifest_file} with {len(manifest_entries)} test cases.")

if __name__ == "__main__":
    setup_directories()
    files = download_github_samples()
    catalog = process_and_categorize(files)
    create_catalog_and_readme(catalog)
    update_backend_manifest(catalog)
    print("\n✅ Dataset setup complete! Total images:", len(catalog))

# InspectIQ structural defect detector — RunPod Serverless deployment

This is the deployment package for the MBDD2025-based structural defect
detector, meant to run as a RunPod Serverless endpoint that InspectIQ's
`/api/analyze-structural` route calls over HTTPS.

**Not part of the Next.js app** — this is a separate Python/Docker
service. `next build` never touches this folder.

## What's missing before this can run

There is no trained model yet. This package expects a trained Ultralytics
YOLO weights file at `model/best.pt` (gitignored — do not commit weights
files to this repo). Training that file is a separate step, done on a
machine with a GPU (a RunPod **Pod** — a rented GPU instance, different
from the Serverless endpoint, which is for inference *after* training).
This app dev environment cannot run it.

MBDD2025 ships PASCAL VOC XML annotations (`Annotations/*.xml`, one per
image in `JPEGImages/`), five defect classes (crack, leakage, abscission,
corrosion, bulge) across six structure types. `training/` has both scripts
needed:

1. **Convert VOC XML → YOLO format** (Ultralytics needs YOLO-style
   `images/` + `labels/` folders and a `data.yaml`, not raw VOC XML):
   ```
   cd runpod-structural-detector/training
   pip install -r ../requirements.txt
   python voc_to_yolo.py --source /path/to/MBDD2025 --dest /path/to/mbdd2025-yolo --val-split 0.1
   ```
   Class names are read directly from the XML files rather than assumed,
   and it prints a warning if it doesn't find exactly five - a quick sanity
   check that the dataset matches what MBDD2025's own README describes.

2. **Train:**
   ```
   python train.py --data /path/to/mbdd2025-yolo/data.yaml --epochs 100 --imgsz 640
   ```
   Defaults to fine-tuning from `yolov8s.pt` (a good speed/accuracy
   balance for defect-sized objects - swap `--base-model yolov8m.pt` for
   higher accuracy at more training cost). On completion this copies the
   best checkpoint to `model/best.pt` automatically - the exact path the
   Dockerfile and handler expect.

   Cost/time note: with ~13,000 training images this will run for a
   meaningful chunk of GPU-hours, billed for the whole time the Pod is
   running - budget for that before kicking it off, same as any RunPod GPU
   rental.

## Once you have a trained `model/best.pt`

1. **Build the image:**
   ```
   cd runpod-structural-detector
   docker build -t <your-registry>/inspectiq-structural-detector:latest .
   ```
2. **Push it** to a registry RunPod can pull from (Docker Hub, GitHub
   Container Registry, etc.):
   ```
   docker push <your-registry>/inspectiq-structural-detector:latest
   ```
3. **Create a RunPod Serverless endpoint** (RunPod console → Serverless →
   New Endpoint) pointing at that image. Pick a GPU tier (a T4 or L4 is
   plenty for YOLO inference — no need for anything bigger). Set the
   min/max worker count — 0 min workers gives you true scale-to-zero
   (cheapest, cold-start lag); a min of 1 keeps one instance warm (see the
   infrastructure note on `/dashboard/admin` for the cost tradeoff).
4. **Copy the endpoint ID and your RunPod API key.**
5. **Set them as environment variables in Vercel** (Project Settings →
   Environment Variables) on the InspectIQ app:
   - `RUNPOD_STRUCTURAL_ENDPOINT_ID`
   - `RUNPOD_API_KEY`

Once those are set, `/api/analyze-structural` (in the main app) can call
this endpoint and write results into the `defect_detections` table.

## Local test (once you have weights)

```
pip install -r requirements.txt
python handler.py
```

RunPod's SDK runs the handler in local test mode when no `RUNPOD_*`
environment variables are present, reading test input from a local
`test_input.json` if you create one - see RunPod's docs for the exact
format.

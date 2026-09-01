# InspectIQ structural defect detector — RunPod Serverless deployment

This is the deployment package for the MBDD2025-based structural defect
detector, meant to run as a RunPod Serverless endpoint that InspectIQ's
`/api/analyze-structural` route calls over HTTPS.

**Not part of the Next.js app** — this is a separate Python/Docker
service. `next build` never touches this folder.

## What's missing before this can run

There is no trained model yet. This package expects a trained Ultralytics
YOLO weights file at `model/best.pt` (gitignored — do not commit weights
files to this repo). Training that file is a separate step: fine-tune a
YOLO model (e.g. `yolov8s.pt` as a starting checkpoint) on the MBDD2025
dataset. That needs its own training script tailored to MBDD2025's actual
folder/annotation layout, which isn't written yet — happy to build it once
you can share what's inside the unzipped dataset (folder structure, whether
it already ships a `data.yaml`, image/label file naming).

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

"""
RunPod Serverless handler for the InspectIQ structural defect detector
(MBDD2025-based YOLO model).

Input (job["input"]):
    {
        "image_base64": "<base64-encoded JPEG/PNG, no data: prefix>",
        "confidence_threshold": 0.25   # optional, defaults to CONFIDENCE_THRESHOLD below
    }

Output:
    {
        "detections": [
            {
                "defect_class": "crack",       # one of MBDD2025's five classes
                "confidence": 0.87,
                "box": {"x": 12.4, "y": 30.1, "width": 8.2, "height": 4.5}
            },
            ...
        ]
    }

box coordinates are percentages (0-100) of image width/height, matching the
bounding_box convention already used throughout InspectIQ (see
lib/defectDetections.ts and the PolygonBoxEditor component) - so the
InspectIQ-side route can write these straight into defect_detections
without any unit conversion.

Requires a trained Ultralytics YOLO weights file at the path given by the
MODEL_WEIGHTS_PATH env var (baked into the Docker image - see Dockerfile).
There is no trained model yet as of this scaffold; this handler will fail
to start until one is added at build time.
"""

import base64
import io
import os

import runpod
from PIL import Image
from ultralytics import YOLO

MODEL_WEIGHTS_PATH = os.environ.get("MODEL_WEIGHTS_PATH", "/model/best.pt")
CONFIDENCE_THRESHOLD = float(os.environ.get("CONFIDENCE_THRESHOLD", "0.25"))

model = YOLO(MODEL_WEIGHTS_PATH)


def handler(job):
    job_input = job.get("input") or {}
    image_b64 = job_input.get("image_base64")
    if not image_b64:
        return {"error": "image_base64 is required"}

    threshold = float(job_input.get("confidence_threshold", CONFIDENCE_THRESHOLD))

    try:
        image_bytes = base64.b64decode(image_b64)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as exc:
        return {"error": f"Could not decode image_base64: {exc}"}

    width, height = image.size
    results = model.predict(image, conf=threshold, verbose=False)

    detections = []
    for result in results:
        for box in result.boxes:
            x1, y1, x2, y2 = [float(v) for v in box.xyxy[0].tolist()]
            class_id = int(box.cls[0].item())
            class_name = model.names.get(class_id, str(class_id))
            confidence = float(box.conf[0].item())

            detections.append(
                {
                    "defect_class": class_name,
                    "confidence": round(confidence, 4),
                    "box": {
                        "x": round((x1 / width) * 100, 2),
                        "y": round((y1 / height) * 100, 2),
                        "width": round(((x2 - x1) / width) * 100, 2),
                        "height": round(((y2 - y1) / height) * 100, 2),
                    },
                }
            )

    return {"detections": detections}


runpod.serverless.start({"handler": handler})

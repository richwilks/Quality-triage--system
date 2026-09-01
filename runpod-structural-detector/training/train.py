"""
Fine-tunes a YOLOv8 model on MBDD2025, already converted to YOLO format via
voc_to_yolo.py. Run this on a machine with a GPU (e.g. a RunPod Pod - not
the Serverless endpoint, which is for inference after training, not for
training itself).

Usage:
    python train.py --data /path/to/output/data.yaml --epochs 100 --imgsz 640

On completion, copies the best checkpoint to ../model/best.pt - the exact
path handler.py and the Dockerfile expect for the inference deployment.
"""

import argparse
import shutil
from pathlib import Path

from ultralytics import YOLO


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, help="Path to data.yaml produced by voc_to_yolo.py")
    parser.add_argument("--base-model", default="yolov8s.pt", help="Pretrained checkpoint to fine-tune from")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=16)
    args = parser.parse_args()

    model = YOLO(args.base_model)
    results = model.train(
        data=args.data,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
    )

    best_weights = Path(results.save_dir) / "weights" / "best.pt"
    output_dir = Path(__file__).resolve().parent.parent / "model"
    output_dir.mkdir(exist_ok=True)
    output_path = output_dir / "best.pt"
    shutil.copy(best_weights, output_path)
    print(f"Trained weights copied to {output_path}")
    print("Next: build and push the Docker image, then create/redeploy the RunPod Serverless endpoint - see ../README.md")


if __name__ == "__main__":
    main()

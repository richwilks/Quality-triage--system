FROM pytorch/pytorch:2.4.0-cuda12.1-cudnn9-runtime

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY handler.py .

# Trained weights are not part of this repo - place your trained YOLO
# weights at runpod-structural-detector/model/best.pt before building this
# image. See README.md for how to produce that file.
COPY model/best.pt /model/best.pt
ENV MODEL_WEIGHTS_PATH=/model/best.pt

CMD ["python", "-u", "handler.py"]

"""
Pipeline for high-quality animal image embeddings.

- Runs YOLOv8m to detect dog/cat bounding boxes and crop the image.
- Feeds the crop into DINOv2 ViT-L/14 to produce an embedding.
- Stores embedding vectors in `animal_embeddings_ml` table
  with metadata (model name, bbox, confidence).

Prerequisites:
    pip install torch torchvision torchaudio
    pip install transformers==4.46.2
    pip install ultralytics
    pip install pillow requests psycopg2-binary numpy

Weights are downloaded automatically on first run.
"""
from __future__ import annotations

import io
import json
import os
import time
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Tuple

import numpy as np
import psycopg2
import requests
import torch
from PIL import Image
from psycopg2.extras import execute_values, Json
from transformers import AutoImageProcessor, AutoModel
from ultralytics import YOLO

# ================== 환경설정 ==================
PG_DSN = os.getenv(
    "PG_DSN",
    "host=localhost port=5432 dbname=cogdb user=postgres password=6575",
)

YOLO_MODEL_NAME = os.getenv("YOLO_MODEL", "yolov8m.pt")
DINO_MODEL_NAME = os.getenv("DINO_MODEL", "facebook/dinov2-large")
ALLOWED_CLASSES = {15, 16}  # 15: cat, 16: dog in COCO
BBOX_EXPANSION = float(os.getenv("BBOX_EXPANSION", "0.12"))
MAX_IMAGES = int(os.getenv("MAX_IMAGES", "0"))  # 0 = 전체
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "8"))
REQUEST_TIMEOUT = 20
MAX_RETRIES = 2

TABLE_SQL = """
CREATE TABLE IF NOT EXISTS animal_embeddings_ml (
    desertion_no VARCHAR(50),
    embedding_side TEXT NOT NULL CHECK (embedding_side IN ('popfile1', 'popfile2')),
    model_name TEXT NOT NULL,
    embedding DOUBLE PRECISION[] NOT NULL,
    embedding_dim INTEGER NOT NULL,
    bbox JSONB,
    conf DOUBLE PRECISION,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (desertion_no, embedding_side, model_name)
);
"""

UPSERT_SQL = """
INSERT INTO animal_embeddings_ml
    (desertion_no, embedding_side, model_name, embedding, embedding_dim, bbox, conf)
VALUES %s
ON CONFLICT (desertion_no, embedding_side, model_name)
DO UPDATE SET
    embedding = EXCLUDED.embedding,
    embedding_dim = EXCLUDED.embedding_dim,
    bbox = EXCLUDED.bbox,
    conf = EXCLUDED.conf,
    created_at = CURRENT_TIMESTAMP;
"""

# ================== 유틸리티 ==================


def fetch_image(url: str) -> Optional[Image.Image]:
    for attempt in range(MAX_RETRIES + 1):
        try:
            resp = requests.get(url, timeout=REQUEST_TIMEOUT)
            if resp.status_code != 200:
                continue
            return Image.open(io.BytesIO(resp.content)).convert("RGB")
        except Exception:
            time.sleep(0.5 * (attempt + 1))
    return None


@dataclass
class DetectionResult:
    crop: Image.Image
    bbox: Tuple[int, int, int, int]
    conf: float
    cls_id: int


class YoloCropper:
    def __init__(self, model_name: str = YOLO_MODEL_NAME, device: Optional[str] = None):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.model = YOLO(model_name)
        # Ultralytics automatically selects device; enforce ours
        self.model.to(self.device)

    def detect_best_crop(self, image: Image.Image) -> DetectionResult:
        arr = np.array(image)
        results = self.model.predict(
            arr,
            verbose=False,
            conf=0.2,
            imgsz=640,
        )
        width, height = image.size
        best = None
        for r in results:
            boxes = r.boxes
            if boxes is None:
                continue
            for box in boxes:
                cls_id = int(box.cls.item())
                if cls_id not in ALLOWED_CLASSES:
                    continue
                conf = float(box.conf.item())
                xyxy = box.xyxy[0].cpu().numpy()
                x1, y1, x2, y2 = xyxy
                # 확장
                w = x2 - x1
                h = y2 - y1
                x1 -= w * BBOX_EXPANSION
                y1 -= h * BBOX_EXPANSION
                x2 += w * BBOX_EXPANSION
                y2 += h * BBOX_EXPANSION
                x1 = max(0, int(x1))
                y1 = max(0, int(y1))
                x2 = min(width, int(x2))
                y2 = min(height, int(y2))
                if x2 <= x1 or y2 <= y1:
                    continue
                crop = image.crop((x1, y1, x2, y2))
                if best is None or conf > best.conf:
                    best = DetectionResult(crop=crop, bbox=(x1, y1, x2, y2), conf=conf, cls_id=cls_id)
        if best is None:
            # 전체를 반환
            return DetectionResult(
                crop=image,
                bbox=(0, 0, width, height),
                conf=0.0,
                cls_id=-1,
            )
        return best


class DinoEmbedder:
    def __init__(self, model_name: str = DINO_MODEL_NAME, device: Optional[str] = None):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.processor = AutoImageProcessor.from_pretrained(model_name)
        self.model = AutoModel.from_pretrained(model_name)
        self.model.to(self.device)
        self.model.eval()

    @torch.no_grad()
    def embed_batch(self, images: List[Image.Image]) -> np.ndarray:
        if not images:
            return np.empty((0, 0))
        inputs = self.processor(images=images, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        outputs = self.model(**inputs)
        # CLS 토큰 사용
        embeddings = outputs.last_hidden_state[:, 0, :]
        embeddings = torch.nn.functional.normalize(embeddings, dim=1)
        return embeddings.cpu().numpy()


# ================== DB ==================


def ensure_table(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(TABLE_SQL)
    conn.commit()


def fetch_targets(conn) -> List[Tuple[str, str, str]]:
    query = """
        SELECT desertion_no, 'popfile1' AS side, popfile1
        FROM abandoned_animals
        WHERE popfile1 IS NOT NULL AND popfile1 <> ''
      UNION ALL
        SELECT desertion_no, 'popfile2' AS side, popfile2
        FROM abandoned_animals
        WHERE popfile2 IS NOT NULL AND popfile2 <> ''
        ORDER BY desertion_no, side;
    """
    with conn.cursor() as cur:
        cur.execute(query)
        rows = [(d, s, url) for d, s, url in cur.fetchall()]
    if MAX_IMAGES > 0:
        return rows[:MAX_IMAGES]
    return rows


def upsert_embeddings(
    conn,
    rows: Iterable[Tuple[str, str, str, List[float], int, Dict[str, float], Optional[float]]],
) -> int:
    rows = list(rows)
    if not rows:
        return 0
    payload = [
        (
            desertion_no,
            side,
            model_name,
            embedding,
            dim,
            Json(bbox) if bbox else None,
            conf,
        )
        for desertion_no, side, model_name, embedding, dim, bbox, conf in rows
    ]
    with conn.cursor() as cur:
        execute_values(cur, UPSERT_SQL, payload)
    conn.commit()
    return len(payload)


# ================== 메인 루프 ==================


def process():
    conn = psycopg2.connect(PG_DSN)
    ensure_table(conn)

    cropper = YoloCropper()
    embedder = DinoEmbedder()

    targets = fetch_targets(conn)
    total = len(targets)
    print(f"총 {total}개의 이미지 처리 예정 (popfile1+2).")

    batch_images: List[Image.Image] = []
    batch_meta: List[Tuple[str, str, Dict[str, float], float]] = []
    pending_sql: List[
        Tuple[str, str, str, List[float], int, Dict[str, float], Optional[float]]
    ] = []
    processed = 0
    failures = 0

    for desertion_no, side, url in targets:
        img = fetch_image(url)
        if img is None:
            failures += 1
            continue
        detection = cropper.detect_best_crop(img)
        batch_images.append(detection.crop)
        bbox_payload = {
            "x1": detection.bbox[0],
            "y1": detection.bbox[1],
            "x2": detection.bbox[2],
            "y2": detection.bbox[3],
            "cls_id": detection.cls_id,
        }
        batch_meta.append((desertion_no, side, bbox_payload, detection.conf))

        if len(batch_images) >= BATCH_SIZE:
            embeddings = embedder.embed_batch(batch_images)
            for (des_no, embed_side, bbox, conf), vec in zip(batch_meta, embeddings):
                pending_sql.append(
                    (
                        des_no,
                        embed_side,
                        DINO_MODEL_NAME,
                        vec.astype(float).tolist(),
                        vec.shape[0],
                        bbox,
                        conf,
                    )
                )
            upsert_embeddings(conn, pending_sql)
            processed += len(pending_sql)
            pending_sql.clear()
            batch_images.clear()
            batch_meta.clear()
            print(f"  진행 상황: {processed}/{total} (실패 {failures})")

    if batch_images:
        embeddings = embedder.embed_batch(batch_images)
        for (des_no, embed_side, bbox, conf), vec in zip(batch_meta, embeddings):
            pending_sql.append(
                (
                    des_no,
                    embed_side,
                    DINO_MODEL_NAME,
                    vec.astype(float).tolist(),
                    vec.shape[0],
                    bbox,
                    conf,
                )
            )
        upsert_embeddings(conn, pending_sql)
        processed += len(pending_sql)

    conn.close()
    print(f"\n완료: {processed}개 저장, 실패 {failures}개")


if __name__ == "__main__":
    process()

#!/usr/bin/env python
"""
Create augmented embeddings for popfile2 images and store them in new tables.

- Downloads popfile2 images, applies 2 augmentations (orig, horizontal flip).
- Embeds each crop with DINO (via advanced_embedding_pipeline.DinoEmbedder).
- Writes vectors into per-dimension tables (default: animal_embeddings2_aug_<dim>).
- Keeps the existing split from abandoned_animals so train/valid info stays aligned.

Environment variables:
  PG_DSN             : Postgres connection string (default: cogdb local)
  DINO_MODEL         : huggingface model id passed to DinoEmbedder
  YOLO_MODEL         : YOLO model path/id passed to YoloCropper
  AUG_DIMS           : comma list of target dims (default: 1024)
  TABLE_PREFIX       : table name prefix (default: animal_embeddings2_aug)
  BATCH_SIZE         : number of rows to upsert per batch (default: 64)
  MAX_IMAGES         : optional limit for quick runs
"""
from __future__ import annotations

import io
import os
import sys
import time
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import numpy as np
import psycopg2
import psycopg2.errors
import requests
from PIL import Image, ImageEnhance, ImageOps
from psycopg2.extras import execute_values

from advanced_embedding_pipeline import DinoEmbedder, YoloCropper

PG_DSN = os.getenv(
    "PG_DSN",
    "host=localhost port=5432 dbname=cogdb user=postgres password=6575",
)
DINO_MODEL = os.getenv("DINO_MODEL", "facebook/dinov2-large")
YOLO_MODEL = os.getenv("YOLO_MODEL", "yolov8m.pt")
TABLE_PREFIX = os.getenv("TABLE_PREFIX", "animal_embeddings2_aug")
MAX_RETRIES = 2
REQUEST_TIMEOUT = 15
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "64"))
MAX_IMAGES = int(os.getenv("MAX_IMAGES", "0"))


def parse_dims(raw: Optional[str]) -> Sequence[int]:
    if not raw:
        return (1024,)
    dims = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            dims.append(int(part))
        except ValueError:
            print(f"skip invalid dim '{part}'", file=sys.stderr)
    return dims or (1024,)


DIMS = parse_dims(os.getenv("AUG_DIMS"))


def ensure_vector_extension(conn) -> None:
    with conn.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    conn.commit()


def create_table(conn, dim: int) -> None:
    tbl = f"{TABLE_PREFIX}_{dim}"
    sql = f"""
    CREATE TABLE IF NOT EXISTS {tbl} (
        desertion_no VARCHAR PRIMARY KEY
            REFERENCES abandoned_animals(desertion_no) ON DELETE CASCADE,
        embedding_side TEXT NOT NULL DEFAULT 'popfile2',
        split TEXT,
        vector1 vector({dim}),
        vector2 vector({dim}),
        vector3 vector({dim}),
        vector4 vector({dim}),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()


def fetch_animals(conn) -> List[Tuple[str, str, Optional[str]]]:
    sql = """
    SELECT desertion_no, popfile2, split
    FROM abandoned_animals
    WHERE popfile2 IS NOT NULL AND popfile2 <> ''
    """
    with conn.cursor() as cur:
        cur.execute(sql)
        rows = cur.fetchall()
    if MAX_IMAGES > 0:
        rows = rows[:MAX_IMAGES]
    return rows


def fetch_image(url: str) -> Optional[Image.Image]:
    for attempt in range(MAX_RETRIES + 1):
        try:
            resp = requests.get(url, timeout=REQUEST_TIMEOUT)
            if resp.status_code != 200:
                time.sleep(0.5 * (attempt + 1))
                continue
            return Image.open(io.BytesIO(resp.content)).convert("RGB")
        except Exception:
            time.sleep(0.5 * (attempt + 1))
    return None


def augment(img: Image.Image) -> List[Image.Image]:
    # Only original and horizontal flip to align with requested minimal aug.
    return [
        img,
        ImageOps.mirror(img),
    ]


def project_vec(vec: np.ndarray, dim: int) -> Optional[np.ndarray]:
    if vec.size < dim:
        return None
    if vec.size == dim:
        return vec.astype(np.float32)
    # truncate if larger
    return vec[:dim].astype(np.float32)


def to_pgvector(vec: Optional[np.ndarray]):
    if vec is None:
        return None
    return vec.astype(float).tolist()


def upsert_embeddings(conn, dim: int, rows: List[Tuple]) -> None:
    tbl = f"{TABLE_PREFIX}_{dim}"
    sql = f"""
    INSERT INTO {tbl} (desertion_no, embedding_side, split, vector1, vector2, vector3, vector4)
    VALUES %s
    ON CONFLICT (desertion_no) DO UPDATE SET
        embedding_side = EXCLUDED.embedding_side,
        split = EXCLUDED.split,
        vector1 = EXCLUDED.vector1,
        vector2 = EXCLUDED.vector2,
        vector3 = EXCLUDED.vector3,
        vector4 = EXCLUDED.vector4;
    """
    with conn.cursor() as cur:
        execute_values(cur, sql, rows, page_size=BATCH_SIZE)
    conn.commit()


def main():
    cropper = YoloCropper(model_name=YOLO_MODEL)
    embedder = DinoEmbedder(model_name=DINO_MODEL)

    with psycopg2.connect(PG_DSN) as conn:
        ensure_vector_extension(conn)
        for d in DIMS:
            create_table(conn, d)
        animals = fetch_animals(conn)

        for dim in DIMS:
            batch: List[Tuple] = []
            tbl = f"{TABLE_PREFIX}_{dim}"
            print(f"[{tbl}] processing {len(animals)} images...", flush=True)
            for idx, (desertion_no, url, split) in enumerate(animals, 1):
                img = fetch_image(url)
                if img is None:
                    continue
                det = cropper.detect_best_crop(img)
                crop = det.crop if det else img
                aug_images = augment(crop)
                vecs = embedder.embed_batch(aug_images)
                base_dim = vecs.shape[1]
                projected = []
                for i in range(2):
                    pv = project_vec(vecs[i], dim)
                    if pv is None:
                        break
                    projected.append(pv)
                if len(projected) != 2:
                    continue
                # pad to 4 slots with None to keep schema, unused slots stay NULL
                projected += [None, None]
                batch.append(
                    (
                        desertion_no,
                        "popfile2",
                        split,
                        to_pgvector(projected[0]),
                        to_pgvector(projected[1]),
                        to_pgvector(projected[2]),
                        to_pgvector(projected[3]),
                    )
                )
                if len(batch) >= BATCH_SIZE:
                    upsert_embeddings(conn, dim, batch)
                    batch.clear()
                if idx % 50 == 0:
                    print(f"[{tbl}] {idx}/{len(animals)} done", flush=True)
            if batch:
                upsert_embeddings(conn, dim, batch)
            print(f"[{tbl}] completed.", flush=True)


if __name__ == "__main__":
    main()

#!/usr/bin/env python
"""
Prepare DB splits and store augmented image embeddings for triplet/semi-hard triplet training.
- Adds a `split` column to relevant tables and populates train/valid buckets (70/30) only.
- Ensures pgvector-backed embedding tables (384/768/1024/1536) with four augmented vectors per popfile side.
- Downloads popfile1/popfile2 images, generates 4 augmentations (orig, flip, bright 1.2, bright 0.8), embeds with DINOv2, projects to target dims, and UPSERTs.

Notes:
- Requires pgvector extension on Postgres and access to popfile URLs.
- DINOv2-L/14 hidden size is 1024; other dims are deterministic random projections from that base vector.
- PG_DSN can be overridden via environment.
"""
from __future__ import annotations

import io
import os
import sys
import time
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import numpy as np
import psycopg2
import psycopg2.errors
import requests
import torch
from PIL import Image, ImageEnhance, ImageOps
from psycopg2.extras import execute_values
from transformers import AutoImageProcessor, AutoModel
from advanced_embedding_pipeline import YoloCropper

# ================== Config ==================
PG_DSN = os.getenv(
    "PG_DSN",
    "host=localhost port=5432 dbname=cogdb user=postgres password=6575",
)
DINO_MODEL_NAME = os.getenv("DINO_MODEL", "facebook/dinov2-large")
YOLO_MODEL_NAME = os.getenv("YOLO_MODEL", "yolov8m.pt")
REQUEST_TIMEOUT = 20
MAX_RETRIES = 2
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "8"))
DIMENSIONS: Sequence[int] = (1024,)
DIM_LIST_RAW = os.getenv("DIM_LIST")
EMBED_TABLE_PREFIX = os.getenv("EMBED_TABLE_PREFIX", "animal_embeddings_new")

# ================== DB helpers ==================
cropper: Optional[YoloCropper] = None

def ensure_vector_extension(conn) -> None:
    with conn.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    conn.commit()


def ensure_split_columns(conn) -> None:
    prev_autocommit = conn.autocommit
    conn.autocommit = True
    tables = [
        "abandoned_animals",
        f"{EMBED_TABLE_PREFIX}_1024",
    ]
    for tbl in tables:
        with conn.cursor() as cur:
            try:
                cur.execute(f"ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS split TEXT;")
            except psycopg2.errors.UndefinedTable:
                # table might not exist; skip
                continue
    conn.autocommit = prev_autocommit
    if not conn.autocommit:
        conn.commit()


ALLOW_SPLIT_OVERWRITE = os.getenv("ALLOW_SPLIT_OVERWRITE", "0") == "1"


def assign_splits(conn) -> None:
    """Assign 60/20/20 train/valid/test buckets on desertion_no into a separate table."""
    if not ALLOW_SPLIT_OVERWRITE:
        print("[split] Skipped assigning splits because ALLOW_SPLIT_OVERWRITE!=1", flush=True)
        return
    sql = """
    WITH id_splits AS (
        SELECT
            desertion_no,
            NTILE(10) OVER (ORDER BY random()) AS bucket
        FROM abandoned_animals
        GROUP BY desertion_no
    )
    UPDATE abandoned_animals AS a
    SET split = CASE
        WHEN s.bucket <= 6 THEN 'train'   -- 60%
        WHEN s.bucket <= 8 THEN 'valid'   -- 20%
        ELSE 'test'                       -- 20%
    END
    FROM id_splits AS s
    WHERE a.desertion_no = s.desertion_no;
    """
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()


def create_embedding_table(conn, dim: int) -> None:
    table = f"{EMBED_TABLE_PREFIX}_{dim}"
    sql = f"""
    CREATE TABLE IF NOT EXISTS {table} (
        desertion_no VARCHAR NOT NULL
            REFERENCES abandoned_animals(desertion_no) ON DELETE CASCADE,
        embedding_side TEXT NOT NULL CHECK (embedding_side IN ('popfile1', 'popfile2')),
        vector1 vector({dim}),
        vector2 vector({dim}),
        vector3 vector({dim}),
        vector4 vector({dim}),
        split TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (desertion_no, embedding_side)
    );
    """
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()


def ensure_embedding_schema(conn, dim: int) -> None:
    """Backfill schema for tables created without embedding_side PK."""
    table = f"{EMBED_TABLE_PREFIX}_{dim}"
    with conn.cursor() as cur:
        try:
            cur.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS embedding_side TEXT;")
            cur.execute(
                f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;"
            )
            cur.execute(
                f"""
                UPDATE {table}
                SET embedding_side = 'popfile1'
                WHERE embedding_side IS NULL;
                """
            )
            cur.execute(
                f"ALTER TABLE {table} ALTER COLUMN embedding_side SET NOT NULL;"
            )
            # Add/check constraint for allowed values
            cur.execute(
                f"""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = '{table}_embedding_side_chk'
                    ) THEN
                        ALTER TABLE {table}
                        ADD CONSTRAINT {table}_embedding_side_chk
                        CHECK (embedding_side IN ('popfile1', 'popfile2'));
                    END IF;
                END$$;
                """
            )
            # Switch primary key to (desertion_no, embedding_side)
            cur.execute(f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {table}_pkey;")
            cur.execute(
                f"ALTER TABLE {table} ADD CONSTRAINT {table}_pkey PRIMARY KEY (desertion_no, embedding_side);"
            )
        except psycopg2.errors.UndefinedTable:
            conn.rollback()
            return
    conn.commit()


def propagate_split(conn, table: str) -> None:
    sql = f"""
    UPDATE {table} AS e
    SET split = a.split
    FROM abandoned_animals AS a
    WHERE e.desertion_no = a.desertion_no;
    """
    with conn.cursor() as cur:
        try:
            cur.execute(sql)
            conn.commit()
        except psycopg2.errors.UndefinedTable:
            conn.rollback()
            return


# ================== Image helpers ==================

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


def augment_image(img: Image.Image) -> List[Image.Image]:
    # 2-way augmentation: original + horizontal flip (brightness aug removed)
    return [
        img,
        ImageOps.mirror(img),
    ]


# ================== Embedding ==================

@dataclass
class DinoEmbedder:
    processor: AutoImageProcessor
    model: AutoModel
    device: torch.device

    @classmethod
    def build(cls, model_name: str = DINO_MODEL_NAME) -> "DinoEmbedder":
        if torch.backends.mps.is_available():
            device = torch.device("mps")
        elif torch.cuda.is_available():
            device = torch.device("cuda")
        else:
            device = torch.device("cpu")
        processor = AutoImageProcessor.from_pretrained(model_name)
        model = AutoModel.from_pretrained(model_name)
        model.to(device)
        model.eval()
        return cls(processor=processor, model=model, device=device)

    @torch.no_grad()
    def embed_batch(self, images: List[Image.Image]) -> np.ndarray:
        if not images:
            return np.empty((0, 0))
        inputs = self.processor(images=images, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        outputs = self.model(**inputs)
        reps = outputs.last_hidden_state[:, 0, :]
        reps = torch.nn.functional.normalize(reps, dim=1)
        return reps.cpu().numpy()


class Projector:
    def __init__(self):
        self.cache: Dict[Tuple[int, int], np.ndarray] = {}
        self.rng = np.random.default_rng(42)

    def project(self, vec: np.ndarray, target_dim: int) -> np.ndarray:
        base_dim = vec.shape[0]
        if base_dim == target_dim:
            return vec
        key = (base_dim, target_dim)
        if key not in self.cache:
            mat = self.rng.standard_normal((target_dim, base_dim)).astype(np.float32)
            mat /= np.linalg.norm(mat, axis=1, keepdims=True) + 1e-8
            self.cache[key] = mat
        mat = self.cache[key]
        out = mat @ vec
        norm = np.linalg.norm(out)
        if norm > 0:
            out = out / norm
        return out.astype(np.float32)


projector = Projector()


def vec_to_pg(vec: np.ndarray) -> str:
    return "[" + ",".join(f"{float(x):.6f}" for x in vec) + "]"


# ================== Processing ==================

def load_animals(conn) -> List[Tuple[str, Optional[str], Optional[str], Optional[str]]]:
    sql = """
        SELECT desertion_no, popfile1, popfile2, split
        FROM abandoned_animals
        WHERE (popfile1 IS NOT NULL AND popfile1 <> '')
           OR (popfile2 IS NOT NULL AND popfile2 <> '')
    """
    with conn.cursor() as cur:
        cur.execute(sql)
        return cur.fetchall()


def upsert_rows(conn, table: str, rows: Iterable[Tuple[str, str, Optional[str], str, str, str, str]]) -> None:
    rows = list(rows)
    if not rows:
        return
    sql = f"""
    INSERT INTO {table} (desertion_no, embedding_side, split, vector1, vector2, vector3, vector4)
    VALUES %s
    ON CONFLICT (desertion_no, embedding_side)
    DO UPDATE SET
        split = EXCLUDED.split,
        vector1 = EXCLUDED.vector1,
        vector2 = EXCLUDED.vector2,
        vector3 = EXCLUDED.vector3,
        vector4 = EXCLUDED.vector4,
        created_at = CURRENT_TIMESTAMP;
    """
    payload = [
        (
            desertion_no,
            side,
            split,
            vec1,
            vec2,
            vec3,
            vec4,
        )
        for desertion_no, side, split, vec1, vec2, vec3, vec4 in rows
    ]
    with conn.cursor() as cur:
        execute_values(cur, sql, payload)
    conn.commit()


def process_dimension(conn, dim: int, animals: List[Tuple[str, Optional[str], Optional[str], Optional[str]]], embedder: DinoEmbedder) -> None:
    table = f"{EMBED_TABLE_PREFIX}_{dim}"
    to_save: List[Tuple[str, str, Optional[str], str, str, str, str]] = []
    total_sides = sum(
        (1 if url1 else 0) + (1 if url2 else 0) for _, url1, url2, _ in animals
    )
    processed = 0
    last_log = 0

    if total_sides == 0:
        print(f"[dim {dim}] no images to process", flush=True)
        return

    print(f"[dim {dim}] start: {total_sides} sides to embed", flush=True)
    for desertion_no, url1, url2, split in animals:
        for side, url in (("popfile1", url1), ("popfile2", url2)):
            if not url:
                continue
            img = fetch_image(url)
            if img is None:
                continue
            # YOLO crop to align training embeddings with search-time preprocessing
            try:
                det = cropper.detect_best_crop(img)
                img = det.crop
            except Exception:
                # fallback to full image on any detection failure
                pass
            processed += 1
            # popfile2 is eval-only: keep only original (no augmentation)
            augmented = [img] if side == "popfile2" else augment_image(img)
            vecs_1024 = embedder.embed_batch(augmented)
            # project to target dim
            projected = [projector.project(v, dim) for v in vecs_1024]
            vec_strings = [vec_to_pg(v) for v in projected]
            # pad to 4 slots so columns align across sides
            while len(vec_strings) < 4:
                vec_strings.append(None)
            to_save.append(
                (
                    desertion_no,
                    side,
                    split,
                    vec_strings[0],
                    vec_strings[1],
                    vec_strings[2],
                    vec_strings[3],
                )
            )
            if len(to_save) >= BATCH_SIZE:
                upsert_rows(conn, table, to_save)
                to_save.clear()
            if processed - last_log >= 50:
                print(f"[dim {dim}] processed {processed}/{total_sides} sides", flush=True)
                last_log = processed

    if to_save:
        upsert_rows(conn, table, to_save)
        to_save.clear()
    print(f"[dim {dim}] completed {processed}/{total_sides} sides", flush=True)


# ================== Main ==================

def main():
    def _parse_dims(raw: Optional[str]) -> List[int]:
        if not raw:
            return list(DIMENSIONS)
        dims: List[int] = []
        seen = set()
        for part in raw.split(","):
            part = part.strip()
            if not part:
                continue
            try:
                dval = int(part)
            except ValueError:
                print(f"skip invalid dim '{part}'", flush=True)
                continue
            if dval in seen:
                continue
            seen.add(dval)
            dims.append(dval)
        return dims or list(DIMENSIONS)

    dims_to_run = _parse_dims(DIM_LIST_RAW)

    conn = psycopg2.connect(PG_DSN)
    try:
        global cropper
        cropper = YoloCropper(YOLO_MODEL_NAME)
        ensure_vector_extension(conn)
        for dim in dims_to_run:
            create_embedding_table(conn, dim)
            ensure_embedding_schema(conn, dim)
        ensure_split_columns(conn)
        assign_splits(conn)
        propagate_split(conn, "animal_embeddings")
        for dim in dims_to_run:
            propagate_split(conn, f"{EMBED_TABLE_PREFIX}_{dim}")

        animals = load_animals(conn)
        print(f"Found {len(animals)} animals with popfile images.")
        embedder = DinoEmbedder.build(DINO_MODEL_NAME)

        for dim in dims_to_run:
            print(f"Processing dimension {dim}...")
            process_dimension(conn, dim, animals, embedder)
            print(f"Done dim {dim}.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()

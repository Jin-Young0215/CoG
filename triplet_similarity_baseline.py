#!/usr/bin/env python
"""
Find top-K similar shelter animals using 768-dim embeddings without triplet head.

Inputs:
  --image <path>   : query image file
  --topk <int>     : number of results (default 20)
  --model-name     : embedding model name for the query side (defaults to DINO_MODEL_NAME)

Reads DB table:
  TRIPLET_TABLE (default: animal_embeddings_768) with columns:
    desertion_no, embedding_side, vector1~4 (vector type), split, created_at

Outputs JSON to stdout:
{
  "query_bbox": {"x1": int, "y1": int, "x2": int, "y2": int, "conf": float},
  "results": [
     {
       "desertion_no": "...",
       "side": "popfile1|popfile2",
       "similarity": float,
       "det_conf": float,
       "image_url": "...",
       "kind_nm": "...",
       "sex_cd": "...",
       "age": "...",
       "care_nm": "...",
       "care_tel": "...",
       "care_addr": "..."
     }, ...
  ]
}
"""
import argparse
import json
import os
from dataclasses import dataclass
from typing import Dict, List, Tuple

import numpy as np
import psycopg2
import torch
from PIL import Image
from psycopg2.extras import DictCursor

from advanced_embedding_pipeline import (
    DINO_MODEL_NAME,
    PG_DSN,
    DinoEmbedder,
    YoloCropper,
)

TRIPLET_TABLE = os.getenv("TRIPLET_TABLE", "animal_embeddings_1024")
EMBED_DIM = int(os.getenv("TRIPLET_EMBED_DIM", "1024"))
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


@dataclass
class DbEmbedding:
    desertion_no: str
    side: str
    vec: np.ndarray
    det_conf: float
    image_url: str
    up_kind_cd: str
    kind_nm: str
    sex_cd: str
    age: str
    care_nm: str
    care_tel: str
    care_addr: str


def _parse_vec(raw) -> np.ndarray:
    if raw is None:
        return np.array([], dtype=np.float32)
    if isinstance(raw, str):
        return np.fromstring(raw.strip("[]"), sep=",", dtype=np.float32)
    if isinstance(raw, (list, tuple, np.ndarray)):
        return np.asarray(raw, dtype=np.float32)
    return np.array([], dtype=np.float32)


def _mean_valid_vectors(vectors: List[np.ndarray], dim: int) -> np.ndarray:
    valid = [v for v in vectors if v.size == dim]
    if not valid:
        return np.array([], dtype=np.float32)
    return np.mean(valid, axis=0).astype(np.float32)


def load_embeddings(conn, model_name: str) -> List[DbEmbedding]:
    sql = f"""
        SELECT
            e.desertion_no,
            e.embedding_side,
            e.vector1::text AS v1_text,
            e.vector2::text AS v2_text,
            e.vector3::text AS v3_text,
            e.vector4::text AS v4_text,
            0.0 AS det_conf,
            CASE WHEN e.embedding_side = 'popfile1' THEN a.popfile1 ELSE a.popfile2 END AS image_url,
            COALESCE(a.up_kind_cd, '') AS up_kind_cd,
            COALESCE(a.kind_nm, '') AS kind_nm,
            COALESCE(a.sex_cd, '') AS sex_cd,
            COALESCE(a.age, '') AS age,
            COALESCE(a.care_nm, '') AS care_nm,
            COALESCE(a.care_tel, '') AS care_tel,
            COALESCE(a.care_addr, '') AS care_addr
        FROM {TRIPLET_TABLE} e
        JOIN abandoned_animals a
          ON a.desertion_no = e.desertion_no
        WHERE e.vector1 IS NOT NULL
    """
    with conn.cursor(cursor_factory=DictCursor) as cur:
        cur.execute(sql)
        rows = cur.fetchall()
    embeddings: List[DbEmbedding] = []
    for row in rows:
        vecs = [
            _parse_vec(row["v1_text"]),
            _parse_vec(row["v2_text"]),
            _parse_vec(row["v3_text"]),
            _parse_vec(row["v4_text"]),
        ]
        vec = _mean_valid_vectors(vecs, EMBED_DIM)
        if vec.size != EMBED_DIM:
            continue
        embeddings.append(
            DbEmbedding(
                desertion_no=row["desertion_no"],
                side=row["embedding_side"],
                vec=vec,
                det_conf=float(row["det_conf"]),
                image_url=row["image_url"] or "",
                up_kind_cd=row["up_kind_cd"],
                kind_nm=row["kind_nm"],
                sex_cd=row["sex_cd"],
                age=row["age"],
                care_nm=row["care_nm"],
                care_tel=row["care_tel"],
                care_addr=row["care_addr"],
            )
        )
    return embeddings


def main():
    parser = argparse.ArgumentParser(description="Baseline cosine similarity search (no triplet head).")
    parser.add_argument("--image", required=True, help="Query image path")
    parser.add_argument("--topk", type=int, default=20, help="Number of results to return")
    parser.add_argument("--model-name", default=DINO_MODEL_NAME, help="Model name used when storing embeddings (query-side)")
    args = parser.parse_args()

    if not os.path.isfile(args.image):
        raise FileNotFoundError(f"Image not found: {args.image}")

    img = Image.open(args.image).convert("RGB")
    cropper = YoloCropper()
    embedder = DinoEmbedder(model_name=args.model_name)

    detection = cropper.detect_best_crop(img)
    query_vec = embedder.embed_batch([detection.crop])[0]

    if query_vec.shape[0] != EMBED_DIM:
        if query_vec.shape[0] > EMBED_DIM:
            query_vec = query_vec[:EMBED_DIM]
        else:
            raise RuntimeError(
                f"Query embedding dim {query_vec.shape[0]} does not match expected {EMBED_DIM}. "
                "Set DINO_MODEL_NAME/EMBED_DIM to the trained dimension."
            )

    with psycopg2.connect(PG_DSN) as conn:
        dataset = load_embeddings(conn, args.model_name)

    if not dataset:
        raise RuntimeError(f"No embeddings found in {TRIPLET_TABLE} with dim={EMBED_DIM}.")

    # Normalize query
    query_vec = query_vec / (np.linalg.norm(query_vec) + 1e-8)

    scores: List[Tuple[float, DbEmbedding]] = []
    # Optional filters from env
    gender_filter_raw = os.getenv("SEARCH_GENDER", "").lower()
    gender_filter = (
        "M"
        if gender_filter_raw == "male"
        else "F"
        if gender_filter_raw == "female"
        else ""
        if gender_filter_raw in ("", "undefined", "null")
        else ""
    )
    animal_filter = os.getenv("SEARCH_ANIMAL_TYPE", "").strip().lower()
    animal_code = {"dog": "417000", "cat": "422400"}.get(animal_filter, "")

    # Batch cosine
    batch_size = 512
    for start in range(0, len(dataset), batch_size):
        batch = dataset[start : start + batch_size]
        if animal_code or gender_filter:
            batch = [
                emb
                for emb in batch
                if (not animal_code or emb.up_kind_cd == animal_code)
                and (not gender_filter or emb.sex_cd.upper() == gender_filter)
            ]
            if not batch:
                continue
        vecs = np.stack([e.vec for e in batch], axis=0)
        norms = np.linalg.norm(vecs, axis=1, keepdims=True) + 1e-8
        vecs_norm = vecs / norms
        sims = vecs_norm @ query_vec
        for sim, emb in zip(sims, batch):
            scores.append((float(sim), emb))

    scores.sort(key=lambda x: x[0], reverse=True)
    if not scores:
        payload: Dict[str, object] = {
            "query_bbox": {
                "x1": int(detection.bbox[0]),
                "y1": int(detection.bbox[1]),
                "x2": int(detection.bbox[2]),
                "y2": int(detection.bbox[3]),
                "conf": float(detection.conf),
            },
            "results": [],
        }
        print(json.dumps(payload, ensure_ascii=False))
        return
    topk = scores[: args.topk]

    payload: Dict[str, object] = {
        "query_bbox": {
            "x1": int(detection.bbox[0]),
            "y1": int(detection.bbox[1]),
            "x2": int(detection.bbox[2]),
            "y2": int(detection.bbox[3]),
            "conf": float(detection.conf),
        },
        "results": [
            {
                "desertion_no": emb.desertion_no,
                "side": emb.side,
                "similarity": sim,
                "det_conf": emb.det_conf,
                "image_url": emb.image_url,
                "up_kind_cd": emb.up_kind_cd,
                "kind_nm": emb.kind_nm,
                "sex_cd": emb.sex_cd,
                "age": emb.age,
                "care_nm": emb.care_nm,
                "care_tel": emb.care_tel,
                "care_addr": emb.care_addr,
            }
            for sim, emb in topk
        ],
    }
    print(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main()

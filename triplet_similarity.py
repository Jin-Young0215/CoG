#!/usr/bin/env python
"""
Find top-K similar shelter animals using a 768-dim embedding + triplet head.

Inputs:
  --image <path>   : query image file
  --topk <int>     : number of results (default 20)
  --model-name     : embedding model name stored in DB (defaults to DINO_MODEL_NAME)

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
import glob
import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Tuple

import numpy as np
import psycopg2
import torch
import torch.nn.functional as F
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
CKPT_PATH = os.getenv("TRIPLET_CKPT", f"checkpoints/triplet_head_{EMBED_DIM}.pt")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
COARSE_TOPK = int(os.getenv("COARSE_TOPK", "500"))  # first-stage candidate size


class TinyHead(torch.nn.Module):
    def __init__(self, d_in: int):
        super().__init__()
        self.net = torch.nn.Sequential(
            torch.nn.Linear(d_in, d_in // 2),
            torch.nn.ReLU(),
            torch.nn.Linear(d_in // 2, d_in // 2),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return F.normalize(self.net(x), dim=-1)


@dataclass
class DbEmbedding:
    desertion_no: str
    side: str
    vec: np.ndarray
    image_url: str
    up_kind_cd: str
    kind_nm: str
    sex_cd: str
    age: str
    neuter_yn: str
    care_nm: str
    care_tel: str
    care_addr: str
    notice_sdt: str
    special_mark: str


def _parse_vec(raw) -> np.ndarray:
    """
    Accept vector data returned as text (e.g., "[0.1,0.2,...]") or as a Python list/tuple.
    """
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
    """
    animal_embeddings_1024 구조 (vector1~4, embedding_side) 를 사용.
    vector1~4 중 dim=EMBED_DIM 인 것만 평균하여 사용.
    model_name/embedding_dim 컬럼이 없으므로 필터 없이 전체를 조회.
    """
    sql = f"""
        SELECT
            e.desertion_no,
            e.embedding_side,
            e.vector1::text AS v1_text,
            e.vector2::text AS v2_text,
            e.vector3::text AS v3_text,
            e.vector4::text AS v4_text,
            CASE WHEN e.embedding_side = 'popfile1' THEN a.popfile1 ELSE a.popfile2 END AS image_url,
            COALESCE(a.up_kind_cd, '') AS up_kind_cd,
            COALESCE(a.kind_nm, '') AS kind_nm,
            COALESCE(a.sex_cd, '') AS sex_cd,
            COALESCE(a.age, '') AS age,
            COALESCE(a.neuter_yn, '') AS neuter_yn,
            COALESCE(a.care_nm, '') AS care_nm,
            COALESCE(a.care_tel, '') AS care_tel,
            COALESCE(a.care_addr, '') AS care_addr,
            COALESCE(a.notice_sdt::text, '') AS notice_sdt,
            COALESCE(a.special_mark, '') AS special_mark
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
                image_url=row["image_url"] or "",
                up_kind_cd=row["up_kind_cd"],
                kind_nm=row["kind_nm"],
                sex_cd=row["sex_cd"],
                age=row["age"],
                neuter_yn=row["neuter_yn"],
                care_nm=row["care_nm"],
                care_tel=row["care_tel"],
                care_addr=row["care_addr"],
                notice_sdt=row["notice_sdt"],
                special_mark=row["special_mark"],
            )
        )
    return embeddings


def resolve_ckpt_path() -> str:
    """
    Prefer explicit env/path, then default name, then any matching checkpoint in the folder.
    """
    search_pattern = f"checkpoints/triplet_head_{EMBED_DIM}*.pt"

    if CKPT_PATH and os.path.exists(CKPT_PATH):
        return CKPT_PATH

    matches = sorted(glob.glob(search_pattern))
    if matches:
        fallback = matches[0]
        print(
            f"Triplet head checkpoint not found at {CKPT_PATH}; using fallback {fallback}",
            file=sys.stderr,
        )
        return fallback

    raise FileNotFoundError(f"Triplet head checkpoint not found: {CKPT_PATH}")


def load_head() -> TinyHead:
    ckpt_path = resolve_ckpt_path()
    head = TinyHead(EMBED_DIM).to(DEVICE)
    ckpt = torch.load(ckpt_path, map_location=DEVICE)
    state = ckpt.get("state_dict", ckpt)
    head.load_state_dict(state, strict=False)
    head.eval()
    return head


def main():
    parser = argparse.ArgumentParser(description="Triplet-head similarity search (768-dim).")
    parser.add_argument("--image", required=True, help="Query image path")
    parser.add_argument("--topk", type=int, default=20, help="Number of results to return")
    parser.add_argument("--model-name", default=DINO_MODEL_NAME, help="Model name used when storing embeddings (query-side)")
    args = parser.parse_args()

    if not os.path.isfile(args.image):
        raise FileNotFoundError(f"Image not found: {args.image}")

    img = Image.open(args.image).convert("RGB")
    cropper = YoloCropper()
    embedder = DinoEmbedder(model_name=args.model_name)
    head = load_head()

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

    # Optional filters from env
    gender_filter_raw = os.getenv("SEARCH_GENDER", "").lower()
    # treat "undefined"/"null"/"" as no filter
    gender_filter = (
        "M"
        if gender_filter_raw == "male"
        else "F"
        if gender_filter_raw == "female"
        else ""
        if gender_filter_raw in ("", "undefined", "null")
        else ""
    )
    lost_date_str = os.getenv("SEARCH_LOST_DATE", "").strip()
    if lost_date_str in ("", "undefined", "null"):
        lost_date_str = ""
    lost_date = None
    if lost_date_str:
        try:
            lost_date = datetime.fromisoformat(lost_date_str).date()
        except Exception:
            lost_date = None
    animal_filter = os.getenv("SEARCH_ANIMAL_TYPE", "").strip().lower()
    animal_code = {"dog": "417000", "cat": "422400"}.get(animal_filter, "")

    with psycopg2.connect(PG_DSN) as conn:
        dataset = load_embeddings(conn, args.model_name)

    # Apply filters: animal type, gender and notice date after lost date
    if animal_code or gender_filter or lost_date:
        filtered = []
        for emb in dataset:
            if animal_code and emb.up_kind_cd != animal_code:
                continue
            if gender_filter and emb.sex_cd.upper() != gender_filter:
                continue
            if lost_date:
                if not emb.notice_sdt:
                    continue
                try:
                    notice_dt = datetime.fromisoformat(emb.notice_sdt).date()
                except Exception:
                    continue
                if notice_dt < lost_date:
                    continue
            filtered.append(emb)
        dataset = filtered

    if not dataset:
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

    if not dataset:
        raise RuntimeError(f"No embeddings found in {TRIPLET_TABLE} with dim={EMBED_DIM} and model={args.model_name}")

    # Transform query through head
    with torch.no_grad():
        q = torch.tensor(query_vec, dtype=torch.float32, device=DEVICE)
        q = torch.nn.functional.normalize(q, dim=0)
        query_t = head(q)

    # ------- Stage 1: coarse retrieval with base embeddings -------
    base_vecs = torch.tensor([e.vec for e in dataset], dtype=torch.float32, device=DEVICE)
    base_vecs = torch.nn.functional.normalize(base_vecs, dim=1)
    with torch.no_grad():
        coarse_scores = torch.matmul(base_vecs, q)  # q is already normalized
    topn = min(len(dataset), max(args.topk, COARSE_TOPK))
    topn_scores, topn_idx = torch.topk(coarse_scores, k=topn)
    shortlist = [dataset[i] for i in topn_idx.cpu().tolist()]

    # ------- Stage 2: rerank with triplet head -------
    scores: List[Tuple[float, DbEmbedding]] = []
    batch_size = 512
    for start in range(0, len(shortlist), batch_size):
        batch = shortlist[start : start + batch_size]
        vecs = torch.tensor([e.vec for e in batch], dtype=torch.float32, device=DEVICE)
        vecs = torch.nn.functional.normalize(vecs, dim=1)
        with torch.no_grad():
            transformed = head(vecs)  # already normalized by TinyHead
            sims = torch.matmul(transformed, query_t)
        for sim, emb in zip(sims.cpu().numpy(), batch):
            scores.append((float(sim), emb))

    scores.sort(key=lambda x: x[0], reverse=True)
    # Deduplicate per desertion_no, keep the highest-scoring entry per ID
    best_per_id: Dict[str, Tuple[float, DbEmbedding]] = {}
    for sim, emb in scores:
        prev = best_per_id.get(emb.desertion_no)
        if prev is None or sim > prev[0]:
            best_per_id[emb.desertion_no] = (sim, emb)
    deduped = sorted(best_per_id.values(), key=lambda x: x[0], reverse=True)
    topk = deduped[: args.topk]

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
                "image_url": emb.image_url,
                "up_kind_cd": emb.up_kind_cd,
                "kind_nm": emb.kind_nm,
                "sex_cd": emb.sex_cd,
                "age": emb.age,
                "neuter_yn": emb.neuter_yn,
                "care_nm": emb.care_nm,
                "care_tel": emb.care_tel,
                "care_addr": emb.care_addr,
                "notice_sdt": emb.notice_sdt,
                "special_mark": emb.special_mark,
            }
            for sim, emb in topk
        ],
    }
    print(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main()

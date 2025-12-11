#!/usr/bin/env python
"""
Compare baseline cosine similarity vs. triplet-head-transformed similarity
for popfile1/popfile2 pairs in a given embedding table (default 384 dim).
"""
import os
from typing import Dict, Tuple

import psycopg2
import torch
import torch.nn.functional as F
from psycopg2.extras import DictCursor

PG_DSN = os.getenv(
    "PG_DSN", "host=localhost port=5432 dbname=cogdb user=postgres password=6575"
)
TABLE = os.getenv("TRIPLET_TABLE", "animal_embeddings_384")
EMBED_DIM = int(os.getenv("TRIPLET_EMBED_DIM", "384"))
CKPT_PATH = os.getenv("TRIPLET_CKPT", f"checkpoints/triplet_head_{EMBED_DIM}.pt")
SPLIT = os.getenv("TRIPLET_EVAL_SPLIT", "test")  # set to "all" to ignore split filter
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


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


def load_vectors() -> Tuple[Dict[str, torch.Tensor], Dict[str, torch.Tensor]]:
    """Load popfile1/popfile2 vector1 for the chosen split."""
    where_split = "" if SPLIT == "all" else "AND split = %s"
    params = ("popfile1",) if SPLIT == "all" else ("popfile1", SPLIT)
    params2 = ("popfile2",) if SPLIT == "all" else ("popfile2", SPLIT)

    sql = f"""
    SELECT desertion_no, vector1::float4[] AS vec
    FROM {TABLE}
    WHERE embedding_side = %s {where_split}
    """
    pop1: Dict[str, torch.Tensor] = {}
    pop2: Dict[str, torch.Tensor] = {}
    with psycopg2.connect(PG_DSN) as conn, conn.cursor(cursor_factory=DictCursor) as cur:
        cur.execute(sql, params)
        for row in cur.fetchall():
            pop1[row["desertion_no"]] = torch.tensor(row["vec"], dtype=torch.float32)
        cur.execute(sql, params2)
        for row in cur.fetchall():
            pop2[row["desertion_no"]] = torch.tensor(row["vec"], dtype=torch.float32)
    return pop1, pop2


def cosine(a: torch.Tensor, b: torch.Tensor) -> float:
    return float(F.cosine_similarity(a, b, dim=0).item())


def main():
    pop1, pop2 = load_vectors()
    common_ids = sorted(set(pop1) & set(pop2))
    if not common_ids:
        raise RuntimeError("No matching popfile1/popfile2 pairs found for evaluation.")
    print(f"Loaded {len(common_ids)} pairs from {TABLE} (split={SPLIT}).")

    # baseline cosine
    base_sims = []
    for did in common_ids:
        base_sims.append(cosine(pop1[did], pop2[did]))
    base_avg = sum(base_sims) / len(base_sims)

    # load head
    if not os.path.exists(CKPT_PATH):
        raise FileNotFoundError(f"Checkpoint not found: {CKPT_PATH}")
    head = TinyHead(EMBED_DIM).to(DEVICE)
    ckpt = torch.load(CKPT_PATH, map_location=DEVICE)
    state = ckpt.get("state_dict", ckpt)
    head.load_state_dict(state, strict=False)
    head.eval()

    # transformed cosine
    tuned_sims = []
    with torch.no_grad():
        for did in common_ids:
            a = pop1[did].to(DEVICE)
            b = pop2[did].to(DEVICE)
            tuned_sims.append(cosine(head(a), head(b)))
    tuned_avg = sum(tuned_sims) / len(tuned_sims)

    # simple deltas
    deltas = [t - b for b, t in zip(base_sims, tuned_sims)]
    improved = sum(1 for d in deltas if d > 0)
    worsened = sum(1 for d in deltas if d < 0)

    print(f"Baseline avg cosine:   {base_avg:.4f}")
    print(f"Tuned avg cosine:      {tuned_avg:.4f}")
    print(f"Pairs improved/worse:  {improved} / {worsened} (out of {len(common_ids)})")


if __name__ == "__main__":
    main()

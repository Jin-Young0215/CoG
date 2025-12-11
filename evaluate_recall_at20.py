import os
import time

import psycopg2
import torch
import torch.nn as nn
import torch.nn.functional as F
from psycopg2.extras import DictCursor

PG_DSN = "host=localhost port=5432 dbname=cogdb user=postgres password=6575"

# 단일 테이블/체크포인트만 평가하고 싶을 때 환경변수로 지정
EVAL_TABLE = os.getenv("EVAL_TABLE")
EVAL_DIM = int(os.getenv("EVAL_DIM", "0")) or None
EVAL_CKPT = os.getenv("EVAL_CKPT")

TABLES = (
    [(EVAL_TABLE, EVAL_DIM, EVAL_CKPT)]
    if EVAL_TABLE and EVAL_DIM and EVAL_CKPT
    else [
        ("animal_embeddings_384", 384, "checkpoints/triplet_head_384.pt"),
        ("animal_embeddings_768", 768, "checkpoints/triplet_head_768.pt"),
        ("animal_embeddings_1024", 1024, "checkpoints/triplet_head_1024.pt"),
        ("animal_embeddings_1536", 1536, "checkpoints/triplet_head_1536.pt"),
    ]
)
TOP_K = 20

class TinyHead(nn.Module):
    def __init__(self, d_in):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(d_in, d_in // 2),
            nn.ReLU(),
            nn.Linear(d_in // 2, d_in // 2),
        )
    def forward(self, x):
        return F.normalize(self.net(x), dim=-1)

def load_vectors(table: str):
    with psycopg2.connect(PG_DSN) as conn, conn.cursor(cursor_factory=DictCursor) as cur:
        cur.execute(
            f"""
            SELECT desertion_no, vector1::float4[], vector2::float4[],
                   vector3::float4[], vector4::float4[]
            FROM {table}
            WHERE embedding_side='popfile1'
            """
        )
        pop1_rows = cur.fetchall()
        cur.execute(
            f"""
            SELECT desertion_no, vector1::float4[]
            FROM {table}
            WHERE embedding_side='popfile2'
            """
        )
        pop2_rows = cur.fetchall()
    pop1_ids, pop1_vecs = [], []
    for r in pop1_rows:
        for vec in (r[1], r[2], r[3], r[4]):
            if vec is None:
                continue
            pop1_ids.append(r[0])
            pop1_vecs.append(torch.tensor(vec, dtype=torch.float32))
    pop2 = {r[0]: torch.tensor(r[1], dtype=torch.float32) for r in pop2_rows if r[1] is not None}
    return pop1_ids, pop1_vecs, pop2

def evaluate(table, dim, ckpt_path=None):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    pop1_ids, pop1_vecs, pop2 = load_vectors(table)
    if not pop1_vecs or not pop2:
        return None
    pop1 = torch.stack(pop1_vecs).to(device)
    pop1 = F.normalize(pop1, dim=1)
    head = None
    if ckpt_path:
        head = TinyHead(dim).to(device)
        ckpt = torch.load(ckpt_path, map_location=device)
        head.load_state_dict(ckpt.get("state_dict", ckpt), strict=False)
        head.eval()
        with torch.no_grad():
            pop1 = head(pop1)
    queries = [(did, pop2[did]) for did in pop2.keys() if did in pop1_ids]
    success = 0
    t_total = 0.0
    with torch.no_grad():
        for did, vec in queries:
            q = F.normalize(vec.to(device), dim=0)
            if head is not None:
                q = head(q)
            t0 = time.perf_counter()
            sims = torch.matmul(pop1, q)
            idxs = torch.topk(sims, k=min(TOP_K, sims.numel())).indices.tolist()
            hits = {pop1_ids[i] for i in idxs}
            if did in hits:
                success += 1
            t_total += time.perf_counter() - t0
    return {
        "table": table,
        "dim": dim,
        "recall@20": success / len(queries),
        "avg_ms_per_query": (t_total / len(queries)) * 1000,
        "queries": len(queries),
    }

def main():
    for table, dim, ckpt in TABLES:
        base = evaluate(table, dim, None)
        head = evaluate(table, dim, ckpt)
        print(f"=== {table} (dim {dim}) ===")
        print(f"baseline recall@20={base['recall@20']*100:.2f}% | avg_search={base['avg_ms_per_query']:.3f} ms over {base['queries']} queries")
        print(f"triplet  recall@20={head['recall@20']*100:.2f}% | avg_search={head['avg_ms_per_query']:.3f} ms over {head['queries']} queries")
        print()

if __name__ == "__main__":
    main()

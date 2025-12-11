#!/usr/bin/env python
"""
Triplet training script using precomputed embeddings from animal_embeddings_* tables.
- Loads train/valid splits for a chosen dimension table (default 768).
- Samples random triplets (anchor/positive from same desertion_no, negative from different).
- Trains a small projection head with cosine-based triplet margin loss.
"""
import os
import random
import psycopg2
import torch
import torch.nn as nn
import torch.nn.functional as F
from psycopg2.extras import DictCursor
from torch.utils.data import Dataset, DataLoader

PG_DSN = os.getenv("PG_DSN", "host=localhost port=5432 dbname=cogdb user=postgres password=6575")
if torch.backends.mps.is_available():
    DEVICE = "mps"
elif torch.cuda.is_available():
    DEVICE = "cuda"
else:
    DEVICE = "cpu"
OUT_DIR = os.getenv("TRIPLET_OUT_DIR", "checkpoints")
DEFAULT_TABLE = os.getenv("TRIPLET_TABLE", "animal_embeddings_1024")
DEFAULT_EMBED_DIM = int(os.getenv("TRIPLET_EMBED_DIM", "1024"))
DEFAULT_BATCH_SIZE = int(os.getenv("TRIPLET_BATCH", "64"))
DEFAULT_LENGTH_MULT = int(os.getenv("TRIPLET_LENGTH_MULT", "25"))
DEFAULT_MARGIN = float(os.getenv("TRIPLET_MARGIN", "0.2"))
WEAK_MARGIN = float(os.getenv("TRIPLET_MARGIN_WEAK", str(DEFAULT_MARGIN / 2)))
WEAK_WEIGHT = float(os.getenv("TRIPLET_WEAK_WEIGHT", "0.5"))  # weight for weak-positive loss
DEFAULT_EPOCHS = int(os.getenv("TRIPLET_EPOCHS", "60"))
DEFAULT_LR = float(os.getenv("TRIPLET_LR", "0.001"))
DEFAULT_NUM_WORKERS = int(os.getenv("TRIPLET_NUM_WORKERS", "0"))
DIM_LIST = os.getenv("TRIPLET_DIM_LIST", "1024")


def fetch_embeddings(table: str, split: str):
    use_vec34 = os.getenv("TRIPLET_USE_VEC34", "0") == "1"
    sql = f"""
    SELECT e.desertion_no, e.embedding_side,
           vector1::float4[], vector2::float4[], vector3::float4[], vector4::float4[]
          ,a.kind_cd, a.color_cd
    FROM {table} e
    JOIN abandoned_animals a ON a.desertion_no = e.desertion_no
    WHERE e.split = %s
    """
    with psycopg2.connect(PG_DSN) as conn, conn.cursor(cursor_factory=DictCursor) as cur:
        cur.execute(sql, (split,))
        rows = cur.fetchall()
    grouped = {}
    for r in rows:
        vecs = [r["vector1"], r["vector2"]]
        if use_vec34:
            vecs.extend([r["vector3"], r["vector4"]])
        vecs = [torch.tensor(v, dtype=torch.float32) for v in vecs if v is not None]
        if not vecs:
            continue
        grouped.setdefault(
            r["desertion_no"],
            {"vecs": [], "kind": r["kind_cd"], "color": r["color_cd"]},
        )["vecs"].extend(vecs)
    return grouped


class TripletDataset(Dataset):
    def __init__(self, grouped, length_mult: int):
        # keep only ids with at least 2 vectors for strong positives
        self.grouped = {k: v for k, v in grouped.items() if len(v["vecs"]) >= 2}
        self.ids = list(self.grouped.keys())
        self.neg_ids = self.ids
        self.length_mult = max(1, int(length_mult))
        # weak-positive pool by (kind,color)
        self.by_meta = {}
        for did, info in self.grouped.items():
            key = (info["kind"], info["color"])
            self.by_meta.setdefault(key, []).append(did)

    def __len__(self):
        return len(self.ids) * self.length_mult

    def __getitem__(self, idx):
        did = self.ids[idx % len(self.ids)]  # repeat sampling per ID
        info = self.grouped[did]
        anchor, positive_strong = random.sample(info["vecs"], 2)

        # weak positive: same kind/color but different id
        key = (info["kind"], info["color"])
        weak_ids = [x for x in self.by_meta.get(key, []) if x != did]
        if weak_ids:
            w_id = random.choice(weak_ids)
            weak_vec = random.choice(self.grouped[w_id]["vecs"])
        else:
            weak_vec = positive_strong  # fallback

        neg_id = random.choice(self.neg_ids)
        while neg_id == did:
            neg_id = random.choice(self.neg_ids)
        negative = random.choice(self.grouped[neg_id]["vecs"])
        return (
            F.normalize(anchor, dim=0),
            F.normalize(positive_strong, dim=0),
            F.normalize(weak_vec, dim=0),
            F.normalize(negative, dim=0),
        )


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


def train(table, embed_dim, batch_size, margin, epochs, lr, length_mult, num_workers):
    train_group = fetch_embeddings(table, "train")
    valid_group = fetch_embeddings(table, "valid")
    if not train_group:
        raise RuntimeError("No train embeddings found. Run prepare_triplet_data.py first.")

    train_ds = TripletDataset(train_group, length_mult=length_mult)
    valid_ds = TripletDataset(valid_group, length_mult=1) if valid_group else None
    train_dl = DataLoader(
        train_ds,
        batch_size=batch_size,
        shuffle=True,
        drop_last=False,
        num_workers=num_workers,
        pin_memory=(DEVICE == "cuda"),
    )
    valid_dl = (
        DataLoader(
            valid_ds,
            batch_size=batch_size,
            shuffle=False,
            drop_last=False,
            num_workers=num_workers,
            pin_memory=(DEVICE == "cuda"),
        )
        if valid_ds
        else []
    )
    train_steps = len(train_dl)
    total_updates = train_steps * epochs

    model = TinyHead(embed_dim).to(DEVICE)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr)
    strong_loss_fn = nn.TripletMarginWithDistanceLoss(
        distance_function=lambda x, y: 1 - F.cosine_similarity(x, y),
        margin=margin,
    )
    weak_loss_fn = nn.TripletMarginWithDistanceLoss(
        distance_function=lambda x, y: 1 - F.cosine_similarity(x, y),
        margin=WEAK_MARGIN,
    )

    print(
        f"config: table={table} embed_dim={embed_dim} batch={batch_size} "
        f"epochs={epochs} length_mult={length_mult} margin={margin} weak_margin={WEAK_MARGIN} weak_weight={WEAK_WEIGHT} lr={lr} "
        f"num_workers={num_workers} device={DEVICE}",
        flush=True,
    )
    print(
        f"dataset sizes: train_ids={len(train_ds.ids)} train_len={len(train_ds)} "
        f"valid_ids={len(valid_ds.ids) if valid_ds else 0} valid_len={len(valid_ds) if valid_ds else 0} "
        f"train_steps_per_epoch={len(train_dl)} valid_steps_per_epoch={len(valid_dl)}",
        flush=True,
    )
    if train_steps > 2000 or total_updates > 150000:
        print(
            "hint: steps are large; consider raising TRIPLET_BATCH or TRIPLET_NUM_WORKERS to hide I/O, "
            "or slightly lowering TRIPLET_LENGTH_MULT.",
            flush=True,
        )
    if num_workers == 0 and train_steps > 500:
        print("hint: TRIPLET_NUM_WORKERS=0; try a few workers to overlap I/O.", flush=True)

    for epoch in range(epochs):
        model.train()
        running = 0.0
        total_batches = len(train_dl)
        for step, (anchor, positive_strong, positive_weak, negative) in enumerate(train_dl, 1):
            anchor = anchor.to(DEVICE)
            positive_strong = positive_strong.to(DEVICE)
            positive_weak = positive_weak.to(DEVICE)
            negative = negative.to(DEVICE)
            optimizer.zero_grad()
            a, ps, pw, n = model(anchor), model(positive_strong), model(positive_weak), model(negative)
            loss_strong = strong_loss_fn(a, ps, n)
            loss_weak = weak_loss_fn(a, pw, n)
            loss = loss_strong + WEAK_WEIGHT * loss_weak
            loss.backward()
            optimizer.step()
            running += loss.item() * anchor.size(0)
            if step % 20 == 0 or step == total_batches:
                print(
                    f"epoch {epoch+1}/{epochs} step {step}/{total_batches} "
                    f"batch_loss={loss.item():.4f} "
                    f"(strong={loss_strong.item():.4f} weak={loss_weak.item():.4f})",
                    flush=True,
                )
        train_loss = running / len(train_dl.dataset) if len(train_dl.dataset) else 0

        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for anchor, positive_strong, positive_weak, negative in valid_dl:
                anchor = anchor.to(DEVICE)
                positive_strong = positive_strong.to(DEVICE)
                positive_weak = positive_weak.to(DEVICE)
                negative = negative.to(DEVICE)
                a, ps, pw, n = model(anchor), model(positive_strong), model(positive_weak), model(negative)
                l_s = strong_loss_fn(a, ps, n)
                l_w = weak_loss_fn(a, pw, n)
                val_loss += (l_s + WEAK_WEIGHT * l_w).item() * anchor.size(0)
        val_loss = val_loss / len(valid_dl.dataset) if valid_dl else 0

        print(f"epoch {epoch+1}: train_loss={train_loss:.4f} val_loss={val_loss:.4f}")

    # save final checkpoint per run/dimension for downstream eval/deploy
    os.makedirs(OUT_DIR, exist_ok=True)
    ckpt_path = os.path.join(OUT_DIR, f"triplet_head_{embed_dim}.pt")
    torch.save(
        {
            "state_dict": model.state_dict(),
            "embed_dim": embed_dim,
            "table": table,
            "epochs": epochs,
            "margin": margin,
        },
        ckpt_path,
    )
    print(f"saved checkpoint to {ckpt_path}")


def _parse_dims(raw: str):
    dims = []
    seen = set()
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            dim_val = int(part)
        except ValueError:
            print(f"skip invalid dim '{part}'", flush=True)
            continue
        if dim_val in seen:
            continue
        seen.add(dim_val)
        dims.append(dim_val)
    return dims


if __name__ == "__main__":
    dims = _parse_dims(DIM_LIST)
    if dims:
        for d in dims:
            table = f"animal_embeddings_{d}"
            print(f"=== training dimension {d} ===", flush=True)
            train(
                table=table,
                embed_dim=d,
                batch_size=DEFAULT_BATCH_SIZE,
                margin=DEFAULT_MARGIN,
                epochs=DEFAULT_EPOCHS,
                lr=DEFAULT_LR,
                length_mult=DEFAULT_LENGTH_MULT,
                num_workers=DEFAULT_NUM_WORKERS,
            )
    else:
        train(
            table=DEFAULT_TABLE,
            embed_dim=DEFAULT_EMBED_DIM,
            batch_size=DEFAULT_BATCH_SIZE,
            margin=DEFAULT_MARGIN,
            epochs=DEFAULT_EPOCHS,
            lr=DEFAULT_LR,
            length_mult=DEFAULT_LENGTH_MULT,
            num_workers=DEFAULT_NUM_WORKERS,
        )

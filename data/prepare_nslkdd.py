"""
prepare_nslkdd.py — Convert the real NSL-KDD dataset into the Sentinel XDR
training schema.

NSL-KDD (KDDTrain+.txt) has 43 columns. We keep the 8 features the model uses
(all real NSL-KDD columns), map the label to binary (normal=0, attack=1), and
derive the standard attack-category (dos/probe/r2l/u2r). Output is written in the
SAME schema as data/sample_network_flows.csv, so the existing preprocessing,
training, API, and UI work unchanged — just on real benchmark data.

Usage:
    python data/prepare_nslkdd.py --in data/nslkdd/KDDTrain+.txt \
        --out data/nslkdd_flows.csv --sample 25000
"""
from __future__ import annotations

import argparse
import os

import pandas as pd

# Canonical NSL-KDD column order (41 features + label + difficulty).
NSLKDD_COLUMNS = [
    "duration", "protocol_type", "service", "flag", "src_bytes", "dst_bytes",
    "land", "wrong_fragment", "urgent", "hot", "num_failed_logins", "logged_in",
    "num_compromised", "root_shell", "su_attempted", "num_root",
    "num_file_creations", "num_shells", "num_access_files", "num_outbound_cmds",
    "is_host_login", "is_guest_login", "count", "srv_count", "serror_rate",
    "srv_serror_rate", "rerror_rate", "srv_rerror_rate", "same_srv_rate",
    "diff_srv_rate", "srv_diff_host_rate", "dst_host_count", "dst_host_srv_count",
    "dst_host_same_srv_rate", "dst_host_diff_srv_rate",
    "dst_host_same_src_port_rate", "dst_host_srv_diff_host_rate",
    "dst_host_serror_rate", "dst_host_srv_serror_rate", "dst_host_rerror_rate",
    "dst_host_srv_rerror_rate", "label", "difficulty",
]

# The 8 features the Sentinel XDR DL model uses (all present in NSL-KDD).
KEEP_FEATURES = [
    "duration", "protocol_type", "service", "src_bytes", "dst_bytes",
    "count", "srv_count", "same_srv_rate",
]

# NSL-KDD attack name -> high-level category.
ATTACK_CATEGORY = {}
for name in ("back", "land", "neptune", "pod", "smurf", "teardrop", "apache2",
             "udpstorm", "processtable", "worm", "mailbomb"):
    ATTACK_CATEGORY[name] = "dos"
for name in ("satan", "ipsweep", "nmap", "portsweep", "mscan", "saint"):
    ATTACK_CATEGORY[name] = "probe"
for name in ("guess_passwd", "ftp_write", "imap", "phf", "multihop",
             "warezmaster", "warezclient", "spy", "xlock", "xsnoop",
             "snmpguess", "snmpgetattack", "httptunnel", "sendmail", "named"):
    ATTACK_CATEGORY[name] = "r2l"
for name in ("buffer_overflow", "loadmodule", "rootkit", "perl", "sqlattack",
             "xterm", "ps"):
    ATTACK_CATEGORY[name] = "u2r"


def main() -> None:
    ap = argparse.ArgumentParser(description="Convert NSL-KDD to Sentinel schema")
    ap.add_argument("--in", dest="inp", default="data/nslkdd/KDDTrain+.txt")
    ap.add_argument("--out", dest="out", default="data/nslkdd_flows.csv")
    ap.add_argument("--sample", type=int, default=25000,
                    help="stratified row sample (0 = keep all)")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    df = pd.read_csv(args.inp, header=None, names=NSLKDD_COLUMNS)
    print(f"Loaded {len(df):,} NSL-KDD rows")

    # Binary label + attack category.
    raw_label = df["label"].astype(str).str.strip()
    df["label"] = (raw_label != "normal").astype(int)
    df["attack_type"] = raw_label.map(lambda v: "normal" if v == "normal"
                                      else ATTACK_CATEGORY.get(v, "other"))

    out = df[KEEP_FEATURES + ["label", "attack_type"]].copy()

    # Optional stratified subsample (keeps class ratio) for fast training.
    if args.sample and args.sample < len(out):
        frac = args.sample / len(out)
        out = (out.groupby("label", group_keys=False)
                  .apply(lambda g: g.sample(frac=frac, random_state=args.seed)))
        out = out.sample(frac=1.0, random_state=args.seed).reset_index(drop=True)

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    out.to_csv(args.out, index=False)

    n_attack = int(out["label"].sum())
    print(f"Wrote {len(out):,} rows -> {args.out}")
    print(f"  normal={len(out) - n_attack:,}  attack={n_attack:,}  "
          f"({100 * n_attack / len(out):.1f}% attack)")
    print("  attack_type breakdown:")
    print(out["attack_type"].value_counts().to_string())


if __name__ == "__main__":
    main()

"""
Generate data/sample_network_flows.csv — a small, learnable, NSL-KDD-style
network-flow dataset for the Sentinel XDR Deep Learning final project.

Uses only the Python standard library (no numpy/pandas) so it runs in any
environment. Deterministic via a fixed seed so the committed CSV is reproducible.

Columns (10):
    duration, protocol_type, service, src_bytes, dst_bytes,
    count, srv_count, same_srv_rate, label, attack_type

label:        0 = normal, 1 = attack
attack_type:  normal | dos | probe | r2l | u2r
"""
import csv
import random
import os

random.seed(42)

PROTOCOLS = ["tcp", "udp", "icmp"]
SERVICES = ["http", "ftp", "smtp", "ssh", "dns", "telnet", "private", "ecr_i", "other"]

ROWS = []


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def normal_flow():
    proto = random.choices(["tcp", "udp"], weights=[0.7, 0.3])[0]
    service = random.choices(
        ["http", "smtp", "dns", "ssh", "ftp", "other"],
        weights=[0.45, 0.15, 0.15, 0.1, 0.1, 0.05],
    )[0]
    duration = clamp(int(random.gauss(25, 20)), 0, 400)
    src_bytes = clamp(int(random.gauss(2500, 1500)), 0, 60000)
    dst_bytes = clamp(int(random.gauss(8000, 5000)), 0, 120000)
    count = clamp(int(random.gauss(8, 5)), 1, 60)
    srv_count = clamp(int(count * random.uniform(0.6, 1.0)), 1, count)
    same_srv_rate = round(clamp(random.gauss(0.85, 0.12), 0.0, 1.0), 2)
    return [duration, proto, service, src_bytes, dst_bytes, count, srv_count,
            same_srv_rate, 0, "normal"]


def dos_flow():
    # DoS: very high connection counts, short duration, low same_srv diversity
    proto = random.choices(["tcp", "icmp", "udp"], weights=[0.5, 0.35, 0.15])[0]
    service = random.choices(["ecr_i", "private", "http"], weights=[0.4, 0.4, 0.2])[0]
    duration = clamp(int(random.gauss(1, 2)), 0, 15)
    src_bytes = clamp(int(random.gauss(40, 60)), 0, 800)
    dst_bytes = clamp(int(random.gauss(10, 30)), 0, 400)
    count = clamp(int(random.gauss(420, 90)), 150, 511)
    srv_count = clamp(int(count * random.uniform(0.85, 1.0)), 100, 511)
    same_srv_rate = round(clamp(random.gauss(0.98, 0.03), 0.0, 1.0), 2)
    return [duration, proto, service, src_bytes, dst_bytes, count, srv_count,
            same_srv_rate, 1, "dos"]


def probe_flow():
    # Probe/scan: many services touched, low same_srv_rate, small bytes
    proto = random.choices(["tcp", "udp", "icmp"], weights=[0.6, 0.25, 0.15])[0]
    service = random.choices(["private", "other", "telnet", "http"],
                             weights=[0.4, 0.3, 0.15, 0.15])[0]
    duration = clamp(int(random.gauss(2, 3)), 0, 30)
    src_bytes = clamp(int(random.gauss(60, 50)), 0, 500)
    dst_bytes = clamp(int(random.gauss(40, 50)), 0, 500)
    count = clamp(int(random.gauss(120, 60)), 30, 400)
    srv_count = clamp(int(count * random.uniform(0.1, 0.35)), 1, count)
    same_srv_rate = round(clamp(random.gauss(0.18, 0.1), 0.0, 1.0), 2)
    return [duration, proto, service, src_bytes, dst_bytes, count, srv_count,
            same_srv_rate, 1, "probe"]


def r2l_flow():
    # Remote-to-Local: auth services, moderate bytes, low counts, longer duration
    proto = "tcp"
    service = random.choices(["ftp", "telnet", "ssh", "smtp"],
                             weights=[0.35, 0.3, 0.2, 0.15])[0]
    duration = clamp(int(random.gauss(120, 90)), 5, 600)
    src_bytes = clamp(int(random.gauss(350, 250)), 10, 4000)
    dst_bytes = clamp(int(random.gauss(900, 700)), 10, 8000)
    count = clamp(int(random.gauss(4, 3)), 1, 20)
    srv_count = clamp(int(count * random.uniform(0.4, 0.9)), 1, count)
    same_srv_rate = round(clamp(random.gauss(0.55, 0.2), 0.0, 1.0), 2)
    return [duration, proto, service, src_bytes, dst_bytes, count, srv_count,
            same_srv_rate, 1, "r2l"]


def u2r_flow():
    # User-to-Root: long shell sessions, high dst_bytes (exfil), very low counts
    proto = "tcp"
    service = random.choices(["telnet", "ssh", "ftp"], weights=[0.5, 0.35, 0.15])[0]
    duration = clamp(int(random.gauss(280, 140)), 20, 800)
    src_bytes = clamp(int(random.gauss(1200, 800)), 50, 9000)
    dst_bytes = clamp(int(random.gauss(15000, 8000)), 200, 60000)
    count = clamp(int(random.gauss(2, 1)), 1, 8)
    srv_count = clamp(int(count * random.uniform(0.5, 1.0)), 1, count)
    same_srv_rate = round(clamp(random.gauss(0.65, 0.2), 0.0, 1.0), 2)
    return [duration, proto, service, src_bytes, dst_bytes, count, srv_count,
            same_srv_rate, 1, "u2r"]


# Class mix: ~45% normal, rest split across 4 attack families. ~220 rows total.
GENERATORS = (
    [normal_flow] * 100
    + [dos_flow] * 45
    + [probe_flow] * 40
    + [r2l_flow] * 22
    + [u2r_flow] * 13
)
random.shuffle(GENERATORS)

for gen in GENERATORS:
    ROWS.append(gen())

HEADER = ["duration", "protocol_type", "service", "src_bytes", "dst_bytes",
          "count", "srv_count", "same_srv_rate", "label", "attack_type"]

out_path = os.path.join(os.path.dirname(__file__), "sample_network_flows.csv")
with open(out_path, "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(HEADER)
    w.writerows(ROWS)

n_attack = sum(1 for r in ROWS if r[8] == 1)
print(f"Wrote {len(ROWS)} rows -> {out_path}")
print(f"  normal={len(ROWS) - n_attack}  attack={n_attack}")

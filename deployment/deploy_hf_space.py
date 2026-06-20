"""
deploy_hf_space.py — One-command deploy of the DL IDS API to a Hugging Face
Docker Space.

It creates (or reuses) the Space repo and uploads exactly what the serving
container needs: the Space Dockerfile + README, requirements-api.txt, and the
src/ deployment/ models/ artifacts/ data/ files.

Usage:
    # token from https://huggingface.co/settings/tokens (WRITE scope)
    export HF_TOKEN=hf_xxx
    python deployment/deploy_hf_space.py --repo-id <user>/sentinel-xdr-dl

After it finishes, the API is at  https://<user>-sentinel-xdr-dl.hf.space
(give it a few minutes for the first Docker build).
"""
from __future__ import annotations

import argparse
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HF_DIR = os.path.join(REPO_ROOT, "deployment", "hf_space")


def main() -> None:
    ap = argparse.ArgumentParser(description="Deploy the DL IDS API to a HF Space")
    ap.add_argument("--repo-id", required=True, help="e.g. Obaiz1/sentinel-xdr-dl")
    ap.add_argument("--token", default=os.environ.get("HF_TOKEN"), help="HF write token")
    ap.add_argument("--private", action="store_true", help="make the Space private")
    args = ap.parse_args()

    if not args.token:
        sys.exit("No token. Pass --token or set HF_TOKEN (WRITE scope).")

    from huggingface_hub import HfApi

    api = HfApi(token=args.token)

    print(f"Creating/looking up Space: {args.repo_id}")
    api.create_repo(
        repo_id=args.repo_id,
        repo_type="space",
        space_sdk="docker",
        private=args.private,
        exist_ok=True,
    )

    # Space root files: Dockerfile + README (from deployment/hf_space/).
    print("Uploading Space Dockerfile + README ...")
    api.upload_file(path_or_fileobj=os.path.join(HF_DIR, "Dockerfile"),
                    path_in_repo="Dockerfile", repo_id=args.repo_id, repo_type="space")
    api.upload_file(path_or_fileobj=os.path.join(HF_DIR, "README.md"),
                    path_in_repo="README.md", repo_id=args.repo_id, repo_type="space")
    api.upload_file(path_or_fileobj=os.path.join(REPO_ROOT, "requirements-api.txt"),
                    path_in_repo="requirements-api.txt", repo_id=args.repo_id, repo_type="space")

    # Code + model + minimal data, preserving folder structure.
    print("Uploading code, model, and artifacts ...")
    api.upload_folder(
        folder_path=REPO_ROOT,
        repo_id=args.repo_id,
        repo_type="space",
        allow_patterns=[
            "src/*.py",
            "deployment/__init__.py",
            "deployment/dl_api.py",
            "models/*.keras",
            "artifacts/dl_preprocessor.joblib",
            "data/sample_network_flows.csv",
        ],
    )

    user = args.repo_id.split("/")[0].lower()
    name = args.repo_id.split("/")[1].lower()
    print("\nDone. The Space is building. URL (ready in a few minutes):")
    print(f"  https://{user}-{name}.hf.space")
    print(f"  https://{user}-{name}.hf.space/docs")
    print(f"  https://huggingface.co/spaces/{args.repo_id}")


if __name__ == "__main__":
    main()

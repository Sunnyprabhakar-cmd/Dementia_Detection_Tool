"""Reusable open-access dataset acquisition and checksum validation utility.

Supports downloading legitimately open-access datasets (e.g., Zenodo open records)
with MD5/SHA-256 checksum verification and provenance sidecar generation.
Never bypasses authentication, 401/403 gates, or Data Use Agreements.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ALLOWED_OPEN_HOSTS = ("zenodo.org",)


def compute_checksum(path: Path, algorithm: str = "sha256") -> str:
    digest = hashlib.new(algorithm)
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_zenodo_record(record_id: int, timeout: int = 15) -> dict[str, Any]:
    """Fetch public Zenodo record metadata and verify open access status."""
    url = f"https://zenodo.org/api/records/{int(record_id)}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        payload = json.loads(resp.read().decode("utf-8"))

    metadata = payload.get("metadata", {})
    access_right = metadata.get("access_right")
    license_id = metadata.get("license", {}).get("id")
    if access_right != "open":
        raise PermissionError(
            f"Zenodo record {record_id} is not open-access (access_right={access_right})."
        )

    files = []
    for entry in payload.get("files", []):
        files.append({
            "key": entry.get("key"),
            "size": entry.get("size"),
            "checksum": entry.get("checksum"),
            "download_url": entry.get("links", {}).get("self"),
        })

    return {
        "record_id": int(record_id),
        "title": metadata.get("title"),
        "access_right": access_right,
        "license": license_id,
        "doi": payload.get("doi"),
        "files": files,
    }


def download_zenodo_file(
    record_id: int,
    file_key: str,
    destination: Path,
    *,
    timeout: int = 30,
) -> dict[str, Any]:
    """Download a file from an open-access Zenodo record and verify its checksum."""
    record = verify_zenodo_record(record_id, timeout=timeout)
    match = next((f for f in record["files"] if f["key"] == file_key), None)
    if not match or not match.get("download_url"):
        raise FileNotFoundError(f"File '{file_key}' not found in Zenodo record {record_id}.")

    destination.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(match["download_url"], destination)

    expected_checksum = str(match.get("checksum") or "")
    algo, _, expected_hex = expected_checksum.partition(":")
    if algo and expected_hex:
        actual_hex = compute_checksum(destination, algo)
        if actual_hex.lower() != expected_hex.lower():
            destination.unlink(missing_ok=True)
            raise ValueError(
                f"Checksum mismatch for {destination.name}: expected {expected_hex}, got {actual_hex}"
            )

    sha256_hex = compute_checksum(destination, "sha256")
    provenance = {
        "source": "zenodo",
        "record_id": record["record_id"],
        "title": record["title"],
        "doi": record["doi"],
        "license": record["license"],
        "access_right": record["access_right"],
        "file_key": file_key,
        "local_path": str(destination),
        "size_bytes": destination.stat().st_size,
        "expected_checksum": expected_checksum,
        "sha256": sha256_hex,
        "downloaded_at": datetime.now(timezone.utc).isoformat(),
    }
    sidecar = destination.with_suffix(destination.suffix + ".provenance.json")
    sidecar.write_text(json.dumps(provenance, indent=2), encoding="utf-8")
    return provenance


def main() -> int:
    parser = argparse.ArgumentParser(description="Download open-access Zenodo dataset files.")
    parser.add_argument("--zenodo-id", type=int, required=True)
    parser.add_argument("--file-key", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    result = download_zenodo_file(args.zenodo_id, args.file_key, Path(args.output))
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

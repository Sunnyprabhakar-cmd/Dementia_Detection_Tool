"""Resumable downloads that require explicit approval and source checksums."""

import argparse
import hashlib
import json
import os
import shutil
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import (
    HTTPRedirectHandler,
    Request,
    build_opener,
)


ALLOWED_HOSTS = {
    "download.nrg.wustl.edu",
    "sites.wustl.edu",
    "www.nitrc.org",
    "nitrc.org",
    "talkbank.org",
    "www.talkbank.org",
    "media.talkbank.org",
}
DEFAULT_RAW_DIRECTORY = (
    Path(__file__).resolve().parents[1] / "data" / "raw"
)


class DownloadGateError(ValueError):
    pass


def _validate_url(url: str) -> None:
    parsed = urlparse(url)
    if (
        parsed.scheme != "https"
        or parsed.hostname not in ALLOWED_HOSTS
        or parsed.username
        or parsed.password
    ):
        raise DownloadGateError(
            "Only HTTPS URLs from documented official OASIS/TalkBank/NITRC hosts are allowed."
        )


def load_approved_manifest(path: str | Path) -> dict[str, Any]:
    manifest_path = Path(path).expanduser()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    required = (
        "dataset_name",
        "release",
        "source_url",
        "download_url",
        "access_terms_url",
        "authorization_reference",
        "license_or_agreement",
        "authorization_confirmed",
        "sha256",
        "file_name",
    )
    missing = [key for key in required if not manifest.get(key)]
    if missing:
        raise DownloadGateError(
            "Manifest is missing required approved fields: " + ", ".join(missing)
        )
    if manifest["authorization_confirmed"] is not True:
        raise DownloadGateError(
            "Download blocked: review and accept the official data-use terms first."
        )
    if (
        not isinstance(manifest["sha256"], str)
        or len(manifest["sha256"]) != 64
        or any(char not in "0123456789abcdefABCDEF" for char in manifest["sha256"])
    ):
        raise DownloadGateError(
            "An official or independently verified 64-character SHA-256 is required."
        )
    file_name = manifest["file_name"]
    if (
        not isinstance(file_name, str)
        or Path(file_name).name != file_name
        or file_name in {"", ".", ".."}
    ):
        raise DownloadGateError("file_name must be a simple filename.")
    _validate_url(manifest["source_url"])
    _validate_url(manifest["download_url"])
    _validate_url(manifest["access_terms_url"])
    size = manifest.get("expected_size_bytes")
    if size is not None and (
        isinstance(size, bool) or not isinstance(size, int) or size <= 0
    ):
        raise DownloadGateError("expected_size_bytes must be a positive integer.")
    return manifest


class OfficialHostRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        _validate_url(new_url)
        return super().redirect_request(request, fp, code, message, headers, new_url)


def _hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _fetch_size(url: str, opener, timeout: int) -> int:
    request = Request(url, method="HEAD", headers={"User-Agent": "MindScan-Research/1"})
    with opener.open(request, timeout=timeout) as response:
        final_url = response.geturl()
        _validate_url(final_url)
        content_length = response.headers.get("Content-Length")
        if not content_length or not content_length.isdigit():
            raise DownloadGateError(
                "The official server did not provide a file size; add an independently verified expected_size_bytes to the manifest."
            )
        size = int(content_length)
        if size <= 0:
            raise DownloadGateError("The official server reported an invalid file size.")
        return size


def download_file(
    manifest: dict[str, Any],
    destination_root: str | Path = DEFAULT_RAW_DIRECTORY,
    *,
    timeout: int = 30,
    retries: int = 3,
    opener=None,
) -> dict[str, Any]:
    _validate_url(manifest["download_url"])
    destination_root = Path(destination_root).expanduser()
    destination_root.mkdir(parents=True, exist_ok=True)
    destination = destination_root / manifest["file_name"]
    partial = destination.with_name(destination.name + ".part")
    if destination.exists():
        raise DownloadGateError(f"Refusing to overwrite existing file: {destination}")

    opener = opener or build_opener(OfficialHostRedirectHandler())
    expected_size = manifest.get("expected_size_bytes")
    if expected_size is None:
        try:
            expected_size = _fetch_size(manifest["download_url"], opener, timeout)
        except HTTPError as error:
            if error.code in {401, 403}:
                raise DownloadGateError(
                    "The official source requires access approval/authentication. "
                    "Stop here; complete its official manual access process."
                ) from None
            raise DownloadGateError(
                f"Official source returned HTTP {error.code} while checking file size."
            ) from None
        except URLError:
            raise DownloadGateError(
                "Network error while checking official file size."
            ) from None

    existing_size = partial.stat().st_size if partial.exists() else 0
    if existing_size > expected_size:
        partial.unlink()
        existing_size = 0

    free_space = shutil.disk_usage(destination_root).free
    remaining_size = expected_size - existing_size
    if free_space < remaining_size:
        raise DownloadGateError(
            f"Insufficient disk space: {remaining_size} bytes are required, "
            f"{free_space} bytes are available."
        )

    for attempt in range(retries + 1):
        request = Request(
            manifest["download_url"],
            headers={
                "User-Agent": "MindScan-Research/1",
                **(
                    {"Range": f"bytes={existing_size}-"}
                    if existing_size
                    else {}
                ),
            },
        )
        try:
            with opener.open(request, timeout=timeout) as response:
                final_url = response.geturl()
                _validate_url(final_url)
                status = getattr(response, "status", response.getcode())
                if (existing_size and status not in {200, 206}) or (
                    not existing_size and status != 200
                ):
                    raise DownloadGateError(
                        f"Official source returned unexpected HTTP status {status}."
                    )
                append = existing_size > 0 and status == 206
                if existing_size and status != 206:
                    existing_size = 0
                mode = "ab" if append else "wb"
                with partial.open(mode) as output:
                    shutil.copyfileobj(response, output, length=1024 * 1024)

            actual_size = partial.stat().st_size
            if actual_size != expected_size:
                if actual_size < expected_size and attempt < retries:
                    existing_size = actual_size
                    continue
                if actual_size > expected_size:
                    partial.unlink()
                raise DownloadGateError(
                    f"Downloaded size mismatch: expected {expected_size}, got {actual_size}."
                )
            digest = _hash_file(partial)
            if digest.lower() != manifest["sha256"].lower():
                partial.unlink()
                raise DownloadGateError("Downloaded file checksum does not match the approved manifest.")

            os.replace(partial, destination)
            provenance = {
                "dataset_name": manifest["dataset_name"],
                "release": manifest["release"],
                "source_url": manifest["source_url"],
                "download_url": manifest["download_url"],
                "access_terms_url": manifest["access_terms_url"],
                "authorization_reference": manifest["authorization_reference"],
                "license_or_agreement": manifest["license_or_agreement"],
                "authorization_confirmed": True,
                "access_date_utc": datetime.now(timezone.utc).date().isoformat(),
                "file_name": destination.name,
                "file_size_bytes": actual_size,
                "sha256": digest,
            }
            sidecar = destination.with_name(destination.name + ".provenance.json")
            sidecar.write_text(
                json.dumps(provenance, indent=2),
                encoding="utf-8",
            )
            return {
                "status": "success",
                "file_name": destination.name,
                "file_size_bytes": actual_size,
                "sha256": digest,
            }
        except HTTPError as error:
            if error.code in {401, 403}:
                raise DownloadGateError(
                    "The official source requires access approval/authentication. "
                    "Stop here; complete its official manual access process."
                ) from None
            if attempt == retries:
                raise DownloadGateError(
                    f"Official source returned HTTP {error.code}; partial download retained for retry."
                ) from None
        except (URLError, TimeoutError, OSError):
            if attempt == retries:
                raise DownloadGateError(
                    "Network or filesystem error; partial download retained for retry."
                ) from None
            existing_size = partial.stat().st_size if partial.exists() else 0
            if existing_size >= expected_size:
                partial.unlink()
                existing_size = 0
        time.sleep(min(2**attempt, 8))

    raise DownloadGateError("Download did not complete.")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Download only explicitly authorized files from official data hosts."
    )
    parser.add_argument("--manifest", required=True, help="Reviewed manifest JSON.")
    parser.add_argument(
        "--destination",
        default=str(DEFAULT_RAW_DIRECTORY),
        help="Private raw-data directory (default: Backend/data/raw).",
    )
    parser.add_argument("--dry-run", action="store_true", help="Validate gate and report destination; do not connect.")
    return parser


def main() -> int:
    try:
        args = build_parser().parse_args()
        manifest = load_approved_manifest(args.manifest)
        destination = Path(args.destination).expanduser()
        if args.dry_run:
            print(
                json.dumps(
                    {
                        "status": "dry_run",
                        "dataset": manifest["dataset_name"],
                        "release": manifest["release"],
                        "file_name": manifest["file_name"],
                        "destination": str(destination / manifest["file_name"]),
                        "network_requested": False,
                    }
                )
            )
            return 0
        print(json.dumps(download_file(manifest, destination)))
        return 0
    except (DownloadGateError, OSError, json.JSONDecodeError) as error:
        print(json.dumps({"status": "blocked_or_error", "message": str(error)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

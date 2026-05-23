"""
Cleanup script: xoa cac Case test co prefix [UAT-RUN-] tren prod.
Strategy: PUT status -> TIEP_NHAN -> DELETE.

Usage: python tests/uat-cleanup.py
"""
import os
import sys
import json
import urllib.request
import urllib.error
from pathlib import Path

# Load .env.test
env_file = Path(__file__).parent / ".env.test"
env = {}
for line in env_file.read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    env[k] = v

API = env["API_BASE"]
ADMIN_U = env["ADMIN_USERNAME"]
ADMIN_P = env["ADMIN_PASSWORD"]
TAG = env.get("TEST_TAG_PREFIX", "[UAT-RUN-")


def request(method, path, token=None, body=None):
    url = f"{API}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8"))
        except Exception:
            return e.code, {"error": str(e)}


def login():
    status, body = request("POST", "/auth/login", body={"username": ADMIN_U, "password": ADMIN_P})
    if status != 200 and status != 201:
        sys.exit(f"Login fail {status}: {body}")
    return body["accessToken"]


def list_test_cases(token, limit=100, offset=0):
    """List cases with name starting with TAG via search."""
    cases = []
    while True:
        # Search by full name fragment '[UAT-RUN-' (URL-encoded)
        search = urllib.parse.quote("[UAT-RUN-")
        status, body = request("GET", f"/cases?search={search}&limit={limit}&offset={offset}", token=token)
        if status != 200:
            sys.exit(f"List fail {status}: {body}")
        data = body.get("data", [])
        cases.extend([c for c in data if c.get("name", "").startswith(TAG[:11])])
        total = body.get("total", 0)
        offset += len(data)
        if offset >= total or not data:
            break
    return cases


def reset_and_delete(token, case_id, current_status, current_updated_at):
    """PUT status -> TIEP_NHAN (if not already), then DELETE."""
    # Reset status if needed
    if current_status != "TIEP_NHAN":
        status, body = request(
            "PUT", f"/cases/{case_id}",
            token=token,
            body={
                "status": "TIEP_NHAN",
                "expectedUpdatedAt": current_updated_at,
            },
        )
        if status != 200:
            return False, f"reset_status_fail({status})"
        current_updated_at = body.get("data", {}).get("updatedAt", current_updated_at)
    # Delete
    reason = "[UAT-CLEANUP-20260523] Xoa du lieu test UAT 2026-05-23 — admin auto cleanup"
    status, body = request("DELETE", f"/cases/{case_id}", token=token, body={"reason": reason})
    if status != 200:
        return False, f"delete_fail({status})"
    return True, "ok"


import urllib.parse  # at end, after function defs (used in list_test_cases)

if __name__ == "__main__":
    print("=" * 60)
    print("UAT TEST DATA CLEANUP — PROD 171.244.40.245")
    print("=" * 60)
    token = login()
    print(f"✓ Login OK as {ADMIN_U}")

    cases = list_test_cases(token)
    print(f"✓ Found {len(cases)} test cases with prefix '{TAG[:11]}'")

    if not cases:
        print("Nothing to cleanup.")
        sys.exit(0)

    # Group by current status
    by_status = {}
    for c in cases:
        s = c.get("status", "UNKNOWN")
        by_status[s] = by_status.get(s, 0) + 1
    print("Status distribution:")
    for s, n in by_status.items():
        print(f"  {s}: {n}")
    print()

    success = 0
    fail = 0
    fail_details = []
    for c in cases:
        cid = c["id"]
        cstatus = c.get("status")
        cupdated = c.get("updatedAt")
        ok, msg = reset_and_delete(token, cid, cstatus, cupdated)
        if ok:
            success += 1
        else:
            fail += 1
            fail_details.append(f"{cid[:8]}…|{cstatus}|{msg}")

    print()
    print("=" * 60)
    print(f"RESULT: {success}/{len(cases)} deleted | {fail} failed")
    print("=" * 60)
    if fail_details:
        print("Failed cases:")
        for d in fail_details[:20]:
            print(f"  {d}")

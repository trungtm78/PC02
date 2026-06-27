#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UAT cleanup v2 — dọn data test trên prod 171.244.40.245.

Cover prefixes:
- Cases: name starts with '[UAT-TC-' hoặc '[UAT-RUN-'
- Subjects: fullName starts with 'UAT-TC-'
- Lawyers: fullName starts with 'UAT-TC-'
- Proposals: proposalNumber starts with 'DX-UAT-'
- Delegations: delegationNumber starts with 'UT-UAT-'
- Conclusions: type='TEST_CONCLUSION'
- Supplements: decisionNumber starts with 'GH-UAT-'

Strategy:
1. Login admin
2. Each entity: list → filter → DELETE (sub-resources không cần reset status)
3. Cases: PUT status='TIEP_NHAN' (nếu đã chuyển) → DELETE

Run: PYTHONIOENCODING=utf-8 python tests/uat-cleanup-v2.py
"""
import os
import sys
import json
import time
import urllib.request
import urllib.parse
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

_token_cache = {"v": None, "t": 0}


def request(method, path, token=None, body=None, timeout=30):
    url = f"{API}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8"))
        except Exception:
            return e.code, {"error": str(e)}
    except Exception as e:
        return 0, {"error": str(e)}


def login():
    """Cached login — JWT exp ~15 phút, refresh sau 13'."""
    if _token_cache["v"] and (time.time() - _token_cache["t"] < 780):
        return _token_cache["v"]
    status, body = request("POST", "/auth/login",
                           body={"username": ADMIN_U, "password": ADMIN_P})
    if status not in (200, 201):
        sys.exit(f"Login fail {status}: {body}")
    tok = body["accessToken"]
    _token_cache["v"] = tok
    _token_cache["t"] = time.time()
    return tok


def list_all(path, name_filter=None, limit=100):
    """Paginate qua endpoint, optional filter theo function."""
    items = []
    offset = 0
    while True:
        token = login()
        status, body = request("GET", f"{path}?limit={limit}&offset={offset}", token=token)
        if status != 200:
            print(f"  ⚠ List fail {path}: {status} {str(body)[:120]}")
            break
        data = body.get("data", [])
        if name_filter:
            data = [d for d in data if name_filter(d)]
        items.extend(data)
        total = body.get("total", 0)
        offset += len(body.get("data", [])) or limit
        if offset >= total or not body.get("data"):
            break
    return items


def cleanup_cases():
    print("\n=== Cleanup Cases ===")
    token = login()
    # Search '[UAT-' bằng search query
    cases = []
    for prefix in ['[UAT-TC-', '[UAT-RUN-', '[UAT-RUN]', '[UAT-']:
        offset = 0
        while True:
            q = urllib.parse.quote(prefix)
            status, body = request("GET", f"/cases?search={q}&limit=100&offset={offset}", token=token)
            if status != 200:
                print(f"  ⚠ Search '{prefix}' fail: {status}")
                break
            data = body.get("data", [])
            cases.extend([c for c in data if c.get("name", "").startswith(prefix)])
            total = body.get("total", 0)
            offset += len(data) or 100
            if offset >= total or not data:
                break
    # Dedupe
    seen = set()
    cases = [c for c in cases if c["id"] not in seen and not seen.add(c["id"])]
    print(f"  Found {len(cases)} test Cases")
    if not cases:
        return 0, 0

    success = fail = 0
    for c in cases:
        cid = c["id"]
        cstatus = c.get("status")
        cupdated = c.get("updatedAt")
        # Reset status về TIEP_NHAN nếu cần
        if cstatus != "TIEP_NHAN":
            token = login()
            status, body = request("PUT", f"/cases/{cid}", token=token,
                                   body={"status": "TIEP_NHAN", "expectedUpdatedAt": cupdated})
            if status != 200:
                fail += 1
                continue
            cupdated = body.get("data", {}).get("updatedAt", cupdated)
        # Delete
        token = login()
        status, body = request("DELETE", f"/cases/{cid}", token=token,
                               body={"reason": "[UAT-CLEANUP-v2] Dọn dữ liệu test UAT comprehensive 781 TC ngày 2026-05-23"})
        if status == 200:
            success += 1
        else:
            fail += 1
            if fail <= 5:
                print(f"  ✗ {cid[:8]} {cstatus} | {status} {str(body)[:100]}")
    print(f"  ✓ {success} deleted | {fail} failed")
    return success, fail


def cleanup_sub_resource(name, path, filter_fn):
    """Generic cleanup cho sub-resource (Subjects/Lawyers/Proposals/...)."""
    print(f"\n=== Cleanup {name} ===")
    items = list_all(path, name_filter=filter_fn)
    print(f"  Found {len(items)} test {name}")
    if not items:
        return 0, 0
    success = fail = 0
    for item in items:
        iid = item["id"]
        token = login()
        status, body = request("DELETE", f"{path}/{iid}", token=token)
        if status in (200, 204):
            success += 1
        else:
            fail += 1
            if fail <= 5:
                print(f"  ✗ {iid[:8]} | {status} {str(body)[:100]}")
    print(f"  ✓ {success} deleted | {fail} failed")
    return success, fail


def main():
    print("=" * 70)
    print("UAT v2 CLEANUP — PROD 171.244.40.245")
    print("=" * 70)
    print(f"Admin: {ADMIN_U}")
    login()
    print("✓ Login OK")

    total_success = total_fail = 0

    # Sub-resources TRƯỚC (vì Case bị block delete nếu có sub-resource)
    s, f = cleanup_sub_resource("Subjects", "/subjects",
                                 lambda d: (d.get("fullName") or "").startswith("UAT-TC-"))
    total_success += s; total_fail += f

    s, f = cleanup_sub_resource("Lawyers", "/lawyers",
                                 lambda d: (d.get("fullName") or "").startswith("UAT-TC-"))
    total_success += s; total_fail += f

    s, f = cleanup_sub_resource("Conclusions", "/conclusions",
                                 lambda d: d.get("type") == "TEST_CONCLUSION")
    total_success += s; total_fail += f

    s, f = cleanup_sub_resource("Proposals", "/proposals",
                                 lambda d: (d.get("proposalNumber") or "").startswith("DX-UAT-"))
    total_success += s; total_fail += f

    s, f = cleanup_sub_resource("Delegations", "/delegations",
                                 lambda d: (d.get("delegationNumber") or "").startswith("UT-UAT-"))
    total_success += s; total_fail += f

    s, f = cleanup_sub_resource("Supplements", "/investigation-supplements",
                                 lambda d: (d.get("decisionNumber") or "").startswith("GH-UAT-"))
    total_success += s; total_fail += f

    # Cases CUỐI CÙNG
    s, f = cleanup_cases()
    total_success += s; total_fail += f

    print()
    print("=" * 70)
    print(f"TOTAL: {total_success} deleted | {total_fail} failed")
    print("=" * 70)
    if total_fail > 0:
        print("\nNote: Cases failed delete có thể do:")
        print("  - Status không phải TIEP_NHAN sau reset (concurrency)")
        print("  - Vẫn còn sub-resource link (chưa delete hết)")
        print("  - Quá 72h window (cần ADMIN bypass — vẫn pass vì login admin)")
        print("  - Audit trail compliance (BLTTHS) block delete")


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""Đo M2 = Σ V(G) của các tệp logic MỚI của đợt này bằng lizard, rồi chạy `_build.py` với số đo ấy.

    python docs/uat/dot-1411/_measure_m2.py

Số M2 trong Ledger là số đo, không phải số ước: đổi danh sách tệp thì chạy lại.
"""
import csv, io, os, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
FILES = [
    # Quyền theo tổ
    'backend/src/authz/engine/compile.ts', 'backend/src/authz/engine/scope.ts', 'backend/src/authz/engine/validate.ts',
    'backend/src/authz/authz.service.ts', 'backend/src/authz/authz-scope.service.ts', 'backend/src/authz/enforcement.ts',
    'backend/src/authz/record-readers.ts', 'backend/src/authz/admin/documents.ts', 'backend/src/authz/admin/authz-admin.service.ts',
    'backend/src/authz/admin/authz-mode.service.ts', 'backend/src/authz/admin/starter-templates.ts',
    'backend/src/common/utils/precise-scope.ts',
    # Vòng đời tổ
    'backend/src/teams/team-lifecycle.service.ts', 'backend/src/teams/team-merge.service.ts',
    # Tiêu chí báo cáo theo tổ
    'backend/src/dynamic-reports/config/criteria-matrix.ts', 'backend/src/dynamic-reports/config/criteria-matrix.service.ts',
    'backend/src/dynamic-reports/config/target-subsets.ts',
]
missing = [f for f in FILES if not os.path.exists(os.path.join(ROOT, f))]
if missing:
    sys.exit('Thiếu tệp: %s' % ', '.join(missing))
out = subprocess.run([sys.executable, '-m', 'lizard', '--csv'] + FILES, cwd=ROOT, capture_output=True, text=True, encoding='utf-8').stdout
per = {}
for row in csv.reader(io.StringIO(out)):
    if len(row) > 6:
        try:
            per[row[6]] = per.get(row[6], 0) + int(row[1])
        except ValueError:
            pass
if not per:
    sys.exit('lizard không trả số nào: KHÔNG ĐO ĐƯỢC, không lấy số thay thế.')
total = sum(per.values())
name = lambda p: p.replace(chr(92), '/').split('/')[-1]
listing = 'Đo bằng `lizard %s` ngày 14/11/2026, tổng **%d**: ' % (
    subprocess.run([sys.executable, '-m', 'lizard', '--version'], capture_output=True, text=True).stdout.strip(), total,
) + ' · '.join('`%s` %d' % (name(k), v) for k, v in sorted(per.items(), key=lambda kv: -kv[1])) + '.'
env = dict(os.environ, UAT_M2=str(total), UAT_M2_FILES=listing, PYTHONUTF8='1')
print('M2 =', total)
sys.exit(subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), '_build.py')], env=env).returncode)

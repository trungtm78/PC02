from pathlib import Path
r=Path(__file__).resolve().parents[2];p=r/'backend/src/audit/audit.controller.spec.ts';s=p.read_text(encoding='utf-8-sig')
pos=s.index('const mockService =')
s=s[:pos]+"const actorRequest={user:{id:'audit-reader'},ip:'127.0.0.1',headers:{}} as never;\n"+s[pos:]
s=s.replace('''      offset: 0,
    });''','''      offset: 0,
    },actorRequest);''')
s=s.replace('controller.findAll({});','controller.findAll({},actorRequest);')
s=s.replace("controller.findAll({ tk: ['nguoiThucHien~an'] });","controller.findAll({ tk: ['nguoiThucHien~an'] },actorRequest);")
s=s.replace("const req = { user: { sub: 'u1' },","const req = { user: { id: 'audit-reader' },")
s=s.replace('controller.actions();','controller.actions(actorRequest);').replace('controller.subjects();','controller.subjects(actorRequest);')
# Strengthened delegation ensures authenticated identity accompanies every list/export call.
s=s.replace('''      }),
    );''','''      }),
      'audit-reader',
    );''')
s=s.replace("expect.objectContaining({ tk: ['nguoiThucHien~an'] }),\n    );","expect.objectContaining({ tk: ['nguoiThucHien~an'] }),\n      'audit-reader',\n    );")
p.write_text(s,encoding='utf-8')

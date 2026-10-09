from pathlib import Path
from xml.sax.saxutils import escape
import json,textwrap,html
ROOT=Path('/workspace/scratch/c1f736b20146');OUT=ROOT/'deliverables';AS=OUT/'mockups';AS.mkdir(exist_ok=True)
screens=[];els=[]
C={'navy':'#083C70','blue':'#1468B3','ink':'#1B2D40','muted':'#63758A','line':'#D8E2EC','bg':'#F3F6FA','green':'#127453','amber':'#926000','red':'#B32E36'}
def rect(x,y,w,h,fill='white',stroke=None,r=8):
 els.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}"'+(f' stroke="{stroke}"' if stroke else '')+'/>')
def txt(x,y,s,size=15,color=None,bold=False):
 els.append(f'<text x="{x}" y="{y}" font-family="Arial,DejaVu Sans,sans-serif" font-size="{size}" fill="{color or C["ink"]}" font-weight="{700 if bold else 400}">{escape(str(s))}</text>')
def lines(x,y,s,width=70,size=15,color=None):
 for i,l in enumerate(textwrap.wrap(s,width=width)):txt(x,y+i*(size+7),l,size,color)
def btn(x,y,label,w=140,primary=False):
 rect(x,y,w,38,C['blue'] if primary else 'white',C['blue'] if primary else C['line'],6);txt(x+14,y+25,label,14,'white' if primary else C['ink'],True)
def pill(x,y,label,color='blue',w=None):
 w=w or len(label)*7.6+22;fill={'green':'#E5F5ED','red':'#FCECED','amber':'#FFF3D8','blue':'#EAF2FC','muted':'#EDF1F5'}[color];rect(x,y,w,27,fill,r=13);txt(x+11,y+19,label,12,C.get(color,C['muted']),True)
def field(x,y,label,value,w=300,helper=None):
 txt(x,y,label,13,C['muted'],True);rect(x,y+12,w,44,'white',C['line'],6);txt(x+12,y+40,value,15)
 if helper:txt(x,y+78,helper,12,C['muted'])
def banner(y,s,kind='blue'):
 fill={'blue':'#EAF2FC','amber':'#FFF4DC','red':'#FCECEE','green':'#E8F5EF'}[kind];rect(244,y,1168,48,fill,r=6);txt(260,y+30,s,14,C.get(kind),True)
def table(x,y,width,headers,rows,colweights=None,rowh=55):
 ws=colweights or [1]*len(headers);ws=[width*w/sum(ws) for w in ws];rect(x,y,width,42,'#EAF0F6',r=0)
 cx=x
 for h,w in zip(headers,ws):txt(cx+12,y+27,h,13,C['muted'],True);cx+=w
 for n,row in enumerate(rows):
  yy=y+42+n*rowh;rect(x,yy,width,rowh,'white' if n%2==0 else '#F8FAFC',C['line'],0);cx=x
  for j,(val,w) in enumerate(zip(row,ws)):
   for k,l in enumerate(textwrap.wrap(str(val),max(6,int((w-24)/7.5)))[:2]):txt(cx+12,yy+22+k*19,l,13)
   cx+=w
 return y+42+len(rows)*rowh
def shell(id,title,sub,active='Nhập và tổng hợp'):
 global els;els=[]
 rect(0,0,1440,960,C['bg'],r=0);rect(0,0,1440,64,'white',r=0);rect(0,64,216,896,C['navy'],r=0)
 rect(20,15,34,34,'#B68A1F',r=6);txt(27,39,'PC',15,'white',True);txt(68,30,'HỆ THỐNG PC02',17,C['navy'],True);txt(68,48,'Quản lý báo cáo',12,C['muted'])
 txt(1150,28,'Tài khoản minh họa',14,bold=True);txt(1150,48,'Báo cáo động',12,C['muted'])
 txt(22,108,'TÌM KIẾM MENU',11,'#ABC6DF');txt(22,157,'Tổng quan',15,'white');txt(22,202,'Nghiệp vụ chính',15,'white');txt(22,264,'BÁO CÁO VÀ THỐNG KÊ',11,'#F4CF76',True)
 for i,label in enumerate(['Thiết lập báo cáo','Nhập và tổng hợp','Tình trạng nhập liệu']):
  yy=287+i*52
  if label==active:rect(10,yy,196,43,'#155C98',r=6)
  txt(24,yy+28,label,14,'white',label==active)
 txt(24,487,'Báo cáo tháng',14,'#C8DBEA');txt(24,532,'Báo cáo quý',14,'#C8DBEA');txt(24,577,'Hệ thống',14,'#C8DBEA');txt(24,622,'Quản trị',14,'#C8DBEA')
 txt(20,917,'Mockup đề xuất v1.0',12,'#C8DBEA');txt(20,940,'Dữ liệu minh họa',11,'#C8DBEA')
 txt(244,96,'BÁO CÁO ĐỘNG  /  '+id,11,C['muted'],True);txt(244,139,title,28,bold=True);txt(244,166,sub,14,C['muted'])
def steps(current):
 labels=['Thông tin và mẫu','Kiểm tra ô nhập','Kỳ và hạn nhập','Phân công và xác nhận']
 for i,s in enumerate(labels):
  x=244+i*296;rect(x,195,282,50,'#EAF2FC' if i+1==current else 'white',C['blue'] if i+1==current else C['line']);txt(x+14,226,f'{i+1}. {s}',14,C['blue'] if i+1==current else C['muted'],True)
def footer(left='Lưu nháp',right='Tiếp theo'):
 rect(244,879,1168,62,'white',C['line']);btn(260,891,'Quay lại',105);txt(385,916,'Thay đổi chỉ áp dụng sau khi xuất bản',12,C['muted']);btn(1092,891,left,138);btn(1245,891,right,150,True)
def save(id,title,desc,role,events):
 svg='<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="960" viewBox="0 0 1440 960"><title>'+escape(id+' '+title)+'</title>'+''.join(els)+'</svg>'
 (AS/(id+'.svg')).write_text(svg)
 screens.append({'id':id,'title':title,'description':desc,'role':role,'events':events,'svg':svg})
def report_filters(y=217,manager=False):
 field(260,y,'Báo cáo','Báo cáo hoạt động tuần',410);field(694,y,'Kỳ báo cáo','Tuần 41 · 05–11/10/2026',350)
 if manager:field(1068,y,'Người nhập','Tất cả người được giao',325)
 else:pill(1085,y+17,'Báo cáo tôi nhập','blue',250)
def grid(y=360,mode='input',error=False):
 rect(244,y,1168,430,'white',C['line']);rect(244,y,1168,39,'#EDF2F8',r=0);txt(260,y+25,'BÁO CÁO HOẠT ĐỘNG TUẦN 41',16,bold=True);txt(1120,y+25,'Mẫu v1 · Sheet Tổng hợp',12,C['muted'])
 rows=[['01','Tiếp nhận mới','125' if mode!='aggregate' else '1.280','NUM · SUM'],['02','Đã xử lý','96' if mode!='aggregate' else '1.024','NUM · SUM'],['03','Tỷ lệ xử lý','76,80%' if mode!='aggregate' else '80,00%','fx · chỉ đọc'],['04','Ngày lập','09/10/2026' if mode!='aggregate' else 'Không tổng hợp','DATE'],['05','Ghi chú','Không phát sinh bổ sung' if mode!='aggregate' else 'Không tổng hợp','TEXT']]
 table(260,y+60,1136,['STT','Chỉ tiêu','Giá trị','Kiểu ô'],rows,[.5,3,2,1.5],rowh=51)
 if mode in ['input','reopened']:
  for row in [0,1,3,4]:rect(828,y+107+row*51,3,34,C['blue'],r=0)
 if error:
  rect(828,y+107,323,36,'#FFF1F2',C['red'],4);txt(841,y+130,'125abc',14,C['red']);txt(260,y+392,'B5: Chỉ nhập số. Giá trị này chưa được lưu.',13,C['red'],True)
 else:txt(260,y+392,'Ô nhập có viền xanh  ·  fx là ô công thức  ·  Ô tĩnh không thể sửa',12,C['muted'])
 btn(260,y+438,'Tổng hợp',135,True);btn(405,y+438,'Diễn giải',125);txt(1130,y+461,'Zoom 100%  ·  Toàn màn hình',12,C['muted'])

shell('S01','Thiết lập báo cáo','Quản lý mẫu Excel, lịch báo cáo và người được phân công.','Thiết lập báo cáo')
btn(1222,115,'Tạo báo cáo',190,True);field(260,226,'Tìm kiếm','Tên hoặc mã báo cáo',425);field(710,226,'Loại kỳ','Tất cả',280);field(1015,226,'Trạng thái','Tất cả',375)
table(244,328,1168,['Mã / Tên báo cáo','Kỳ','Hạn tiếp theo','Quản lý','Người nhập','Trạng thái'],[['BC-01 · Hoạt động tuần','Tuần','09/10 · 17:00','Quản lý A','12','Đã xuất bản'],['BC-02 · Tổng hợp tháng','Tháng','31/10 · 17:00','Quản lý B','24','Đã xuất bản'],['BC-03 · Chuyên đề quý','Quý','25/12 · 17:00','Quản lý A','8','Bản nháp']],[3,1,1.6,1.5,1,1.5],64)
txt(260,620,'Chọn một báo cáo để xem cấu hình, tạo phiên bản mới hoặc ngừng phát sinh kỳ.',14,C['muted'])
save('S01','Danh sách thiết lập','Lọc, tạo mới, xem và quản lý vòng đời báo cáo.','Người thiết lập',{'Tạo báo cáo':'S02','Xem phiên bản':'S22'})

shell('S02','Tạo báo cáo','Bước 1 · Thông tin chung và file mẫu Excel.','Thiết lập báo cáo');steps(1)
field(260,298,'Mã báo cáo *','BC-TUAN-01',330);field(614,298,'Tên báo cáo *','Báo cáo hoạt động tuần',776)
field(260,396,'Mô tả','Báo cáo hoạt động của cán bộ theo từng tuần',1130)
rect(260,492,1130,197,'#F8FBFF',C['blue']);txt(595,543,'Kéo thả file Excel vào đây',22,C['navy'],True);txt(534,575,'Định dạng .xlsx · Tối đa 10 MB theo cấu hình đề xuất',14,C['muted']);btn(688,607,'Chọn file',160,True)
txt(260,735,'Hướng dẫn: khóa ô tĩnh, mở khóa ô nhập và đặt token như {NUM|#,##0|SUM}.',15)
txt(260,771,'Tải file mẫu hướng dẫn   ·   Xem quy ước TEXT NUM DATE TIME',14,C['blue'],True);footer()
save('S02','Upload mẫu Excel','Kiểm tra loại file và parse trước khi sang bước tiếp theo; upload không tự xuất bản.','Người thiết lập',{'Chọn file hợp lệ':'S03','File lỗi':'S04'})

shell('S03','Kiểm tra ô nhập','Bước 2 · Đối soát ô nhập, ô tĩnh và công thức trước khi xuất bản.','Thiết lập báo cáo');steps(2)
pill(260,268,'18 ô nhập','blue');pill(405,268,'3 công thức','muted');pill(568,268,'0 lỗi','green');pill(688,268,'1 cảnh báo','amber')
table(260,322,755,['Ô','Nhãn','Token','Kết quả'],[['A2','Tổng tiếp nhận','{NUM|#,##0|SUM}','Hợp lệ'],['A5','Ghi chú','{TEXT}','Hợp lệ'],['AK12','Ngày lập','{DATE|dd/mm/yyyy}','Hợp lệ'],['C8','Tỷ lệ','=B7/B6','Chỉ đọc']],[.8,1.4,2.3,1.1],64)
rect(1040,322,350,455,'white',C['line']);txt(1060,355,'THUỘC TÍNH Ô A2',15,bold=True);field(1060,392,'Tên hiển thị','Tổng tiếp nhận',308);field(1060,480,'Kiểu / Tổng hợp','NUM / SUM',308);field(1060,568,'Số chữ số thập phân','0',308);txt(1060,661,'☑ Bắt buộc nhập',15);txt(1060,701,'Giá trị nhỏ nhất: 0',14,C['muted'])
txt(260,698,'Sheet: Tổng hợp  |  Diễn giải',14,C['blue'],True);txt(260,738,'Click ô trong preview để đối chiếu đúng vị trí Excel.',14,C['muted']);footer()
save('S03','Preview và thuộc tính ô','Đối soát schema theo Sheet!Cell; sửa thuộc tính nháp và xem cảnh báo.','Người thiết lập',{'Có lỗi import':'S04','Tiếp theo':'S05'})

shell('S04','Mẫu Excel cần điều chỉnh','Chưa thể xuất bản. Chọn từng lỗi để xác định vị trí trong mẫu.','Thiết lập báo cáo');steps(2);banner(268,'Có 3 lỗi cần sửa và 1 cảnh báo. Dữ liệu mẫu chưa được phát hành.','red')
table(260,347,1130,['Mức độ','Vị trí','Nội dung','Cách xử lý'],[['Lỗi','Tổng hợp!A2','Token nằm trong ô Locked','Mở khóa ô A2 trong Excel'],['Lỗi','Tổng hợp!AK12','Ngày dùng SUM không hợp lệ','Bỏ SUM khỏi token DATE'],['Lỗi','Diễn giải!B7','Ô nhập nằm ở hàng ẩn','Hiện hàng hoặc loại khỏi vùng nhập'],['Cảnh báo','Tổng hợp!C5','AGV đã chuẩn hóa thành AVG','Dùng AVG trong mẫu để thống nhất']],[1,1.7,2.7,2.7],75)
btn(260,732,'Tải lại file đã sửa',200,True);txt(488,756,'Mọi lỗi phải được xử lý trước khi xuất bản.',14,C['muted']);footer('Lưu nháp','Kiểm tra lại')
save('S04','Lỗi import và validation mẫu','Danh sách lỗi có vị trí nguyên nhân và cách sửa; không âm thầm bỏ qua ô lỗi.','Người thiết lập',{'Tải lại':'S02','Mẫu hợp lệ':'S03'})

for id,typ,selected,desc in [('S05','Tuần','Thứ Sáu','Hằng tuần, thứ Sáu lúc 17:00'),('S06','Tháng','Ngày 31','Hằng tháng, ngày 31 hoặc ngày cuối tháng lúc 17:00'),('S07','Quý','Tháng thứ 3 · Ngày 25','Hằng quý, ngày 25 của tháng thứ 3 lúc 17:00'),('S08','Ngày cụ thể','20/10/2026','Một kỳ duy nhất, khóa ngày 20/10/2026 lúc 17:00')]:
 shell(id,'Kỳ báo cáo và hạn nhập','Bước 3 · Xem trước ngày giờ khóa thực tế theo lịch đã chọn.','Thiết lập báo cáo');steps(3)
 for j,t in enumerate(['Tuần','Tháng','Quý','Ngày cụ thể']):btn(260+j*220,284,t,200,t==typ)
 field(260,373,'Ngày khóa *',selected,450);field(742,373,'Giờ khóa *','17:00',250);field(1020,373,'Múi giờ','Việt Nam · UTC+7',370)
 field(260,478,'Hạn thuộc kỳ','Kỳ hiện tại' if typ!='Ngày cụ thể' else 'Một lần',450);field(742,478,'Mở nhập từ','Đầu kỳ báo cáo',648)
 rect(260,581,1130,68,'#EAF2FC');txt(278,622,desc,17,C['navy'],True)
 if typ=='Tuần':preview=[['41/2026','05–11/10/2026','09/10/2026 · 17:00'],['42/2026','12–18/10/2026','16/10/2026 · 17:00']]
 elif typ=='Tháng':preview=[['10/2026','01–31/10/2026','31/10/2026 · 17:00'],['02/2027','01–28/02/2027','28/02/2027 · 17:00 · Cuối tháng']]
 elif typ=='Quý':preview=[['Quý IV/2026','01/10–31/12/2026','25/12/2026 · 17:00'],['Quý I/2027','01/01–31/03/2027','25/03/2027 · 17:00']]
 else:preview=[['Chuyên đề 20/10','01–20/10/2026','20/10/2026 · 17:00']]
 table(260,679,1130,['Kỳ dữ liệu','Khoảng thời gian','Khóa nhập lúc'],preview,[1.4,2,3],49);footer()
 save(id,'Cấu hình kỳ '+typ.lower(),'Bản sản phẩm hiển thị tối thiểu 6 kỳ kế tiếp; mẫu ngắn thể hiện ngày biên. Ngày cụ thể là một lần.','Người thiết lập',{'Đổi kiểu kỳ':'S05–S08','Tiếp theo':'S09'})

shell('S09','Phân công báo cáo','Bước 4 · Chọn người quản lý và những người phải nhập.','Thiết lập báo cáo');steps(4)
field(260,299,'Người quản lý *','Quản lý A · Đơn vị A',1130);field(260,400,'Tìm người nhập','Tìm tên, mã cán bộ hoặc đơn vị',735);field(1020,400,'Đơn vị','Tất cả',370)
table(260,492,1130,['Chọn','Người nhập','Mã cán bộ','Đơn vị','Tình trạng'],[['☑','Cán bộ A','CB-DEMO-01','Đơn vị A','Đang hoạt động'],['☑','Cán bộ B','CB-DEMO-02','Đơn vị A','Đang hoạt động'],['☑','Cán bộ C','CB-DEMO-03','Đơn vị B','Đang hoạt động'],['—','Cán bộ D','CB-DEMO-04','Đơn vị B','Ngừng hoạt động']],[.6,2,1.5,1.5,1.8],51)
txt(260,785,'Đã chọn 12 người nhập · 1 người quản lý. Người ngừng hoạt động không được gán mới.',14,C['blue'],True);footer('Lưu nháp','Xem xác nhận')
save('S09','Phân công quản lý và người nhập','Multi-select có tìm kiếm, đơn vị và loại trùng. Một người quản lý theo đề xuất.','Người thiết lập',{'Xem xác nhận':'S10'})

shell('S10','Xác nhận xuất bản','Kiểm tra cấu hình cuối cùng trước khi tạo nghĩa vụ nhập báo cáo.','Thiết lập báo cáo');steps(4)
table(260,283,1130,['Nội dung','Cấu hình'],[['Báo cáo','BC-TUAN-01 · Báo cáo hoạt động tuần'],['Mẫu Excel','bao_cao_tuan.xlsx · v1 · 18 ô nhập · 3 ô công thức'],['Lịch','Hằng tuần, thứ Sáu 17:00 · UTC+7'],['Người quản lý','Quản lý A'],['Người nhập','12 người · 2 đơn vị'],['Áp dụng từ','Tuần 42/2026 · Bắt đầu 12/10/2026'],['Kỳ đã phát sinh','Không thay đổi các kỳ trước ngày hiệu lực']],[1.2,4],64)
banner(817,'Sau xuất bản, phiên bản mẫu được cố định cho mỗi kỳ. Chỉnh sửa tiếp theo tạo phiên bản mới.','blue');footer('Lưu nháp','Xuất bản')
save('S10','Xác nhận xuất bản','Có ngày hiệu lực rõ; publish không tự tạo kỳ quá khứ.','Người thiết lập',{'Xuất bản thành công':'S01'})

for id,title,mode,msg,kind in [('S11','Nhập báo cáo','input','Còn 2 giờ 15 phút · Hạn nhập 09/10/2026 lúc 17:00','blue'),('S12','Kiểm tra dữ liệu nhập','input','Có 2 ô cần sửa. Các giá trị chưa hợp lệ chưa được lưu.','red'),('S13','Báo cáo đã khóa','readonly','Đã khóa lúc 17:00 ngày 09/10/2026. Liên hệ quản lý nếu cần nhập lại.','red'),('S14','Báo cáo được mở lại','reopened','Được nhập lại đến 10/10/2026 lúc 02:30 · Hạn gốc vẫn là 09/10 lúc 17:00','amber')]:
 shell(id,title,'Nhập theo mẫu Excel. Ô tĩnh và ô công thức luôn chỉ đọc.');report_filters();banner(295,msg,kind);grid(360,mode,id=='S12')
 rect(244,882,1168,62,'white',C['line']);txt(261,920,'Đã lưu lúc 14:45 · 16/18 ô bắt buộc hợp lệ' if id!='S12' else 'Chưa lưu: B5 sai kiểu số, AK12 sai ngày',14,C['red'] if id=='S12' else C['green'])
 if id=='S13':pill(1140,898,'Chỉ xem','muted',200)
 else:btn(980,894,'Lưu nháp',120);btn(1112,894,'Kiểm tra',108);btn(1232,894,'Hoàn thành',162,True)
 save(id,title,'Điều hướng bằng Tab; date/time có picker. '+msg,'Người nhập',{'Kiểm tra':'S12','Đến hạn':'S13','Được mở lại':'S14','Lỗi lưu':'S26'})

shell('S15','Tổng hợp báo cáo','Chế độ quản lý · Số liệu chỉ đọc, có thể xem nguồn đóng góp.');report_filters(manager=True);banner(295,'Tạm tính từ tất cả dữ liệu đã lưu · 8/12 người hoàn thành · 10/12 người có dữ liệu','amber');grid(360,'aggregate')
rect(244,882,1168,62,'white',C['line']);txt(261,919,'Cập nhật lúc 14:45 · Tập nguồn revision đã xác định',14,C['muted']);btn(1070,894,'Nguồn số liệu',160);btn(1242,894,'Xuất Excel',152,True)
save('S15','Tổng hợp của người quản lý','Mặc định tổng hợp all_saved có nhãn tạm tính; không có nút sửa/lưu.','Người quản lý',{'Chọn người':'S16','Nguồn số liệu':'S18','Xuất Excel':'S25'})

shell('S16','Xem báo cáo cá nhân','Chế độ quản lý · Chỉ xem dữ liệu của người được phân công.');report_filters(manager=True)
rect(1068,229,325,44,'white',C['line']);txt(1080,258,'Cán bộ A · Đơn vị A',15);banner(295,'Cán bộ A · Đang nhập · Hạn gốc 09/10/2026 17:00 · 16/18 ô đã hợp lệ','blue');grid(360,'readonly')
rect(244,882,1168,62,'white',C['line']);txt(261,919,'Bạn đang quản lý. Không thể sửa dữ liệu thay người nhập.',14,C['muted']);btn(1050,894,'Lịch sử',130);btn(1195,894,'Mở lại quyền nhập',199,True)
save('S16','Xem cá nhân chỉ đọc','Có chuyển mode nếu đồng thời là người nhập; chỉ mode nhập cho sửa bản của mình.','Người quản lý',{'Mở lại':'S17','Lịch sử':'S21','Chế độ nhập':'S11'})

shell('S17','Mở lại quyền nhập','Áp dụng cho một người, một báo cáo và một kỳ.');report_filters(manager=True)
rect(216,184,1224,776,'#DDE5ED',r=0);rect(438,232,790,652,'white',C['line'],12);txt(470,282,'Mở lại quyền nhập',25,bold=True);txt(470,319,'Báo cáo hoạt động tuần · Tuần 41/2026',16);pill(470,341,'Cán bộ A · Đơn vị A','blue',325)
field(470,421,'Ngày khóa lại *','10/10/2026',345);field(839,421,'Giờ khóa lại *','02:30',345);txt(470,508,'Mặc định: thời gian máy chủ 09/10 23:30 cộng 3 giờ.',13,C['muted'])
field(470,554,'Lý do mở lại *','Bổ sung số liệu theo yêu cầu đối soát',714);lines(470,670,'Cán bộ A được sửa kỳ này đến 02:30 ngày 10/10/2026. Hạn gốc không thay đổi và các người nhập khác vẫn khóa.',84,15)
btn(894,798,'Hủy',100);btn(1008,798,'Mở lại quyền nhập',180,True)
save('S17','Dialog mở khóa','Kiểm tra datetime tương lai và lý do; qua nửa đêm tự đổi ngày.','Người quản lý',{'Hủy':'S16','Mở lại thành công':'S14'})

shell('S18','Nguồn số liệu của ô tổng','Đối soát theo từng người và revision đã đóng góp.');banner(205,'Ô A2 · Tổng tiếp nhận · NUM · SUM · Tập nguồn lúc 14:45 ngày 09/10/2026','blue')
table(260,294,1130,['Người nhập','Giá trị lưu','Trạng thái','Revision','Cập nhật'],[['Cán bộ A','10','Hoàn thành','8','09/10 · 14:32'],['Cán bộ B','0','Đang nhập','3','09/10 · 14:40'],['Cán bộ C','Chưa nhập','Chưa bắt đầu','—','—']],[2,1.5,2,1,2],70)
rect(260,588,1130,170,'white',C['line']);txt(286,631,'SUM = 10       AVG = 5       COUNT = 2',24,C['navy'],True);txt(286,674,'Ô trống bị loại khỏi AVG. Giá trị 0 vẫn được tính. Không cộng các revision lịch sử.',15);txt(286,715,'Dữ liệu minh họa cho quy tắc tính. Mỗi số tổng có chế độ all_saved hoặc completed.',14,C['muted']);btn(1240,821,'Quay lại tổng',150,True)
save('S18','Nguồn số tổng','Ví dụ độc lập 10,0,null để giải thích mẫu số; không dùng chung số với báo cáo demo S15.','Người quản lý',{'Chọn người':'S16','Quay lại':'S15'})

shell('S19','Tình trạng nhập liệu','Theo dõi mọi lượt giao, gồm cả người chưa nhập.','Tình trạng nhập liệu')
field(260,214,'Báo cáo','Tất cả báo cáo tuần',420);field(704,214,'Kỳ','Tuần 41/2026',330);field(1058,214,'Đơn vị','Tất cả',332)
stats=[('Phải nộp','24','navy'),('Hoàn thành','16','green'),('Đang nhập','5','blue'),('Chưa bắt đầu','3','muted'),('Quá hạn','4','red'),('Đang mở lại','2','amber')]
for i,(label,value,color) in enumerate(stats):
 x=244+i*197;rect(x,310,183,111,'white',C['line']);txt(x+16,340,label,13,C['muted']);txt(x+16,393,value,36,C.get(color),True)
txt(260,450,'Hoàn thành 16/24 lượt (66,7%) · Quá hạn và mở lại là chỉ số chồng lấp, không cộng vào tổng.',13,C['muted'])
btn(260,478,'Danh sách',150,True);btn(420,478,'Ma trận',140);btn(1180,478,'Xuất danh sách',210)
table(244,538,1168,['Người / Báo cáo','Mức điền','Tiến độ','Hạn gốc','Khóa lại','Thao tác'],[['A · Hoạt động tuần','16/18','Đang nhập','09/10 17:00','10/10 02:30','Xem chi tiết'],['B · Hoạt động tuần','0/18','Chưa bắt đầu','09/10 17:00','—','Xem chi tiết'],['C · Tổng hợp tuần','18/18','Hoàn thành','09/10 17:00','—','Xem chi tiết']],[2.4,1,1.6,1.5,1.5,1.3],74)
txt(260,851,'3 dòng minh họa / 24 lượt giao · Trang 1/1',13,C['muted']);txt(1005,851,'Cập nhật 09/10/2026 18:00',13,C['muted'])
save('S19','Dashboard tình trạng','KPI đếm lượt giao, filter đồng nhất, ưu tiên quá hạn; dữ liệu demo thời điểm sau hạn.','Người quản lý',{'Ma trận':'S20','Chi tiết':'S16','Xuất':'S25'})

shell('S20','Ma trận nhập liệu','Hàng là người, cột là báo cáo và kỳ được chọn.','Tình trạng nhập liệu');banner(205,'Kỳ tuần 41/2026 · 3 báo cáo · 4 người trong vùng xem minh họa','blue')
table(260,300,1130,['Người / Đơn vị','Hoạt động tuần','Tổng hợp tuần','Chuyên đề'],[['A · Đơn vị A','Đang nhập · Mở lại','Hoàn thành','Không giao'],['B · Đơn vị A','Chưa bắt đầu','Hoàn thành','Hoàn thành'],['C · Đơn vị B','Hoàn thành','Đang nhập','Không giao'],['D · Đơn vị B','Không giao','Chưa bắt đầu','Hoàn thành']],[1.7,2.2,2.2,2.2],85)
txt(260,760,'Không giao: không có nghĩa vụ. Chưa bắt đầu: đã được giao nhưng chưa có dữ liệu lưu.',15,C['muted']);txt(260,798,'Chọn tối đa 12 cột. Nhiều hơn chuyển sang danh sách để giữ khả năng đọc.',14,C['muted']);btn(1190,849,'Về danh sách',200,True)
save('S20','Ma trận người và báo cáo','Click ô được giao mở đúng report/kỳ/người; không giao không mở form nhập.','Người quản lý',{'Ô được giao':'S16','Danh sách':'S19'})

shell('S21','Lịch sử báo cáo','Theo dõi lưu dữ liệu, hoàn thành và mở lại theo thời gian.','Tình trạng nhập liệu');banner(205,'Cán bộ A · Báo cáo hoạt động tuần · Kỳ 41/2026 · Mẫu v1','blue')
table(260,299,1130,['Thời điểm','Người thực hiện','Sự kiện','Chi tiết'],[['10/10 · 02:30','Hệ thống','Hết quyền mở lại','Trở về chỉ xem'],['09/10 · 23:30','Quản lý A','Mở lại','Đến 10/10 02:30 · Bổ sung đối soát'],['09/10 · 16:55','Cán bộ A','Hoàn thành','Revision 8'],['09/10 · 14:32','Cán bộ A','Lưu dữ liệu','Revision 7 → 8 · A2: 120 → 125'],['09/10 · 09:10','Cán bộ A','Bắt đầu nhập','Revision 1']],[1.4,1.5,1.4,3.5],78)
txt(260,785,'Nhật ký chỉ đọc. Các lần mở lại không thay đổi hạn gốc hoặc xóa dấu vết nộp trễ.',14,C['muted'])
save('S21','Lịch sử và audit','Xem actor thời điểm lý do và revision; không có thao tác sửa/xóa nhật ký.','Người quản lý',{'Quay lại cá nhân':'S16'})

shell('S22','Phiên bản và hiệu lực','Thay đổi mẫu hoặc phân công không làm mất lịch sử kỳ cũ.','Thiết lập báo cáo')
table(260,229,1130,['Phiên bản','Ngày hiệu lực','Trạng thái','Kỳ đã dùng','Thao tác'],[['v2','12/10/2026','Nháp','Chưa sử dụng','Tiếp tục thiết lập'],['v1','05/10/2026','Đã xuất bản','Tuần 41/2026','Xem cấu hình']],[1,1.5,1.5,2,2],72)
rect(260,482,1130,230,'white',C['line']);txt(282,521,'Thay đổi dự kiến ở v2',21,bold=True);txt(282,565,'Thêm 2 ô nhập · Đổi mô tả 1 chỉ tiêu · Thêm 1 người nhập',16);txt(282,607,'Kỳ 41 tiếp tục dùng v1. Dữ liệu đã nhập không bị di chuyển hoặc ghi đè.',15,C['muted']);field(282,649,'Áp dụng thay đổi','Từ kỳ chưa mở kế tiếp',500)
btn(260,789,'Tạo phiên bản mới',210,True);btn(490,789,'Ngừng phát sinh kỳ',230);txt(260,866,'Sửa phân công kỳ hiện tại cần thao tác riêng, lý do và xác nhận thay đổi mẫu số.',14,C['muted'])
save('S22','Quản lý phiên bản','Giữ template version và snapshot assignments; thay đổi nghĩa vụ hiện hành có nhật ký.','Người thiết lập',{'Tạo phiên bản':'S02','Tiếp tục nháp':'S03'})

shell('S23','Trạng thái dùng chung','Mỗi màn hình phải có trạng thái tải, rỗng, lỗi và không có quyền.','Tình trạng nhập liệu')
for i,(title,body,action) in enumerate([('Đang tải','Đang tải báo cáo đúng kỳ đã chọn.','Thao tác ghi bị vô hiệu'),('Chưa có phân công','Bạn chưa được giao báo cáo trong kỳ này.','Đổi kỳ hoặc liên hệ quản lý'),('Không thể tải dữ liệu','Kết nối gián đoạn. Bộ lọc hiện tại được giữ.','Thử lại'),('Không có quyền truy cập','Bạn không có quyền xem báo cáo này.','Về danh sách được phép')]):
 x=260+(i%2)*580;y=235+(i//2)*300;rect(x,y,550,262,'white',C['line']);txt(x+24,y+51,title,22,bold=True);lines(x+24,y+95,body,48,15);btn(x+24,y+174,action,490,i==2)
save('S23','Loading empty error permission','Bộ trạng thái áp dụng toàn module; không dùng trang trắng hoặc số cũ như mới.','Mọi vai trò',{'Thử lại':'S19','Về danh sách':'S01'})

shell('S24','Nhập liệu trên màn hình hẹp','Giữ bảng Excel cuộn ngang; mở editor riêng cho ô đang chọn.')
rect(276,218,400,678,'#14273A',r=30);rect(291,241,370,629,'white',r=18);txt(312,285,'Báo cáo hoạt động tuần',18,bold=True);txt(312,316,'Tuần 41 · Còn 2 giờ',13,C['blue']);rect(308,343,335,185,'#F3F6FA',C['line']);txt(322,378,'Chỉ tiêu',14,bold=True);txt(500,378,'Giá trị',14,bold=True);txt(322,426,'Tiếp nhận mới',14);txt(519,426,'125',15,C['blue'],True);txt(322,475,'Đã xử lý',14);txt(519,475,'96',15);txt(319,552,'Vuốt ngang để xem đủ các cột',12,C['muted']);field(312,599,'Ô A2 · Tổng tiếp nhận','125',326);btn(312,707,'Lưu giá trị',326,True);txt(312,785,'Đã lưu lúc 14:45',13,C['green'])
txt(735,287,'Tương tác thích ứng',25,bold=True);lines(735,338,'Desktop và tablet là môi trường nhập chính. Trên điện thoại, không thu nhỏ toàn bộ sheet tới mức khó đọc.',66,17);lines(735,441,'Chạm ô nhập để mở editor đúng kiểu dữ liệu. Date và time dùng picker. Header giữ tên báo cáo, kỳ và trạng thái hạn.',66,17);lines(735,547,'Thanh lưu không che bàn phím. Ô tĩnh và công thức không mở editor. Cần kiểm thử keyboard, focus và trình đọc màn hình.',66,17)
save('S24','Responsive và editor từng ô','Thiết kế mobile đề xuất cần kiểm chứng với template thật; không thay đổi tọa độ sheet.','Người nhập',{'Lưu giá trị':'S11','Hết hạn':'S13'})

shell('S25','Xuất báo cáo Excel','Tạo file từ một tập revision cố định để số liệu nhất quán.');field(260,234,'Phạm vi','Tổng hợp · Tuần 41/2026',650);field(935,234,'Nguồn tổng hợp','Tất cả dữ liệu đã lưu',455)
rect(260,333,1130,191,'white',C['line']);txt(284,376,'Thông tin đi kèm file',21,bold=True);txt(284,420,'Mẫu v1 · 12 lượt giao · 8 hoàn thành · 10 có dữ liệu',16);txt(284,461,'Snapshot 09/10/2026 14:45 · Ghi rõ trạng thái tạm tính',16,C['muted']);txt(284,494,'Không thay đổi nội dung export khi có người nhập thêm sau thời điểm này.',14,C['muted'])
table(260,565,1130,['Yêu cầu','Trạng thái','Tạo lúc','Thao tác'],[['BC-TUAN-01_Tuan41.xlsx','Sẵn sàng','09/10 · 14:45','Tải file'],['BC-TUAN-01_Tuan41.xlsx','Đang tạo','09/10 · 14:46','Chờ xử lý']],[3,1.4,1.5,1],66);btn(1170,818,'Tạo file xuất mới',220,True)
save('S25','Xuất file và trạng thái job','Quyền kiểm tra khi tạo và tải; file private có thời hạn; lỗi cho retry theo snapshot.','Theo quyền xem',{'Tải':'S15','Quay lại':'S19'})

shell('S26','Lưu dữ liệu và xung đột','Không báo đã lưu khi dữ liệu chưa được máy chủ xác nhận.')
rect(260,224,1130,164,'#FFF4DC',C['line']);txt(284,264,'Kết nối gián đoạn — thay đổi chưa được lưu',23,C['amber'],True);lines(284,303,'Dữ liệu đang nhập được giữ trong phiên hiện tại. Không đóng trang trước khi lưu lại thành công. Hệ thống không tự gửi phần chưa lưu sau khi đã hết hạn.',120,15);btn(1180,332,'Thử lưu lại',185,True)
rect(400,435,850,420,'white',C['line'],12);txt(430,484,'Báo cáo đã thay đổi ở tab khác',24,bold=True);lines(430,528,'Bản trên máy chủ là revision 9. Tab này đang sửa revision 8. Hãy tải bản mới và kiểm tra trước khi áp lại thay đổi.',88,16)
table(430,602,788,['Ô','Máy chủ revision 9','Thay đổi chưa lưu'],[['A2','130','125'],['AK12','09/10/2026','10/10/2026']],[1,2,2],52);btn(825,787,'Giữ lại để xem',160);btn(999,787,'Tải bản mới',210,True)
save('S26','Mất mạng và revision conflict','Không overwrite tự động; lưu buffer tạm trong phiên, retry idempotent, complete chờ flush.','Người nhập',{'Tải bản mới':'S11','Quá hạn':'S13'})

shell('S27','Phân tích tiến độ theo đơn vị','Biểu đồ và bộ lọc nâng cao bổ sung cho bảng công việc.','Tình trạng nhập liệu')
rect(260,220,720,330,'white',C['line']);txt(284,260,'Tỷ lệ hoàn thành theo đơn vị',21,bold=True)
for i,(label,val,count) in enumerate([('Đơn vị A',80,'8/10'),('Đơn vị B',60,'6/10'),('Đơn vị C',50,'2/4')]):
 yy=305+i*70;txt(284,yy+20,label,15);rect(407,yy,440,26,'#E9EEF4',r=5);rect(407,yy,440*val/100,26,C['blue'],r=5);txt(868,yy+20,count,15,bold=True)
rect(1003,220,387,618,'white',C['line']);txt(1025,260,'Bộ lọc nâng cao',21,bold=True);field(1025,310,'Người nhập','Tất cả',342);field(1025,402,'Tiến độ','Chưa hoàn thành',342);field(1025,494,'Tình trạng hạn','Quá hạn',342);field(1025,586,'Quyền nhập','Tất cả',342);btn(1025,753,'Xóa lọc',120);btn(1160,753,'Áp dụng',207,True)
rect(260,576,720,261,'white',C['line']);txt(284,618,'Xu hướng hoàn thành cùng loại kỳ',21,bold=True)
for i,(lab,h,pct) in enumerate([('Tuần 38',72,'60%'),('Tuần 39',87,'72%'),('Tuần 40',100,'83%'),('Tuần 41',80,'67%')]):
 x=325+i*160;rect(x,773-h,68,h,'#83B5DD',r=4);txt(x,762-h,pct,14,C['navy'],True);txt(x-5,804,lab,13,C['muted'])
save('S27','Biểu đồ và filter nâng cao','Chỉ so sánh các kỳ cùng loại; tooltip có tử mẫu. Apply filter đồng bộ KPI bảng chart và export.','Người quản lý',{'Áp dụng':'S19','Chọn đơn vị':'S19'})

shell('S28','Chọn ngày và giờ trong ô nhập','Picker hỗ trợ thao tác nhanh, vẫn kiểm tra dữ liệu gõ tay.');report_filters();grid(360,'input')
rect(790,283,430,467,'white',C['line'],10);txt(814,322,'Ngày lập · AK12',20,bold=True);field(814,356,'Ngày nhập','09/10/2026',380);txt(895,451,'Tháng 10 năm 2026',17,bold=True)
for j,d in enumerate(['T2','T3','T4','T5','T6','T7','CN']):txt(817+j*53,489,d,13,C['muted'],True)
for n in range(1,32):
 idx=n+2;x=814+(idx%7)*53;y=514+(idx//7)*35
 if n==9:rect(x-5,y-20,35,29,C['blue'],r=4)
 txt(x,y,str(n),14,'white' if n==9 else None)
btn(814,694,'Hôm nay',110);btn(1026,694,'Chọn ngày',166,True)
save('S28','Date picker và editor theo kiểu','Ngày dùng picker không nhận serial number tùy ý. TIME dùng picker 24h và format hh:mm theo cùng nguyên tắc.','Người nhập',{'Chọn ngày':'S11','Ngày không hợp lệ':'S12'})

shell('S29','Xác nhận hoàn thành báo cáo','Hoàn thành là xác nhận của người nhập, không phải phê duyệt của quản lý.')
rect(413,235,820,510,'white',C['line'],12);txt(445,287,'Hoàn thành kỳ báo cáo này?',25,bold=True);txt(445,331,'Báo cáo hoạt động tuần · Kỳ 41/2026',17);pill(445,362,'18/18 ô bắt buộc hợp lệ','green',325)
lines(445,437,'Tất cả thay đổi đã được lưu. Hệ thống ghi nhận thời điểm hoàn thành trên revision hiện tại.',83,17);lines(445,532,'Anh/chị vẫn có thể sửa trước hạn. Khi sửa dữ liệu, trạng thái trở về Đang nhập và cần xác nhận hoàn thành lại.',83,16)
btn(870,660,'Quay lại',120);btn(1007,660,'Hoàn thành',189,True);banner(813,'Sau thành công: badge Hoàn thành, thời điểm xác nhận và revision hiển thị ngay trên form.','green')
save('S29','Xác nhận và kết quả hoàn thành','Chờ autosave flush trước complete. Nếu đã khóa hoặc conflict phải hiển thị lỗi và không báo thành công.','Người nhập',{'Quay lại':'S11','Hoàn thành thành công':'S11','Hết hạn':'S13'})

shell('S30','Điều chỉnh phân công kỳ hiện tại','Thay đổi nghĩa vụ có kiểm soát và lưu lịch sử mẫu số.','Thiết lập báo cáo');banner(205,'Kỳ 41 đã mở. Thao tác này chỉ dành cho người có quyền điều chỉnh phân công.','amber')
field(260,302,'Người được điều chỉnh','Cán bộ B · Đơn vị A',535);field(824,302,'Thao tác','Miễn thực hiện kỳ này',566);field(260,404,'Lý do bắt buộc','Điều chuyển công tác trong kỳ',1130)
table(260,518,1130,['Ảnh hưởng','Trước','Sau'],[['Lượt phải nộp của báo cáo','12','11'],['Dữ liệu đã nhập của người này','Giữ nguyên','Giữ nguyên trong lịch sử'],['Quyền nhập trong kỳ','Được giao','Không còn quyền nhập'],['Kỳ khác','Theo cấu hình riêng','Không tự thay đổi']],[3,2,2],57)
btn(1060,840,'Hủy',100);btn(1174,840,'Lưu điều chỉnh',216,True)
save('S30','Điều chỉnh và miễn nghĩa vụ','Có thêm người hoặc miễn nghĩa vụ theo quyền; không xóa submission cũ và phải lưu tác động mẫu số.','Người có quyền cấu hình',{'Lưu':'S19','Hủy':'S22'})

shell('S31','Xác nhận thay đổi hiệu lực','Ngừng phát sinh kỳ và thu hồi mở lại là hai thao tác khác nhau.','Thiết lập báo cáo')
for x,title,body,action in [(260,'Ngừng phát sinh kỳ mới','Các kỳ đã phát sinh và dữ liệu hiện có vẫn giữ nguyên. Kỳ đang mở tiếp tục theo hạn đã cấu hình.','Ngừng phát sinh'),(841,'Thu hồi quyền mở lại','Chỉ thu hồi grant của Cán bộ A trong kỳ 41. Nếu đã quá hạn gốc, người này chuyển sang chỉ xem.','Thu hồi mở lại')]:
 rect(x,247,549,534,'white',C['line'],12);txt(x+24,296,title,21,bold=True);lines(x+24,353,body,50,16);field(x+24,490,'Lý do bắt buộc','Nhập lý do thao tác',501);btn(x+24,690,'Hủy',100);btn(x+282,690,action,240,True)
save('S31','Ngừng phát sinh và thu hồi grant','Dialog chỉ mở đúng thao tác được chọn. Không có xóa vĩnh viễn. Xác nhận luôn nêu đối tượng phạm vi ảnh hưởng.','Theo quyền cấu hình hoặc quản lý',{'Ngừng phát sinh':'S01','Thu hồi':'S16'})

shell('S32','Thuộc tính trường và preview mẫu','Kiểm tra định nghĩa từ Excel cùng các ràng buộc nghiệp vụ.','Thiết lập báo cáo')
table(260,230,660,['Ô','A','B','C'],[['1','BÁO CÁO HOẠT ĐỘNG','',''],['2','Tổng tiếp nhận','{NUM|#,##0|SUM}',''],['3','Tổng đã xử lý','{NUM|#,##0|SUM}',''],['4','Tỷ lệ','=B3/B2',''],['5','Ghi chú','{TEXT}','']],[.4,2,2.5,.5],68)
rect(945,230,445,632,'white',C['line']);txt(968,270,'Trường Tổng tiếp nhận',22,bold=True);field(968,307,'Địa chỉ / Locked','Tổng hợp!B2 / Không',398);field(968,398,'Kiểu / Format / Tổng hợp','NUM / #,##0 / SUM',398);field(968,489,'Min / Max / Scale','0 / 999999999 / 0',398);field(968,580,'Nhãn và hướng dẫn','Nhập số hồ sơ tiếp nhận mới',398);txt(968,685,'☑ Bắt buộc nhập',16);btn(968,792,'Lưu thuộc tính nháp',398,True)
txt(260,690,'Preview dạng lưới và danh sách thuộc tính dùng chung schema.',14,C['muted']);txt(260,735,'Ở đây B2 là ô nhập minh họa. Địa chỉ thật lấy từ file người dùng tải lên.',13,C['muted'])
save('S32','Lưới template và ràng buộc field','Màn inspector đầy đủ cho label required min max scale maxLength và helper text; DATE TIME dùng ràng buộc tương ứng.','Người thiết lập',{'Lưu nháp':'S03','Kiểm tra lại':'S04'})

nav=''.join(f'<button onclick="show(\'{s["id"]}\')" data-id="{s["id"]}"><b>{s["id"]}</b><span>{html.escape(s["title"])}</span></button>' for s in screens)
boards=''.join(f'<section id="{s["id"]}" class="board"><div class="meta"><h2>{s["id"]} · {html.escape(s["title"])}</h2><p>{html.escape(s["description"])}</p><small>Vai trò: {html.escape(s["role"])}</small><div class="flow">'+''.join(f'<span>{html.escape(k)} → {html.escape(v)}</span>' for k,v in s['events'].items())+f'</div></div><div class="art">{s["svg"]}</div></section>' for s in screens)
page='''<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PC02 Bộ mockup báo cáo động</title><style>
*{box-sizing:border-box}body{margin:0;font:15px Arial,sans-serif;color:#1b2d40;background:#eaf0f6}header{height:84px;background:#082f56;color:white;display:flex;align-items:center;justify-content:space-between;padding:14px 26px;position:sticky;top:0;z-index:5}header h1{font-size:22px;margin:0 0 6px}header p{margin:0;color:#c8d9e9;font-size:13px}header button{background:#fff;color:#163e63;border:0;padding:10px 14px;border-radius:6px;cursor:pointer}nav{width:245px;position:fixed;top:84px;bottom:0;overflow:auto;background:white;border-right:1px solid #ccd8e3;padding:12px}nav button{display:flex;align-items:start;gap:10px;width:100%;border:0;background:white;text-align:left;padding:12px 8px;color:#42576b;cursor:pointer;border-radius:6px;line-height:1.4}nav button.active{background:#e6f0fb;color:#085ca2}nav b{font-size:12px;padding-top:2px}main{margin-left:245px;padding:25px}.board{display:none}.board.active{display:block}.meta{max-width:1440px;background:white;border-radius:10px 10px 0 0;padding:20px 24px;border-bottom:1px solid #d4dee9}h2{font-size:23px;margin:0 0 10px}.meta p{line-height:1.6;margin:0 0 6px}.meta small{color:#63758a}.flow{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}.flow span{background:#f0f5fa;padding:7px 10px;border-radius:4px;font-size:12px}.art{overflow:auto;box-shadow:0 8px 30px #19354e16}.art svg{display:block;width:100%;min-width:850px;height:auto;background:white}body.actual .art svg{width:1440px;max-width:none}.notice{margin:0 0 20px;padding:13px 17px;background:#fff5db;border-radius:6px;color:#725015;line-height:1.5}.bottom{display:flex;justify-content:space-between;margin-top:18px}.bottom button{padding:11px 22px;border:1px solid #b7cadb;background:white;border-radius:6px;cursor:pointer}@media(max-width:900px){nav{width:180px}main{margin-left:180px;padding:12px}header h1{font-size:18px}.meta h2{font-size:19px}}@media print{header,nav,.notice,.bottom{display:none}main{margin:0;padding:0}.board{display:block;break-after:page}.meta{padding:8px}.meta p,.flow,small{font-size:10px}.art svg{min-width:0;width:100%}.art{overflow:visible;box-shadow:none}@page{size:A3 landscape;margin:10mm}}
</style></head><body><header><div><h1>PC02 · Thiết kế báo cáo động</h1><p>32 màn hình và trạng thái · Phiên bản đề xuất 1.0 · 09/10/2026</p></div><div><button onclick="document.body.classList.toggle('actual')">100% / Vừa khung</button> <button onclick="window.print()">In toàn bộ</button></div></header><nav>'''+nav+'''</nav><main><p class="notice">Mockup thiết kế dùng dữ liệu minh họa, không kết nối hệ thống thật. Chọn màn ở menu trái để xem; các nút bên trong bản vẽ mô tả vị trí và hành vi cần triển khai.</p>'''+boards+'''<div class="bottom"><button onclick="move(-1)">← Màn trước</button><button onclick="move(1)">Màn tiếp →</button></div></main><script>
const ids='''+json.dumps([s['id'] for s in screens])+''';let index=0;function show(id){index=ids.indexOf(id);if(index<0)index=0;document.querySelectorAll('.board').forEach(e=>e.classList.toggle('active',e.id===ids[index]));document.querySelectorAll('nav button').forEach(e=>e.classList.toggle('active',e.dataset.id===ids[index]));history.replaceState(null,'','#'+ids[index]);window.scrollTo(0,0)}function move(d){show(ids[(index+d+ids.length)%ids.length])}show(ids.includes(location.hash.slice(1))?location.hash.slice(1):ids[0]);
</script></body></html>'''
(OUT/'Mockup_PC02.html').write_text(page)
(OUT/'SCREEN_CATALOG.json').write_text(json.dumps([{k:v for k,v in s.items() if k!='svg'} for s in screens],ensure_ascii=False,indent=2))
spec='# Danh mục màn hình và hành vi UI\n\n32 màn hình hoặc trạng thái trong Mockup_PC02.html. Thiết kế vector 1440×960, có SVG chỉnh sửa trong thư mục mockups. Nút trong bản vẽ là minh họa; menu catalog hoạt động offline. Không kết nối dữ liệu thật.\n\n'
for s in screens:
 spec+=f'## {s["id"]} {s["title"]}\n\nVai trò: {s["role"]}.\n\n{s["description"]}\n\n'+ '\n'.join(f'- {k}: {v}' for k,v in s['events'].items())+'\n\n'
(OUT/'SCREEN_SPEC.md').write_text(spec)
print('Generated',len(screens),'screens')

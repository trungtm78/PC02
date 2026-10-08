--
-- PostgreSQL database dump
--

\restrict Sz0aabRWIA40cRH6IWfE96yQRuaXpa5wfWj13FH0t4q1aexcHVYsfjemqxuyTua

-- Dumped from database version 16.11
-- Dumped by pg_dump version 16.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: AccessLevel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AccessLevel" AS ENUM (
    'READ',
    'WRITE'
);


--
-- Name: BulkOperationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BulkOperationStatus" AS ENUM (
    'STARTED',
    'COMPLETED',
    'FAILED'
);


--
-- Name: CapDoToiPham; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CapDoToiPham" AS ENUM (
    'IT_NGHIEM_TRONG',
    'NGHIEM_TRONG',
    'RAT_NGHIEM_TRONG',
    'DAC_BIET_NGHIEM_TRONG'
);


--
-- Name: EventScope; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EventScope" AS ENUM (
    'SYSTEM',
    'TEAM',
    'PERSONAL'
);


--
-- Name: IncidentHandoffState; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."IncidentHandoffState" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'CANCELLED'
);


--
-- Name: IncidentIntakeStage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."IncidentIntakeStage" AS ENUM (
    'PHAN_LOAI',
    'CHO_NHAN',
    'DA_NHAN'
);


--
-- Name: LoaiDon; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LoaiDon" AS ENUM (
    'TO_CAO',
    'KHIEU_NAI',
    'KIEN_NGHI',
    'PHAN_ANH'
);


--
-- Name: LoaiNguonTin; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LoaiNguonTin" AS ENUM (
    'TO_GIAC',
    'TIN_BAO',
    'KIEN_NGHI_KHOI_TO'
);


--
-- Name: LyDoKhongKhoiTo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LyDoKhongKhoiTo" AS ENUM (
    'KHONG_CO_SU_VIEC',
    'HANH_VI_KHONG_CAU_THANH_TOI_PHAM',
    'NGUOI_THUC_HIEN_CHUA_DU_TUOI',
    'NGUOI_PHAM_TOI_CHET',
    'HET_THOI_HIEU',
    'TOI_PHAM_DA_DUOC_XOA_AN_TICH',
    'TRUONG_HOP_KHAC'
);


--
-- Name: NguonPhatTin; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NguonPhatTin" AS ENUM (
    'CA_NHAN_TO_GIAC',
    'CO_QUAN_NHA_NUOC',
    'TO_CHUC',
    'CA_NHAN_BAO_TIN',
    'PHUONG_TIEN_TRUYEN_THONG',
    'VIEN_KIEM_SAT',
    'THANH_TRA',
    'KIEM_TOAN',
    'TOA_AN',
    'CO_QUAN_KHAC'
);


--
-- Name: NotificationType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NotificationType" AS ENUM (
    'CASE_STATUS_CHANGED',
    'CASE_DEADLINE_NEAR',
    'CASE_OVERDUE',
    'CASE_ASSIGNED',
    'PETITION_RECEIVED',
    'PETITION_DEADLINE_NEAR',
    'PETITION_OVERDUE',
    'INCIDENT_DEADLINE_NEAR',
    'INCIDENT_OVERDUE',
    'DOCUMENT_UPLOADED',
    'SYSTEM',
    'DEADLINE_RULE_SUBMITTED',
    'DEADLINE_RULE_APPROVED',
    'DEADLINE_RULE_REJECTED',
    'DEADLINE_RULE_ACTIVATED',
    'DEADLINE_RULE_STALE_REVIEW',
    'DEADLINE_RULE_WITHDRAWN',
    'DEADLINE_RULE_CHANGES_REQUESTED',
    'INCIDENT_ASSIGNED',
    'PETITION_ASSIGNED',
    'UTDT_ASSIGNED',
    'INCIDENT_CREATED'
);


--
-- Name: PhuongThucTiepNhan; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PhuongThucTiepNhan" AS ENUM (
    'TRUC_TIEP_BANG_LOI',
    'TRUC_TIEP_BANG_VAN_BAN',
    'DIEN_THOAI',
    'BUU_DIEN',
    'PHUONG_TIEN_DIEN_TU'
);


--
-- Name: ReminderChannel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ReminderChannel" AS ENUM (
    'FCM',
    'EMAIL'
);


--
-- Name: case_provenance; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.case_provenance AS ENUM (
    'FROM_PETITION',
    'FROM_INCIDENT',
    'DIRECT_DISCOVERY',
    'TRANSFERRED',
    'OTHER_LEGAL_SOURCE',
    'SELF_SURRENDER',
    'PROSECUTOR_PROPOSAL',
    'UY_THAC_DIEU_TRA'
);


--
-- Name: case_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.case_status AS ENUM (
    'TIEP_NHAN',
    'DANG_XAC_MINH',
    'DA_XAC_MINH',
    'DANG_DIEU_TRA',
    'TAM_DINH_CHI',
    'DINH_CHI',
    'DA_KET_LUAN',
    'DANG_TRUY_TO',
    'DANG_XET_XU',
    'DA_LUU_TRU',
    'DA_CHUYEN_DON_VI',
    'DA_NHAP_VU_KHAC',
    'CHUYEN_XPHC'
);


--
-- Name: case_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.case_type AS ENUM (
    'REGULAR',
    'UY_THAC_DIEU_TRA'
);


--
-- Name: conclusion_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.conclusion_status AS ENUM (
    'DU_THAO',
    'CHO_DUYET',
    'DA_DUYET'
);


--
-- Name: deadline_rule_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.deadline_rule_status AS ENUM (
    'draft',
    'submitted',
    'approved',
    'active',
    'superseded',
    'rejected'
);


--
-- Name: delegation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.delegation_status AS ENUM (
    'PENDING',
    'RECEIVED',
    'COMPLETED'
);


--
-- Name: exchange_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.exchange_status AS ENUM (
    'OPEN',
    'CLOSED',
    'PENDING'
);


--
-- Name: guidance_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.guidance_status AS ENUM (
    'PENDING',
    'COMPLETED',
    'CANCELLED'
);


--
-- Name: huong_xu_ly_don; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.huong_xu_ly_don AS ENUM (
    'GIAO_DON',
    'CHUYEN_DON',
    'TRA_LUU_DON'
);


--
-- Name: incident_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.incident_status AS ENUM (
    'TIEP_NHAN',
    'DANG_XAC_MINH',
    'DA_PHAN_CONG',
    'DA_GIAI_QUYET',
    'TAM_DINH_CHI',
    'QUA_HAN',
    'DA_CHUYEN_VU_AN',
    'KHONG_KHOI_TO',
    'CHUYEN_XPHC',
    'TDC_HET_THOI_HIEU',
    'TDC_HTH_KHONG_KT',
    'PHUC_HOI_NGUON_TIN',
    'DA_CHUYEN_DON_VI',
    'DA_NHAP_VU_KHAC',
    'PHAN_LOAI_DAN_SU',
    'DINH_CHI'
);


--
-- Name: ket_qua_phuc_hoi_vu_an; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ket_qua_phuc_hoi_vu_an AS ENUM (
    'KET_LUAN_DE_NGHI_TRUY_TO',
    'DINH_CHI_DIEU_TRA',
    'TAM_DINH_CHI_LAI',
    'DANG_DIEU_TRA_XAC_MINH',
    'CHUYEN_CO_QUAN_DIEU_TRA_KHAC'
);


--
-- Name: ket_qua_phuc_hoi_vu_viec; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ket_qua_phuc_hoi_vu_viec AS ENUM (
    'QUYET_DINH_KHOI_TO',
    'QUYET_DINH_KHONG_KHOI_TO',
    'TAM_DINH_CHI_LAI',
    'DANG_XAC_MINH',
    'CHUYEN_CO_QUAN_KHAC'
);


--
-- Name: loai_uy_thac; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.loai_uy_thac AS ENUM (
    'UY_THAC_DIEU_TRA',
    'CHUYEN_DON_NGUON_TIN',
    'UY_THAC_GIAI_QUYET'
);


--
-- Name: ly_do_tam_dinh_chi_vu_an; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ly_do_tam_dinh_chi_vu_an AS ENUM (
    'CHUA_XAC_DINH_BI_CAN',
    'KHONG_BIET_BI_CAN_O_DAU',
    'BI_CAN_BENH_TAM_THAN',
    'CHUA_CO_KET_QUA_GIAM_DINH',
    'CHUA_CO_KET_QUA_DINH_GIA',
    'CHUA_CO_KET_QUA_TUONG_TRO',
    'YEU_CAU_TAI_LIEU_CHUA_CO',
    'BAT_KHA_KHANG'
);


--
-- Name: ly_do_tam_dinh_chi_vu_viec; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ly_do_tam_dinh_chi_vu_viec AS ENUM (
    'CHUA_CO_KET_QUA_GIAM_DINH',
    'CHUA_CO_KET_QUA_DINH_GIA',
    'CHUA_CO_KET_QUA_TUONG_TRO',
    'YEU_CAU_TAI_LIEU_CHUA_CO',
    'BAT_KHA_KHANG',
    'CAN_CU_KHAC'
);


--
-- Name: monthly_report_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.monthly_report_status AS ENUM (
    'DRAFT',
    'NEEDS_VERIFICATION',
    'REVIEWING',
    'APPROVED',
    'FINALIZED',
    'REJECTED'
);


--
-- Name: petition_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.petition_status AS ENUM (
    'MOI_TIEP_NHAN',
    'DANG_XU_LY',
    'CHO_PHE_DUYET',
    'DA_LUU_DON',
    'DA_GIAI_QUYET',
    'DA_CHUYEN_VU_VIEC',
    'DA_CHUYEN_VU_AN',
    'DA_TRA_DON',
    'DA_HUONG_DAN',
    'PHAN_LOAI_DAN_SU',
    'TAM_DINH_CHI',
    'KHONG_KHOI_TO',
    'DA_CHUYEN_DON_VI',
    'DA_NHAP_HO_SO_KHAC',
    'DINH_CHI',
    'CHUYEN_XPHC'
);


--
-- Name: proposal_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.proposal_status AS ENUM (
    'CHO_GUI',
    'DA_GUI',
    'CO_PHAN_HOI',
    'DA_XU_LY'
);


--
-- Name: report_tdc_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.report_tdc_status AS ENUM (
    'DRAFT',
    'REVIEWING',
    'REJECTED',
    'APPROVED',
    'FINALIZED'
);


--
-- Name: report_tdc_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.report_tdc_type AS ENUM (
    'VU_AN',
    'VU_VIEC'
);


--
-- Name: subject_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subject_status AS ENUM (
    'INVESTIGATING',
    'DETAINED',
    'RELEASED',
    'WANTED'
);


--
-- Name: subject_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subject_type AS ENUM (
    'SUSPECT',
    'VICTIM',
    'WITNESS'
);


--
-- Name: tien_do_khac_phuc; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tien_do_khac_phuc AS ENUM (
    'DANG_THUC_HIEN',
    'DAM_BAO',
    'CHAM_TRE',
    'KHONG_DAT'
);


--
-- Name: f_bo_dau(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.f_bo_dau(text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $_$
  SELECT btrim(regexp_replace(lower(replace(replace(replace(replace(translate(coalesce($1, ''), 'đĐÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüýÿĀāĂăĄąĆćĈĉĊċČčĎďĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĨĩĪīĬĭĮįİĴĵĶķĹĺĻļĽľŃńŅņŇňŌōŎŏŐőŔŕŖŗŘřŚśŜŝŞşŠšŢţŤťŨũŪūŬŭŮůŰűŲųŴŵŶŷŸŹźŻżŽžƠơƯưǍǎǏǐǑǒǓǔǕǖǗǘǙǚǛǜǞǟǠǡǦǧǨǩǪǫǬǭǰǴǵǸǹǺǻȀȁȂȃȄȅȆȇȈȉȊȋȌȍȎȏȐȑȒȓȔȕȖȗȘșȚțȞȟȦȧȨȩȪȫȬȭȮȯȰȱȲȳḀḁḂḃḄḅḆḇḈḉḊḋḌḍḎḏḐḑḒḓḔḕḖḗḘḙḚḛḜḝḞḟḠḡḢḣḤḥḦḧḨḩḪḫḬḭḮḯḰḱḲḳḴḵḶḷḸḹḺḻḼḽḾḿṀṁṂṃṄṅṆṇṈṉṊṋṌṍṎṏṐṑṒṓṔṕṖṗṘṙṚṛṜṝṞṟṠṡṢṣṤṥṦṧṨṩṪṫṬṭṮṯṰṱṲṳṴṵṶṷṸṹṺṻṼṽṾṿẀẁẂẃẄẅẆẇẈẉẊẋẌẍẎẏẐẑẒẓẔẕẖẗẘẙẠạẢảẤấẦầẨẩẪẫẬậẮắẰằẲẳẴẵẶặẸẹẺẻẼẽẾếỀềỂểỄễỆệỈỉỊịỌọỎỏỐốỒồỔổỖỗỘộỚớỜờỞởỠỡỢợỤụỦủỨứỪừỬửỮữỰựỲỳỴỵỶỷỸỹ–—“”‘’·²³                 　﻿̴̵̶̷̸̡̢̧̨̛̖̗̘̙̜̝̞̟̠̣̤̥̦̩̪̫̬̭̮̯̰̱̲̳̹̺̻̼͇͈͉͍͎̀́̂̃̄̅̆̇̈̉̊̋̌̍̎̏̐̑̒̓̔̽̾̿̀́͂̓̈́͆͊͋͌̕̚ͅ͏͓͔͕͖͙͚͐͑͒͗͛ͣͤͥͦͧͨͩͪͫͬͭͮͯ͘͜͟͢͝͞͠͡', 'ddaaaaaaceeeeiiiinooooouuuuyaaaaaaceeeeiiiinooooouuuuyyaaaaaaccccccccddeeeeeeeeeegggggggghhiiiiiiiiijjkkllllllnnnnnnoooooorrrrrrssssssssttttuuuuuuuuuuuuwwyyyzzzzzzoouuaaiioouuuuuuuuuuaaaaggkkoooojggnnaaaaaaeeeeiiiioooorrrruuuusstthhaaeeooooooooyyaabbbbbbccddddddddddeeeeeeeeeeffgghhhhhhhhhhiiiikkkkkkllllllllmmmmmmnnnnnnnnoooooooopppprrrrrrrrssssssssssttttttttuuuuuuuuuuvvvvwwwwwwwwwwxxxxyyzzzzzzhtwyaaaaaaaaaaaaaaaaaaaaaaaaeeeeeeeeeeeeeeeeiiiioooooooooooooooooooooooouuuuuuuuuuuuuuyyyyyyyy--""''''.23                   '), '…', '...'), '¼', '1/4'), '½', '1/2'), '¾', '3/4')), '[ \t\n\r\f\v]+', ' ', 'g'))
$_$;


--
-- Name: pc02_dat_dinh_danh_incidents(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pc02_dat_dinh_danh_incidents() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."sdt_nguoi_to_giac_norm" := regexp_replace(coalesce(NEW."sdtNguoiToGiac", ''), '[^0-9]', '', 'g');
  NEW."cmnd_nguoi_to_giac_norm" := regexp_replace(coalesce(NEW."cmndNguoiToGiac", ''), '[^0-9A-Za-z]', '', 'g');
  RETURN NEW;
END $$;


--
-- Name: pc02_dat_stt_sort_cases(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pc02_dat_stt_sort_cases() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."sttSort" := pc02_stt_sort(NEW."caseCode");
  RETURN NEW;
END $$;


--
-- Name: pc02_dat_stt_sort_incidents(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pc02_dat_stt_sort_incidents() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."sttSort" := pc02_stt_sort(NEW."code");
  RETURN NEW;
END $$;


--
-- Name: pc02_dat_stt_sort_petitions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pc02_dat_stt_sort_petitions() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."sttSort" := pc02_stt_sort(NEW."stt");
  RETURN NEW;
END $$;


--
-- Name: pc02_dat_tim_kiem_address_mappings(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pc02_dat_tim_kiem_address_mappings() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."old_ward_bd" := ' ' || f_bo_dau(NEW."oldWard");
  NEW."old_district_bd" := ' ' || f_bo_dau(NEW."oldDistrict");
  NEW."new_ward_bd" := ' ' || f_bo_dau(NEW."newWard");
  NEW."note_bd" := ' ' || f_bo_dau(NEW."note");
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."oldWard", NEW."oldDistrict", NEW."newWard", NEW."province", NEW."note"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_address_mappings: %', SQLERRM;
  NEW."old_ward_bd" := NULL;
  NEW."old_district_bd" := NULL;
  NEW."new_ward_bd" := NULL;
  NEW."note_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;


--
-- Name: pc02_dat_tim_kiem_audit_logs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pc02_dat_tim_kiem_audit_logs() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."action", NEW."subject", NEW."subjectId", NEW."ipAddress"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_audit_logs: %', SQLERRM;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;


--
-- Name: pc02_dat_tim_kiem_cases(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pc02_dat_tim_kiem_cases() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."nguon_don_bd" := ' ' || f_bo_dau(NEW."nguonDon");
  NEW."ten_cung_cap_bd" := ' ' || f_bo_dau(NEW."tenCungCap");
  NEW."mo_ta_chi_tiet_bd" := ' ' || f_bo_dau(NEW."moTaChiTiet");
  NEW."don_vi_giai_quyet_bd" := ' ' || f_bo_dau(NEW."donViGiaiQuyet");
  NEW."ket_qua_xu_ly_khac_bd" := ' ' || f_bo_dau(NEW."ketQuaXuLyKhac");
  NEW."don_vi_giao_bd" := ' ' || f_bo_dau(NEW."don_vi_giao");
  NEW."so_quyet_dinh_uy_thac_bd" := ' ' || f_bo_dau(NEW."so_quyet_dinh_uy_thac");
  NEW."nghi_van_doi_tuong_bd" := ' ' || f_bo_dau(NEW."nghiVanDoiTuong");
  NEW."ket_qua_uy_thac_bd" := ' ' || f_bo_dau(NEW."ket_qua_uy_thac");
  NEW."crime_bd" := ' ' || f_bo_dau(NEW."crime");
  NEW."name_bd" := ' ' || f_bo_dau(NEW."name");
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."caseCode", NEW."sttCu", NEW."nguonDon", NEW."tenCungCap", NEW."moTaChiTiet", NEW."donViGiaiQuyet", NEW."ketQuaXuLyKhac", NEW."don_vi_giao", NEW."so_quyet_dinh_uy_thac", NEW."nghiVanDoiTuong", NEW."ket_qua_uy_thac", NEW."crime", NEW."name", NEW."soHoSoCu"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_cases: %', SQLERRM;
  NEW."nguon_don_bd" := NULL;
  NEW."ten_cung_cap_bd" := NULL;
  NEW."mo_ta_chi_tiet_bd" := NULL;
  NEW."don_vi_giai_quyet_bd" := NULL;
  NEW."ket_qua_xu_ly_khac_bd" := NULL;
  NEW."don_vi_giao_bd" := NULL;
  NEW."so_quyet_dinh_uy_thac_bd" := NULL;
  NEW."nghi_van_doi_tuong_bd" := NULL;
  NEW."ket_qua_uy_thac_bd" := NULL;
  NEW."crime_bd" := NULL;
  NEW."name_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;


--
-- Name: pc02_dat_tim_kiem_crimes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pc02_dat_tim_kiem_crimes() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."name_bd" := ' ' || f_bo_dau(NEW."name");
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."code", NEW."name"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_crimes: %', SQLERRM;
  NEW."name_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;


--
-- Name: pc02_dat_tim_kiem_delegations(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pc02_dat_tim_kiem_delegations() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."content_bd" := ' ' || f_bo_dau(NEW."content");
  NEW."receiving_unit_bd" := ' ' || f_bo_dau(NEW."receivingUnit");
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."delegationNumber", NEW."content", NEW."receivingUnit"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_delegations: %', SQLERRM;
  NEW."content_bd" := NULL;
  NEW."receiving_unit_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;


--
-- Name: pc02_dat_tim_kiem_directories(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pc02_dat_tim_kiem_directories() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."name_bd" := ' ' || f_bo_dau(NEW."name");
  NEW."description_bd" := ' ' || f_bo_dau(NEW."description");
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."code", NEW."name", NEW."description"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_directories: %', SQLERRM;
  NEW."name_bd" := NULL;
  NEW."description_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;


--
-- Name: pc02_dat_tim_kiem_documents(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pc02_dat_tim_kiem_documents() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."title_bd" := ' ' || f_bo_dau(NEW."title");
  NEW."original_name_bd" := ' ' || f_bo_dau(NEW."originalName");
  NEW."description_bd" := ' ' || f_bo_dau(NEW."description");
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."title", NEW."originalName", NEW."description"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_documents: %', SQLERRM;
  NEW."title_bd" := NULL;
  NEW."original_name_bd" := NULL;
  NEW."description_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;


--
-- Name: pc02_dat_tim_kiem_exchanges(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pc02_dat_tim_kiem_exchanges() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."record_type_bd" := ' ' || f_bo_dau(NEW."recordType");
  NEW."sender_unit_bd" := ' ' || f_bo_dau(NEW."senderUnit");
  NEW."receiver_unit_bd" := ' ' || f_bo_dau(NEW."receiverUnit");
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."recordCode", NEW."recordType", NEW."senderUnit", NEW."receiverUnit", NEW."subject"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_exchanges: %', SQLERRM;
  NEW."record_type_bd" := NULL;
  NEW."sender_unit_bd" := NULL;
  NEW."receiver_unit_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;


--
-- Name: pc02_dat_tim_kiem_guidance_records(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pc02_dat_tim_kiem_guidance_records() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."subject_bd" := ' ' || f_bo_dau(NEW."subject");
  NEW."unit_bd" := ' ' || f_bo_dau(NEW."unit");
  NEW."nguoi_duoc_huong_dan_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."guidedPerson", NEW."guidedPersonPhone"));
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."subject", NEW."unit", NEW."guidedPerson", NEW."guidedPersonPhone", NEW."guidanceContent"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_guidance_records: %', SQLERRM;
  NEW."subject_bd" := NULL;
  NEW."unit_bd" := NULL;
  NEW."nguoi_duoc_huong_dan_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;


--
-- Name: pc02_dat_tim_kiem_incidents(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pc02_dat_tim_kiem_incidents() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."chuyen_tu_don_vi_bd" := ' ' || f_bo_dau(NEW."chuyenTuDonVi");
  NEW."ben_vu_bd" := ' ' || f_bo_dau(NEW."benVu");
  NEW."description_bd" := ' ' || f_bo_dau(NEW."description");
  NEW."don_vi_giai_quyet_bd" := ' ' || f_bo_dau(NEW."donViGiaiQuyet");
  NEW."ket_qua_xu_ly_bd" := ' ' || f_bo_dau(NEW."ketQuaXuLy");
  NEW."name_bd" := ' ' || f_bo_dau(NEW."name");
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."code", NEW."sttCu", NEW."chuyenTuDonVi", NEW."benVu", NEW."description", NEW."donViGiaiQuyet", NEW."ketQuaXuLy", NEW."name", NEW."doiTuongCaNhan", NEW."doiTuongToChuc", NEW."soHoSoCu", NEW."ngay_viet_don_chu"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_incidents: %', SQLERRM;
  NEW."chuyen_tu_don_vi_bd" := NULL;
  NEW."ben_vu_bd" := NULL;
  NEW."description_bd" := NULL;
  NEW."don_vi_giai_quyet_bd" := NULL;
  NEW."ket_qua_xu_ly_bd" := NULL;
  NEW."name_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;


--
-- Name: pc02_dat_tim_kiem_lawyers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pc02_dat_tim_kiem_lawyers() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."full_name_bd" := ' ' || f_bo_dau(NEW."fullName");
  NEW."bar_number_bd" := ' ' || f_bo_dau(NEW."barNumber");
  NEW."law_firm_bd" := ' ' || f_bo_dau(NEW."lawFirm");
  NEW."phone_bd" := ' ' || f_bo_dau(NEW."phone");
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."fullName", NEW."barNumber", NEW."lawFirm", NEW."phone"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_lawyers: %', SQLERRM;
  NEW."full_name_bd" := NULL;
  NEW."bar_number_bd" := NULL;
  NEW."law_firm_bd" := NULL;
  NEW."phone_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;


--
-- Name: pc02_dat_tim_kiem_petitions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pc02_dat_tim_kiem_petitions() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."loai_thong_tin_bd" := ' ' || f_bo_dau(NEW."loaiThongTin");
  NEW."nguon_don_bd" := ' ' || f_bo_dau(NEW."nguonDon");
  NEW."sender_name_bd" := ' ' || f_bo_dau(NEW."senderName");
  NEW."detail_content_bd" := ' ' || f_bo_dau(NEW."detailContent");
  NEW."don_vi_giai_quyet_bd" := ' ' || f_bo_dau(NEW."donViGiaiQuyet");
  NEW."ket_qua_xu_ly_khac_bd" := ' ' || f_bo_dau(NEW."ketQuaXuLyKhac");
  NEW."suspected_person_bd" := ' ' || f_bo_dau(NEW."suspectedPerson");
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."stt", NEW."sttCu", NEW."loaiThongTin", NEW."nguonDon", NEW."senderName", NEW."detailContent", NEW."donViGiaiQuyet", NEW."ketQuaXuLyKhac", NEW."suspectedPerson", NEW."soHoSoCu", NEW."ngay_viet_don_chu"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_petitions: %', SQLERRM;
  NEW."loai_thong_tin_bd" := NULL;
  NEW."nguon_don_bd" := NULL;
  NEW."sender_name_bd" := NULL;
  NEW."detail_content_bd" := NULL;
  NEW."don_vi_giai_quyet_bd" := NULL;
  NEW."ket_qua_xu_ly_khac_bd" := NULL;
  NEW."suspected_person_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;


--
-- Name: pc02_dat_tim_kiem_proposals(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pc02_dat_tim_kiem_proposals() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."content_bd" := ' ' || f_bo_dau(NEW."content");
  NEW."unit_bd" := ' ' || f_bo_dau(NEW."unit");
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."proposalNumber", NEW."content", NEW."unit"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_proposals: %', SQLERRM;
  NEW."content_bd" := NULL;
  NEW."unit_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;


--
-- Name: pc02_dat_tim_kiem_subjects(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pc02_dat_tim_kiem_subjects() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."full_name_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."fullName"));
  NEW."id_number_bd" := ' ' || f_bo_dau(NEW."idNumber");
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."fullName", NEW."idNumber", NEW."address", NEW."phone"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_subjects: %', SQLERRM;
  NEW."full_name_bd" := NULL;
  NEW."id_number_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;


--
-- Name: pc02_dat_tim_kiem_users(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pc02_dat_tim_kiem_users() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."ho_ten_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."lastName", NEW."firstName", NEW."username"));
  NEW."email_bd" := ' ' || f_bo_dau(NEW."email");
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."workId", NEW."lastName", NEW."firstName", NEW."username", NEW."email"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_users: %', SQLERRM;
  NEW."ho_ten_bd" := NULL;
  NEW."email_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;


--
-- Name: pc02_stt_sort(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pc02_stt_sort(ma text) RETURNS integer
    LANGUAGE sql IMMUTABLE
    AS $_$
  SELECT CASE
    -- Giới hạn 5 chữ số: hậu tố dài hơn thì phép nhân tràn sang phần NĂM và cho ra thứ tự
    -- sai, còn hậu tố quá lớn làm số nguyên tràn và CHẶN cả lệnh ghi — Postgres ném lỗi chứ
    -- không trả NULL, nên một mã méo nhập từ Excel đủ hỏng nguyên lần nhập. Mã thật lớn nhất
    -- có 5 chữ số (2026-11171) và hệ cũ chỉ ~11.000 hồ sơ mỗi năm, nên ngưỡng này rộng gấp
    -- chín lần thực tế mà vẫn nằm gọn trong `integer`.
    --
    -- Kiểu `integer` chứ không `bigint`: `BigInt` của Prisma ra `bigint` của JavaScript, mà
    -- `JSON.stringify` ném lỗi với kiểu ấy — mở một hồ sơ là lỗi 500.
    -- Năm phải nằm trong khoảng hợp lý. Một mã gõ nhầm "3026-15" vẫn đúng hình dạng, và nếu
    -- tính ra số thì hồ sơ ấy chiếm ĐẦU danh sách sắp giảm dần — đúng thứ mà cột sắp ngày
    -- `sortReceivedDate` đã chặn bằng khoảng 1900–2100 từ 24/08/2026.
    WHEN ma ~ '^[0-9]{4}-[0-9]{1,5}$'
     AND split_part(ma, '-', 1)::integer BETWEEN 1900 AND 2100
      THEN split_part(ma, '-', 1)::integer * 100000 + split_part(ma, '-', 2)::integer
    ELSE NULL
  END
$_$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: address_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.address_mappings (
    id text NOT NULL,
    "oldWard" text NOT NULL,
    "oldDistrict" text NOT NULL,
    "newWard" text NOT NULL,
    province text NOT NULL,
    note text,
    "isActive" boolean DEFAULT true NOT NULL,
    "needsReview" boolean DEFAULT false NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    "seededAt" timestamp(3) without time zone,
    candidates jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    old_ward_bd text,
    old_district_bd text,
    new_ward_bd text,
    note_bd text,
    tim_kiem_bd text
);


--
-- Name: address_seed_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.address_seed_jobs (
    id text NOT NULL,
    province text NOT NULL,
    status text NOT NULL,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "totalWards" integer DEFAULT 0 NOT NULL,
    "mappedCount" integer DEFAULT 0 NOT NULL,
    "errorCount" integer DEFAULT 0 NOT NULL,
    "needsReview" integer DEFAULT 0 NOT NULL,
    "cancelToken" text,
    "errorLog" text,
    "triggeredBy" text NOT NULL
);


--
-- Name: admin_unit_dataset_imports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_unit_dataset_imports (
    version text NOT NULL,
    status text NOT NULL,
    checksum text NOT NULL,
    "addedProvinces" integer DEFAULT 0 NOT NULL,
    "addedWards" integer DEFAULT 0 NOT NULL,
    "updatedWards" integer DEFAULT 0 NOT NULL,
    "abolishedWards" integer DEFAULT 0 NOT NULL,
    "importedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "completedAt" timestamp without time zone,
    "errorMessage" text
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    "userId" text,
    action text NOT NULL,
    subject text,
    "subjectId" text,
    metadata jsonb,
    "ipAddress" text,
    "userAgent" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "bulkOperationId" text,
    tim_kiem_bd text
);

ALTER TABLE ONLY public.audit_logs FORCE ROW LEVEL SECURITY;


--
-- Name: bulk_import_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bulk_import_jobs (
    id text NOT NULL,
    "generatedBy" text NOT NULL,
    "sourceFilename" text NOT NULL,
    "sourceSha256" text NOT NULL,
    "totalRows" integer NOT NULL,
    "successRows" integer DEFAULT 0 NOT NULL,
    "errorRows" integer DEFAULT 0 NOT NULL,
    status text NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    "rowOutcomes" jsonb,
    "originalFilePath" text,
    "enrichedFilePath" text,
    "downloadCount" integer DEFAULT 0 NOT NULL,
    "errorMessage" text,
    "startedAt" timestamp(3) without time zone,
    "finishedAt" timestamp(3) without time zone,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: bulk_operations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bulk_operations (
    id text NOT NULL,
    "actorId" text,
    resource text NOT NULL,
    action text NOT NULL,
    status public."BulkOperationStatus" DEFAULT 'STARTED'::public."BulkOperationStatus" NOT NULL,
    "idempotencyKey" text,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "succeededCount" integer DEFAULT 0 NOT NULL,
    "skippedCount" integer DEFAULT 0 NOT NULL,
    "failedCount" integer DEFAULT 0 NOT NULL
);


--
-- Name: calendar_event_occurrence_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_event_occurrence_overrides (
    id text NOT NULL,
    "eventId" text NOT NULL,
    "occurrenceDate" date NOT NULL,
    excluded boolean DEFAULT false NOT NULL,
    "overrideFields" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: calendar_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_events (
    id text NOT NULL,
    title text NOT NULL,
    "shortTitle" text,
    description text,
    "startDate" date NOT NULL,
    "endDate" date,
    "startTime" text,
    "endTime" text,
    "allDay" boolean DEFAULT true NOT NULL,
    "isOfficialDayOff" boolean DEFAULT false NOT NULL,
    "lunarDate" text,
    "categoryId" text NOT NULL,
    scope public."EventScope" NOT NULL,
    "teamId" text,
    "userId" text,
    "recurrenceRule" text,
    "recurrenceEndDate" date,
    "createdById" text NOT NULL,
    "updatedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);


--
-- Name: case_provenance_backfill_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_provenance_backfill_audit (
    case_id text NOT NULL,
    detected_source text NOT NULL,
    inconsistency text,
    metadata_snapshot jsonb,
    backfilled_at timestamp(3) without time zone DEFAULT now() NOT NULL
);


--
-- Name: case_statistics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_statistics (
    id text NOT NULL,
    "caseId" text NOT NULL,
    "soDangKyHoSo" text,
    "ngayDangKyHoSo" timestamp(3) without time zone,
    "hoSoLuu" text,
    "ngayNopLuuHoSo" timestamp(3) without time zone,
    "donViBaoQuanHoSo" text,
    "coGhiAmGhiHinh" boolean DEFAULT false NOT NULL,
    "tongSoBienBanGhiLoiKhai" integer,
    "soBienBanGhiLoiKhaiCoGhiAm" integer,
    "laVuAnGhiAmGhiHinh" boolean DEFAULT false NOT NULL,
    "tongSoBienBanHoiCung" integer,
    "tongSoBienBanHoiCungCoGhiAm" integer,
    "soBiCanCoGhiAm" integer,
    "vksYeuCauGhiAm" boolean DEFAULT false NOT NULL,
    "soBiCanVksYeuCauGhiAm" integer,
    "coVPHC" boolean DEFAULT false NOT NULL,
    "soDoiTuongVPHC" integer,
    "soNguoiBiPhatTien" integer,
    "tongTienPhatHanhChinh" double precision,
    "soDoiTuongDaBat" integer,
    "soDoiTuongBiBatVuAnKhac" integer,
    "dieuTraMoRong" integer,
    "suDungVuKhiNong" text,
    "coBangNhom" boolean DEFAULT false NOT NULL,
    "soBangNhomBatDuoc" integer,
    "soSungThuHoi" integer,
    "soThuocNoThuHoi" integer,
    "soDoiTuongSuuTraHiemNghi" integer,
    "ngayThongKe" timestamp(3) without time zone,
    "ngayPhanCongGiaiQuyetToGiac" timestamp(3) without time zone,
    "ngayTiepNhanTin" timestamp(3) without time zone,
    "ngayDauThu" timestamp(3) without time zone,
    "ngayPhamToiQuaTang" timestamp(3) without time zone,
    "ngayBatKhanCap" timestamp(3) without time zone,
    "ngayPhatHienDauHieu" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "soLuongBiHai" integer,
    "soNguoiBiThuong" integer,
    "soLuongNguoiChet" integer,
    "soTienBiThietHai" double precision,
    "soTienThuHoi" double precision,
    "vuAnDaDuocXetXu" boolean DEFAULT false NOT NULL,
    "ghiAmGhiHinhDaDuocXetXu" boolean,
    "coSuDungKQGhiAmTrongXetXu" boolean,
    "khongGAGHNhungToaYeuCau" boolean,
    "soDoiTuong" integer,
    "soBangNhom" integer
);


--
-- Name: case_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_status_history (
    id text NOT NULL,
    "caseId" text NOT NULL,
    "fromStatus" public.case_status,
    "toStatus" public.case_status NOT NULL,
    "changedById" text,
    "changedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cases (
    id text NOT NULL,
    name text NOT NULL,
    crime text,
    status public.case_status DEFAULT 'TIEP_NHAN'::public.case_status NOT NULL,
    "investigatorId" text,
    deadline timestamp(3) without time zone,
    unit text,
    "subjectsCount" integer DEFAULT 0 NOT NULL,
    metadata jsonb,
    "capDoToiPham" public."CapDoToiPham",
    "ngayKhoiTo" timestamp(3) without time zone,
    "deletedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "laCongNgheCao" boolean DEFAULT false NOT NULL,
    "lyDoTamDinhChiText" text,
    "lyDoTamDinhChiVuAn" public.ly_do_tam_dinh_chi_vu_an[] DEFAULT '{}'::public.ly_do_tam_dinh_chi_vu_an[] NOT NULL,
    "soQuyetDinhTamDinhChi" text,
    "ngayTamDinhChi" timestamp(3) without time zone,
    "soLanTamDinhChi" integer DEFAULT 0 NOT NULL,
    "soLanGiaHan" integer DEFAULT 0 NOT NULL,
    "daRaSoat" boolean DEFAULT false NOT NULL,
    "ngayRaSoat" timestamp(3) without time zone,
    "soQuyetDinhPhucHoi" text,
    "ngayPhucHoi" timestamp(3) without time zone,
    "ketQuaPhucHoiVuAn" public.ket_qua_phuc_hoi_vu_an,
    "ngayHetThoiHieu" timestamp(3) without time zone,
    "assignedTeamId" text,
    "createdById" text,
    "editedAfterWindow" boolean DEFAULT false NOT NULL,
    "caseProvenance" public.case_provenance NOT NULL,
    "linkedPetitionId" text,
    "linkedIncidentId" text,
    "sourceDocumentNote" text,
    "caseCode" text,
    case_type public.case_type DEFAULT 'REGULAR'::public.case_type NOT NULL,
    don_vi_giao text,
    so_quyet_dinh_uy_thac text,
    ngay_tiep_nhan timestamp(3) without time zone,
    thoi_han_uy_thac timestamp(3) without time zone,
    loai_uy_thac public.loai_uy_thac,
    ket_qua_uy_thac text,
    ngay_tra_ket_qua timestamp(3) without time zone,
    loai_thong_tin text,
    "importLogId" text,
    "importedAt" timestamp(3) without time zone,
    "importedById" text,
    "importedFrom" text,
    "sourceFile" text,
    "tdcKhacPhucBienBan" text,
    "tdcKhacPhucLyDoBienPhap" text,
    "soQuyetDinhKhoiTo" text,
    "soQDNhapVuAn" text,
    "ngayNhapVuAn" timestamp(3) without time zone,
    "ghiChuNhapHoSo" text,
    "soQDTachVuAn" text,
    "ngayTachVuAn" timestamp(3) without time zone,
    "soQDTachHanhVi" text,
    "ngayTachHanhVi" timestamp(3) without time zone,
    "soQDDinhChiVuAn" text,
    "ngayDinhChiVuAn" timestamp(3) without time zone,
    "chuyenVuAnChoCQK" text,
    "soBanAnCoHieuLuc" text,
    "ngayBanAnCoHieuLuc" timestamp(3) without time zone,
    "canCuTamDinhChiVuAn" text,
    "canCuPhucHoiVuAn" text,
    "legacySourceId" text,
    "soKLDT" text,
    "ngayKLDT" timestamp(3) without time zone,
    "soQDDieuTraLai" text,
    "ngayQDDieuTraLai" timestamp(3) without time zone,
    ghi_chu_khac text,
    toi_danh_khac_ids text[] DEFAULT ARRAY[]::text[] NOT NULL,
    legacy_raw jsonb,
    "crimeChinhId" text,
    "soHoSoCu" text,
    "legacyId" integer,
    "legacyCollection" text,
    "sttCu" text,
    "ngayDeXuat" timestamp(3) without time zone,
    "moTaChiTiet" text,
    "nguonDon" text,
    "tenCungCap" text,
    "sinhNamCungCap" text,
    "cccdCungCap" text,
    "ngayCapCccd" timestamp(3) without time zone,
    "noiCapCccd" text,
    "sdtCungCap" text,
    "diaChiCungCap" text,
    "nghiVanDoiTuong" text,
    "nhanXet" text,
    "noiXayRa" text,
    "phuongThucThuDoan" text,
    "ketQuaXuLyKhac" text,
    "soPhieuChuyen" text,
    "ngayPhieuChuyen" timestamp(3) without time zone,
    "doVatTaiLieuKemTheo" text,
    "ngayVietDon" timestamp(3) without time zone,
    "ghiChuTrungDon" text,
    "baoCaoBanGiamDoc" boolean,
    "ngayGiaoDonViGiaiQuyet" timestamp(3) without time zone,
    "lanhDaoToTung" text,
    "dieuTraVien" text,
    "phanLoaiToiPhamLinhVuc" text,
    "phanLoaiHoSoNoiBo" text,
    "deXuat" text,
    "yeuCauBoSung" text,
    "reporterDateOfBirth" timestamp(3) without time zone,
    "reporterDateOfBirthPrecision" text,
    "receiveDate" timestamp(3) without time zone,
    "caseClassification" text,
    "tinhTrang" text,
    "toiDanhBanDau" text,
    "baoCaoBanGiamDocText" text,
    "canCuKhongKhoiTo" text,
    "canCuTamDinhChiNguonTin" text,
    "chuyenVuViecDonViKhac" text,
    "khacPhucLyDoTDCVuViec" text,
    "lenhNhapKho" text,
    "lyDoKhongKhoiTo" text[],
    "lyDoTamDinhChiNguonTin" text[],
    "ngayHetThoiHieuVuViec" timestamp(3) without time zone,
    "ngayPhucHoiNguonTin" timestamp(3) without time zone,
    "ngayQDKhongKhoiTo" timestamp(3) without time zone,
    "ngayQDPhanCongNguonTin" timestamp(3) without time zone,
    "ngayQDTamDinhChiNguonTin" timestamp(3) without time zone,
    "ngayXayRa" timestamp(3) without time zone,
    "nhapVaoVuViecSo" text,
    "noiLuuTruBaoQuan" text,
    "noiXayRaPhuongXa" text,
    "phanLoaiDanSu" text,
    "phanLoaiNguonTinBanDau" text,
    "soPhucHoiNguonTin" text,
    "soQDKhongKhoiTo" text,
    "soQDPhanCongNguonTin" text,
    "soQDTamDinhChiNguonTin" text,
    "tienDoKhacPhucTDCVuViec" text,
    "toiDanhChinhKhoiToId" text,
    "vatChungMoTa" text,
    "vuViecTamDungTruoc2015" boolean,
    "donViGiaiQuyet" text,
    "sttSort" integer,
    ngay_giai_quyet timestamp(3) without time zone,
    nguon_don_bd text,
    ten_cung_cap_bd text,
    mo_ta_chi_tiet_bd text,
    don_vi_giai_quyet_bd text,
    ket_qua_xu_ly_khac_bd text,
    don_vi_giao_bd text,
    so_quyet_dinh_uy_thac_bd text,
    nghi_van_doi_tuong_bd text,
    crime_bd text,
    tim_kiem_bd text,
    name_bd text,
    ngay_viet_don_edtf character varying(10),
    ngay_viet_don_chu text,
    ket_qua_uy_thac_bd text,
    utdt_has_failure_reason boolean GENERATED ALWAYS AS ((length(btrim(COALESCE((metadata ->> 'lyDoKhongThucHienDuoc'::text), ''::text))) > 0)) STORED,
    utdt_has_reply_result boolean GENERATED ALWAYS AS ((length(btrim(COALESCE(ket_qua_uy_thac, ''::text))) > 0)) STORED,
    CONSTRAINT case_provenance_fk_consistency CHECK (((("caseProvenance" = 'FROM_PETITION'::public.case_provenance) AND ("linkedPetitionId" IS NOT NULL) AND ("linkedIncidentId" IS NULL)) OR (("caseProvenance" = 'FROM_INCIDENT'::public.case_provenance) AND ("linkedIncidentId" IS NOT NULL) AND ("linkedPetitionId" IS NULL)) OR (("caseProvenance" = ANY (ARRAY['DIRECT_DISCOVERY'::public.case_provenance, 'TRANSFERRED'::public.case_provenance, 'OTHER_LEGAL_SOURCE'::public.case_provenance, 'SELF_SURRENDER'::public.case_provenance, 'PROSECUTOR_PROPOSAL'::public.case_provenance, 'UY_THAC_DIEU_TRA'::public.case_provenance])) AND ("linkedPetitionId" IS NULL) AND ("linkedIncidentId" IS NULL))))
);


--
-- Name: conclusions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conclusions (
    id text NOT NULL,
    "caseId" text NOT NULL,
    type text NOT NULL,
    content text NOT NULL,
    "authorId" text,
    "approvedById" text,
    status public.conclusion_status DEFAULT 'DU_THAO'::public.conclusion_status NOT NULL,
    notes text,
    "deletedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: crimes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crimes (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    "articleNo" integer NOT NULL,
    chapter text NOT NULL,
    "pc02Relevant" boolean DEFAULT false NOT NULL,
    "legacyValue" integer,
    "order" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    name_bd text,
    tim_kiem_bd text
);


--
-- Name: data_access_grants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_access_grants (
    id text NOT NULL,
    "granteeId" text NOT NULL,
    "teamId" text NOT NULL,
    "accessLevel" public."AccessLevel" NOT NULL,
    "grantedById" text NOT NULL,
    "expiresAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: deadline_rule_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deadline_rule_versions (
    id text NOT NULL,
    "ruleKey" text NOT NULL,
    value integer NOT NULL,
    label text NOT NULL,
    "legalBasis" text NOT NULL,
    "documentType" text NOT NULL,
    "documentNumber" text NOT NULL,
    "documentIssuer" text NOT NULL,
    "documentDate" timestamp(3) without time zone,
    "attachmentId" text,
    "documentUrl" text,
    "migrationConfidence" text,
    reason text NOT NULL,
    status public.deadline_rule_status DEFAULT 'draft'::public.deadline_rule_status NOT NULL,
    "effectiveFrom" timestamp(3) without time zone,
    "effectiveTo" timestamp(3) without time zone,
    "supersedesId" text,
    "proposedById" text,
    "proposedByType" text DEFAULT 'USER'::text NOT NULL,
    "proposedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "reviewedById" text,
    "reviewedAt" timestamp(3) without time zone,
    "reviewNotes" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "withdrawNotes" text
);


--
-- Name: delegations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delegations (
    id text NOT NULL,
    "delegationNumber" text NOT NULL,
    "delegationDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "receivingUnit" text NOT NULL,
    content text NOT NULL,
    "createdById" text,
    status public.delegation_status DEFAULT 'PENDING'::public.delegation_status NOT NULL,
    "completedDate" timestamp(3) without time zone,
    "relatedCaseId" text,
    notes text,
    "deletedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "assignedToId" text,
    "legacySourceId" text,
    "legacyRaw" jsonb,
    content_bd text,
    receiving_unit_bd text,
    tim_kiem_bd text
);


--
-- Name: directories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directories (
    id text NOT NULL,
    type text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    "parentId" text,
    "order" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "abolishedAt" timestamp(3) without time zone,
    "replacedByCode" text,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "officialCode" text,
    "sourceVersion" text,
    "legalBasis" text,
    "importedAt" timestamp without time zone,
    name_bd text,
    description_bd text,
    tim_kiem_bd text
);


--
-- Name: document_number_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_number_counters (
    id text NOT NULL,
    "templateId" text NOT NULL,
    "periodKey" text NOT NULL,
    "currentValue" integer DEFAULT 0 NOT NULL,
    "resetAt" timestamp(3) without time zone,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: document_number_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_number_logs (
    id text NOT NULL,
    "templateId" text NOT NULL,
    "generatedNumber" text NOT NULL,
    "documentType" text NOT NULL,
    "documentId" text,
    "userId" text NOT NULL,
    "isDraft" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: document_number_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_number_templates (
    id text NOT NULL,
    name text NOT NULL,
    "documentType" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    separator text DEFAULT '-'::text NOT NULL,
    "inputMode" text DEFAULT 'AUTO'::text NOT NULL,
    segments jsonb NOT NULL,
    "counterConfig" jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdById" text NOT NULL
);


--
-- Name: document_render_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_render_logs (
    id text NOT NULL,
    "petitionId" text,
    "caseId" text,
    "incidentId" text,
    "documentType" text NOT NULL,
    "templateSha" text NOT NULL,
    "renderedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "renderedById" text NOT NULL,
    "generatedNumber" text,
    "fileSha" text
);


--
-- Name: document_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_templates (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    "entityType" text NOT NULL,
    category text NOT NULL,
    "fileBytes" bytea NOT NULL,
    "fileSha" text NOT NULL,
    "fileName" text NOT NULL,
    variables jsonb DEFAULT '[]'::jsonb NOT NULL,
    "needsNumber" boolean DEFAULT false NOT NULL,
    "numberSeriesId" text,
    status text DEFAULT 'active'::text NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    format text DEFAULT 'DOCX'::text NOT NULL,
    "delimStart" text DEFAULT '{'::text NOT NULL,
    "delimEnd" text DEFAULT '}'::text NOT NULL,
    "selectedByDefault" boolean DEFAULT false NOT NULL
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    "fileName" text NOT NULL,
    "originalName" text NOT NULL,
    "mimeType" text NOT NULL,
    size integer NOT NULL,
    "filePath" text NOT NULL,
    "documentType" text DEFAULT 'VAN_BAN'::text NOT NULL,
    "caseId" text,
    "incidentId" text,
    "uploadedById" text NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "petitionId" text,
    title_bd text,
    original_name_bd text,
    description_bd text,
    tim_kiem_bd text,
    "recordedAt" text
);


--
-- Name: edit_window_reset_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.edit_window_reset_requests (
    id text NOT NULL,
    "subjectType" text NOT NULL,
    "subjectId" text NOT NULL,
    "requestedById" text NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "reviewedById" text,
    "reviewNote" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "reviewedAt" timestamp(3) without time zone
);


--
-- Name: enrollment_token_audits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrollment_token_audits (
    id text NOT NULL,
    "userId" text NOT NULL,
    "generatedBy" text NOT NULL,
    "generatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "consumedAt" timestamp(3) without time zone,
    "consumedIp" text,
    "consumedUa" text,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "channelHint" text
);


--
-- Name: event_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_categories (
    id text NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    color text NOT NULL,
    icon text,
    "isSystem" boolean DEFAULT false NOT NULL,
    "sortOrder" integer DEFAULT 100 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: event_reminder_dispatches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_reminder_dispatches (
    id text NOT NULL,
    "reminderId" text NOT NULL,
    "occurrenceDate" date NOT NULL,
    "sentAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    channels public."ReminderChannel"[]
);


--
-- Name: event_reminders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_reminders (
    id text NOT NULL,
    "eventId" text NOT NULL,
    "userId" text NOT NULL,
    "minutesBefore" integer NOT NULL,
    channels public."ReminderChannel"[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: evidences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evidences (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    quantity integer DEFAULT 1 NOT NULL,
    unit text DEFAULT 'cái'::text NOT NULL,
    "storageLocation" text,
    "receivedDate" timestamp(3) without time zone,
    status text DEFAULT 'THU_GIU'::text NOT NULL,
    "evidenceType" text,
    "entryOrder" text,
    "warehouseReceipt" text,
    "caseId" text NOT NULL,
    "createdById" text,
    "deletedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: exchange_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exchange_messages (
    id text NOT NULL,
    "exchangeId" text NOT NULL,
    "senderId" text,
    content text NOT NULL,
    attachments jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: exchanges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exchanges (
    id text NOT NULL,
    "recordCode" text,
    "recordType" text,
    "senderUnit" text,
    "receiverUnit" text,
    subject text,
    status public.exchange_status DEFAULT 'OPEN'::public.exchange_status NOT NULL,
    "createdById" text,
    "deletedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "legacySourceId" text,
    "legacyRaw" jsonb,
    record_type_bd text,
    sender_unit_bd text,
    receiver_unit_bd text,
    tim_kiem_bd text
);


--
-- Name: feature_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feature_flags (
    key text NOT NULL,
    label text NOT NULL,
    description text,
    enabled boolean DEFAULT true NOT NULL,
    domain text,
    "rolloutPct" integer DEFAULT 100 NOT NULL,
    metadata jsonb,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: guidance_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guidance_records (
    id text NOT NULL,
    date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    unit text,
    "createdById" text,
    "guidedPerson" text NOT NULL,
    "guidedPersonPhone" text,
    subject text,
    "guidanceContent" text NOT NULL,
    notes text,
    status public.guidance_status DEFAULT 'PENDING'::public.guidance_status NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "legacySourceId" text,
    "legacyRaw" jsonb,
    subject_bd text,
    unit_bd text,
    nguoi_duoc_huong_dan_bd text,
    tim_kiem_bd text
);


--
-- Name: incident_handoffs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incident_handoffs (
    id text NOT NULL,
    "incidentId" text NOT NULL,
    "fromTeamId" text,
    "toTeamId" text NOT NULL,
    "priorIntakeStage" public."IncidentIntakeStage",
    state public."IncidentHandoffState" DEFAULT 'PENDING'::public."IncidentHandoffState" NOT NULL,
    "sentById" text NOT NULL,
    "sentAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "receivedById" text,
    "receivedAt" timestamp(3) without time zone,
    "cancelledById" text,
    "cancelledAt" timestamp(3) without time zone,
    reason text,
    "requestKey" text NOT NULL,
    "requestHash" text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: incident_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incident_status_history (
    id text NOT NULL,
    "incidentId" text NOT NULL,
    "fromStatus" public.incident_status NOT NULL,
    "toStatus" public.incident_status NOT NULL,
    "changedById" text NOT NULL,
    note text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incidents (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    "incidentType" text,
    description text,
    "fromDate" timestamp(3) without time zone,
    "toDate" timestamp(3) without time zone,
    deadline timestamp(3) without time zone,
    "unitId" text,
    "investigatorId" text,
    status public.incident_status DEFAULT 'TIEP_NHAN'::public.incident_status NOT NULL,
    "sourcePetitionId" text,
    "doiTuongCaNhan" text,
    "doiTuongToChuc" text,
    "loaiDonVu" public."LoaiNguonTin",
    "benVu" text,
    "donViGiaiQuyet" text,
    "ngayDeXuat" timestamp(3) without time zone,
    "ketQuaXuLy" text,
    "tinhTrangHoSo" text,
    "tinhTrangThoiHieu" text,
    "nguoiQuyetDinh" text,
    "chuyenDenDonVi" text,
    "chuyenTuDonVi" text,
    "soQuyetDinh" text,
    "ngayQuyetDinh" timestamp(3) without time zone,
    "soLanGiaHan" integer DEFAULT 0 NOT NULL,
    "ngayGiaHan" timestamp(3) without time zone,
    "lyDoKhongKhoiTo" public."LyDoKhongKhoiTo"[] DEFAULT '{}'::public."LyDoKhongKhoiTo"[] NOT NULL,
    "lyDoTamDinhChiText" text,
    "lyDoTamDinhChiVuViec" public.ly_do_tam_dinh_chi_vu_viec[] DEFAULT '{}'::public.ly_do_tam_dinh_chi_vu_viec[] NOT NULL,
    "laCongNgheCaoVV" boolean DEFAULT false NOT NULL,
    "soQuyetDinhTamDinhChiVV" text,
    "ngayTamDinhChiVV" timestamp(3) without time zone,
    "soLanTamDinhChiVV" integer DEFAULT 0 NOT NULL,
    "daRaSoatVV" boolean DEFAULT false NOT NULL,
    "ngayRaSoatVV" timestamp(3) without time zone,
    "soQuyetDinhPhucHoiVV" text,
    "ngayPhucHoiVV" timestamp(3) without time zone,
    "ketQuaPhucHoiVuViec" public.ket_qua_phuc_hoi_vu_viec,
    "ngayHetThoiHieuVV" timestamp(3) without time zone,
    "diaChiXayRa" text,
    "sdtNguoiToGiac" text,
    "diaChiNguoiToGiac" text,
    "cmndNguoiToGiac" text,
    "mergedIntoId" text,
    "linkedCaseId" text,
    "deadlineRuleVersionId" text,
    "maxExtensionsSnapshot" integer,
    "giaHan1RuleVersionId" text,
    "giaHan2RuleVersionId" text,
    "canBoNhapId" text,
    "createdById" text,
    "deletedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "assignedTeamId" text,
    "nguonPhatTin" public."NguonPhatTin",
    "phuongThucTiepNhan" public."PhuongThucTiepNhan",
    "editedAfterWindow" boolean DEFAULT false NOT NULL,
    "loaiKetQua" text,
    "canCuKhoiToCode" text,
    "importLogId" text,
    "importedAt" timestamp(3) without time zone,
    "importedById" text,
    "importedFrom" text,
    "sourceFile" text,
    "tdcKhacPhucBienBan" text,
    "tdcKhacPhucLyDoBienPhap" text,
    "soQDPhanCongNguonTin" text,
    "ngayQDPhanCongNguonTin" timestamp(3) without time zone,
    "canCuKhongKhoiTo" text,
    "canCuTamDinhChi" text,
    "phanLoaiDanSuText" text,
    "legacySourceId" text,
    "tienDoKhacPhucTDC" text,
    "legacyRaw" jsonb,
    "soQDKhongKhoiTo" text,
    "ngayQDKhongKhoiTo" timestamp(3) without time zone,
    "xacDinhVuViecTamDung" boolean DEFAULT false NOT NULL,
    "soHoSoCu" text,
    "legacyId" integer,
    "legacyCollection" text,
    "sttCu" text,
    "sinhNamNguoiToGiac" text,
    metadata jsonb,
    "nhanXet" text,
    "ngayTiepNhanNguonTin" timestamp(3) without time zone,
    "loaiThongTin" text,
    "ngayVietDon" timestamp(3) without time zone,
    "ghiChuTrungDon" text,
    "baoCaoBanGiamDoc" boolean,
    "ngayGiaoDonViGiaiQuyet" timestamp(3) without time zone,
    "toiDanhBanDau" text,
    "soPhieuChuyen" text,
    "ngayPhieuChuyen" timestamp(3) without time zone,
    "doVatTaiLieuKemTheo" text,
    "phanLoaiToiPhamLinhVuc" text,
    "phanLoaiHoSoNoiBo" text,
    "lanhDaoToTung" text,
    "dieuTraVien" text,
    "dieuTraVienPhuongXa" text,
    "noiCapCccd" text,
    "ngayCapCccd" timestamp(3) without time zone,
    "deXuat" text,
    "yeuCauBoSung" text,
    "ghiChuKhac" text,
    "crimeChinhId" text,
    "phanLoaiNguonTinBanDau" text,
    "baoCaoBanGiamDocText" text,
    "sttSort" integer,
    ngay_giai_quyet timestamp(3) without time zone,
    chuyen_tu_don_vi_bd text,
    ben_vu_bd text,
    description_bd text,
    don_vi_giai_quyet_bd text,
    ket_qua_xu_ly_bd text,
    tim_kiem_bd text,
    name_bd text,
    ngay_viet_don_edtf character varying(10),
    ngay_viet_don_chu text,
    "createRequestKey" text,
    "createRequestHash" text,
    sdt_nguoi_to_giac_norm text,
    cmnd_nguoi_to_giac_norm text,
    "intakeStage" public."IncidentIntakeStage",
    "handledIncidentId" text,
    CONSTRAINT incidents_intake_not_self CHECK ((("handledIncidentId" IS NULL) OR ("handledIncidentId" <> id)))
);


--
-- Name: investigation_supplements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.investigation_supplements (
    id text NOT NULL,
    "caseId" text NOT NULL,
    type text NOT NULL,
    "decisionNumber" text NOT NULL,
    "decisionDate" timestamp(3) without time zone,
    reason text NOT NULL,
    deadline timestamp(3) without time zone,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "legacySourceId" text,
    "legacyId" integer,
    "legacyCollection" text,
    "ngayTiepNhanDTBS" timestamp(3) without time zone,
    "ngayTraHoSoToaAn" timestamp(3) without time zone,
    "ngayTraHoSoVKS" timestamp(3) without time zone
);


--
-- Name: lawyers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lawyers (
    id text NOT NULL,
    "fullName" text NOT NULL,
    "lawFirm" text,
    "barNumber" text NOT NULL,
    phone text,
    "caseId" text NOT NULL,
    "subjectId" text,
    "deletedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "legacySourceId" text,
    "legacyRaw" jsonb,
    full_name_bd text,
    bar_number_bd text,
    law_firm_bd text,
    phone_bd text,
    tim_kiem_bd text
);


--
-- Name: legacy_field_diagnostics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.legacy_field_diagnostics (
    id text NOT NULL,
    "runId" text NOT NULL,
    field text NOT NULL,
    raw text NOT NULL,
    parsed text,
    "precision" text,
    reason text,
    count integer DEFAULT 1 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: legacy_import_errors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.legacy_import_errors (
    id text NOT NULL,
    "runId" text NOT NULL,
    "sourceFile" text NOT NULL,
    "sourceId" text NOT NULL,
    reason text NOT NULL,
    detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: legacy_import_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.legacy_import_runs (
    id text NOT NULL,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "finishedAt" timestamp(3) without time zone,
    status text DEFAULT 'RUNNING'::text NOT NULL,
    "sourceChecksums" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "legacyKeyVersion" text DEFAULT 'v2-collection-prefixed'::text NOT NULL,
    "lastBatchNo" integer DEFAULT 0 NOT NULL,
    counts jsonb DEFAULT '{}'::jsonb NOT NULL,
    note text
);


--
-- Name: legacy_staging; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.legacy_staging (
    id text NOT NULL,
    "runId" text NOT NULL,
    "sourceFile" text NOT NULL,
    "sourceId" text NOT NULL,
    "rowHash" text NOT NULL,
    raw jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: legacy_status_inferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.legacy_status_inferences (
    id text NOT NULL,
    "runId" text NOT NULL,
    "thucThe" text NOT NULL,
    "hoSoId" text NOT NULL,
    "legacyId" integer,
    "sttCu" text,
    "namCu" text,
    "maHoSo" text,
    "trangThaiCu" text NOT NULL,
    "trangThaiMoi" text NOT NULL,
    "ngaySuy" timestamp(3) without time zone,
    "nguyenVan" text NOT NULL,
    "daApDung" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: legacy_unit_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.legacy_unit_aliases (
    id text NOT NULL,
    "rawValue" text NOT NULL,
    "sampleRaw" text,
    kind text DEFAULT 'UNKNOWN'::text NOT NULL,
    "teamId" text,
    "recordCount" integer DEFAULT 0 NOT NULL,
    note text,
    "approvedBy" text,
    "approvedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: master_classes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_classes (
    id text NOT NULL,
    type text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: monthly_report_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monthly_report_adjustments (
    id text NOT NULL,
    "reportId" text NOT NULL,
    appendix text NOT NULL,
    "targetKey" text NOT NULL,
    "issueCode" text,
    "entityId" text,
    operation text NOT NULL,
    "previousValue" jsonb,
    "newValue" jsonb NOT NULL,
    reason text NOT NULL,
    evidence jsonb NOT NULL,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: monthly_report_contributions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monthly_report_contributions (
    id text NOT NULL,
    "reportId" text NOT NULL,
    appendix text NOT NULL,
    "metricKey" text NOT NULL,
    "cellKey" text,
    "entityType" text NOT NULL,
    "entityId" text NOT NULL,
    "entityCode" text,
    label text NOT NULL,
    "eventAt" timestamp(3) without time zone,
    value integer NOT NULL,
    "ruleCode" text NOT NULL,
    snapshot jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: monthly_report_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monthly_report_packages (
    id text NOT NULL,
    "periodStart" timestamp(3) without time zone NOT NULL,
    "periodEnd" timestamp(3) without time zone NOT NULL,
    "unitCode" text,
    "scopeKey" text NOT NULL,
    "unitName" text NOT NULL,
    "teamIds" text[] NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    "lockVersion" integer DEFAULT 0 NOT NULL,
    "templateVersion" text NOT NULL,
    status public.monthly_report_status DEFAULT 'DRAFT'::public.monthly_report_status NOT NULL,
    snapshot jsonb NOT NULL,
    checks jsonb NOT NULL,
    summary jsonb NOT NULL,
    "detailWorkbook" bytea,
    "summaryWorkbook" bytea,
    "detailWorkbookSha256" text,
    "summaryWorkbookSha256" text,
    "parentId" text,
    "createdById" text NOT NULL,
    "reviewedById" text,
    "approvedById" text,
    "finalizedById" text,
    "rejectionReason" text,
    "submittedAt" timestamp(3) without time zone,
    "approvedAt" timestamp(3) without time zone,
    "finalizedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    id text NOT NULL,
    "userId" text NOT NULL,
    "eventType" public."NotificationType" NOT NULL,
    "inApp" boolean DEFAULT true NOT NULL,
    push boolean DEFAULT true NOT NULL,
    email boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id text NOT NULL,
    "userId" text NOT NULL,
    type public."NotificationType" NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    "isRead" boolean DEFAULT false NOT NULL,
    link text,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "readAt" timestamp(3) without time zone,
    "acknowledgedAt" timestamp(3) without time zone,
    "pushSentAt" timestamp(3) without time zone,
    "pushRetryCount" integer DEFAULT 0 NOT NULL,
    "pushNextRetryAt" timestamp(3) without time zone,
    "pushMaxRetries" integer DEFAULT 3 NOT NULL
);


--
-- Name: otp_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otp_codes (
    id text NOT NULL,
    "userId" text NOT NULL,
    "codeHash" text NOT NULL,
    salt text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "usedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    purpose text DEFAULT 'TWO_FA'::text NOT NULL
);


--
-- Name: overdue_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.overdue_notifications (
    id text NOT NULL,
    "resourceType" text NOT NULL,
    "resourceId" text NOT NULL,
    "userId" text NOT NULL,
    "notifiedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id text NOT NULL,
    action text NOT NULL,
    subject text NOT NULL,
    conditions jsonb,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: petition_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.petition_assignments (
    id text NOT NULL,
    "petitionId" text NOT NULL,
    "userId" text NOT NULL,
    role text NOT NULL,
    "assignedById" text NOT NULL,
    "assignedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: petitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.petitions (
    id text NOT NULL,
    stt text NOT NULL,
    "receivedDate" timestamp(3) without time zone NOT NULL,
    unit text,
    "enteredById" text,
    "senderName" text NOT NULL,
    "senderBirthYear" text,
    "senderAddress" text,
    "senderPhone" text,
    "senderEmail" text,
    "suspectedPerson" text,
    "suspectedAddress" text,
    "petitionType" public."LoaiDon",
    priority text,
    summary text,
    "detailContent" text,
    "attachmentsNote" text,
    deadline timestamp(3) without time zone,
    "assignedToId" text,
    notes text,
    status public.petition_status DEFAULT 'MOI_TIEP_NHAN'::public.petition_status NOT NULL,
    "linkedCaseId" text,
    "linkedIncidentId" text,
    "deletedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "assignedTeamId" text,
    "deadlineRuleVersionId" text,
    "editedAfterWindow" boolean DEFAULT false NOT NULL,
    "baoCaoBanGiamDoc" boolean DEFAULT false NOT NULL,
    "canCuPhapLy" text,
    "deXuat" text,
    "huongDanKhoiKien" text,
    "lyDoChuyen" text,
    "lyDoTraDon" text,
    "nguonDon" text,
    "nhanThay" text,
    "petitionDate" timestamp(3) without time zone,
    "raSoatTrung" text,
    "subTeamAssigned" text,
    "senderIdNumber" text,
    "senderIdIssueDate" timestamp(3) without time zone,
    "senderIdIssuePlace" text,
    "senderIsAnonymous" boolean DEFAULT false NOT NULL,
    "loaiThongTin" text,
    "soPhieuChuyen" text,
    "ngayPhieuChuyen" timestamp(3) without time zone,
    "ngayTiepNhanNguonTin" timestamp(3) without time zone,
    "toiDanhBanDau" text,
    "crimeChinhId" text,
    "noiXayRa" text,
    "ngayGiaoDonViGiaiQuyet" timestamp(3) without time zone,
    "laCongNgheCao" boolean DEFAULT false NOT NULL,
    "lanhDaoToTung" text,
    "ketQuaXuLyKhac" text,
    "legacySourceId" text,
    "noiXayRaPhuongXa" text,
    "ngayXayRa" timestamp(3) without time zone,
    "loaiToiPham" text,
    "phuongThucThuDoan" text,
    "thoiHanUTDT" timestamp(3) without time zone,
    "legacyRaw" jsonb,
    "ngayDeXuat" timestamp(3) without time zone,
    "phanLoaiNguonTin" text,
    "dieuTraVien" text,
    "donViGiaiQuyet" text,
    "thuocThamQuyen" boolean DEFAULT true NOT NULL,
    "donViXuLy" text,
    "canBoDeXuatId" text,
    "soHoSoCu" text,
    "legacyId" integer,
    "legacyCollection" text,
    "sttCu" text,
    metadata jsonb,
    "phanLoaiToiPhamLinhVuc" text,
    "phanLoaiHoSoNoiBo" text,
    "ghiChuKhac" text,
    "yeuCauBoSung" text,
    "soTienBiThietHai" double precision,
    "soLuongBiHai" integer,
    "sortReceivedDate" timestamp(3) without time zone GENERATED ALWAYS AS (
CASE
    WHEN (("receivedDate" >= '1900-01-01 00:00:00'::timestamp without time zone) AND ("receivedDate" < '2100-01-01 00:00:00'::timestamp without time zone)) THEN "receivedDate"
    ELSE NULL::timestamp without time zone
END) STORED,
    "baoCaoBanGiamDocText" text,
    "tinhTrang" text,
    "soQDPhanCongNguonTin" text,
    "ngayQDPhanCongNguonTin" timestamp(3) without time zone,
    "soQDTamDinhChiNguonTin" text,
    "ngayQDTamDinhChiNguonTin" timestamp(3) without time zone,
    "canCuTamDinhChiNguonTin" text,
    "soPhucHoiNguonTin" text,
    "ngayPhucHoiNguonTin" timestamp(3) without time zone,
    "sttSort" integer,
    ngay_giai_quyet timestamp(3) without time zone,
    "huongXuLy" public.huong_xu_ly_don,
    nguon_don_bd text,
    sender_name_bd text,
    detail_content_bd text,
    don_vi_giai_quyet_bd text,
    ket_qua_xu_ly_khac_bd text,
    suspected_person_bd text,
    tim_kiem_bd text,
    sender_name_chuan text GENERATED ALWAYS AS (NULLIF(btrim(regexp_replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(NORMALIZE(COALESCE("senderName", ''::text), NFC)), 'oà'::text, 'òa'::text), 'oá'::text, 'óa'::text), 'oả'::text, 'ỏa'::text), 'oã'::text, 'õa'::text), 'oạ'::text, 'ọa'::text), 'oè'::text, 'òe'::text), 'oé'::text, 'óe'::text), 'oẻ'::text, 'ỏe'::text), 'oẽ'::text, 'õe'::text), 'oẹ'::text, 'ọe'::text), 'uỳ'::text, 'ùy'::text), 'uý'::text, 'úy'::text), 'uỷ'::text, 'ủy'::text), 'uỹ'::text, 'ũy'::text), 'uỵ'::text, 'ụy'::text), '\s+'::text, ' '::text, 'g'::text)), ''::text)) STORED,
    sender_address_chuan text GENERATED ALWAYS AS (NULLIF(btrim(regexp_replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(NORMALIZE(COALESCE("senderAddress", ''::text), NFC)), 'oà'::text, 'òa'::text), 'oá'::text, 'óa'::text), 'oả'::text, 'ỏa'::text), 'oã'::text, 'õa'::text), 'oạ'::text, 'ọa'::text), 'oè'::text, 'òe'::text), 'oé'::text, 'óe'::text), 'oẻ'::text, 'ỏe'::text), 'oẽ'::text, 'õe'::text), 'oẹ'::text, 'ọe'::text), 'uỳ'::text, 'ùy'::text), 'uý'::text, 'úy'::text), 'uỷ'::text, 'ủy'::text), 'uỹ'::text, 'ũy'::text), 'uỵ'::text, 'ụy'::text), '\s+'::text, ' '::text, 'g'::text)), ''::text)) STORED,
    suspected_person_chuan text GENERATED ALWAYS AS (NULLIF(btrim(regexp_replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(NORMALIZE(COALESCE("suspectedPerson", ''::text), NFC)), 'oà'::text, 'òa'::text), 'oá'::text, 'óa'::text), 'oả'::text, 'ỏa'::text), 'oã'::text, 'õa'::text), 'oạ'::text, 'ọa'::text), 'oè'::text, 'òe'::text), 'oé'::text, 'óe'::text), 'oẻ'::text, 'ỏe'::text), 'oẽ'::text, 'õe'::text), 'oẹ'::text, 'ọe'::text), 'uỳ'::text, 'ùy'::text), 'uý'::text, 'úy'::text), 'uỷ'::text, 'ủy'::text), 'uỹ'::text, 'ũy'::text), 'uỵ'::text, 'ụy'::text), '\s+'::text, ' '::text, 'g'::text)), ''::text)) STORED,
    sender_phone_chuan text GENERATED ALWAYS AS (NULLIF(regexp_replace(COALESCE("senderPhone", ''::text), '[^0-9]'::text, ''::text, 'g'::text), ''::text)) STORED,
    ngay_viet_don_edtf character varying(10),
    ngay_viet_don_chu text,
    loai_thong_tin_bd text
);


--
-- Name: phu_luc_report_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.phu_luc_report_logs (
    id text NOT NULL,
    "reportType" text NOT NULL,
    "periodStart" timestamp(3) without time zone NOT NULL,
    "periodEnd" timestamp(3) without time zone NOT NULL,
    "unitCode" text,
    "generatedById" text NOT NULL,
    "generatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "rowCount" integer NOT NULL,
    "fileSize" integer NOT NULL,
    "fileSha" text NOT NULL
);


--
-- Name: proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proposals (
    id text NOT NULL,
    "proposalNumber" text NOT NULL,
    "relatedCaseId" text,
    "caseType" text,
    content text NOT NULL,
    unit text,
    "createdById" text,
    status public.proposal_status DEFAULT 'CHO_GUI'::public.proposal_status NOT NULL,
    "sentDate" timestamp(3) without time zone,
    response text,
    "responseDate" timestamp(3) without time zone,
    notes text,
    "deletedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "legacySourceId" text,
    "legacyRaw" jsonb,
    content_bd text,
    unit_bd text,
    tim_kiem_bd text
);


--
-- Name: report_tdc_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_tdc_drafts (
    id text NOT NULL,
    "loaiBaoCao" public.report_tdc_type NOT NULL,
    "fromDate" timestamp(3) without time zone NOT NULL,
    "toDate" timestamp(3) without time zone NOT NULL,
    "teamIds" text[],
    status public.report_tdc_status DEFAULT 'DRAFT'::public.report_tdc_status NOT NULL,
    "computedData" jsonb NOT NULL,
    "adjustedData" jsonb,
    notes text,
    "createdById" text NOT NULL,
    "reviewedById" text,
    "approvedById" text,
    "rejectedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "reviewedAt" timestamp(3) without time zone,
    "approvedAt" timestamp(3) without time zone,
    "rejectedAt" timestamp(3) without time zone,
    "rejectedReason" text,
    "finalizedAt" timestamp(3) without time zone
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    "roleId" text NOT NULL,
    "permissionId" text NOT NULL,
    "assignedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: subjects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subjects (
    id text NOT NULL,
    "fullName" text NOT NULL,
    "dateOfBirth" timestamp(3) without time zone,
    gender text DEFAULT 'MALE'::text NOT NULL,
    "idNumber" text,
    address text,
    phone text,
    "occupationId" text,
    "nationalityId" text,
    "districtId" text,
    "wardId" text,
    "districtName" text,
    "caseId" text NOT NULL,
    "crimeId" text,
    type public.subject_type DEFAULT 'SUSPECT'::public.subject_type NOT NULL,
    status public.subject_status DEFAULT 'INVESTIGATING'::public.subject_status NOT NULL,
    notes text,
    "deletedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "legacySourceId" text,
    "legacyId" integer,
    "legacyCollection" text,
    "legacyRaw" jsonb,
    full_name_bd text,
    id_number_bd text,
    tim_kiem_bd text
);


--
-- Name: suspension_action_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suspension_action_plans (
    id text NOT NULL,
    "caseId" text,
    "incidentId" text,
    "ngayLap" timestamp(3) without time zone NOT NULL,
    "bienPhap" text NOT NULL,
    "thoiHan" timestamp(3) without time zone,
    "tienDo" public.tien_do_khac_phuc DEFAULT 'DANG_THUC_HIEN'::public.tien_do_khac_phuc NOT NULL,
    "ketQua" text,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id text NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    label text NOT NULL,
    unit text,
    "legalBasis" text,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    level integer DEFAULT 0 NOT NULL,
    "parentId" text,
    "order" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "wardId" text,
    "editWindowHours" integer
);


--
-- Name: user_abbreviations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_abbreviations (
    id text NOT NULL,
    "userId" text NOT NULL,
    shortcut text NOT NULL,
    expansion text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: user_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_devices (
    id text NOT NULL,
    "userId" text NOT NULL,
    "fcmToken" text NOT NULL,
    platform text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: user_export_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_export_preferences (
    id text NOT NULL,
    "userId" text NOT NULL,
    "entityType" text NOT NULL,
    "templateIds" text[],
    mode text DEFAULT 'separate'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: user_shortcuts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_shortcuts (
    id text NOT NULL,
    "userId" text NOT NULL,
    action text NOT NULL,
    binding text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: user_table_layouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_table_layouts (
    id text NOT NULL,
    "userId" text NOT NULL,
    "tableKey" text NOT NULL,
    columns jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "matDo" text
);


--
-- Name: user_teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_teams (
    "userId" text NOT NULL,
    "teamId" text NOT NULL,
    "isLeader" boolean DEFAULT false NOT NULL,
    "joinedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text,
    username text NOT NULL,
    "passwordHash" text NOT NULL,
    "firstName" text,
    "lastName" text,
    "workId" text,
    phone text,
    "departmentId" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "roleId" text NOT NULL,
    "refreshTokenHash" text,
    "tokenVersion" integer DEFAULT 0 NOT NULL,
    "canDispatch" boolean DEFAULT false NOT NULL,
    "lastLoginAt" timestamp(3) without time zone,
    "totpSecret" text,
    "totpEnabled" boolean DEFAULT false NOT NULL,
    "totpSetupPending" boolean DEFAULT false NOT NULL,
    "totpSetupPendingAt" timestamp(3) without time zone,
    "backupCodes" text[],
    "backupCodeSalts" text[],
    "lastTotpCode" text,
    "twoFaSetupAt" timestamp(3) without time zone,
    "twoFaUsedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "mustChangePassword" boolean DEFAULT false NOT NULL,
    "passwordChangedAt" timestamp(3) without time zone,
    "failedLoginAttempts" integer DEFAULT 0 NOT NULL,
    "lockedUntil" timestamp(3) without time zone,
    "lastFailedLoginAt" timestamp(3) without time zone,
    "twoFaSetupRequired" boolean DEFAULT true NOT NULL,
    "enrollmentTokenHash" text,
    "enrollmentExpiresAt" timestamp(3) without time zone,
    rank text,
    "shortName" text,
    ho_ten_bd text,
    email_bd text,
    tim_kiem_bd text
);

ALTER TABLE ONLY public.users FORCE ROW LEVEL SECURITY;


--
-- Name: vks_meeting_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vks_meeting_records (
    id text NOT NULL,
    "caseId" text,
    "incidentId" text,
    "ngayTrao" timestamp(3) without time zone NOT NULL,
    "noiDung" text NOT NULL,
    "soQuyetDinh" text,
    "ketQua" text,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: xlsx_import_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.xlsx_import_logs (
    id text NOT NULL,
    "sourceFile" text NOT NULL,
    "fileSize" integer NOT NULL,
    "fileSha" text NOT NULL,
    "uploadedById" text NOT NULL,
    "uploadedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "unitCodeDetected" text,
    "succeededRows" integer DEFAULT 0 NOT NULL,
    "skippedRows" integer DEFAULT 0 NOT NULL,
    "conflictedRows" integer DEFAULT 0 NOT NULL,
    "errorRows" integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'PARSED'::text NOT NULL,
    "errorDetail" jsonb,
    "firstConfirmById" text,
    "firstConfirmAt" timestamp(3) without time zone,
    "secondConfirmById" text,
    "secondConfirmAt" timestamp(3) without time zone,
    "rolledBackById" text,
    "rolledBackAt" timestamp(3) without time zone
);


--
-- Name: xlsx_import_staging; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.xlsx_import_staging (
    id text NOT NULL,
    "importLogId" text NOT NULL,
    "sheetName" text NOT NULL,
    "rowIndex" integer NOT NULL,
    payload jsonb NOT NULL,
    "detectedType" text,
    "conflictReason" text
);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: address_mappings address_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.address_mappings
    ADD CONSTRAINT address_mappings_pkey PRIMARY KEY (id);


--
-- Name: address_seed_jobs address_seed_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.address_seed_jobs
    ADD CONSTRAINT address_seed_jobs_pkey PRIMARY KEY (id);


--
-- Name: admin_unit_dataset_imports admin_unit_dataset_imports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_unit_dataset_imports
    ADD CONSTRAINT admin_unit_dataset_imports_pkey PRIMARY KEY (version);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: bulk_import_jobs bulk_import_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_import_jobs
    ADD CONSTRAINT bulk_import_jobs_pkey PRIMARY KEY (id);


--
-- Name: bulk_operations bulk_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_operations
    ADD CONSTRAINT bulk_operations_pkey PRIMARY KEY (id);


--
-- Name: calendar_event_occurrence_overrides calendar_event_occurrence_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_event_occurrence_overrides
    ADD CONSTRAINT calendar_event_occurrence_overrides_pkey PRIMARY KEY (id);


--
-- Name: calendar_events calendar_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);


--
-- Name: case_provenance_backfill_audit case_provenance_backfill_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_provenance_backfill_audit
    ADD CONSTRAINT case_provenance_backfill_audit_pkey PRIMARY KEY (case_id);


--
-- Name: case_statistics case_statistics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_statistics
    ADD CONSTRAINT case_statistics_pkey PRIMARY KEY (id);


--
-- Name: case_status_history case_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_status_history
    ADD CONSTRAINT case_status_history_pkey PRIMARY KEY (id);


--
-- Name: cases cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_pkey PRIMARY KEY (id);


--
-- Name: conclusions conclusions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conclusions
    ADD CONSTRAINT conclusions_pkey PRIMARY KEY (id);


--
-- Name: crimes crimes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crimes
    ADD CONSTRAINT crimes_pkey PRIMARY KEY (id);


--
-- Name: data_access_grants data_access_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_access_grants
    ADD CONSTRAINT data_access_grants_pkey PRIMARY KEY (id);


--
-- Name: deadline_rule_versions deadline_rule_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deadline_rule_versions
    ADD CONSTRAINT deadline_rule_versions_pkey PRIMARY KEY (id);


--
-- Name: delegations delegations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delegations
    ADD CONSTRAINT delegations_pkey PRIMARY KEY (id);


--
-- Name: directories directories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directories
    ADD CONSTRAINT directories_pkey PRIMARY KEY (id);


--
-- Name: document_number_counters document_number_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_number_counters
    ADD CONSTRAINT document_number_counters_pkey PRIMARY KEY (id);


--
-- Name: document_number_logs document_number_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_number_logs
    ADD CONSTRAINT document_number_logs_pkey PRIMARY KEY (id);


--
-- Name: document_number_templates document_number_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_number_templates
    ADD CONSTRAINT document_number_templates_pkey PRIMARY KEY (id);


--
-- Name: document_render_logs document_render_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_render_logs
    ADD CONSTRAINT document_render_logs_pkey PRIMARY KEY (id);


--
-- Name: document_templates document_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: edit_window_reset_requests edit_window_reset_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edit_window_reset_requests
    ADD CONSTRAINT edit_window_reset_requests_pkey PRIMARY KEY (id);


--
-- Name: enrollment_token_audits enrollment_token_audits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollment_token_audits
    ADD CONSTRAINT enrollment_token_audits_pkey PRIMARY KEY (id);


--
-- Name: event_categories event_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_categories
    ADD CONSTRAINT event_categories_pkey PRIMARY KEY (id);


--
-- Name: event_reminder_dispatches event_reminder_dispatches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_reminder_dispatches
    ADD CONSTRAINT event_reminder_dispatches_pkey PRIMARY KEY (id);


--
-- Name: event_reminders event_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_reminders
    ADD CONSTRAINT event_reminders_pkey PRIMARY KEY (id);


--
-- Name: evidences evidences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidences
    ADD CONSTRAINT evidences_pkey PRIMARY KEY (id);


--
-- Name: exchange_messages exchange_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_messages
    ADD CONSTRAINT exchange_messages_pkey PRIMARY KEY (id);


--
-- Name: exchanges exchanges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchanges
    ADD CONSTRAINT exchanges_pkey PRIMARY KEY (id);


--
-- Name: feature_flags feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_pkey PRIMARY KEY (key);


--
-- Name: guidance_records guidance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guidance_records
    ADD CONSTRAINT guidance_records_pkey PRIMARY KEY (id);


--
-- Name: incident_handoffs incident_handoffs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incident_handoffs
    ADD CONSTRAINT incident_handoffs_pkey PRIMARY KEY (id);


--
-- Name: incident_status_history incident_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incident_status_history
    ADD CONSTRAINT incident_status_history_pkey PRIMARY KEY (id);


--
-- Name: incidents incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_pkey PRIMARY KEY (id);


--
-- Name: investigation_supplements investigation_supplements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investigation_supplements
    ADD CONSTRAINT investigation_supplements_pkey PRIMARY KEY (id);


--
-- Name: lawyers lawyers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lawyers
    ADD CONSTRAINT lawyers_pkey PRIMARY KEY (id);


--
-- Name: legacy_field_diagnostics legacy_field_diagnostics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_field_diagnostics
    ADD CONSTRAINT legacy_field_diagnostics_pkey PRIMARY KEY (id);


--
-- Name: legacy_import_errors legacy_import_errors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_import_errors
    ADD CONSTRAINT legacy_import_errors_pkey PRIMARY KEY (id);


--
-- Name: legacy_import_runs legacy_import_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_import_runs
    ADD CONSTRAINT legacy_import_runs_pkey PRIMARY KEY (id);


--
-- Name: legacy_staging legacy_staging_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_staging
    ADD CONSTRAINT legacy_staging_pkey PRIMARY KEY (id);


--
-- Name: legacy_status_inferences legacy_status_inferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_status_inferences
    ADD CONSTRAINT legacy_status_inferences_pkey PRIMARY KEY (id);


--
-- Name: legacy_unit_aliases legacy_unit_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_unit_aliases
    ADD CONSTRAINT legacy_unit_aliases_pkey PRIMARY KEY (id);


--
-- Name: master_classes master_classes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_classes
    ADD CONSTRAINT master_classes_pkey PRIMARY KEY (id);


--
-- Name: monthly_report_adjustments monthly_report_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_report_adjustments
    ADD CONSTRAINT monthly_report_adjustments_pkey PRIMARY KEY (id);


--
-- Name: monthly_report_contributions monthly_report_contributions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_report_contributions
    ADD CONSTRAINT monthly_report_contributions_pkey PRIMARY KEY (id);


--
-- Name: monthly_report_packages monthly_report_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_report_packages
    ADD CONSTRAINT monthly_report_packages_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: otp_codes otp_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_codes
    ADD CONSTRAINT otp_codes_pkey PRIMARY KEY (id);


--
-- Name: overdue_notifications overdue_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overdue_notifications
    ADD CONSTRAINT overdue_notifications_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: petition_assignments petition_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.petition_assignments
    ADD CONSTRAINT petition_assignments_pkey PRIMARY KEY (id);


--
-- Name: petitions petitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.petitions
    ADD CONSTRAINT petitions_pkey PRIMARY KEY (id);


--
-- Name: phu_luc_report_logs phu_luc_report_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phu_luc_report_logs
    ADD CONSTRAINT phu_luc_report_logs_pkey PRIMARY KEY (id);


--
-- Name: proposals proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_pkey PRIMARY KEY (id);


--
-- Name: report_tdc_drafts report_tdc_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_tdc_drafts
    ADD CONSTRAINT report_tdc_drafts_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY ("roleId", "permissionId");


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (id);


--
-- Name: suspension_action_plans suspension_action_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suspension_action_plans
    ADD CONSTRAINT suspension_action_plans_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: user_abbreviations user_abbreviations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_abbreviations
    ADD CONSTRAINT user_abbreviations_pkey PRIMARY KEY (id);


--
-- Name: user_devices user_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_pkey PRIMARY KEY (id);


--
-- Name: user_export_preferences user_export_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_export_preferences
    ADD CONSTRAINT user_export_preferences_pkey PRIMARY KEY (id);


--
-- Name: user_shortcuts user_shortcuts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_shortcuts
    ADD CONSTRAINT user_shortcuts_pkey PRIMARY KEY (id);


--
-- Name: user_table_layouts user_table_layouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_table_layouts
    ADD CONSTRAINT user_table_layouts_pkey PRIMARY KEY (id);


--
-- Name: user_teams user_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_teams
    ADD CONSTRAINT user_teams_pkey PRIMARY KEY ("userId", "teamId");


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vks_meeting_records vks_meeting_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vks_meeting_records
    ADD CONSTRAINT vks_meeting_records_pkey PRIMARY KEY (id);


--
-- Name: xlsx_import_logs xlsx_import_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xlsx_import_logs
    ADD CONSTRAINT xlsx_import_logs_pkey PRIMARY KEY (id);


--
-- Name: xlsx_import_staging xlsx_import_staging_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xlsx_import_staging
    ADD CONSTRAINT xlsx_import_staging_pkey PRIMARY KEY (id);


--
-- Name: address_mappings_needsReview_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "address_mappings_needsReview_idx" ON public.address_mappings USING btree ("needsReview");


--
-- Name: address_mappings_new_ward_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX address_mappings_new_ward_bd_trgm ON public.address_mappings USING gin (new_ward_bd public.gin_trgm_ops);


--
-- Name: address_mappings_note_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX address_mappings_note_bd_trgm ON public.address_mappings USING gin (note_bd public.gin_trgm_ops);


--
-- Name: address_mappings_oldWard_oldDistrict_province_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "address_mappings_oldWard_oldDistrict_province_key" ON public.address_mappings USING btree ("oldWard", "oldDistrict", province);


--
-- Name: address_mappings_old_district_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX address_mappings_old_district_bd_trgm ON public.address_mappings USING gin (old_district_bd public.gin_trgm_ops);


--
-- Name: address_mappings_old_ward_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX address_mappings_old_ward_bd_trgm ON public.address_mappings USING gin (old_ward_bd public.gin_trgm_ops);


--
-- Name: address_mappings_province_oldDistrict_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "address_mappings_province_oldDistrict_idx" ON public.address_mappings USING btree (province, "oldDistrict");


--
-- Name: address_mappings_tim_kiem_bd_chua_nap; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX address_mappings_tim_kiem_bd_chua_nap ON public.address_mappings USING btree (id) WHERE (tim_kiem_bd IS NULL);


--
-- Name: address_mappings_tim_kiem_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX address_mappings_tim_kiem_bd_trgm ON public.address_mappings USING gin (tim_kiem_bd public.gin_trgm_ops);


--
-- Name: address_seed_jobs_province_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX address_seed_jobs_province_status_idx ON public.address_seed_jobs USING btree (province, status);


--
-- Name: aud_imports_active_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX aud_imports_active_unique ON public.admin_unit_dataset_imports USING btree (status) WHERE (status = 'ACTIVE'::text);


--
-- Name: audit_logs_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_action_idx ON public.audit_logs USING btree (action);


--
-- Name: audit_logs_bulkOperationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "audit_logs_bulkOperationId_idx" ON public.audit_logs USING btree ("bulkOperationId");


--
-- Name: audit_logs_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "audit_logs_createdAt_idx" ON public.audit_logs USING btree ("createdAt");


--
-- Name: audit_logs_subjectId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "audit_logs_subjectId_createdAt_idx" ON public.audit_logs USING btree ("subjectId", "createdAt" DESC);


--
-- Name: audit_logs_tim_kiem_bd_chua_nap; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_tim_kiem_bd_chua_nap ON public.audit_logs USING btree (id) WHERE (tim_kiem_bd IS NULL);


--
-- Name: audit_logs_tim_kiem_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_tim_kiem_bd_trgm ON public.audit_logs USING gin (tim_kiem_bd public.gin_trgm_ops);


--
-- Name: audit_logs_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "audit_logs_userId_idx" ON public.audit_logs USING btree ("userId");


--
-- Name: bulk_import_jobs_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "bulk_import_jobs_expiresAt_idx" ON public.bulk_import_jobs USING btree ("expiresAt");


--
-- Name: bulk_import_jobs_generatedBy_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "bulk_import_jobs_generatedBy_createdAt_idx" ON public.bulk_import_jobs USING btree ("generatedBy", "createdAt");


--
-- Name: bulk_operations_actorId_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "bulk_operations_actorId_idempotencyKey_key" ON public.bulk_operations USING btree ("actorId", "idempotencyKey");


--
-- Name: bulk_operations_actorId_startedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "bulk_operations_actorId_startedAt_idx" ON public.bulk_operations USING btree ("actorId", "startedAt" DESC);


--
-- Name: bulk_operations_resource_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bulk_operations_resource_action_idx ON public.bulk_operations USING btree (resource, action);


--
-- Name: calendar_event_occurrence_overrides_eventId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "calendar_event_occurrence_overrides_eventId_idx" ON public.calendar_event_occurrence_overrides USING btree ("eventId");


--
-- Name: calendar_event_occurrence_overrides_eventId_occurrenceDate_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "calendar_event_occurrence_overrides_eventId_occurrenceDate_key" ON public.calendar_event_occurrence_overrides USING btree ("eventId", "occurrenceDate");


--
-- Name: calendar_events_categoryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "calendar_events_categoryId_idx" ON public.calendar_events USING btree ("categoryId");


--
-- Name: calendar_events_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "calendar_events_deletedAt_idx" ON public.calendar_events USING btree ("deletedAt");


--
-- Name: calendar_events_personal_startDate_partial_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "calendar_events_personal_startDate_partial_idx" ON public.calendar_events USING btree ("startDate", "userId") WHERE ((scope = 'PERSONAL'::public."EventScope") AND ("deletedAt" IS NULL));


--
-- Name: calendar_events_startDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "calendar_events_startDate_idx" ON public.calendar_events USING btree ("startDate");


--
-- Name: calendar_events_system_startDate_partial_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "calendar_events_system_startDate_partial_idx" ON public.calendar_events USING btree ("startDate") WHERE ((scope = 'SYSTEM'::public."EventScope") AND ("deletedAt" IS NULL));


--
-- Name: calendar_events_team_startDate_partial_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "calendar_events_team_startDate_partial_idx" ON public.calendar_events USING btree ("startDate", "teamId") WHERE ((scope = 'TEAM'::public."EventScope") AND ("deletedAt" IS NULL));


--
-- Name: case_provenance_backfill_audit_detected_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX case_provenance_backfill_audit_detected_source_idx ON public.case_provenance_backfill_audit USING btree (detected_source);


--
-- Name: case_provenance_backfill_audit_inconsistency_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX case_provenance_backfill_audit_inconsistency_idx ON public.case_provenance_backfill_audit USING btree (inconsistency) WHERE (inconsistency IS NOT NULL);


--
-- Name: case_statistics_caseId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "case_statistics_caseId_key" ON public.case_statistics USING btree ("caseId");


--
-- Name: case_status_history_caseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "case_status_history_caseId_idx" ON public.case_status_history USING btree ("caseId");


--
-- Name: case_status_history_changedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "case_status_history_changedAt_idx" ON public.case_status_history USING btree ("changedAt");


--
-- Name: cases_assignedTeamId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "cases_assignedTeamId_idx" ON public.cases USING btree ("assignedTeamId");


--
-- Name: cases_caseCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "cases_caseCode_key" ON public.cases USING btree ("caseCode");


--
-- Name: cases_caseProvenance_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "cases_caseProvenance_idx" ON public.cases USING btree ("caseProvenance");


--
-- Name: cases_caseType_ngayDeXuat_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "cases_caseType_ngayDeXuat_idx" ON public.cases USING btree (case_type, "ngayDeXuat" DESC NULLS LAST, id DESC) WHERE ("deletedAt" IS NULL);


--
-- Name: cases_caseType_ngayDeXuat_sttSort_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "cases_caseType_ngayDeXuat_sttSort_id_idx" ON public.cases USING btree (case_type, "ngayDeXuat" DESC NULLS LAST, "sttSort" DESC NULLS LAST, id DESC) WHERE ("deletedAt" IS NULL);


--
-- Name: cases_case_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_case_type_idx ON public.cases USING btree (case_type);


--
-- Name: cases_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "cases_createdAt_idx" ON public.cases USING btree ("createdAt");


--
-- Name: cases_createdById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "cases_createdById_idx" ON public.cases USING btree ("createdById");


--
-- Name: cases_crimeChinhId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "cases_crimeChinhId_idx" ON public.cases USING btree ("crimeChinhId");


--
-- Name: cases_crime_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_crime_bd_trgm ON public.cases USING gin (crime_bd public.gin_trgm_ops);


--
-- Name: cases_deadline_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_deadline_idx ON public.cases USING btree (deadline);


--
-- Name: cases_deletedAt_case_type_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "cases_deletedAt_case_type_status_idx" ON public.cases USING btree ("deletedAt", case_type, status) WHERE ("deletedAt" IS NULL);


--
-- Name: cases_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "cases_deletedAt_idx" ON public.cases USING btree ("deletedAt");


--
-- Name: cases_don_vi_giai_quyet_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_don_vi_giai_quyet_bd_trgm ON public.cases USING gin (don_vi_giai_quyet_bd public.gin_trgm_ops);


--
-- Name: cases_don_vi_giao_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_don_vi_giao_bd_trgm ON public.cases USING gin (don_vi_giao_bd public.gin_trgm_ops);


--
-- Name: cases_don_vi_giao_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_don_vi_giao_idx ON public.cases USING btree (don_vi_giao);


--
-- Name: cases_editedAfterWindow_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "cases_editedAfterWindow_idx" ON public.cases USING btree ("editedAfterWindow") WHERE ("editedAfterWindow" = true);


--
-- Name: cases_ket_qua_uy_thac_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_ket_qua_uy_thac_bd_trgm ON public.cases USING gin (ket_qua_uy_thac_bd public.gin_trgm_ops);


--
-- Name: cases_ket_qua_xu_ly_khac_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_ket_qua_xu_ly_khac_bd_trgm ON public.cases USING gin (ket_qua_xu_ly_khac_bd public.gin_trgm_ops);


--
-- Name: cases_legacyId_legacyCollection_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "cases_legacyId_legacyCollection_idx" ON public.cases USING btree ("legacyId", "legacyCollection");


--
-- Name: cases_legacySourceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "cases_legacySourceId_key" ON public.cases USING btree ("legacySourceId");


--
-- Name: cases_linkedIncidentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "cases_linkedIncidentId_idx" ON public.cases USING btree ("linkedIncidentId");


--
-- Name: cases_linkedIncidentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "cases_linkedIncidentId_key" ON public.cases USING btree ("linkedIncidentId");


--
-- Name: cases_linkedPetitionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "cases_linkedPetitionId_idx" ON public.cases USING btree ("linkedPetitionId");


--
-- Name: cases_mo_ta_chi_tiet_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_mo_ta_chi_tiet_bd_trgm ON public.cases USING gin (mo_ta_chi_tiet_bd public.gin_trgm_ops);


--
-- Name: cases_name_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_name_bd_trgm ON public.cases USING gin (name_bd public.gin_trgm_ops);


--
-- Name: cases_ngay_giai_quyet_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_ngay_giai_quyet_idx ON public.cases USING btree (ngay_giai_quyet);


--
-- Name: cases_nghi_van_doi_tuong_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_nghi_van_doi_tuong_bd_trgm ON public.cases USING gin (nghi_van_doi_tuong_bd public.gin_trgm_ops);


--
-- Name: cases_nguon_don_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_nguon_don_bd_trgm ON public.cases USING gin (nguon_don_bd public.gin_trgm_ops);


--
-- Name: cases_soHoSoCu_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "cases_soHoSoCu_idx" ON public.cases USING btree ("soHoSoCu");


--
-- Name: cases_so_quyet_dinh_uy_thac_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_so_quyet_dinh_uy_thac_bd_trgm ON public.cases USING gin (so_quyet_dinh_uy_thac_bd public.gin_trgm_ops);


--
-- Name: cases_so_quyet_dinh_uy_thac_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cases_so_quyet_dinh_uy_thac_key ON public.cases USING btree (so_quyet_dinh_uy_thac);


--
-- Name: cases_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_status_idx ON public.cases USING btree (status);


--
-- Name: cases_sttCu_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "cases_sttCu_idx" ON public.cases USING btree ("sttCu");


--
-- Name: cases_sttSort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "cases_sttSort_idx" ON public.cases USING btree ("sttSort" DESC NULLS LAST, id DESC);


--
-- Name: cases_ten_cung_cap_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_ten_cung_cap_bd_trgm ON public.cases USING gin (ten_cung_cap_bd public.gin_trgm_ops);


--
-- Name: cases_thoi_han_uy_thac_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_thoi_han_uy_thac_idx ON public.cases USING btree (thoi_han_uy_thac);


--
-- Name: cases_tim_kiem_bd_chua_nap; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_tim_kiem_bd_chua_nap ON public.cases USING btree (id) WHERE (tim_kiem_bd IS NULL);


--
-- Name: cases_tim_kiem_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_tim_kiem_bd_trgm ON public.cases USING gin (tim_kiem_bd public.gin_trgm_ops);


--
-- Name: cases_toiDanhChinhKhoiToId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "cases_toiDanhChinhKhoiToId_idx" ON public.cases USING btree ("toiDanhChinhKhoiToId");


--
-- Name: cases_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_unit_idx ON public.cases USING btree (unit);


--
-- Name: cases_utdt_reply_flags_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_utdt_reply_flags_idx ON public.cases USING btree (utdt_has_failure_reason, utdt_has_reply_result, thoi_han_uy_thac) WHERE ((case_type = 'UY_THAC_DIEU_TRA'::public.case_type) AND ("deletedAt" IS NULL));


--
-- Name: conclusions_caseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "conclusions_caseId_idx" ON public.conclusions USING btree ("caseId");


--
-- Name: conclusions_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "conclusions_deletedAt_idx" ON public.conclusions USING btree ("deletedAt");


--
-- Name: conclusions_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conclusions_status_idx ON public.conclusions USING btree (status);


--
-- Name: crimes_articleNo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "crimes_articleNo_idx" ON public.crimes USING btree ("articleNo");


--
-- Name: crimes_chapter_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crimes_chapter_idx ON public.crimes USING btree (chapter);


--
-- Name: crimes_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX crimes_code_key ON public.crimes USING btree (code);


--
-- Name: crimes_legacyValue_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "crimes_legacyValue_idx" ON public.crimes USING btree ("legacyValue");


--
-- Name: crimes_name_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crimes_name_bd_trgm ON public.crimes USING gin (name_bd public.gin_trgm_ops);


--
-- Name: crimes_pc02Relevant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "crimes_pc02Relevant_idx" ON public.crimes USING btree ("pc02Relevant");


--
-- Name: crimes_tim_kiem_bd_chua_nap; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crimes_tim_kiem_bd_chua_nap ON public.crimes USING btree (id) WHERE (tim_kiem_bd IS NULL);


--
-- Name: crimes_tim_kiem_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crimes_tim_kiem_bd_trgm ON public.crimes USING gin (tim_kiem_bd public.gin_trgm_ops);


--
-- Name: data_access_grants_granteeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "data_access_grants_granteeId_idx" ON public.data_access_grants USING btree ("granteeId");


--
-- Name: data_access_grants_granteeId_teamId_accessLevel_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "data_access_grants_granteeId_teamId_accessLevel_key" ON public.data_access_grants USING btree ("granteeId", "teamId", "accessLevel");


--
-- Name: deadline_rule_versions_attachmentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "deadline_rule_versions_attachmentId_idx" ON public.deadline_rule_versions USING btree ("attachmentId");


--
-- Name: deadline_rule_versions_ruleKey_effectiveFrom_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "deadline_rule_versions_ruleKey_effectiveFrom_idx" ON public.deadline_rule_versions USING btree ("ruleKey", "effectiveFrom");


--
-- Name: deadline_rule_versions_ruleKey_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "deadline_rule_versions_ruleKey_status_idx" ON public.deadline_rule_versions USING btree ("ruleKey", status);


--
-- Name: deadline_rule_versions_status_proposedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "deadline_rule_versions_status_proposedAt_idx" ON public.deadline_rule_versions USING btree (status, "proposedAt");


--
-- Name: delegations_assignedToId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "delegations_assignedToId_idx" ON public.delegations USING btree ("assignedToId");


--
-- Name: delegations_content_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delegations_content_bd_trgm ON public.delegations USING gin (content_bd public.gin_trgm_ops);


--
-- Name: delegations_delegationNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "delegations_delegationNumber_key" ON public.delegations USING btree ("delegationNumber");


--
-- Name: delegations_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "delegations_deletedAt_idx" ON public.delegations USING btree ("deletedAt");


--
-- Name: delegations_legacySourceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "delegations_legacySourceId_key" ON public.delegations USING btree ("legacySourceId");


--
-- Name: delegations_receiving_unit_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delegations_receiving_unit_bd_trgm ON public.delegations USING gin (receiving_unit_bd public.gin_trgm_ops);


--
-- Name: delegations_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delegations_status_idx ON public.delegations USING btree (status);


--
-- Name: delegations_tim_kiem_bd_chua_nap; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delegations_tim_kiem_bd_chua_nap ON public.delegations USING btree (id) WHERE (tim_kiem_bd IS NULL);


--
-- Name: delegations_tim_kiem_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delegations_tim_kiem_bd_trgm ON public.delegations USING gin (tim_kiem_bd public.gin_trgm_ops);


--
-- Name: directories_description_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX directories_description_bd_trgm ON public.directories USING gin (description_bd public.gin_trgm_ops);


--
-- Name: directories_name_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX directories_name_bd_trgm ON public.directories USING gin (name_bd public.gin_trgm_ops);


--
-- Name: directories_tim_kiem_bd_chua_nap; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX directories_tim_kiem_bd_chua_nap ON public.directories USING btree (id) WHERE (tim_kiem_bd IS NULL);


--
-- Name: directories_tim_kiem_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX directories_tim_kiem_bd_trgm ON public.directories USING gin (tim_kiem_bd public.gin_trgm_ops);


--
-- Name: directories_type_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX directories_type_code_key ON public.directories USING btree (type, code);


--
-- Name: directories_type_officialCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "directories_type_officialCode_idx" ON public.directories USING btree (type, "officialCode") WHERE ("officialCode" IS NOT NULL);


--
-- Name: document_number_counters_templateId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "document_number_counters_templateId_idx" ON public.document_number_counters USING btree ("templateId");


--
-- Name: document_number_counters_templateId_periodKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "document_number_counters_templateId_periodKey_key" ON public.document_number_counters USING btree ("templateId", "periodKey");


--
-- Name: document_number_logs_documentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "document_number_logs_documentId_idx" ON public.document_number_logs USING btree ("documentId");


--
-- Name: document_number_logs_templateId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "document_number_logs_templateId_createdAt_idx" ON public.document_number_logs USING btree ("templateId", "createdAt");


--
-- Name: document_number_logs_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "document_number_logs_userId_idx" ON public.document_number_logs USING btree ("userId");


--
-- Name: document_number_templates_documentType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "document_number_templates_documentType_idx" ON public.document_number_templates USING btree ("documentType");


--
-- Name: document_number_templates_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "document_number_templates_isActive_idx" ON public.document_number_templates USING btree ("isActive");


--
-- Name: document_render_logs_caseId_documentType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "document_render_logs_caseId_documentType_idx" ON public.document_render_logs USING btree ("caseId", "documentType");


--
-- Name: document_render_logs_incidentId_documentType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "document_render_logs_incidentId_documentType_idx" ON public.document_render_logs USING btree ("incidentId", "documentType");


--
-- Name: document_render_logs_petitionId_documentType_renderedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "document_render_logs_petitionId_documentType_renderedAt_idx" ON public.document_render_logs USING btree ("petitionId", "documentType", "renderedAt" DESC);


--
-- Name: document_render_logs_renderedById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "document_render_logs_renderedById_idx" ON public.document_render_logs USING btree ("renderedById");


--
-- Name: document_templates_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_templates_category_idx ON public.document_templates USING btree (category);


--
-- Name: document_templates_entityType_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "document_templates_entityType_code_key" ON public.document_templates USING btree ("entityType", code) WHERE ("deletedAt" IS NULL);


--
-- Name: document_templates_entityType_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "document_templates_entityType_status_idx" ON public.document_templates USING btree ("entityType", status);


--
-- Name: documents_caseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "documents_caseId_idx" ON public.documents USING btree ("caseId");


--
-- Name: documents_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "documents_createdAt_idx" ON public.documents USING btree ("createdAt");


--
-- Name: documents_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "documents_deletedAt_idx" ON public.documents USING btree ("deletedAt");


--
-- Name: documents_description_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_description_bd_trgm ON public.documents USING gin (description_bd public.gin_trgm_ops);


--
-- Name: documents_documentType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "documents_documentType_idx" ON public.documents USING btree ("documentType");


--
-- Name: documents_incidentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "documents_incidentId_idx" ON public.documents USING btree ("incidentId");


--
-- Name: documents_original_name_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_original_name_bd_trgm ON public.documents USING gin (original_name_bd public.gin_trgm_ops);


--
-- Name: documents_petitionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "documents_petitionId_idx" ON public.documents USING btree ("petitionId");


--
-- Name: documents_tim_kiem_bd_chua_nap; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_tim_kiem_bd_chua_nap ON public.documents USING btree (id) WHERE (tim_kiem_bd IS NULL);


--
-- Name: documents_tim_kiem_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_tim_kiem_bd_trgm ON public.documents USING gin (tim_kiem_bd public.gin_trgm_ops);


--
-- Name: documents_title_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_title_bd_trgm ON public.documents USING gin (title_bd public.gin_trgm_ops);


--
-- Name: documents_uploadedById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "documents_uploadedById_idx" ON public.documents USING btree ("uploadedById");


--
-- Name: enrollment_token_audits_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "enrollment_token_audits_expiresAt_idx" ON public.enrollment_token_audits USING btree ("expiresAt");


--
-- Name: enrollment_token_audits_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "enrollment_token_audits_userId_idx" ON public.enrollment_token_audits USING btree ("userId");


--
-- Name: event_categories_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX event_categories_slug_key ON public.event_categories USING btree (slug);


--
-- Name: event_categories_sortOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "event_categories_sortOrder_idx" ON public.event_categories USING btree ("sortOrder");


--
-- Name: event_reminder_dispatches_reminderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "event_reminder_dispatches_reminderId_idx" ON public.event_reminder_dispatches USING btree ("reminderId");


--
-- Name: event_reminder_dispatches_reminderId_occurrenceDate_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "event_reminder_dispatches_reminderId_occurrenceDate_key" ON public.event_reminder_dispatches USING btree ("reminderId", "occurrenceDate");


--
-- Name: event_reminder_dispatches_sentAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "event_reminder_dispatches_sentAt_idx" ON public.event_reminder_dispatches USING btree ("sentAt");


--
-- Name: event_reminders_eventId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "event_reminders_eventId_idx" ON public.event_reminders USING btree ("eventId");


--
-- Name: event_reminders_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "event_reminders_userId_idx" ON public.event_reminders USING btree ("userId");


--
-- Name: evidences_caseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "evidences_caseId_idx" ON public.evidences USING btree ("caseId");


--
-- Name: evidences_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "evidences_deletedAt_idx" ON public.evidences USING btree ("deletedAt");


--
-- Name: evidences_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX evidences_status_idx ON public.evidences USING btree (status);


--
-- Name: ewrr_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ewrr_status_idx ON public.edit_window_reset_requests USING btree (status);


--
-- Name: ewrr_subject_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ewrr_subject_idx ON public.edit_window_reset_requests USING btree ("subjectType", "subjectId");


--
-- Name: ewrr_unique_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ewrr_unique_pending ON public.edit_window_reset_requests USING btree ("subjectType", "subjectId", "requestedById") WHERE (status = 'PENDING'::text);


--
-- Name: exchange_messages_exchangeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "exchange_messages_exchangeId_idx" ON public.exchange_messages USING btree ("exchangeId");


--
-- Name: exchanges_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "exchanges_deletedAt_idx" ON public.exchanges USING btree ("deletedAt");


--
-- Name: exchanges_legacySourceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "exchanges_legacySourceId_key" ON public.exchanges USING btree ("legacySourceId");


--
-- Name: exchanges_receiver_unit_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exchanges_receiver_unit_bd_trgm ON public.exchanges USING gin (receiver_unit_bd public.gin_trgm_ops);


--
-- Name: exchanges_record_type_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exchanges_record_type_bd_trgm ON public.exchanges USING gin (record_type_bd public.gin_trgm_ops);


--
-- Name: exchanges_sender_unit_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exchanges_sender_unit_bd_trgm ON public.exchanges USING gin (sender_unit_bd public.gin_trgm_ops);


--
-- Name: exchanges_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exchanges_status_idx ON public.exchanges USING btree (status);


--
-- Name: exchanges_tim_kiem_bd_chua_nap; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exchanges_tim_kiem_bd_chua_nap ON public.exchanges USING btree (id) WHERE (tim_kiem_bd IS NULL);


--
-- Name: exchanges_tim_kiem_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exchanges_tim_kiem_bd_trgm ON public.exchanges USING gin (tim_kiem_bd public.gin_trgm_ops);


--
-- Name: feature_flags_enabled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feature_flags_enabled_idx ON public.feature_flags USING btree (enabled);


--
-- Name: guidance_records_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "guidance_records_deletedAt_idx" ON public.guidance_records USING btree ("deletedAt");


--
-- Name: guidance_records_legacySourceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "guidance_records_legacySourceId_key" ON public.guidance_records USING btree ("legacySourceId");


--
-- Name: guidance_records_nguoi_duoc_huong_dan_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guidance_records_nguoi_duoc_huong_dan_bd_trgm ON public.guidance_records USING gin (nguoi_duoc_huong_dan_bd public.gin_trgm_ops);


--
-- Name: guidance_records_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guidance_records_status_idx ON public.guidance_records USING btree (status);


--
-- Name: guidance_records_subject_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guidance_records_subject_bd_trgm ON public.guidance_records USING gin (subject_bd public.gin_trgm_ops);


--
-- Name: guidance_records_tim_kiem_bd_chua_nap; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guidance_records_tim_kiem_bd_chua_nap ON public.guidance_records USING btree (id) WHERE (tim_kiem_bd IS NULL);


--
-- Name: guidance_records_tim_kiem_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guidance_records_tim_kiem_bd_trgm ON public.guidance_records USING gin (tim_kiem_bd public.gin_trgm_ops);


--
-- Name: guidance_records_unit_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guidance_records_unit_bd_trgm ON public.guidance_records USING gin (unit_bd public.gin_trgm_ops);


--
-- Name: idx_audit_logs_metadata_text; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_metadata_text ON public.audit_logs USING gin (((metadata)::text) public.gin_trgm_ops);


--
-- Name: idx_audit_logs_subject_subjectid_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_subject_subjectid_created ON public.audit_logs USING btree (subject, "subjectId", "createdAt" DESC) WHERE ((subject IS NOT NULL) AND ("subjectId" IS NOT NULL));


--
-- Name: incident_handoffs_incidentId_sentAt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "incident_handoffs_incidentId_sentAt_id_idx" ON public.incident_handoffs USING btree ("incidentId", "sentAt", id);


--
-- Name: incident_handoffs_one_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX incident_handoffs_one_pending ON public.incident_handoffs USING btree ("incidentId") WHERE (state = 'PENDING'::public."IncidentHandoffState");


--
-- Name: incident_handoffs_sentById_requestKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "incident_handoffs_sentById_requestKey_key" ON public.incident_handoffs USING btree ("sentById", "requestKey");


--
-- Name: incident_handoffs_toTeamId_state_sentAt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "incident_handoffs_toTeamId_state_sentAt_id_idx" ON public.incident_handoffs USING btree ("toTeamId", state, "sentAt", id);


--
-- Name: incident_status_history_incidentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "incident_status_history_incidentId_idx" ON public.incident_status_history USING btree ("incidentId");


--
-- Name: incidents_assignedTeamId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "incidents_assignedTeamId_idx" ON public.incidents USING btree ("assignedTeamId");


--
-- Name: incidents_ben_vu_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX incidents_ben_vu_bd_trgm ON public.incidents USING gin (ben_vu_bd public.gin_trgm_ops);


--
-- Name: incidents_chuyen_tu_don_vi_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX incidents_chuyen_tu_don_vi_bd_trgm ON public.incidents USING gin (chuyen_tu_don_vi_bd public.gin_trgm_ops);


--
-- Name: incidents_cmnd_norm_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX incidents_cmnd_norm_trgm ON public.incidents USING gin (cmnd_nguoi_to_giac_norm public.gin_trgm_ops);


--
-- Name: incidents_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX incidents_code_key ON public.incidents USING btree (code);


--
-- Name: incidents_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "incidents_createdAt_idx" ON public.incidents USING btree ("createdAt");


--
-- Name: incidents_createdById_createRequestKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "incidents_createdById_createRequestKey_key" ON public.incidents USING btree ("createdById", "createRequestKey");


--
-- Name: incidents_crimeChinhId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "incidents_crimeChinhId_idx" ON public.incidents USING btree ("crimeChinhId");


--
-- Name: incidents_deadlineRuleVersionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "incidents_deadlineRuleVersionId_idx" ON public.incidents USING btree ("deadlineRuleVersionId");


--
-- Name: incidents_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "incidents_deletedAt_idx" ON public.incidents USING btree ("deletedAt");


--
-- Name: incidents_deletedAt_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "incidents_deletedAt_status_idx" ON public.incidents USING btree ("deletedAt", status) WHERE ("deletedAt" IS NULL);


--
-- Name: incidents_description_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX incidents_description_bd_trgm ON public.incidents USING gin (description_bd public.gin_trgm_ops);


--
-- Name: incidents_don_vi_giai_quyet_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX incidents_don_vi_giai_quyet_bd_trgm ON public.incidents USING gin (don_vi_giai_quyet_bd public.gin_trgm_ops);


--
-- Name: incidents_editedAfterWindow_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "incidents_editedAfterWindow_idx" ON public.incidents USING btree ("editedAfterWindow") WHERE ("editedAfterWindow" = true);


--
-- Name: incidents_giaHan1RuleVersionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "incidents_giaHan1RuleVersionId_idx" ON public.incidents USING btree ("giaHan1RuleVersionId");


--
-- Name: incidents_giaHan2RuleVersionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "incidents_giaHan2RuleVersionId_idx" ON public.incidents USING btree ("giaHan2RuleVersionId");


--
-- Name: incidents_handledIncidentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "incidents_handledIncidentId_key" ON public.incidents USING btree ("handledIncidentId");


--
-- Name: incidents_ket_qua_xu_ly_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX incidents_ket_qua_xu_ly_bd_trgm ON public.incidents USING gin (ket_qua_xu_ly_bd public.gin_trgm_ops);


--
-- Name: incidents_legacyId_legacyCollection_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "incidents_legacyId_legacyCollection_idx" ON public.incidents USING btree ("legacyId", "legacyCollection");


--
-- Name: incidents_legacySourceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "incidents_legacySourceId_key" ON public.incidents USING btree ("legacySourceId");


--
-- Name: incidents_loaiKetQua_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "incidents_loaiKetQua_idx" ON public.incidents USING btree ("loaiKetQua");


--
-- Name: incidents_name_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX incidents_name_bd_trgm ON public.incidents USING gin (name_bd public.gin_trgm_ops);


--
-- Name: incidents_ngayDeXuat_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "incidents_ngayDeXuat_id_idx" ON public.incidents USING btree ("ngayDeXuat" DESC NULLS LAST, id DESC) WHERE ("deletedAt" IS NULL);


--
-- Name: incidents_ngayDeXuat_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "incidents_ngayDeXuat_idx" ON public.incidents USING btree ("ngayDeXuat");


--
-- Name: incidents_ngayDeXuat_sttSort_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "incidents_ngayDeXuat_sttSort_id_idx" ON public.incidents USING btree ("ngayDeXuat" DESC NULLS LAST, "sttSort" DESC NULLS LAST, id DESC) WHERE ("deletedAt" IS NULL);


--
-- Name: incidents_ngay_giai_quyet_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX incidents_ngay_giai_quyet_idx ON public.incidents USING btree (ngay_giai_quyet);


--
-- Name: incidents_sdt_norm_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX incidents_sdt_norm_trgm ON public.incidents USING gin (sdt_nguoi_to_giac_norm public.gin_trgm_ops);


--
-- Name: incidents_soHoSoCu_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "incidents_soHoSoCu_idx" ON public.incidents USING btree ("soHoSoCu");


--
-- Name: incidents_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX incidents_status_idx ON public.incidents USING btree (status);


--
-- Name: incidents_sttCu_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "incidents_sttCu_idx" ON public.incidents USING btree ("sttCu");


--
-- Name: incidents_sttSort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "incidents_sttSort_idx" ON public.incidents USING btree ("sttSort" DESC NULLS LAST, id DESC);


--
-- Name: incidents_tim_kiem_bd_chua_nap; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX incidents_tim_kiem_bd_chua_nap ON public.incidents USING btree (id) WHERE (tim_kiem_bd IS NULL);


--
-- Name: incidents_tim_kiem_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX incidents_tim_kiem_bd_trgm ON public.incidents USING gin (tim_kiem_bd public.gin_trgm_ops);


--
-- Name: incidents_unitId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "incidents_unitId_idx" ON public.incidents USING btree ("unitId");


--
-- Name: investigation_supplements_caseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "investigation_supplements_caseId_idx" ON public.investigation_supplements USING btree ("caseId");


--
-- Name: investigation_supplements_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "investigation_supplements_createdAt_idx" ON public.investigation_supplements USING btree ("createdAt");


--
-- Name: investigation_supplements_legacySourceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "investigation_supplements_legacySourceId_key" ON public.investigation_supplements USING btree ("legacySourceId");


--
-- Name: lawyers_barNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "lawyers_barNumber_key" ON public.lawyers USING btree ("barNumber");


--
-- Name: lawyers_bar_number_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lawyers_bar_number_bd_trgm ON public.lawyers USING gin (bar_number_bd public.gin_trgm_ops);


--
-- Name: lawyers_caseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "lawyers_caseId_idx" ON public.lawyers USING btree ("caseId");


--
-- Name: lawyers_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "lawyers_deletedAt_idx" ON public.lawyers USING btree ("deletedAt");


--
-- Name: lawyers_full_name_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lawyers_full_name_bd_trgm ON public.lawyers USING gin (full_name_bd public.gin_trgm_ops);


--
-- Name: lawyers_law_firm_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lawyers_law_firm_bd_trgm ON public.lawyers USING gin (law_firm_bd public.gin_trgm_ops);


--
-- Name: lawyers_legacySourceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "lawyers_legacySourceId_key" ON public.lawyers USING btree ("legacySourceId");


--
-- Name: lawyers_phone_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lawyers_phone_bd_trgm ON public.lawyers USING gin (phone_bd public.gin_trgm_ops);


--
-- Name: lawyers_subjectId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "lawyers_subjectId_idx" ON public.lawyers USING btree ("subjectId");


--
-- Name: lawyers_tim_kiem_bd_chua_nap; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lawyers_tim_kiem_bd_chua_nap ON public.lawyers USING btree (id) WHERE (tim_kiem_bd IS NULL);


--
-- Name: lawyers_tim_kiem_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lawyers_tim_kiem_bd_trgm ON public.lawyers USING gin (tim_kiem_bd public.gin_trgm_ops);


--
-- Name: legacy_field_diagnostics_runId_field_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "legacy_field_diagnostics_runId_field_idx" ON public.legacy_field_diagnostics USING btree ("runId", field);


--
-- Name: legacy_import_errors_runId_reason_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "legacy_import_errors_runId_reason_idx" ON public.legacy_import_errors USING btree ("runId", reason);


--
-- Name: legacy_import_runs_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX legacy_import_runs_status_idx ON public.legacy_import_runs USING btree (status);


--
-- Name: legacy_staging_runId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "legacy_staging_runId_idx" ON public.legacy_staging USING btree ("runId");


--
-- Name: legacy_staging_sourceFile_sourceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "legacy_staging_sourceFile_sourceId_key" ON public.legacy_staging USING btree ("sourceFile", "sourceId");


--
-- Name: legacy_status_inferences_hoSoId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "legacy_status_inferences_hoSoId_idx" ON public.legacy_status_inferences USING btree ("hoSoId");


--
-- Name: legacy_status_inferences_runId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "legacy_status_inferences_runId_idx" ON public.legacy_status_inferences USING btree ("runId");


--
-- Name: legacy_status_inferences_sttCu_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "legacy_status_inferences_sttCu_idx" ON public.legacy_status_inferences USING btree ("sttCu");


--
-- Name: legacy_unit_aliases_kind_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX legacy_unit_aliases_kind_idx ON public.legacy_unit_aliases USING btree (kind);


--
-- Name: legacy_unit_aliases_rawValue_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "legacy_unit_aliases_rawValue_key" ON public.legacy_unit_aliases USING btree ("rawValue");


--
-- Name: master_classes_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "master_classes_isActive_idx" ON public.master_classes USING btree ("isActive");


--
-- Name: master_classes_type_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX master_classes_type_code_key ON public.master_classes USING btree (type, code);


--
-- Name: master_classes_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX master_classes_type_idx ON public.master_classes USING btree (type);


--
-- Name: monthly_report_adjustments_reportId_appendix_targetKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "monthly_report_adjustments_reportId_appendix_targetKey_idx" ON public.monthly_report_adjustments USING btree ("reportId", appendix, "targetKey");


--
-- Name: monthly_report_contributions_entityType_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "monthly_report_contributions_entityType_entityId_idx" ON public.monthly_report_contributions USING btree ("entityType", "entityId");


--
-- Name: monthly_report_contributions_reportId_appendix_metricKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "monthly_report_contributions_reportId_appendix_metricKey_idx" ON public.monthly_report_contributions USING btree ("reportId", appendix, "metricKey");


--
-- Name: monthly_report_packages_createdById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "monthly_report_packages_createdById_idx" ON public.monthly_report_packages USING btree ("createdById");


--
-- Name: monthly_report_packages_periodStart_periodEnd_scopeKey_version_; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "monthly_report_packages_periodStart_periodEnd_scopeKey_version_" ON public.monthly_report_packages USING btree ("periodStart", "periodEnd", "scopeKey", version);


--
-- Name: monthly_report_packages_periodStart_periodEnd_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "monthly_report_packages_periodStart_periodEnd_status_idx" ON public.monthly_report_packages USING btree ("periodStart", "periodEnd", status);


--
-- Name: notification_preferences_userId_eventType_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "notification_preferences_userId_eventType_key" ON public.notification_preferences USING btree ("userId", "eventType");


--
-- Name: notification_preferences_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "notification_preferences_userId_idx" ON public.notification_preferences USING btree ("userId");


--
-- Name: notifications_acknowledgedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "notifications_acknowledgedAt_idx" ON public.notifications USING btree ("acknowledgedAt");


--
-- Name: notifications_pushNextRetryAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "notifications_pushNextRetryAt_idx" ON public.notifications USING btree ("pushNextRetryAt");


--
-- Name: notifications_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "notifications_userId_createdAt_idx" ON public.notifications USING btree ("userId", "createdAt");


--
-- Name: notifications_userId_isRead_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "notifications_userId_isRead_idx" ON public.notifications USING btree ("userId", "isRead");


--
-- Name: otp_codes_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "otp_codes_userId_idx" ON public.otp_codes USING btree ("userId");


--
-- Name: overdue_notifications_notifiedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "overdue_notifications_notifiedAt_idx" ON public.overdue_notifications USING btree ("notifiedAt");


--
-- Name: overdue_notifications_resourceType_resourceId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "overdue_notifications_resourceType_resourceId_userId_key" ON public.overdue_notifications USING btree ("resourceType", "resourceId", "userId");


--
-- Name: permissions_action_subject_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX permissions_action_subject_key ON public.permissions USING btree (action, subject);


--
-- Name: petition_assignments_petitionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "petition_assignments_petitionId_idx" ON public.petition_assignments USING btree ("petitionId");


--
-- Name: petition_assignments_petitionId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "petition_assignments_petitionId_userId_key" ON public.petition_assignments USING btree ("petitionId", "userId");


--
-- Name: petitions_assignedTeamId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "petitions_assignedTeamId_idx" ON public.petitions USING btree ("assignedTeamId");


--
-- Name: petitions_canBoDeXuatId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "petitions_canBoDeXuatId_idx" ON public.petitions USING btree ("canBoDeXuatId");


--
-- Name: petitions_crimeChinhId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "petitions_crimeChinhId_idx" ON public.petitions USING btree ("crimeChinhId");


--
-- Name: petitions_deadlineRuleVersionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "petitions_deadlineRuleVersionId_idx" ON public.petitions USING btree ("deadlineRuleVersionId");


--
-- Name: petitions_deadline_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX petitions_deadline_idx ON public.petitions USING btree (deadline);


--
-- Name: petitions_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "petitions_deletedAt_idx" ON public.petitions USING btree ("deletedAt");


--
-- Name: petitions_deletedAt_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "petitions_deletedAt_status_idx" ON public.petitions USING btree ("deletedAt", status) WHERE ("deletedAt" IS NULL);


--
-- Name: petitions_detail_content_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX petitions_detail_content_bd_trgm ON public.petitions USING gin (detail_content_bd public.gin_trgm_ops);


--
-- Name: petitions_don_vi_giai_quyet_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX petitions_don_vi_giai_quyet_bd_trgm ON public.petitions USING gin (don_vi_giai_quyet_bd public.gin_trgm_ops);


--
-- Name: petitions_editedAfterWindow_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "petitions_editedAfterWindow_idx" ON public.petitions USING btree ("editedAfterWindow") WHERE ("editedAfterWindow" = true);


--
-- Name: petitions_ket_qua_xu_ly_khac_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX petitions_ket_qua_xu_ly_khac_bd_trgm ON public.petitions USING gin (ket_qua_xu_ly_khac_bd public.gin_trgm_ops);


--
-- Name: petitions_legacyId_legacyCollection_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "petitions_legacyId_legacyCollection_idx" ON public.petitions USING btree ("legacyId", "legacyCollection");


--
-- Name: petitions_legacySourceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "petitions_legacySourceId_key" ON public.petitions USING btree ("legacySourceId");


--
-- Name: petitions_linkedCaseId_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "petitions_linkedCaseId_unique" ON public.petitions USING btree ("linkedCaseId") WHERE ("linkedCaseId" IS NOT NULL);


--
-- Name: petitions_loai_thong_tin_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX petitions_loai_thong_tin_bd_trgm ON public.petitions USING gin (loai_thong_tin_bd public.gin_trgm_ops);


--
-- Name: petitions_ngayDeXuat_sttSort_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "petitions_ngayDeXuat_sttSort_id_idx" ON public.petitions USING btree ("ngayDeXuat" DESC NULLS LAST, "sttSort" DESC NULLS LAST, id DESC) WHERE ("deletedAt" IS NULL);


--
-- Name: petitions_ngay_giai_quyet_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX petitions_ngay_giai_quyet_idx ON public.petitions USING btree (ngay_giai_quyet);


--
-- Name: petitions_nguon_don_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX petitions_nguon_don_bd_trgm ON public.petitions USING gin (nguon_don_bd public.gin_trgm_ops);


--
-- Name: petitions_receivedDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "petitions_receivedDate_idx" ON public.petitions USING btree ("receivedDate");


--
-- Name: petitions_senderName_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "petitions_senderName_idx" ON public.petitions USING btree ("senderName");


--
-- Name: petitions_senderName_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "petitions_senderName_trgm_idx" ON public.petitions USING gin ("senderName" public.gin_trgm_ops);


--
-- Name: petitions_sender_address_chuan_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX petitions_sender_address_chuan_idx ON public.petitions USING btree (sender_address_chuan);


--
-- Name: petitions_sender_name_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX petitions_sender_name_bd_trgm ON public.petitions USING gin (sender_name_bd public.gin_trgm_ops);


--
-- Name: petitions_sender_name_chuan_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX petitions_sender_name_chuan_idx ON public.petitions USING btree (sender_name_chuan);


--
-- Name: petitions_sender_phone_chuan_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX petitions_sender_phone_chuan_idx ON public.petitions USING btree (sender_phone_chuan);


--
-- Name: petitions_soHoSoCu_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "petitions_soHoSoCu_idx" ON public.petitions USING btree ("soHoSoCu");


--
-- Name: petitions_sortReceivedDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "petitions_sortReceivedDate_idx" ON public.petitions USING btree ("sortReceivedDate" DESC NULLS LAST, id DESC) WHERE ("deletedAt" IS NULL);


--
-- Name: petitions_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX petitions_status_idx ON public.petitions USING btree (status);


--
-- Name: petitions_sttCu_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "petitions_sttCu_idx" ON public.petitions USING btree ("sttCu");


--
-- Name: petitions_sttSort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "petitions_sttSort_idx" ON public.petitions USING btree ("sttSort" DESC NULLS LAST, id DESC);


--
-- Name: petitions_stt_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX petitions_stt_key ON public.petitions USING btree (stt);


--
-- Name: petitions_suspected_person_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX petitions_suspected_person_bd_trgm ON public.petitions USING gin (suspected_person_bd public.gin_trgm_ops);


--
-- Name: petitions_suspected_person_chuan_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX petitions_suspected_person_chuan_idx ON public.petitions USING btree (suspected_person_chuan);


--
-- Name: petitions_tim_kiem_bd_chua_nap; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX petitions_tim_kiem_bd_chua_nap ON public.petitions USING btree (id) WHERE (tim_kiem_bd IS NULL);


--
-- Name: petitions_tim_kiem_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX petitions_tim_kiem_bd_trgm ON public.petitions USING gin (tim_kiem_bd public.gin_trgm_ops);


--
-- Name: phu_luc_report_logs_generatedById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "phu_luc_report_logs_generatedById_idx" ON public.phu_luc_report_logs USING btree ("generatedById");


--
-- Name: phu_luc_report_logs_reportType_periodStart_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "phu_luc_report_logs_reportType_periodStart_idx" ON public.phu_luc_report_logs USING btree ("reportType", "periodStart");


--
-- Name: phu_luc_report_logs_unitCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "phu_luc_report_logs_unitCode_idx" ON public.phu_luc_report_logs USING btree ("unitCode");


--
-- Name: proposals_content_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX proposals_content_bd_trgm ON public.proposals USING gin (content_bd public.gin_trgm_ops);


--
-- Name: proposals_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "proposals_createdAt_idx" ON public.proposals USING btree ("createdAt");


--
-- Name: proposals_createdById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "proposals_createdById_idx" ON public.proposals USING btree ("createdById");


--
-- Name: proposals_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "proposals_deletedAt_idx" ON public.proposals USING btree ("deletedAt");


--
-- Name: proposals_legacySourceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "proposals_legacySourceId_key" ON public.proposals USING btree ("legacySourceId");


--
-- Name: proposals_proposalNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "proposals_proposalNumber_key" ON public.proposals USING btree ("proposalNumber");


--
-- Name: proposals_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX proposals_status_idx ON public.proposals USING btree (status);


--
-- Name: proposals_tim_kiem_bd_chua_nap; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX proposals_tim_kiem_bd_chua_nap ON public.proposals USING btree (id) WHERE (tim_kiem_bd IS NULL);


--
-- Name: proposals_tim_kiem_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX proposals_tim_kiem_bd_trgm ON public.proposals USING gin (tim_kiem_bd public.gin_trgm_ops);


--
-- Name: proposals_unit_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX proposals_unit_bd_trgm ON public.proposals USING gin (unit_bd public.gin_trgm_ops);


--
-- Name: report_tdc_drafts_fromDate_toDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "report_tdc_drafts_fromDate_toDate_idx" ON public.report_tdc_drafts USING btree ("fromDate", "toDate");


--
-- Name: report_tdc_drafts_loaiBaoCao_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "report_tdc_drafts_loaiBaoCao_idx" ON public.report_tdc_drafts USING btree ("loaiBaoCao");


--
-- Name: report_tdc_drafts_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX report_tdc_drafts_status_idx ON public.report_tdc_drafts USING btree (status);


--
-- Name: roles_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX roles_name_key ON public.roles USING btree (name);


--
-- Name: subjects_caseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "subjects_caseId_idx" ON public.subjects USING btree ("caseId");


--
-- Name: subjects_crimeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "subjects_crimeId_idx" ON public.subjects USING btree ("crimeId");


--
-- Name: subjects_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "subjects_deletedAt_idx" ON public.subjects USING btree ("deletedAt");


--
-- Name: subjects_full_name_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subjects_full_name_bd_trgm ON public.subjects USING gin (full_name_bd public.gin_trgm_ops);


--
-- Name: subjects_id_number_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subjects_id_number_bd_trgm ON public.subjects USING gin (id_number_bd public.gin_trgm_ops);


--
-- Name: subjects_legacySourceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "subjects_legacySourceId_idx" ON public.subjects USING btree ("legacySourceId");


--
-- Name: subjects_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subjects_status_idx ON public.subjects USING btree (status);


--
-- Name: subjects_tim_kiem_bd_chua_nap; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subjects_tim_kiem_bd_chua_nap ON public.subjects USING btree (id) WHERE (tim_kiem_bd IS NULL);


--
-- Name: subjects_tim_kiem_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subjects_tim_kiem_bd_trgm ON public.subjects USING gin (tim_kiem_bd public.gin_trgm_ops);


--
-- Name: subjects_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subjects_type_idx ON public.subjects USING btree (type);


--
-- Name: suspension_action_plans_caseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "suspension_action_plans_caseId_idx" ON public.suspension_action_plans USING btree ("caseId");


--
-- Name: suspension_action_plans_incidentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "suspension_action_plans_incidentId_idx" ON public.suspension_action_plans USING btree ("incidentId");


--
-- Name: system_settings_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX system_settings_key_key ON public.system_settings USING btree (key);


--
-- Name: teams_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX teams_code_key ON public.teams USING btree (code);


--
-- Name: teams_level_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX teams_level_idx ON public.teams USING btree (level);


--
-- Name: teams_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX teams_name_key ON public.teams USING btree (name);


--
-- Name: teams_parentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "teams_parentId_idx" ON public.teams USING btree ("parentId");


--
-- Name: teams_wardId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "teams_wardId_idx" ON public.teams USING btree ("wardId");


--
-- Name: user_abbreviations_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "user_abbreviations_userId_idx" ON public.user_abbreviations USING btree ("userId");


--
-- Name: user_abbreviations_userId_shortcut_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "user_abbreviations_userId_shortcut_key" ON public.user_abbreviations USING btree ("userId", shortcut);


--
-- Name: user_devices_fcmToken_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "user_devices_fcmToken_key" ON public.user_devices USING btree ("fcmToken");


--
-- Name: user_devices_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "user_devices_userId_idx" ON public.user_devices USING btree ("userId");


--
-- Name: user_export_preferences_userId_entityType_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "user_export_preferences_userId_entityType_key" ON public.user_export_preferences USING btree ("userId", "entityType");


--
-- Name: user_export_preferences_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "user_export_preferences_userId_idx" ON public.user_export_preferences USING btree ("userId");


--
-- Name: user_shortcuts_userId_action_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "user_shortcuts_userId_action_key" ON public.user_shortcuts USING btree ("userId", action);


--
-- Name: user_shortcuts_userId_binding_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "user_shortcuts_userId_binding_key" ON public.user_shortcuts USING btree ("userId", binding);


--
-- Name: user_shortcuts_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "user_shortcuts_userId_idx" ON public.user_shortcuts USING btree ("userId");


--
-- Name: user_table_layouts_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "user_table_layouts_userId_idx" ON public.user_table_layouts USING btree ("userId");


--
-- Name: user_table_layouts_userId_tableKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "user_table_layouts_userId_tableKey_key" ON public.user_table_layouts USING btree ("userId", "tableKey");


--
-- Name: user_teams_teamId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "user_teams_teamId_idx" ON public.user_teams USING btree ("teamId");


--
-- Name: users_email_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_email_bd_trgm ON public.users USING gin (email_bd public.gin_trgm_ops);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_enrollmentExpiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "users_enrollmentExpiresAt_idx" ON public.users USING btree ("enrollmentExpiresAt") WHERE ("enrollmentExpiresAt" IS NOT NULL);


--
-- Name: users_ho_ten_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_ho_ten_bd_trgm ON public.users USING gin (ho_ten_bd public.gin_trgm_ops);


--
-- Name: users_tim_kiem_bd_chua_nap; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_tim_kiem_bd_chua_nap ON public.users USING btree (id) WHERE (tim_kiem_bd IS NULL);


--
-- Name: users_tim_kiem_bd_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_tim_kiem_bd_trgm ON public.users USING gin (tim_kiem_bd public.gin_trgm_ops);


--
-- Name: users_username_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username);


--
-- Name: users_workId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "users_workId_key" ON public.users USING btree ("workId") WHERE ("workId" IS NOT NULL);


--
-- Name: vks_meeting_records_caseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "vks_meeting_records_caseId_idx" ON public.vks_meeting_records USING btree ("caseId");


--
-- Name: vks_meeting_records_incidentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "vks_meeting_records_incidentId_idx" ON public.vks_meeting_records USING btree ("incidentId");


--
-- Name: xlsx_import_logs_fileSha_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "xlsx_import_logs_fileSha_key" ON public.xlsx_import_logs USING btree ("fileSha");


--
-- Name: xlsx_import_logs_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX xlsx_import_logs_status_idx ON public.xlsx_import_logs USING btree (status);


--
-- Name: xlsx_import_logs_uploadedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "xlsx_import_logs_uploadedAt_idx" ON public.xlsx_import_logs USING btree ("uploadedAt");


--
-- Name: xlsx_import_logs_uploadedById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "xlsx_import_logs_uploadedById_idx" ON public.xlsx_import_logs USING btree ("uploadedById");


--
-- Name: xlsx_import_staging_conflictReason_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "xlsx_import_staging_conflictReason_idx" ON public.xlsx_import_staging USING btree ("conflictReason");


--
-- Name: xlsx_import_staging_importLogId_sheetName_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "xlsx_import_staging_importLogId_sheetName_idx" ON public.xlsx_import_staging USING btree ("importLogId", "sheetName");


--
-- Name: incidents pc02_dinh_danh_incidents; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pc02_dinh_danh_incidents BEFORE INSERT OR UPDATE OF "sdtNguoiToGiac", "cmndNguoiToGiac" ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.pc02_dat_dinh_danh_incidents();


--
-- Name: cases pc02_stt_sort_cases; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pc02_stt_sort_cases BEFORE INSERT OR UPDATE OF "caseCode" ON public.cases FOR EACH ROW EXECUTE FUNCTION public.pc02_dat_stt_sort_cases();


--
-- Name: incidents pc02_stt_sort_incidents; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pc02_stt_sort_incidents BEFORE INSERT OR UPDATE OF code ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.pc02_dat_stt_sort_incidents();


--
-- Name: petitions pc02_stt_sort_petitions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pc02_stt_sort_petitions BEFORE INSERT OR UPDATE OF stt ON public.petitions FOR EACH ROW EXECUTE FUNCTION public.pc02_dat_stt_sort_petitions();


--
-- Name: address_mappings pc02_tim_kiem_address_mappings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pc02_tim_kiem_address_mappings BEFORE INSERT OR UPDATE OF "oldWard", "oldDistrict", "newWard", province, note ON public.address_mappings FOR EACH ROW EXECUTE FUNCTION public.pc02_dat_tim_kiem_address_mappings();


--
-- Name: audit_logs pc02_tim_kiem_audit_logs; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pc02_tim_kiem_audit_logs BEFORE INSERT OR UPDATE OF action, subject, "subjectId", "ipAddress" ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.pc02_dat_tim_kiem_audit_logs();


--
-- Name: cases pc02_tim_kiem_cases; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pc02_tim_kiem_cases BEFORE INSERT OR UPDATE OF "caseCode", "sttCu", "nguonDon", "tenCungCap", "moTaChiTiet", "donViGiaiQuyet", "ketQuaXuLyKhac", don_vi_giao, so_quyet_dinh_uy_thac, "nghiVanDoiTuong", ket_qua_uy_thac, crime, name, "soHoSoCu" ON public.cases FOR EACH ROW EXECUTE FUNCTION public.pc02_dat_tim_kiem_cases();


--
-- Name: crimes pc02_tim_kiem_crimes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pc02_tim_kiem_crimes BEFORE INSERT OR UPDATE OF code, name ON public.crimes FOR EACH ROW EXECUTE FUNCTION public.pc02_dat_tim_kiem_crimes();


--
-- Name: delegations pc02_tim_kiem_delegations; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pc02_tim_kiem_delegations BEFORE INSERT OR UPDATE OF "delegationNumber", content, "receivingUnit" ON public.delegations FOR EACH ROW EXECUTE FUNCTION public.pc02_dat_tim_kiem_delegations();


--
-- Name: directories pc02_tim_kiem_directories; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pc02_tim_kiem_directories BEFORE INSERT OR UPDATE OF code, name, description ON public.directories FOR EACH ROW EXECUTE FUNCTION public.pc02_dat_tim_kiem_directories();


--
-- Name: documents pc02_tim_kiem_documents; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pc02_tim_kiem_documents BEFORE INSERT OR UPDATE OF title, "originalName", description ON public.documents FOR EACH ROW EXECUTE FUNCTION public.pc02_dat_tim_kiem_documents();


--
-- Name: exchanges pc02_tim_kiem_exchanges; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pc02_tim_kiem_exchanges BEFORE INSERT OR UPDATE OF "recordCode", "recordType", "senderUnit", "receiverUnit", subject ON public.exchanges FOR EACH ROW EXECUTE FUNCTION public.pc02_dat_tim_kiem_exchanges();


--
-- Name: guidance_records pc02_tim_kiem_guidance_records; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pc02_tim_kiem_guidance_records BEFORE INSERT OR UPDATE OF subject, unit, "guidedPerson", "guidedPersonPhone", "guidanceContent" ON public.guidance_records FOR EACH ROW EXECUTE FUNCTION public.pc02_dat_tim_kiem_guidance_records();


--
-- Name: incidents pc02_tim_kiem_incidents; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pc02_tim_kiem_incidents BEFORE INSERT OR UPDATE OF code, "sttCu", "chuyenTuDonVi", "benVu", description, "donViGiaiQuyet", "ketQuaXuLy", name, "doiTuongCaNhan", "doiTuongToChuc", "soHoSoCu", ngay_viet_don_chu ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.pc02_dat_tim_kiem_incidents();


--
-- Name: lawyers pc02_tim_kiem_lawyers; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pc02_tim_kiem_lawyers BEFORE INSERT OR UPDATE OF "fullName", "barNumber", "lawFirm", phone ON public.lawyers FOR EACH ROW EXECUTE FUNCTION public.pc02_dat_tim_kiem_lawyers();


--
-- Name: petitions pc02_tim_kiem_petitions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pc02_tim_kiem_petitions BEFORE INSERT OR UPDATE OF stt, "sttCu", "loaiThongTin", "nguonDon", "senderName", "detailContent", "donViGiaiQuyet", "ketQuaXuLyKhac", "suspectedPerson", "soHoSoCu", ngay_viet_don_chu ON public.petitions FOR EACH ROW EXECUTE FUNCTION public.pc02_dat_tim_kiem_petitions();


--
-- Name: proposals pc02_tim_kiem_proposals; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pc02_tim_kiem_proposals BEFORE INSERT OR UPDATE OF "proposalNumber", content, unit ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.pc02_dat_tim_kiem_proposals();


--
-- Name: subjects pc02_tim_kiem_subjects; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pc02_tim_kiem_subjects BEFORE INSERT OR UPDATE OF "fullName", "idNumber", address, phone ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.pc02_dat_tim_kiem_subjects();


--
-- Name: users pc02_tim_kiem_users; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pc02_tim_kiem_users BEFORE INSERT OR UPDATE OF "lastName", "firstName", username, "workId", email ON public.users FOR EACH ROW EXECUTE FUNCTION public.pc02_dat_tim_kiem_users();


--
-- Name: audit_logs audit_logs_bulkOperationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "audit_logs_bulkOperationId_fkey" FOREIGN KEY ("bulkOperationId") REFERENCES public.bulk_operations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: bulk_import_jobs bulk_import_jobs_generatedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_import_jobs
    ADD CONSTRAINT "bulk_import_jobs_generatedBy_fkey" FOREIGN KEY ("generatedBy") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: bulk_operations bulk_operations_actorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_operations
    ADD CONSTRAINT "bulk_operations_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: calendar_event_occurrence_overrides calendar_event_occurrence_overrides_eventId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_event_occurrence_overrides
    ADD CONSTRAINT "calendar_event_occurrence_overrides_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES public.calendar_events(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT "calendar_events_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public.event_categories(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: calendar_events calendar_events_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT "calendar_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: calendar_events calendar_events_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT "calendar_events_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.teams(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_updatedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT "calendar_events_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: calendar_events calendar_events_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT "calendar_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: case_provenance_backfill_audit case_provenance_backfill_audit_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_provenance_backfill_audit
    ADD CONSTRAINT case_provenance_backfill_audit_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: case_statistics case_statistics_caseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_statistics
    ADD CONSTRAINT "case_statistics_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES public.cases(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: case_status_history case_status_history_caseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_status_history
    ADD CONSTRAINT "case_status_history_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES public.cases(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: case_status_history case_status_history_changedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_status_history
    ADD CONSTRAINT "case_status_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: cases cases_assignedTeamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT "cases_assignedTeamId_fkey" FOREIGN KEY ("assignedTeamId") REFERENCES public.teams(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: cases cases_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT "cases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: cases cases_crimeChinhId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT "cases_crimeChinhId_fkey" FOREIGN KEY ("crimeChinhId") REFERENCES public.crimes(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: cases cases_importLogId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT "cases_importLogId_fkey" FOREIGN KEY ("importLogId") REFERENCES public.xlsx_import_logs(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: cases cases_importedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT "cases_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: cases cases_investigatorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT "cases_investigatorId_fkey" FOREIGN KEY ("investigatorId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: cases cases_linkedIncidentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT "cases_linkedIncidentId_fkey" FOREIGN KEY ("linkedIncidentId") REFERENCES public.incidents(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: cases cases_linkedPetitionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT "cases_linkedPetitionId_fkey" FOREIGN KEY ("linkedPetitionId") REFERENCES public.petitions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: cases cases_toiDanhChinhKhoiToId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT "cases_toiDanhChinhKhoiToId_fkey" FOREIGN KEY ("toiDanhChinhKhoiToId") REFERENCES public.crimes(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: conclusions conclusions_approvedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conclusions
    ADD CONSTRAINT "conclusions_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: conclusions conclusions_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conclusions
    ADD CONSTRAINT "conclusions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: conclusions conclusions_caseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conclusions
    ADD CONSTRAINT "conclusions_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES public.cases(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: data_access_grants data_access_grants_grantedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_access_grants
    ADD CONSTRAINT "data_access_grants_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: data_access_grants data_access_grants_granteeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_access_grants
    ADD CONSTRAINT "data_access_grants_granteeId_fkey" FOREIGN KEY ("granteeId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: data_access_grants data_access_grants_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_access_grants
    ADD CONSTRAINT "data_access_grants_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.teams(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: deadline_rule_versions deadline_rule_versions_attachmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deadline_rule_versions
    ADD CONSTRAINT "deadline_rule_versions_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES public.documents(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: deadline_rule_versions deadline_rule_versions_proposedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deadline_rule_versions
    ADD CONSTRAINT "deadline_rule_versions_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: deadline_rule_versions deadline_rule_versions_reviewedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deadline_rule_versions
    ADD CONSTRAINT "deadline_rule_versions_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: deadline_rule_versions deadline_rule_versions_supersedesId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deadline_rule_versions
    ADD CONSTRAINT "deadline_rule_versions_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES public.deadline_rule_versions(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: delegations delegations_assignedToId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delegations
    ADD CONSTRAINT "delegations_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: delegations delegations_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delegations
    ADD CONSTRAINT "delegations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: delegations delegations_relatedCaseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delegations
    ADD CONSTRAINT "delegations_relatedCaseId_fkey" FOREIGN KEY ("relatedCaseId") REFERENCES public.cases(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: document_number_counters document_number_counters_templateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_number_counters
    ADD CONSTRAINT "document_number_counters_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public.document_number_templates(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: document_number_logs document_number_logs_templateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_number_logs
    ADD CONSTRAINT "document_number_logs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public.document_number_templates(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: document_number_logs document_number_logs_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_number_logs
    ADD CONSTRAINT "document_number_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: document_number_templates document_number_templates_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_number_templates
    ADD CONSTRAINT "document_number_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: document_render_logs document_render_logs_caseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_render_logs
    ADD CONSTRAINT "document_render_logs_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES public.cases(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: document_render_logs document_render_logs_incidentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_render_logs
    ADD CONSTRAINT "document_render_logs_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES public.incidents(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: document_render_logs document_render_logs_petitionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_render_logs
    ADD CONSTRAINT "document_render_logs_petitionId_fkey" FOREIGN KEY ("petitionId") REFERENCES public.petitions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: document_render_logs document_render_logs_renderedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_render_logs
    ADD CONSTRAINT "document_render_logs_renderedById_fkey" FOREIGN KEY ("renderedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: documents documents_caseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT "documents_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES public.cases(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: documents documents_incidentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT "documents_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES public.incidents(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: documents documents_petitionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT "documents_petitionId_fkey" FOREIGN KEY ("petitionId") REFERENCES public.petitions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: documents documents_uploadedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: enrollment_token_audits enrollment_token_audits_generatedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollment_token_audits
    ADD CONSTRAINT "enrollment_token_audits_generatedBy_fkey" FOREIGN KEY ("generatedBy") REFERENCES public.users(id) ON UPDATE CASCADE;


--
-- Name: enrollment_token_audits enrollment_token_audits_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollment_token_audits
    ADD CONSTRAINT "enrollment_token_audits_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: event_reminder_dispatches event_reminder_dispatches_reminderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_reminder_dispatches
    ADD CONSTRAINT "event_reminder_dispatches_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES public.event_reminders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: event_reminders event_reminders_eventId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_reminders
    ADD CONSTRAINT "event_reminders_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES public.calendar_events(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: event_reminders event_reminders_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_reminders
    ADD CONSTRAINT "event_reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: evidences evidences_caseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidences
    ADD CONSTRAINT "evidences_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES public.cases(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: edit_window_reset_requests ewrr_requestedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edit_window_reset_requests
    ADD CONSTRAINT "ewrr_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: edit_window_reset_requests ewrr_reviewedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edit_window_reset_requests
    ADD CONSTRAINT "ewrr_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: exchange_messages exchange_messages_exchangeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_messages
    ADD CONSTRAINT "exchange_messages_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES public.exchanges(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: exchange_messages exchange_messages_senderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_messages
    ADD CONSTRAINT "exchange_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: exchanges exchanges_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchanges
    ADD CONSTRAINT "exchanges_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: guidance_records guidance_records_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guidance_records
    ADD CONSTRAINT "guidance_records_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: incident_handoffs incident_handoffs_incidentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incident_handoffs
    ADD CONSTRAINT "incident_handoffs_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES public.incidents(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: incident_handoffs incident_handoffs_toTeamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incident_handoffs
    ADD CONSTRAINT "incident_handoffs_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES public.teams(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: incident_status_history incident_status_history_changedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incident_status_history
    ADD CONSTRAINT "incident_status_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: incident_status_history incident_status_history_incidentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incident_status_history
    ADD CONSTRAINT "incident_status_history_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES public.incidents(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: incidents incidents_assignedTeamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT "incidents_assignedTeamId_fkey" FOREIGN KEY ("assignedTeamId") REFERENCES public.teams(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: incidents incidents_canBoNhapId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT "incidents_canBoNhapId_fkey" FOREIGN KEY ("canBoNhapId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: incidents incidents_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT "incidents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: incidents incidents_crimeChinhId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT "incidents_crimeChinhId_fkey" FOREIGN KEY ("crimeChinhId") REFERENCES public.crimes(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: incidents incidents_deadlineRuleVersionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT "incidents_deadlineRuleVersionId_fkey" FOREIGN KEY ("deadlineRuleVersionId") REFERENCES public.deadline_rule_versions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: incidents incidents_giaHan1RuleVersionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT "incidents_giaHan1RuleVersionId_fkey" FOREIGN KEY ("giaHan1RuleVersionId") REFERENCES public.deadline_rule_versions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: incidents incidents_giaHan2RuleVersionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT "incidents_giaHan2RuleVersionId_fkey" FOREIGN KEY ("giaHan2RuleVersionId") REFERENCES public.deadline_rule_versions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: incidents incidents_handledIncidentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT "incidents_handledIncidentId_fkey" FOREIGN KEY ("handledIncidentId") REFERENCES public.incidents(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: incidents incidents_importLogId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT "incidents_importLogId_fkey" FOREIGN KEY ("importLogId") REFERENCES public.xlsx_import_logs(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: incidents incidents_importedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT "incidents_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: incidents incidents_investigatorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT "incidents_investigatorId_fkey" FOREIGN KEY ("investigatorId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: incidents incidents_linkedCaseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT "incidents_linkedCaseId_fkey" FOREIGN KEY ("linkedCaseId") REFERENCES public.cases(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: incidents incidents_mergedIntoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT "incidents_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES public.incidents(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: investigation_supplements investigation_supplements_caseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investigation_supplements
    ADD CONSTRAINT "investigation_supplements_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES public.cases(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: investigation_supplements investigation_supplements_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investigation_supplements
    ADD CONSTRAINT "investigation_supplements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: lawyers lawyers_caseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lawyers
    ADD CONSTRAINT "lawyers_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES public.cases(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: lawyers lawyers_subjectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lawyers
    ADD CONSTRAINT "lawyers_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES public.subjects(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: monthly_report_adjustments monthly_report_adjustments_reportId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_report_adjustments
    ADD CONSTRAINT "monthly_report_adjustments_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES public.monthly_report_packages(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: monthly_report_contributions monthly_report_contributions_reportId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_report_contributions
    ADD CONSTRAINT "monthly_report_contributions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES public.monthly_report_packages(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: monthly_report_packages monthly_report_packages_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_report_packages
    ADD CONSTRAINT "monthly_report_packages_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public.monthly_report_packages(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: notification_preferences notification_preferences_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: notifications notifications_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: overdue_notifications overdue_notifications_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overdue_notifications
    ADD CONSTRAINT "overdue_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: petition_assignments petition_assignments_assignedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.petition_assignments
    ADD CONSTRAINT "petition_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: petition_assignments petition_assignments_petitionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.petition_assignments
    ADD CONSTRAINT "petition_assignments_petitionId_fkey" FOREIGN KEY ("petitionId") REFERENCES public.petitions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: petition_assignments petition_assignments_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.petition_assignments
    ADD CONSTRAINT "petition_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: petitions petitions_assignedTeamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.petitions
    ADD CONSTRAINT "petitions_assignedTeamId_fkey" FOREIGN KEY ("assignedTeamId") REFERENCES public.teams(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: petitions petitions_assignedToId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.petitions
    ADD CONSTRAINT "petitions_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: petitions petitions_canBoDeXuatId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.petitions
    ADD CONSTRAINT "petitions_canBoDeXuatId_fkey" FOREIGN KEY ("canBoDeXuatId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: petitions petitions_crimeChinhId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.petitions
    ADD CONSTRAINT "petitions_crimeChinhId_fkey" FOREIGN KEY ("crimeChinhId") REFERENCES public.crimes(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: petitions petitions_deadlineRuleVersionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.petitions
    ADD CONSTRAINT "petitions_deadlineRuleVersionId_fkey" FOREIGN KEY ("deadlineRuleVersionId") REFERENCES public.deadline_rule_versions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: petitions petitions_enteredById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.petitions
    ADD CONSTRAINT "petitions_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: petitions petitions_linkedCaseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.petitions
    ADD CONSTRAINT "petitions_linkedCaseId_fkey" FOREIGN KEY ("linkedCaseId") REFERENCES public.cases(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: petitions petitions_linkedIncidentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.petitions
    ADD CONSTRAINT "petitions_linkedIncidentId_fkey" FOREIGN KEY ("linkedIncidentId") REFERENCES public.incidents(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: phu_luc_report_logs phu_luc_report_logs_generatedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phu_luc_report_logs
    ADD CONSTRAINT "phu_luc_report_logs_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: proposals proposals_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT "proposals_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: proposals proposals_relatedCaseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT "proposals_relatedCaseId_fkey" FOREIGN KEY ("relatedCaseId") REFERENCES public.cases(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: report_tdc_drafts report_tdc_drafts_approvedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_tdc_drafts
    ADD CONSTRAINT "report_tdc_drafts_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: report_tdc_drafts report_tdc_drafts_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_tdc_drafts
    ADD CONSTRAINT "report_tdc_drafts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: report_tdc_drafts report_tdc_drafts_rejectedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_tdc_drafts
    ADD CONSTRAINT "report_tdc_drafts_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: report_tdc_drafts report_tdc_drafts_reviewedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_tdc_drafts
    ADD CONSTRAINT "report_tdc_drafts_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: role_permissions role_permissions_permissionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES public.permissions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: subjects subjects_caseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT "subjects_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES public.cases(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: subjects subjects_crimeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT "subjects_crimeId_fkey" FOREIGN KEY ("crimeId") REFERENCES public.crimes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: suspension_action_plans suspension_action_plans_caseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suspension_action_plans
    ADD CONSTRAINT "suspension_action_plans_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES public.cases(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: suspension_action_plans suspension_action_plans_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suspension_action_plans
    ADD CONSTRAINT "suspension_action_plans_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: suspension_action_plans suspension_action_plans_incidentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suspension_action_plans
    ADD CONSTRAINT "suspension_action_plans_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES public.incidents(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: teams teams_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT "teams_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public.teams(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: teams teams_wardId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT "teams_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES public.directories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: user_abbreviations user_abbreviations_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_abbreviations
    ADD CONSTRAINT "user_abbreviations_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_devices user_devices_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT "user_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_export_preferences user_export_preferences_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_export_preferences
    ADD CONSTRAINT "user_export_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_shortcuts user_shortcuts_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_shortcuts
    ADD CONSTRAINT "user_shortcuts_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_table_layouts user_table_layouts_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_table_layouts
    ADD CONSTRAINT "user_table_layouts_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_teams user_teams_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_teams
    ADD CONSTRAINT "user_teams_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.teams(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_teams user_teams_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_teams
    ADD CONSTRAINT "user_teams_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users users_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: vks_meeting_records vks_meeting_records_caseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vks_meeting_records
    ADD CONSTRAINT "vks_meeting_records_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES public.cases(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: vks_meeting_records vks_meeting_records_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vks_meeting_records
    ADD CONSTRAINT "vks_meeting_records_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: vks_meeting_records vks_meeting_records_incidentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vks_meeting_records
    ADD CONSTRAINT "vks_meeting_records_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES public.incidents(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: xlsx_import_logs xlsx_import_logs_firstConfirmById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xlsx_import_logs
    ADD CONSTRAINT "xlsx_import_logs_firstConfirmById_fkey" FOREIGN KEY ("firstConfirmById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: xlsx_import_logs xlsx_import_logs_rolledBackById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xlsx_import_logs
    ADD CONSTRAINT "xlsx_import_logs_rolledBackById_fkey" FOREIGN KEY ("rolledBackById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: xlsx_import_logs xlsx_import_logs_secondConfirmById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xlsx_import_logs
    ADD CONSTRAINT "xlsx_import_logs_secondConfirmById_fkey" FOREIGN KEY ("secondConfirmById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: xlsx_import_logs xlsx_import_logs_uploadedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xlsx_import_logs
    ADD CONSTRAINT "xlsx_import_logs_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: xlsx_import_staging xlsx_import_staging_importLogId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xlsx_import_staging
    ADD CONSTRAINT "xlsx_import_staging_importLogId_fkey" FOREIGN KEY ("importLogId") REFERENCES public.xlsx_import_logs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_logs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_logs_insert ON public.audit_logs FOR INSERT WITH CHECK (true);


--
-- Name: audit_logs audit_logs_self_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_logs_self_read ON public.audit_logs FOR SELECT USING ((("userId" = current_setting('app.current_user_id'::text, true)) OR (current_setting('app.current_user_role'::text, true) = ANY (ARRAY['ADMIN'::text, 'SYSTEM'::text]))));


--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: users users_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_admin_all ON public.users USING ((current_setting('app.current_user_role'::text, true) = ANY (ARRAY['ADMIN'::text, 'SYSTEM'::text])));


--
-- Name: users users_self_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_self_read ON public.users FOR SELECT USING (((id = current_setting('app.current_user_id'::text, true)) OR (current_setting('app.current_user_role'::text, true) = ANY (ARRAY['ADMIN'::text, 'SYSTEM'::text]))));


--
-- PostgreSQL database dump complete
--

\unrestrict Sz0aabRWIA40cRH6IWfE96yQRuaXpa5wfWj13FH0t4q1aexcHVYsfjemqxuyTua


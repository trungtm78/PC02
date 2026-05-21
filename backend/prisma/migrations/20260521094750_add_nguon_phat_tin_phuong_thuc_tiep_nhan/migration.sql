-- Migration: Add NguonPhatTin + PhuongThucTiepNhan enums + columns on incidents
-- v0.31.0.0 — Bổ sung Loại nguồn tin chi tiết theo Đ.144 BLTTHS + TT 28/2020/TT-BCA Đ.6
-- Safe: nullable columns, no backfill required.

-- CreateEnum
CREATE TYPE "NguonPhatTin" AS ENUM (
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

-- CreateEnum
CREATE TYPE "PhuongThucTiepNhan" AS ENUM (
  'TRUC_TIEP_BANG_LOI',
  'TRUC_TIEP_BANG_VAN_BAN',
  'DIEN_THOAI',
  'BUU_DIEN',
  'PHUONG_TIEN_DIEN_TU'
);

-- AlterTable
ALTER TABLE "incidents"
  ADD COLUMN "nguonPhatTin" "NguonPhatTin",
  ADD COLUMN "phuongThucTiepNhan" "PhuongThucTiepNhan";

"""
TDD tests cho extract_body_from_steps() trong uat_spec_generator.py.
Viết TRƯỚC khi implement hàm — xác nhận RED trước khi GREEN.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from uat_spec_generator import extract_body_from_steps


def test_flat_object():
    """Trích xuất flat JS object literal từ steps text."""
    s = "1. POST body {name:'Vụ án trộm cắp', caseProvenance:'DIRECT_DISCOVERY'}"
    result = extract_body_from_steps(s)
    assert result == "{name:'Vụ án trộm cắp', caseProvenance:'DIRECT_DISCOVERY'}"


def test_nested_object():
    """Balanced-brace parser xử lý được nested object."""
    s = "1. POST body {subjects:[{fullName:'Nguyễn A'}], name:'test'}"
    result = extract_body_from_steps(s)
    assert result is not None
    assert result.startswith('{')
    assert result.endswith('}')
    assert 'subjects' in result


def test_no_body_returns_none():
    """Steps không có body → trả về None."""
    s = "1. Gửi request thiếu field bắt buộc không có body"
    result = extract_body_from_steps(s)
    assert result is None


def test_empty_body_returns_none():
    """Empty body {} → trả về None (len <= 2, không có nội dung)."""
    s = "1. POST body {}"
    result = extract_body_from_steps(s)
    assert result is None


def test_backtick_in_body_still_extracted():
    """Body có backtick vẫn được extract — caller sẽ sanitize sau."""
    s = "1. POST body {name:`test value`, key:'val'}"
    result = extract_body_from_steps(s)
    assert result is not None
    assert result.startswith('{')

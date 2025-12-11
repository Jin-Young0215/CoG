import os
import time
import requests
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime, timedelta, date
from typing import Optional, List, Dict, Any
from urllib.parse import urlencode, quote_plus

# ================== 환경설정 ==================
# 본인들 데이터베이스 port랑 이름 비번으로 변경하면 됨
PG_DSN = os.getenv(
    "PG_DSN",
    "host=localhost port=5432 dbname=cogdb user=postgres password=6575"
)

API_BASE = "https://apis.data.go.kr/1543061/abandonmentPublicService_v2"
ENDPOINT = "abandonmentPublic_v2"  # ★ probe 결과 정답
API_KEY = "51c188a65dd88ee3e854b93df87366b428d6c8520e0111d1c732345f8e24889f"

HEADERS = {"User-Agent": "pet-finder/1.0", "Accept": "application/json"}
UPKINDS = ["417000", "422400"]  # 개, 고양이

# ================== 유틸/파서 ==================
def parse_date(date_str: Optional[str]) -> Optional[str]:
    if not date_str or len(date_str) != 8:
        return None
    try:
        return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
    except Exception:
        return None

def parse_ts(ts_str: Optional[str]) -> Optional[str]:
    if not ts_str or len(ts_str) != 14:
        return None
    try:
        return datetime.strptime(ts_str, "%Y%m%d%H%M%S").strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return None

def item_to_row(it: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "desertion_no":  it.get("desertionNo"),
        "rfid_cd":       it.get("rfidCd"),
        "happen_dt":     parse_date(it.get("happenDt")),
        "happen_place":  it.get("happenPlace"),
        "up_kind_cd":    it.get("upKindCd"),
        "up_kind_nm":    it.get("upKindNm"),
        "kind_cd":       it.get("kindCd"),
        "kind_nm":       it.get("kindNm"),
        "color_cd":      it.get("colorCd"),
        "age":           it.get("age"),
        "weight":        it.get("weight"),
        "notice_no":     it.get("noticeNo"),
        "notice_sdt":    parse_date(it.get("noticeSdt")),
        "notice_edt":    parse_date(it.get("noticeEdt")),
        "popfile1":      it.get("popfile1"),
        "popfile2":      it.get("popfile2"),
        "process_state": it.get("processState"),
        "sex_cd":        it.get("sexCd"),
        "neuter_yn":     it.get("neuterYn"),
        "special_mark":  it.get("specialMark"),
        "care_reg_no":   it.get("careRegNo"),
        "care_nm":       it.get("careNm"),
        "care_tel":      it.get("careTel"),
        "care_addr":     it.get("careAddr"),
        "care_owner_nm": it.get("careOwnerNm"),
        "org_nm":        it.get("orgNm"),
        "etc_bigo":      it.get("etcBigo"),
        "upd_tm":        parse_ts(it.get("updTm")),
    }

# ================== DB 스키마 ==================
CREATE_SQL = """
CREATE TABLE IF NOT EXISTS abandoned_animals (
    desertion_no VARCHAR(50) PRIMARY KEY,
    rfid_cd VARCHAR(50),
    happen_dt DATE,
    happen_place TEXT,
    up_kind_cd VARCHAR(10),
    up_kind_nm VARCHAR(50),
    kind_cd VARCHAR(30),
    kind_nm VARCHAR(100),
    color_cd VARCHAR(30),
    age VARCHAR(50),
    weight VARCHAR(50),
    notice_no VARCHAR(50),
    notice_sdt DATE,
    notice_edt DATE,
    popfile1 TEXT,
    popfile2 TEXT,
    process_state VARCHAR(50),
    sex_cd VARCHAR(10),
    neuter_yn VARCHAR(10),
    special_mark TEXT,
    care_reg_no VARCHAR(50),
    care_nm VARCHAR(200),
    care_tel VARCHAR(50),
    care_addr TEXT,
    care_owner_nm VARCHAR(100),
    org_nm VARCHAR(200),
    etc_bigo TEXT,
    upd_tm TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_happen_dt ON abandoned_animals(happen_dt);
CREATE INDEX IF NOT EXISTS idx_notice_edt ON abandoned_animals(notice_edt);
CREATE INDEX IF NOT EXISTS idx_process_state ON abandoned_animals(process_state);
ALTER TABLE abandoned_animals ALTER COLUMN kind_cd TYPE VARCHAR(30);
ALTER TABLE abandoned_animals ALTER COLUMN color_cd TYPE VARCHAR(30);
"""

UPSERT_SQL = """
INSERT INTO abandoned_animals (
    desertion_no, rfid_cd, happen_dt, happen_place, up_kind_cd, up_kind_nm,
    kind_cd, kind_nm, color_cd, age, weight, notice_no, notice_sdt, notice_edt,
    popfile1, popfile2, process_state, sex_cd, neuter_yn, special_mark,
    care_reg_no, care_nm, care_tel, care_addr, care_owner_nm, org_nm,
    etc_bigo, upd_tm
) VALUES %s
ON CONFLICT (desertion_no)
DO UPDATE SET
    rfid_cd = EXCLUDED.rfid_cd,
    happen_dt = EXCLUDED.happen_dt,
    happen_place = EXCLUDED.happen_place,
    up_kind_cd = EXCLUDED.up_kind_cd,
    up_kind_nm = EXCLUDED.up_kind_nm,
    kind_cd = EXCLUDED.kind_cd,
    kind_nm = EXCLUDED.kind_nm,
    color_cd = EXCLUDED.color_cd,
    age = EXCLUDED.age,
    weight = EXCLUDED.weight,
    notice_no = EXCLUDED.notice_no,
    notice_sdt = EXCLUDED.notice_sdt,
    notice_edt = EXCLUDED.notice_edt,
    popfile1 = EXCLUDED.popfile1,
    popfile2 = EXCLUDED.popfile2,
    process_state = EXCLUDED.process_state,
    sex_cd = EXCLUDED.sex_cd,
    neuter_yn = EXCLUDED.neuter_yn,
    special_mark = EXCLUDED.special_mark,
    care_reg_no = EXCLUDED.care_reg_no,
    care_nm = EXCLUDED.care_nm,
    care_tel = EXCLUDED.care_tel,
    care_addr = EXCLUDED.care_addr,
    care_owner_nm = EXCLUDED.care_owner_nm,
    org_nm = EXCLUDED.org_nm,
    etc_bigo = EXCLUDED.etc_bigo,
    upd_tm = EXCLUDED.upd_tm;
"""

# ================== API 호출 ==================
def build_url(params: Dict[str, Any]) -> str:
    # serviceKey는 이미 안전한 문자열이므로 따로 인코딩하지 않는다.
    q = {"serviceKey": API_KEY, "_type": "json", **params}
    return f"{API_BASE}/{ENDPOINT}?{urlencode(q, doseq=True)}"

def fetch_page(bgnde: str, endde: str, page_no: int, rows: int, upkind: Optional[str]=None) -> Dict[str, Any]:
    params = {"bgnde": bgnde, "endde": endde, "pageNo": page_no, "numOfRows": rows}
    if upkind:
        params["upkind"] = upkind
    url = build_url(params)
    print("[GET]", url)
    r = requests.get(url, timeout=20, headers=HEADERS)
    if r.status_code != 200:
        print("[DEBUG]", r.status_code, r.text[:600])
        return {}
    try:
        data = r.json()
    except Exception as e:
        print("[JSON ERROR]", e, r.text[:600])
        return {}
    header = data.get("response", {}).get("header", {})
    if header.get("resultCode") != "00":
        print("[API ERROR]", header)
        return {}
    return data

# ================== 저장 로직 ==================
def upsert_items(conn, items: List[Dict[str, Any]]) -> int:
    if not items:
        return 0
    rows = [item_to_row(x) for x in items if isinstance(x, dict) and x.get("desertionNo")]
    if not rows:
        return 0
    values = [
        (
            r["desertion_no"], r["rfid_cd"], r["happen_dt"], r["happen_place"],
            r["up_kind_cd"], r["up_kind_nm"], r["kind_cd"], r["kind_nm"],
            r["color_cd"], r["age"], r["weight"], r["notice_no"],
            r["notice_sdt"], r["notice_edt"], r["popfile1"], r["popfile2"],
            r["process_state"], r["sex_cd"], r["neuter_yn"], r["special_mark"],
            r["care_reg_no"], r["care_nm"], r["care_tel"], r["care_addr"],
            r["care_owner_nm"], r["org_nm"], r["etc_bigo"], r["upd_tm"]
        )
        for r in rows
    ]
    if not values:
        return 0
    with conn.cursor() as cur:
        execute_values(cur, UPSERT_SQL, values)
        conn.commit()
    return len(values)

# ================== 동기화 (하루 단위 + upkind 분리) ==================
def sync_range(begin_dt: str, end_dt: str, rows_per_page: int = 200):
    conn = psycopg2.connect(PG_DSN)
    try:
        with conn.cursor() as cur:
            cur.execute(CREATE_SQL)
        conn.commit()
        print("✓ 테이블 확인/생성 완료")

        total_saved = 0
        # 날짜를 하루 단위로 쪼갬 (서버 안정성 ↑)
        sd = datetime.strptime(begin_dt, "%Y%m%d").date()
        ed = datetime.strptime(end_dt, "%Y%m%d").date()
        d = sd
        while d <= ed:
            ymd = d.strftime("%Y%m%d")
            print(f"\n=== {ymd} 수집 시작 ===")
            for uk in UPKINDS:
                page = 1
                day_saved = 0
                while True:
                    data = fetch_page(ymd, ymd, page, rows_per_page, upkind=uk)
                    if not data:
                        break
                    body = data.get("response", {}).get("body", {})
                    total = int(body.get("totalCount", 0) or 0)
                    items_raw = body.get("items", {}).get("item", [])
                    # 단일 dict → 리스트 변환, None 등 비정상 응답 방어
                    if isinstance(items_raw, dict):
                        items = [items_raw]
                    elif isinstance(items_raw, list):
                        items = items_raw
                    else:
                        items = []
                    # 서버 버그 회피: total>0인데 items비면 break하지 말고 다음 페이지 시도
                    saved = upsert_items(conn, items)
                    total_saved += saved
                    day_saved += saved
                    print(f"  upkind={uk} page={page} saved={saved} / total={total}")

                    # 다음 페이지 판단
                    if len(items) < rows_per_page:
                        break
                    page += 1
                    time.sleep(0.15)  # 서버 보호
            print(f"=== {ymd} 수집 종료 (저장 {day_saved}건) ===")
            d += timedelta(days=1)
            time.sleep(0.1)
        print(f"\n[DONE] 전체 저장: {total_saved}건")
    finally:
        conn.close()

# ================== 메인 ==================
if __name__ == "__main__":
    # 어제 하루만 먼저 테스트 (가장 안전)
    y = (date.today() - timedelta(days=1)).strftime("%Y%m%d")
    print(f"[TEST] endpoint check for {y}")
    test = fetch_page(y, y, page_no=1, rows=10, upkind="417000")
    if not test:
        print("⚠ 테스트 호출 실패: endpoint/키/파라미터 재확인 필요")
        # 그래도 계속 진행하려면 주석 해제
        # exit(1)
    else:
        print("✓ 테스트 호출 성공")

    # 본 수집(최근 30일 예시)
    # 근데 평균 공고일이 28일 정도 됨
    # 밑에 있는 날짜만 변경하면 됨
    # 현재 10월 22일 쯤에 데이터가 너무 길어서 오류 한 번 나는 거 빼고 문제 없음
    begin_dt = (date.today() - timedelta(days=30)).strftime("%Y%m%d")
    end_dt   = (date.today() - timedelta(days=0)).strftime("%Y%m%d")
    print(f"\n[RUN] {begin_dt} ~ {end_dt}")
    sync_range(begin_dt, end_dt, rows_per_page=200)

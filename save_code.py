# ================== 저장 로직 ==================
#def upsert_items(conn, items: List[Dict[str, Any]]) -> int:
#    ...
#    return len(values)
#이 밑에 부분에 동기화 부분을 복사해서 저장로직 밑에 있는 동기화랑 바꾸면 됨

# ================== 동기화 (하루 단위 + upkind 분리) ==================
def sync_range(begin_dt: str, end_dt: str, rows_per_page: int = 200):
    conn = psycopg2.connect(PG_DSN)
    try:
        with conn.cursor() as cur:
            cur.execute(CREATE_SQL)
        conn.commit()
        print("✓ 테이블 확인/생성 완료")

        total_saved = 0
        sd = datetime.strptime(begin_dt, "%Y%m%d").date()
        ed = datetime.strptime(end_dt, "%Y%m%d").date()
        d = sd
        while d <= ed:
            ymd = d.strftime("%Y%m%d")
            print(f"\n=== {ymd} 수집 시작 ===")
            for uk in UPKINDS:
                page = 1
                got = 0
                day_saved = 0

                while True:
                    data = fetch_page(ymd, ymd, page, rows_per_page, upkind=uk)
                    if not data:
                        break

                    body  = data.get("response", {}).get("body", {})
                    total = int(body.get("totalCount", 0) or 0)
                    items = body.get("items", {}).get("item", [])

                    if isinstance(items, dict):
                        items = [items]

                    if not items:
                        if got >= total or total == 0:
                            break
                        page += 1
                        continue

                    saved = upsert_items(conn, items)
                    total_saved += saved
                    day_saved += saved
                    got += len(items)

                    if got >= total or len(items) == 0:
                        break

                    page += 1
                    time.sleep(0.15)

                print(f"  upkind={uk} 누적수집={got} / total={total}, 저장={day_saved}")

            print(f"=== {ymd} 수집 종료 (저장 {day_saved}건) ===")
            d += timedelta(days=1)
            time.sleep(0.1)

        print(f"\n[DONE] 전체 저장: {total_saved}건")
    finally:
        conn.close()

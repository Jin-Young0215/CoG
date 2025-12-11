import { NextResponse } from "next/server"
import { execFile } from "child_process"
import { promisify } from "util"

const execFileAsync = promisify(execFile)
const PG_DSN = process.env.PG_DSN || "postgres://postgres:6575@localhost:5432/cogdb"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const animalType = searchParams.get("animalType") || "all"
  const upKindFilter =
    animalType === "cat"
      ? "AND a.up_kind_cd = '422400'"
      : animalType === "dog"
        ? "AND a.up_kind_cd = '417000'"
        : "" // all
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1)
  const pageSize = Math.min(50, Math.max(5, parseInt(searchParams.get("pageSize") || "30", 10) || 30))
  const offset = (page - 1) * pageSize
  const qRaw = (searchParams.get("q") || "").trim()
  const q =
    qRaw.replace("서울시", "서울특별시")
      .replace("경상도", "경상남도")
      .replace("경상남도", "경상남도")
      .replace("경상북도", "경상북도")
      .replace("충정도", "충청도")
      .replace("충청도", "충청")
      .replace("전라도", "전라")
  const lat = parseFloat(searchParams.get("lat") || "")
  const lng = parseFloat(searchParams.get("lng") || "")
  const hasUserCoords = Number.isFinite(lat) && Number.isFinite(lng)

  // care_centers에 lat/lng 컬럼 존재 여부 확인
  let hasLatLngCols = false
  try {
    const colCheck = await execFileAsync("psql", [
      PG_DSN,
      "-At",
      "-c",
      "select (count(*)=2) from information_schema.columns where table_name='care_centers' and column_name in ('lat','lng');",
    ])
    hasLatLngCols = colCheck.stdout.trim().split("\n").pop()?.trim() === "t"
  } catch (err) {
    hasLatLngCols = false
  }

  const sql = `
WITH shelters AS (
  SELECT
    care_reg_no,
    care_nm,
    care_addr,
    care_tel,
    org_nm${hasLatLngCols ? ", lat, lng" : ", NULL::double precision AS lat, NULL::double precision AS lng"}
    ${hasLatLngCols && hasUserCoords ? `,
    (
      6371 * 2 * ASIN(
        SQRT(
          POWER(SIN(RADIANS(c.lat - ${lat}) / 2), 2) +
          COS(RADIANS(${lat})) * COS(RADIANS(c.lat)) *
          POWER(SIN(RADIANS(c.lng - ${lng}) / 2), 2)
        )
      )
    ) AS dist_km` : ", NULL::double precision AS dist_km"}
  FROM care_centers c
  WHERE ($$${q}$$ = '' OR c.care_nm ILIKE '%' || $$${q}$$ || '%' OR c.care_addr ILIKE '%' || $$${q}$$ || '%')
  ${hasUserCoords && hasLatLngCols ? "ORDER BY dist_km" : "ORDER BY c.care_nm"}
  LIMIT ${pageSize} OFFSET ${offset}
),
animals AS (
  SELECT a.desertion_no, a.popfile1, a.popfile2, a.kind_nm, a.up_kind_cd, a.age, a.sex_cd, a.notice_sdt, a.special_mark, a.care_reg_no
  FROM abandoned_animals a
  JOIN shelters s ON s.care_reg_no = a.care_reg_no
  WHERE (a.popfile1 IS NOT NULL OR a.popfile2 IS NOT NULL)
    AND a.process_state IN ('보호중', '보호중(입양대기)', '공고중')
    ${upKindFilter}
)
SELECT
  coalesce(json_agg(row_to_json(s_with_animals)), '[]'::json) AS shelters,
  (
    SELECT count(*)
    FROM care_centers c
    WHERE ($$${q}$$ = '' OR c.care_nm ILIKE '%' || $$${q}$$ || '%' OR c.care_addr ILIKE '%' || $$${q}$$ || '%')
  ) AS total
FROM (
  SELECT
    s.care_reg_no,
    s.care_nm,
    s.care_addr,
    s.care_tel,
    s.org_nm${hasLatLngCols ? ", s.lat, s.lng" : ""}${hasLatLngCols && hasUserCoords ? ", s.dist_km" : ""},
    COALESCE((SELECT json_agg(row_to_json(a)) FROM animals a WHERE a.care_reg_no = s.care_reg_no), '[]'::json) AS animals
  FROM shelters s
) AS s_with_animals;
`

  try {
    const { stdout } = await execFileAsync("psql", [PG_DSN, "-At", "-c", sql], {
      maxBuffer: 50 * 1024 * 1024, // 50MB
    })
    const lines = stdout.trim().split("\n")
    const last = lines.pop() || "[]|0"
    const [sheltersJson, totalStr] = last.split("|")
    let shelters = sheltersJson ? JSON.parse(sheltersJson) : []
    if (hasLatLngCols && hasUserCoords) {
      const toRad = (d: number) => (d * Math.PI) / 180
      const R = 6371
      shelters = shelters.map((s: any) => {
        if (typeof s.dist_km === "number") {
          s.distance_km = s.dist_km
        } else if (typeof s.lat === "number" && typeof s.lng === "number") {
          const dLat = toRad(s.lat - lat)
          const dLng = toRad(s.lng - lng)
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat)) * Math.cos(toRad(s.lat)) * Math.sin(dLng / 2) ** 2
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
          s.distance_km = R * c
        } else {
          s.distance_km = null
        }
        return s
      })
    }
    const total = parseInt(totalStr || "0", 10) || 0
    return NextResponse.json({ shelters, total, page, pageSize })
  } catch (err: any) {
    console.error("[api/shelters] error", err)
    return NextResponse.json(
      { error: "failed to load shelters", detail: String(err) },
      { status: 500 },
    )
  }
}

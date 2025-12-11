import { NextResponse } from "next/server"
import { mkdtemp, writeFile, rm, access } from "fs/promises"
import path from "path"
import { tmpdir } from "os"
import { promisify } from "util"
import { execFile } from "child_process"

const execFileAsync = promisify(execFile)
export const runtime = "nodejs"

const PYTHON_SCRIPT = path.resolve(process.cwd(), "..", "triplet_similarity.py")
const PYTHON_BASELINE_SCRIPT = path.resolve(process.cwd(), "..", "triplet_similarity_baseline.py")
async function pickPython(): Promise<string> {
  // 1) 명시적으로 지정된 경우 그대로 사용 (실제로 접근 가능할 때)
  if (process.env.PYTHON_BIN) {
    try {
      await access(process.env.PYTHON_BIN)
      return process.env.PYTHON_BIN
    } catch (_) {
      // 지정된 경로가 없으면 아래 후보로 폴백
    }
  }

  // 2) OS별 기본 가상환경/시스템 파이썬 경로 우선
  const isWin = process.platform === "win32"
  const candidates = isWin
    ? [
        path.resolve(process.cwd(), "..", ".venv", "Scripts", "python.exe"),
        "python.exe",
        "py",
        "python",
      ]
    : [
        path.resolve(process.cwd(), "..", ".venv", "bin", "python"),
        path.resolve(process.cwd(), "..", ".venv", "bin", "python3"),
        "python3",
        "python",
      ]
  for (const p of candidates) {
    try {
      await access(p)
      return p
    } catch (_) {
      continue
    }
  }
  return "python"
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const imageBase64 = body?.imageBase64
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json({ error: "imageBase64 필드가 필요합니다." }, { status: 400 })
    }

    const base64Payload = imageBase64.includes(",") ? imageBase64.split(",").pop() : imageBase64
    if (!base64Payload) {
      return NextResponse.json({ error: "유효하지 않은 이미지 데이터" }, { status: 400 })
    }

    const tempDir = await mkdtemp(path.join(tmpdir(), "pet-search-"))
    const imagePath = path.join(tempDir, "query.png")
    await writeFile(imagePath, Buffer.from(base64Payload, "base64"))

    const pythonBin = await pickPython()
    const script = body?.mode === "baseline" ? PYTHON_BASELINE_SCRIPT : PYTHON_SCRIPT

    const env: NodeJS.ProcessEnv = { ...process.env }
    if (body?.gender) {
      env.SEARCH_GENDER = body.gender
    }
    if (body?.lostDate) {
      env.SEARCH_LOST_DATE = body.lostDate
    }
    if (body?.animalType) {
      env.SEARCH_ANIMAL_TYPE = body.animalType
    }

    const { stdout, stderr } = await execFileAsync(pythonBin, [script, "--image", imagePath, "--topk", "20"], {
      env,
      cwd: path.resolve(process.cwd(), ".."),
      maxBuffer: 10 * 1024 * 1024,
    })

    if (stderr) {
      console.warn("[python stderr]", stderr)
    }

    const data = JSON.parse(stdout.trim())
    await rm(tempDir, { recursive: true, force: true })
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("[api/search] error", error)
    return NextResponse.json({ error: "검색 중 오류가 발생했습니다.", detail: String(error) }, { status: 500 })
  }
}

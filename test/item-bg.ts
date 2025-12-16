import { Database } from "bun:sqlite";

// 假设：
// 1. SQLite 文件名为 eaiser.db，放在项目根目录（与 test/ 同级）
// 2. 有一张表 notes，包含字段：id (INTEGER PRIMARY KEY), content (TEXT)
// 如果你的表名 / 字段名不一样，只要改 SQL 和类型即可。

type NoteRow = {
  id: number;
  content: string | null;
};

// 提取 content 中的第一张图片 URL
// 支持两种格式：
// 1) HTML: <img src="..." />
// 2) Markdown: ![alt](url)
export function extractFirstImageUrl(content) {
  if (!content) return null;

  // 先找 HTML <img>
  const imgTagRegex = /<img[^>]*src=["']([^"'>]+)["'][^>]*>/i;
  const htmlMatch = content.match(imgTagRegex);
  if (htmlMatch && htmlMatch[1]) {
    return htmlMatch[1];
  }

  // 再找 Markdown 图片 ![alt](url)
  const mdImgRegex = /!\[[^\]]*\]\(([^)]+)\)/;
  const mdMatch = content.match(mdImgRegex);
  if (mdMatch && mdMatch[1]) {
    return mdMatch[1];
  }

  return null;
}

// 从 SQLite 读取指定笔记的 content，并返回第一张图片的 URL
export function getNoteBgFromDb(dbPath: string, noteId: number): string | null {
  const db = new Database(dbPath, { readonly: true });

  try {
    const query = db.prepare<NoteRow, [number]>(
      "SELECT id, content_md FROM notes WHERE id = ? LIMIT 1"
    );
    const row = query.get(noteId) as NoteRow | undefined;

    if (!row) return null;

    return extractFirstImageUrl(row.content_md ?? "");
  } finally {
    db.close();
  }
}

// 示例：直接在命令行用 `bun test/item-bg.ts` 运行时的演示
// node/bun: bun run test/item-bg.ts 1
if (import.meta.main) {
  const arg = process.argv[2];
  const noteId = Number(arg ?? "1");

  const dbPath = new URL("../build/bin/Eaiser.app/Contents/MacOS/eaiser.db", import.meta.url).pathname;

  const url = getNoteBgFromDb(dbPath, noteId);

  if (url) {
    console.log("First image URL:", url);
  } else {
    console.log("No image found in content.");
  }
}

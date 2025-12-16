export default function extractFirstImageUrl(content) {
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
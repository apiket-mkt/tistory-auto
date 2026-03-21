import { GoogleGenerativeAI } from '@google/generative-ai';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gemini-key');

  const apiKey = process.env.GEMINI_API_KEY || req.headers['x-gemini-key'];
  if (!apiKey) return res.status(400).json({ error: 'Gemini API 키가 없습니다' });

  const { pdfText, numPages, fileName } = req.body;
  if (!pdfText) return res.status(400).json({ error: 'PDF 텍스트가 없습니다' });

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    const prompt = `다음 PDF 텍스트를 분석해서 아래 JSON 형식으로만 응답하세요.
마크다운 코드블록 없이 순수 JSON만 출력하세요.
현재 연도는 2026년입니다. 제목이나 키워드에 연도를 포함할 때는 반드시 2026년 기준으로 작성하세요.

PDF 파일명: ${fileName || ''}
PDF 내용 (${numPages}페이지):
${pdfText}

응답 형식:
{
  "coreMessage": "핵심 메시지 한 줄",
  "wiifm": "독자가 이 글을 읽으면 얻는 것",
  "searchIntent": "정보형 또는 비교형 또는 구매형",
  "mainKeyword": "실제 검색창에 칠 법한 메인 키워드",
  "subKeywords": ["서브1", "서브2", "서브3", "서브4", "서브5"],
  "tags": ["태그1", "태그2", "태그3", "태그4", "태그5", "태그6", "태그7", "태그8", "태그9", "태그10"],
  "titles": [
    "숫자 또는 연도(2026) 포함형 제목",
    "질문형 제목 (~하는 법, ~란?, 왜 ~인가)",
    "문제 해결형 제목 (~때문에 고민이라면)"
  ]
}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/^```json\n?|\n?```$/g, '').trim();
    const analysis = JSON.parse(raw);

    res.status(200).json({ ...analysis, numPages });
  } catch (err) {
    console.error('분석 오류:', err);
    res.status(500).json({ error: err.message });
  }
}

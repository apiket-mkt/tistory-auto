import { GoogleGenerativeAI } from '@google/generative-ai';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gemini-key');

  const apiKey = process.env.GEMINI_API_KEY || req.headers['x-gemini-key'];
  if (!apiKey) return res.status(400).json({ error: 'Gemini API 키가 없습니다' });

  const { pdfText, analysis, selectedTitleIndex, pngNames } = req.body;
  if (!pdfText || !analysis) return res.status(400).json({ error: '데이터가 없습니다' });

  const selectedTitle = analysis.titles[selectedTitleIndex || 0];

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    const prompt = `당신은 티스토리 블로그 전문 에디터입니다.
아래 정보를 바탕으로 티스토리 HTML 에디터에 바로 붙여넣을 수 있는 완성형 HTML 본문을 작성하세요.
순수 HTML 코드만 출력하세요. 마크다운 코드블록(\`\`\`)이나 다른 텍스트는 절대 포함하지 마세요.

[제목] ${selectedTitle}
[메인 키워드] ${analysis.mainKeyword}
[서브 키워드] ${analysis.subKeywords.join(', ')}
[핵심 메시지] ${analysis.coreMessage}
[독자 WIIFM] ${analysis.wiifm}
[검색 의도] ${analysis.searchIntent}
[태그] ${analysis.tags.join(', ')}

[PDF 원문 내용]
${pdfText.slice(0, 8000)}

[이미지 파일 목록 - 본문 적절한 위치에 삽입 표기]
${(pngNames || []).map((n, i) => `- ${n} (PDF ${i + 1}페이지)`).join('\n')}

[HTML 작성 규칙]
1. 이미지 삽입 위치는 반드시 이 형식:
   <p style="background:#fff8e1;border:1px dashed #f59e0b;border-radius:8px;padding:12px 16px;font-size:14px;color:#78350f;margin:20px 0;">📷 이미지 삽입: [파일명] — [내용 설명]</p>
2. 각 이미지는 관련 섹션에 1장씩 자연스럽게 배치
3. SEO: 메인 키워드를 첫 100자 내 포함, H2에 2회 이상
4. AEO: 핵심 요약 박스(파란 배경) + FAQ 4개 이상 (<details> 태그)
5. GEO: 수치/연도/비교 데이터 포함, 서술형 문장 위주
6. 총 본문 2,000자 이상
7. 마무리에 CTA 포함

반드시 포함할 구조:
- 도입부 (키워드 포함, WIIFM 예고)
- 핵심 요약 박스 (파란 배경, 불릿 3개)
- 목차 (앵커 링크)
- H2 섹션 3개 이상 (각 H3, 리스트, 이미지 위치 포함)
- FAQ (<details> 태그, 4개)
- 마무리 + CTA 박스`;

    const result = await model.generateContent(prompt);
    let html = result.response.text().trim().replace(/^```html\n?|\n?```$/g, '').trim();

    // SEO 점검
    const plainText = html.replace(/<[^>]+>/g, '');
    const seoChecks = [
      { cat: 'SEO', item: '메인 키워드 도입부 포함', ok: html.indexOf(analysis.mainKeyword) < 600 },
      { cat: 'SEO', item: 'H2 소제목 2개 이상', ok: (html.match(/<h2/gi) || []).length >= 2 },
      { cat: 'SEO', item: '이미지 삽입 위치 표기', ok: html.includes('📷') },
      { cat: 'SEO', item: '본문 2,000자 이상', ok: plainText.length >= 2000 },
      { cat: 'AEO', item: '핵심 요약 박스 포함', ok: html.includes('핵심 요약') },
      { cat: 'AEO', item: 'FAQ 4개 이상', ok: (html.match(/<details/gi) || []).length >= 4 },
      { cat: 'GEO', item: '수치/연도 데이터 포함', ok: /\d+[%년개명원]/.test(plainText) },
      { cat: 'GEO', item: '서술형 문장 위주', ok: plainText.length > 2000 },
    ];

    res.status(200).json({ html, seoChecks, selectedTitle });
  } catch (err) {
    console.error('HTML 생성 오류:', err);
    res.status(500).json({ error: err.message });
  }
}

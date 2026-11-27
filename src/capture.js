import html2canvas from 'html2canvas';

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 요소 하나를 PNG로 저장 (페이지 어디에 있어도 요소 영역 기준으로 캡처) */
export async function captureElement(element, filename) {
  if (!element) return;

  await document.fonts.ready;
  await sleep(50);

  const { width, height } = element.getBoundingClientRect();
  const canvas = await html2canvas(element, {
    scale: 2,
    width: Math.round(width),
    height: Math.round(height),
    useCORS: true,
    backgroundColor: null,
    removeContainer: true,
    logging: false,
  });

  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = filename;
  link.click();
}

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
    // 캡처용 복제 DOM에만 'ubCapture' 클래스를 붙인다.
    // html2canvas는 텍스트 baseline을 브라우저보다 아래로 그리므로(폰트 크기에 비례),
    // 이 클래스에서만 텍스트를 위로 보정한다. (화면 미리보기는 그대로)
    onclone: (clonedDoc) => {
      if (!element.id) return;
      const cloned = clonedDoc.getElementById(element.id);
      if (cloned) cloned.classList.add('ubCapture');
    },
  });

  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = filename;
  link.click();
}

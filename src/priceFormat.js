/**
 * 업비트 KRW 마켓 호가 단위 기준 소수점 자릿수.
 * (매수평균가 입력 규칙과는 다름: 현재가/등락액 표시는 호가 단위를 따른다)
 */
export function getTickDecimals(price) {
  if (price >= 100) return 0; // 100원 이상은 1원 이상 단위
  if (price >= 10) return 1;
  if (price >= 1) return 2;
  if (price >= 0.1) return 3;
  if (price >= 0.01) return 4;
  if (price >= 0.001) return 5;
  if (price >= 0.0001) return 6;
  if (price >= 0.00001) return 7;
  return 8;
}

export function formatPrice(value, decimals) {
  return value.toLocaleString('ko-KR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * 현재가와 기준가(전일 종가)로 업비트 상단 시세 문구를 만든다.
 * - 등락액 = 현재가 - 기준가 (음수는 '-' 표기, 양수는 부호 없음)
 * - 등락률 = 등락액 / 기준가 * 100 (소수 2자리, 양수는 '+' 표기)
 */
export function buildQuote(priceInput, baseInput) {
  const price = Number(priceInput);
  const base = Number(baseInput);
  if (!Number.isFinite(price) || !Number.isFinite(base) || price <= 0 || base <= 0) {
    return null;
  }

  const decimals = getTickDecimals(price);
  const factor = 10 ** decimals;
  const rounded = Math.round(price * factor) / factor;

  const diff = rounded - base;
  const rate = (diff / base) * 100;

  let dir = 'even';
  if (Math.abs(diff) > base * 1e-12) dir = diff > 0 ? 'up' : 'down';

  const rateFixed = rate.toFixed(2);
  const rateIsZero = Number(rateFixed) === 0;
  // PC: 상승 시 '+' 표기 / 모바일 앱: '+' 없이 숫자만 (하락은 둘 다 '-')
  const rateText = rateIsZero
    ? '0.00%'
    : `${rate > 0 ? '+' : ''}${rateFixed}%`;
  const rateTextPlain = rateIsZero ? '0.00%' : `${rateFixed}%`;

  let diffRounded = Math.round(diff * factor) / factor;
  if (diffRounded === 0) diffRounded = 0; // -0 방지

  return {
    dir,
    priceText: formatPrice(rounded, decimals),
    rateText,
    rateTextPlain,
    diffText: formatPrice(diffRounded, decimals),
  };
}

import './BuyShots.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { captureElement, sleep } from './capture';
import { buildQuote } from './priceFormat';

const EMPTY_QUOTE = {
  dir: 'even',
  priceText: '-',
  rateText: '0.00%',
  rateTextPlain: '0.00%',
  diffText: '0',
};

async function fetchJson(urls) {
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      return await res.json();
    } catch (_) {
      // 다음 엔드포인트 시도
    }
  }
  return null;
}

/** 기준가 = 업비트 전일 종가(한국시간 오전 9시 기준) */
async function fetchPrevClose(ticker) {
  const data = await fetchJson([
    `https://api.upbit.com/v1/ticker?markets=KRW-${ticker}`,
    `/api/upbit/ticker?markets=KRW-${ticker}`,
  ]);
  const value = data && data[0] && data[0].prev_closing_price;
  return Number.isFinite(value) ? value : null;
}

/** 로고는 CORS 헤더가 없어 동일 출처 프록시로 받아 dataURL로 변환 */
async function loadLogo(ticker) {
  try {
    const res = await fetch(`/api/upbit-logo/${encodeURIComponent(ticker)}.png`);
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !type.startsWith('image/')) return '';
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch (_) {
    return '';
  }
}

/**
 * CSS 테두리로 그린 삼각형 (색은 currentColor).
 * 위치 지정된 인라인 SVG는 html2canvas 캡처에서 누락/잘림이 생겨 CSS 도형을 쓴다.
 */
function Triangle({ dir, className, width, height }) {
  const side = `${width / 2}px solid transparent`;
  const tip = `${height}px solid currentColor`;
  const style = {
    display: 'block',
    width: 0,
    height: 0,
    borderLeft: side,
    borderRight: side,
    ...(dir === 'up' ? { borderBottom: tip } : { borderTop: tip }),
  };
  return <span className={className} style={style} />;
}

/** 업비트 PC 시세 상단 (구조: titB > select/Arrow, marketB > ty01) */
function PcStage({ id, theme, data }) {
  const { name, ticker, badge, logo, quote } = data;
  return (
    <div id={id} className={`ubPc ubPc--${theme}`}>
      <div className="ubPc__tit">
        <div className="ubPc__select">
          <em className="ubPc__logo">
            {logo ? (
              <img src={logo} alt="" />
            ) : (
              <span className="ubPc__logoFallback">{ticker.slice(0, 1)}</span>
            )}
          </em>
          <strong className="ubPc__name">{name}</strong>
          <p className="ubPc__code">{ticker}/KRW</p>
        </div>
        {badge && (
          <div className="ubPc__caution">
            <span className="ubBadge">위</span>
          </div>
        )}
        <span className="ubPc__arrow">
          <Triangle dir="down" className="ubPc__arrowIco" width={13} height={7} />
        </span>
      </div>

      <div className={`ubPc__market ${quote.dir}`}>
        <span className="ubPc__first">
          <strong>{quote.priceText}</strong>
          <em>KRW</em>
        </span>
        <span className="ubPc__sub">
          <strong>{quote.rateText}</strong>
          <strong className="ubPc__upDown">
            {quote.dir !== 'even' && (
              <Triangle dir={quote.dir} className="ubPc__tri" width={10} height={9} />
            )}
            {quote.diffText}
          </strong>
        </span>
      </div>
    </div>
  );
}

/** 업비트 모바일 앱(다크) 시세 상단 — 참고 사진 831 x 305 기준 */
function MobileStage({ id, data }) {
  const { name, ticker, badge, quote } = data;
  return (
    <div id={id} className="ubM">
      <div className="ubM__back">
        <svg width="32" height="58" viewBox="0 0 32 58">
          <polyline
            points="28.5,2.5 2.5,29 28.5,55.5"
            fill="none"
            stroke="#d6dae2"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="ubM__head">
        {badge && <span className="ubM__badge">위</span>}
        <strong className="ubM__name">
          {name} ({ticker}/KRW)
        </strong>
        <Triangle dir="down" className="ubM__drop" width={24} height={15} />
      </div>

      <div className="ubM__peek">
        <svg width="22" height="40" viewBox="0 0 22 40">
          <polyline
            points="19.5,1.5 2,20 19.5,38.5"
            fill="none"
            stroke="#586070"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className={`ubM__price ${quote.dir}`}>{quote.priceText}</div>
      <div className={`ubM__chg ${quote.dir}`}>
        <span>{quote.rateTextPlain}</span>
        {quote.dir !== 'even' && (
          <Triangle dir={quote.dir} className="ubM__tri" width={30} height={21} />
        )}
        <span className="ubM__diff">{quote.diffText}</span>
      </div>
    </div>
  );
}

function BuyShots({ markets }) {
  const [coinName, setCoinName] = useState('');
  const [ticker, setTicker] = useState('');
  const [price, setPrice] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [badge, setBadge] = useState(false);
  const [logo, setLogo] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const suggestRef = useRef(null);
  const symbol = ticker.trim().toUpperCase();
  const knownMarket = useMemo(
    () => markets.find((m) => m.ticker === symbol) || null,
    [markets, symbol]
  );

  useEffect(() => {
    const onDocClick = (e) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target)) {
        setShowSuggest(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // 티커가 바뀌면 로고 로드
  useEffect(() => {
    setLogo('');
    if (!symbol) return undefined;

    let cancelled = false;
    const timer = setTimeout(async () => {
      const dataUrl = await loadLogo(symbol);
      if (!cancelled) setLogo(dataUrl);
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [symbol]);

  const loadBase = useCallback(async (sym) => {
    setStatus('기준가(전일 종가) 조회 중…');
    const value = await fetchPrevClose(sym);
    if (value === null) {
      setStatus('기준가를 불러오지 못했습니다. 직접 입력해 주세요.');
      return;
    }
    setBasePrice(String(value));
    setStatus('');
  }, []);

  // 업비트에 있는 종목이면 기준가 자동 조회
  useEffect(() => {
    if (!knownMarket) return undefined;

    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) loadBase(knownMarket.ticker);
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [knownMarket, loadBase]);

  const filtered = useMemo(() => {
    const q = coinName.trim().toLowerCase();
    if (!q || markets.length === 0) return [];
    return markets
      .filter(
        (m) =>
          m.koreanName.toLowerCase().includes(q) ||
          m.ticker.toLowerCase().includes(q) ||
          m.englishName.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [coinName, markets]);

  const pickCoin = (m) => {
    setCoinName(m.koreanName);
    setTicker(m.ticker);
    setBadge(Boolean(m.caution || m.warning));
    setShowSuggest(false);
  };

  const handleCoinChange = (e) => {
    const v = e.target.value;
    setCoinName(v);
    setShowSuggest(true);

    const exact = markets.find(
      (m) => m.koreanName === v || m.ticker.toLowerCase() === v.trim().toLowerCase()
    );
    if (exact) pickCoin(exact);
  };

  const onlyNumber = (setter) => (e) => {
    const v = e.target.value;
    if (!/^\d*\.?\d*$/.test(v)) return;
    setter(v);
  };

  const quote = useMemo(() => buildQuote(price, basePrice), [price, basePrice]);

  const stageData = {
    name: coinName.trim() || '코인명',
    ticker: symbol || 'TICKER',
    badge,
    logo,
    quote: quote || EMPTY_QUOTE,
  };

  const handleGenerate = async () => {
    if (!coinName.trim() || !symbol) {
      setStatus('코인명과 티커를 확인해 주세요.');
      return;
    }
    if (!quote) {
      setStatus('현재가와 기준가를 올바르게 입력해 주세요.');
      return;
    }

    setBusy(true);
    setStatus('이미지 생성 중…');

    try {
      const safeName = coinName.trim().replace(/[\\/:*?"<>|]/g, '_');
      const shots = [
        ['ubShotPcLight', `${safeName}_매수_PC_일반.png`],
        ['ubShotPcDark', `${safeName}_매수_PC_다크.png`],
        ['ubShotMobileDark', `${safeName}_매수_모바일_다크.png`],
      ];

      for (let i = 0; i < shots.length; i += 1) {
        const [id, filename] = shots[i];
        await captureElement(document.getElementById(id), filename);
        if (i < shots.length - 1) await sleep(300);
      }

      setStatus(`완료 — 이미지 ${shots.length}장 저장됨`);
    } catch (err) {
      console.error(err);
      setStatus('이미지 생성 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ubWrap">
      <div className="ubPreview">
        <div className="ubPreviewItem">
          <div className="ubPreviewLabel">PC · 일반</div>
          <PcStage id="ubShotPcLight" theme="light" data={stageData} />
        </div>
        <div className="ubPreviewItem">
          <div className="ubPreviewLabel">PC · 다크</div>
          <PcStage id="ubShotPcDark" theme="dark" data={stageData} />
        </div>
        <div className="ubPreviewItem">
          <div className="ubPreviewLabel">모바일 · 다크</div>
          <MobileStage id="ubShotMobileDark" data={stageData} />
        </div>
      </div>

      <div className="formWrap">
        <div className="inputWrap suggestWrap" ref={suggestRef}>
          <div className="label">코인명</div>
          <div className="suggestField">
            <input
              type="text"
              value={coinName}
              onChange={handleCoinChange}
              onFocus={() => setShowSuggest(true)}
              placeholder="예: 라그랑주 / LA"
              autoComplete="off"
            />
            {showSuggest && filtered.length > 0 && (
              <ul className="suggestList">
                {filtered.map((m) => (
                  <li key={m.market} onClick={() => pickCoin(m)}>
                    <strong>{m.koreanName}</strong>
                    <span>{m.ticker}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="inputWrap">
          <div className="label">티커(영문)</div>
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="자동 입력 / 수동 수정 가능"
          />
        </div>

        <div className="inputWrap">
          <div className="label">현재가</div>
          <input type="text" value={price} onChange={onlyNumber(setPrice)} />
        </div>

        <div className="inputWrap">
          <div className="label">기준가(전일 종가)</div>
          <input type="text" value={basePrice} onChange={onlyNumber(setBasePrice)} />
          <button
            type="button"
            className="ubSmallBtn"
            disabled={!knownMarket}
            onClick={() => knownMarket && loadBase(knownMarket.ticker)}
          >
            다시 불러오기
          </button>
        </div>

        <label className="ubCheck">
          <input
            type="checkbox"
            checked={badge}
            onChange={(e) => setBadge(e.target.checked)}
          />
          <span>‘위’ 배지 표시 (주의 항목이 있는 종목은 자동 체크)</span>
        </label>

        <div className="inputWrap">
          <button type="button" onClick={handleGenerate} disabled={busy}>
            {busy ? '생성 중…' : '이미지 3장 생성'}
          </button>
        </div>

        {status && <div className="statusMsg">{status}</div>}
      </div>
    </div>
  );
}

export default BuyShots;

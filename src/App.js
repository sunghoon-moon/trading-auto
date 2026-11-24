import './App.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import html2canvas from 'html2canvas';

const HOLDINGS_FONT_DEFAULT = 32;
const HOLDINGS_FONT_MIN = 18;
const LEFT_PAD_RATIO = 0.03;

function formatWithCommas(value) {
  if (value === '' || value === null || value === undefined) return '';
  const [int, decimal] = String(value).split('.');
  const formattedInt = int ? Number(int).toLocaleString('ko-KR') : '0';
  return decimal !== undefined ? `${formattedInt}.${decimal}` : formattedInt;
}

/** 업비트 매수평균가 구간별 소수점 최대 자릿수 */
function getAvgPriceDecimals(price) {
  if (price >= 10000) return 0;
  if (price >= 100) return 1;
  if (price >= 10) return 2;
  if (price >= 1) return 3;
  if (price >= 0.1) return 4;
  if (price >= 0.01) return 5;
  if (price >= 0.001) return 6;
  if (price >= 0.0001) return 7;
  return 8;
}

function formatAvgPrice(price) {
  if (!Number.isFinite(price)) return '';
  const decimals = getAvgPriceDecimals(price);
  return formatWithCommas(price.toFixed(decimals));
}

function formatIntegerKrw(value) {
  if (!Number.isFinite(value)) return '';
  return Math.round(value).toLocaleString('ko-KR');
}

/** 3000만 이상 ~ 6000만 미만, 끝자리 0이 과도하지 않은 금액 */
function randomBuyAmount() {
  const min = 30000000;
  const max = 59999999;
  let amount = Math.floor(Math.random() * (max - min + 1)) + min;

  // 0000 이상으로 끝나면 끝자리 흔들기
  if (amount % 10000 === 0) {
    amount += Math.floor(Math.random() * 8999) + 1001;
    if (amount > max) amount -= 10000;
    if (amount < min) amount += 10000;
  }

  return amount;
}

function onlyNumber(setter) {
  return (e) => {
    const v = e.target.value;
    if (!/^\d*\.?\d*$/.test(v)) return;
    setter(v);
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function App() {
  const [coinName, setCoinName] = useState('');
  const [ticker, setTicker] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [target1, setTarget1] = useState('');
  const [target2, setTarget2] = useState('');
  const [target3, setTarget3] = useState('');

  const [markets, setMarkets] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [status, setStatus] = useState('');
  const [generating, setGenerating] = useState(false);

  // 캡처용 표시 값
  const [option01, setOption01] = useState('');
  const [option02, setOption02] = useState('');
  const [option03, setOption03] = useState(''); // 평가손익
  const [option04, setOption04] = useState(''); // 수익률
  const [option05, setOption05] = useState(''); // 보유수량
  const [option06, setOption06] = useState(''); // 매수평균가
  const [option07, setOption07] = useState(''); // 평가금액
  const [option08, setOption08] = useState(''); // 매수금액
  const [option09, setOption09] = useState(HOLDINGS_FONT_DEFAULT);

  const suggestRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const endpoints = [
          'https://api.upbit.com/v1/market/all?isDetails=false',
          '/api/upbit/market/all?isDetails=false',
        ];

        let data = null;
        for (const url of endpoints) {
          try {
            const res = await fetch(url);
            if (!res.ok) continue;
            data = await res.json();
            break;
          } catch (_) {
            // 다음 엔드포인트 시도
          }
        }
        if (!data) throw new Error('업비트 종목 조회 실패');
        if (cancelled) return;

        const krw = data
          .filter((m) => m.market.startsWith('KRW-'))
          .map((m) => ({
            market: m.market,
            koreanName: m.korean_name,
            englishName: m.english_name,
            ticker: m.market.replace('KRW-', ''),
          }));
        setMarkets(krw);
      } catch (err) {
        console.error(err);
        if (!cancelled) setStatus('업비트 종목 목록을 불러오지 못했습니다. 티커는 수동 입력하세요.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onDocClick = (e) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target)) {
        setShowSuggest(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

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

  const handleCoinChange = (e) => {
    const v = e.target.value;
    setCoinName(v);
    setShowSuggest(true);

    const exact = markets.find(
      (m) =>
        m.koreanName === v ||
        m.ticker.toLowerCase() === v.trim().toLowerCase()
    );
    if (exact) {
      setTicker(exact.ticker);
      setCoinName(exact.koreanName);
    }
  };

  const pickCoin = (m) => {
    setCoinName(m.koreanName);
    setTicker(m.ticker);
    setShowSuggest(false);
  };

  const fitHoldingsFont = async () => {
    const captureEl = document.getElementById('capture');
    const holdingsEl = document.querySelector('.option05');
    if (!captureEl || !holdingsEl) return HOLDINGS_FONT_DEFAULT;

    let size = HOLDINGS_FONT_DEFAULT;
    flushSync(() => setOption09(size));
    await sleep(16);

    const leftLimit =
      captureEl.getBoundingClientRect().left +
      captureEl.getBoundingClientRect().width * LEFT_PAD_RATIO;

    while (size > HOLDINGS_FONT_MIN) {
      const left = holdingsEl.getBoundingClientRect().left;
      if (left >= leftLimit - 0.5) break;
      const next = size - 1;
      size = next;
      flushSync(() => setOption09(next));
      await sleep(16);
    }

    return size;
  };

  const captureOnce = async (filename) => {
    const element = document.getElementById('capture');
    if (!element) return;

    await document.fonts.ready;
    await sleep(50);

    const { width, height } = element.getBoundingClientRect();
    const canvas = await html2canvas(element, {
      scale: 2,
      width: Math.round(width),
      height: Math.round(height),
      x: 0,
      y: 0,
      useCORS: true,
      backgroundColor: null,
      removeContainer: true,
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = imgData;
    link.download = filename;
    link.click();
  };

  const applySnapshot = ({
    name,
    symbol,
    avgPriceText,
    buyAmountText,
    holdingsText,
    rateText,
    evalAmountText,
    pnlText,
  }) => {
    flushSync(() => {
      setOption01(name);
      setOption02(symbol);
      setOption06(avgPriceText);
      setOption08(buyAmountText);
      setOption05(holdingsText);
      setOption04(rateText);
      setOption07(evalAmountText);
      setOption03(pnlText);
      setOption09(HOLDINGS_FONT_DEFAULT);
    });
  };

  const buildCalc = (buy, target, amount) => {
    const holdings = amount / buy;
    const holdingsText = holdings.toFixed(8);
    const rate = ((target - buy) / buy) * 100;
    const evalAmount = holdings * target;
    const pnl = evalAmount - amount;

    return {
      holdingsText,
      rateText: rate.toFixed(2),
      evalAmountText: formatIntegerKrw(evalAmount),
      pnlText: formatIntegerKrw(pnl),
      buyAmountText: formatIntegerKrw(amount),
      avgPriceText: formatAvgPrice(buy),
    };
  };

  const handleGenerate = async () => {
    const buy = Number(buyPrice);
    const tp = Number(takeProfit);
    const t1 = Number(target1);
    const t2 = target2.trim() === '' ? null : Number(target2);
    const t3 = target3.trim() === '' ? null : Number(target3);
    const name = coinName.trim();
    const symbol = ticker.trim().toUpperCase();

    if (!name || !symbol) {
      setStatus('코인명과 티커를 확인해 주세요.');
      return;
    }
    if (!Number.isFinite(buy) || buy <= 0) {
      setStatus('매수가를 올바르게 입력해 주세요.');
      return;
    }
    if (!Number.isFinite(tp) || tp <= 0) {
      setStatus('자율 익절가를 올바르게 입력해 주세요.');
      return;
    }
    if (!Number.isFinite(t1) || t1 <= 0) {
      setStatus('1차 목표가를 올바르게 입력해 주세요.');
      return;
    }
    if (t2 !== null && (!Number.isFinite(t2) || t2 <= 0)) {
      setStatus('2차 목표가를 올바르게 입력해 주세요.');
      return;
    }
    if (t3 !== null && (!Number.isFinite(t3) || t3 <= 0)) {
      setStatus('3차 목표가를 올바르게 입력해 주세요.');
      return;
    }

    const jobs = [
      { label: '자율익절', price: tp },
      { label: '1차목표', price: t1 },
    ];
    if (t2 !== null) jobs.push({ label: '2차목표', price: t2 });
    if (t3 !== null) jobs.push({ label: '3차목표', price: t3 });

    setGenerating(true);
    setStatus('이미지 생성 중…');

    try {
      const amount = randomBuyAmount();
      const safeName = name.replace(/[\\/:*?"<>|]/g, '_');

      for (let i = 0; i < jobs.length; i += 1) {
        const job = jobs[i];
        const calc = buildCalc(buy, job.price, amount);
        applySnapshot({
          name,
          symbol,
          ...calc,
        });
        await fitHoldingsFont();
        await captureOnce(`${safeName}_${job.label}.png`);
        if (i < jobs.length - 1) await sleep(300);
      }

      setStatus(
        `완료 — 매수금액 ${formatIntegerKrw(amount)}원 기준, 이미지 ${jobs.length}장 저장됨`
      );
    } catch (err) {
      console.error(err);
      setStatus('이미지 생성 중 오류가 발생했습니다.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="App">
      <div className="imgWrap d-flex">
        <div className="img" id="capture">
          <img src="/images/bg.jpg" alt="" />

          <div className="option option01">
            {option01} <img src="/images/ico_share.png" alt="" />
          </div>

          <div className="option option02">({option02})</div>

          <div className="option option03">{option03}</div>

          <div className="option option04">{option04}%</div>

          <div
            className="option option05"
            style={{ fontSize: `${option09}px` }}
          >
            {formatWithCommas(option05)}
            <span className="unit"> {option02}</span>
          </div>

          <div className="option option06">
            {option06}
            <span className="unit"> KRW</span>
          </div>

          <div className="option option07">
            {option07}
            <span className="unit"> KRW</span>
          </div>

          <div className="option option08">
            {option08}
            <span className="unit"> KRW</span>
          </div>
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
              placeholder="예: 아이오에스티 / IOST"
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
          <div className="label">매수가</div>
          <input type="text" value={buyPrice} onChange={onlyNumber(setBuyPrice)} />
        </div>

        <div className="inputWrap">
          <div className="label">자율 익절가</div>
          <input
            type="text"
            value={takeProfit}
            onChange={onlyNumber(setTakeProfit)}
          />
        </div>

        <div className="inputWrap">
          <div className="label">1차 목표가</div>
          <input type="text" value={target1} onChange={onlyNumber(setTarget1)} />
        </div>

        <div className="inputWrap">
          <div className="label">2차 목표가 (선택)</div>
          <input type="text" value={target2} onChange={onlyNumber(setTarget2)} />
        </div>

        <div className="inputWrap">
          <div className="label">3차 목표가 (선택)</div>
          <input type="text" value={target3} onChange={onlyNumber(setTarget3)} />
        </div>

        <div className="inputWrap">
          <button type="button" onClick={handleGenerate} disabled={generating}>
            {generating ? '생성 중…' : '이미지 생성'}
          </button>
        </div>

        {status && <div className="statusMsg">{status}</div>}
      </div>
    </div>
  );
}

export default App;

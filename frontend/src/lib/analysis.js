// PerpPilot analysis engine: indicators, signal scoring, trade plan and
// plain-English explanations. Pure functions only (no React, no network).

export function calculateEMA(values, period) {
  if (!values.length) return [];
  const k = 2 / (period + 1);
  const ema = [values[0]];
  for (let i = 1; i < values.length; i += 1) {
    ema.push((values[i] - ema[i - 1]) * k + ema[i - 1]);
  }
  return ema;
}

export function calculateRSI(values, period = 14) {
  if (values.length < period + 1) return values.map(() => 50);
  const result = Array(values.length).fill(50);
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i += 1) {
    const change = values[i] - values[i - 1];
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

export function calculateMACD(values) {
  const e12 = calculateEMA(values, 12);
  const e26 = calculateEMA(values, 26);
  return values.map((_, i) => e12[i] - e26[i]);
}

// Average True Range (Wilder smoothing). Returns an array aligned to candles.
export function calculateATR(candles, period = 14) {
  if (candles.length < 2) return candles.map(() => 0);
  const tr = candles.map((c, i) => {
    const high = Number(c.high);
    const low = Number(c.low);
    if (i === 0) return high - low;
    const prevClose = Number(candles[i - 1].close);
    return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
  });
  const atr = Array(tr.length).fill(0);
  const seed = Math.min(period, tr.length);
  atr[seed - 1] = tr.slice(0, seed).reduce((a, b) => a + b, 0) / seed;
  for (let i = seed; i < tr.length; i += 1) {
    atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
  }
  for (let i = 0; i < seed - 1; i += 1) atr[i] = atr[seed - 1];
  return atr;
}

// Kaufman efficiency ratio: 1 = straight-line trend, 0 = pure chop.
export function efficiencyRatio(values, period = 20) {
  if (values.length < period + 1) return 0.3;
  const end = values.length - 1;
  const net = Math.abs(values[end] - values[end - period]);
  let path = 0;
  for (let i = end - period + 1; i <= end; i += 1) {
    path += Math.abs(values[i] - values[i - 1]);
  }
  return path === 0 ? 0 : net / path;
}

const fmt = (value, digits = 2) =>
  Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

// Pick a sensible number of decimals for a price.
export function priceDigits(price) {
  const p = Math.abs(Number(price));
  if (p >= 1000) return 2;
  if (p >= 1) return 4;
  if (p >= 0.01) return 5;
  return 7;
}

export function generateSignal(candles) {
  if (!Array.isArray(candles) || candles.length < 30) {
    return {
      signal: "HOLD",
      confidence: 50,
      reason: "Waiting for sufficient market data.",
      factors: [],
      explanation: ["Not enough candles loaded yet to analyse this market."],
      plan: null,
      risk: { level: "Unknown", score: 0, reasons: ["Insufficient data"] },
      regime: "Unknown",
      volatility: { label: "Unknown", atr: 0, atrPct: 0, ratio: 1 },
      levels: null,
    };
  }

  const closes = candles.map((c) => Number(c.close));
  const volumes = candles.map((c) => Number(c.volume || 0));

  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const rsi = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const atrSeries = calculateATR(candles, 14);

  const last = closes.length - 1;
  const prev = Math.max(0, last - 3);
  const price = closes[last];

  const ema9Slope = ema9[prev] ? ((ema9[last] - ema9[prev]) / ema9[prev]) * 100 : 0;
  const momentum = closes[prev] ? ((price - closes[prev]) / closes[prev]) * 100 : 0;

  const recentVol = volumes.slice(Math.max(0, last - 19), last + 1);
  const avgVol = recentVol.reduce((s, v) => s + v, 0) / Math.max(1, recentVol.length);
  const volumeRatio = avgVol > 0 ? volumes[last] / avgVol : 1;

  // Volatility and regime
  const atr = atrSeries[last];
  const atrPct = price ? (atr / price) * 100 : 0;
  const atrWindow = atrSeries.slice(Math.max(0, last - 49), last + 1);
  const atrAvg = atrWindow.reduce((s, v) => s + v, 0) / Math.max(1, atrWindow.length);
  const atrRatio = atrAvg > 0 ? atr / atrAvg : 1;
  const volLabel = atrRatio > 1.3 ? "Expanding" : atrRatio < 0.75 ? "Compressing" : "Normal";

  const er = efficiencyRatio(closes, 20);
  const regime = er >= 0.35 ? "Trending" : er < 0.2 ? "Choppy" : "Transitional";

  // Support / resistance from recent swing extremes
  const win = candles.slice(Math.max(0, last - 29), last + 1);
  const support = Math.min(...win.map((c) => Number(c.low)));
  const resistance = Math.max(...win.map((c) => Number(c.high)));

  // Scoring
  let score = 0;
  const factors = [];

  if (ema9[last] > ema21[last]) { score += 2; factors.push("EMA trend bullish"); }
  else { score -= 2; factors.push("EMA trend bearish"); }

  if (ema9Slope > 0.03) { score += 1; factors.push("Short-term momentum rising"); }
  else if (ema9Slope < -0.03) { score -= 1; factors.push("Short-term momentum falling"); }

  if (price > ema9[last]) { score += 1; factors.push("Price above EMA9"); }
  else if (price < ema9[last]) { score -= 1; factors.push("Price below EMA9"); }

  if (rsi[last] >= 52 && rsi[last] <= 68) { score += 2; factors.push("RSI supports bullish momentum"); }
  else if (rsi[last] >= 32 && rsi[last] <= 48) { score -= 2; factors.push("RSI supports bearish momentum"); }
  else if (rsi[last] > 72) { score -= 1; factors.push("RSI is overbought"); }
  else if (rsi[last] < 28) { score += 1; factors.push("RSI is oversold"); }

  if (macd[last] > 0) { score += 2; factors.push("MACD is positive"); }
  else { score -= 2; factors.push("MACD is negative"); }

  if (momentum > 0.08) { score += 1; factors.push("Recent price momentum positive"); }
  else if (momentum < -0.08) { score -= 1; factors.push("Recent price momentum negative"); }

  if (volumeRatio > 1.15) {
    if (momentum > 0) { score += 1; factors.push("Volume confirms buying activity"); }
    else if (momentum < 0) { score -= 1; factors.push("Volume confirms selling activity"); }
  }

  let signal = "HOLD";
  if (score >= 6) signal = "LONG";
  if (score <= -6) signal = "SHORT";

  // Confidence: strength of score, adjusted for regime and volatility.
  let confidence = signal === "HOLD"
    ? Math.min(68, 50 + Math.abs(score) * 3)
    : Math.min(90, 50 + Math.abs(score) * 4);

  const cautions = [];
  if (signal !== "HOLD") {
    if (regime === "Choppy") {
      confidence -= 10;
      cautions.push("The market is choppy, so trend signals are less reliable.");
    } else if (regime === "Trending") {
      confidence += 3;
    }
    if (volLabel === "Expanding") {
      confidence -= 4;
      cautions.push("Volatility is expanding, so price swings may be larger than usual.");
    }
    if (signal === "LONG" && rsi[last] > 70) {
      confidence -= 6;
      cautions.push("RSI is high, so a pullback is possible.");
    }
    if (signal === "SHORT" && rsi[last] < 30) {
      confidence -= 6;
      cautions.push("RSI is low, so a bounce is possible.");
    }
    if (signal === "LONG" && price >= resistance - atr * 0.3) {
      confidence -= 4;
      cautions.push("Price is close to recent resistance.");
    }
    if (signal === "SHORT" && price <= support + atr * 0.3) {
      confidence -= 4;
      cautions.push("Price is close to recent support.");
    }
  }
  confidence = Math.max(35, Math.min(90, Math.round(confidence)));

  // Trade plan (ATR-based). Suggestion only, never sent automatically.
  let plan = null;
  if (signal !== "HOLD" && atr > 0) {
    const dir = signal === "LONG" ? 1 : -1;
    const stopDistance = atr * 1.5;
    const stop = price - dir * stopDistance;
    const target1 = price + dir * stopDistance * 1.5;
    const target2 = price + dir * stopDistance * 2.5;
    plan = {
      side: signal,
      entry: price,
      stop,
      target1,
      target2,
      stopPct: (stopDistance / price) * 100,
      rr1: 1.5,
      rr2: 2.5,
    };
  }

  // Risk rating
  const riskReasons = [];
  let riskScore = 0;
  if (volLabel === "Expanding") { riskScore += 2; riskReasons.push("Volatility is expanding"); }
  if (atrPct > 0.6) { riskScore += 1; riskReasons.push(`High range per candle (${atrPct.toFixed(2)}%)`); }
  if (regime === "Choppy") { riskScore += 2; riskReasons.push("Choppy, directionless price action"); }
  if (rsi[last] > 72 || rsi[last] < 28) { riskScore += 1; riskReasons.push("RSI at an extreme"); }
  if (signal === "HOLD") { riskScore += 1; riskReasons.push("No clear directional edge"); }
  if (!riskReasons.length) riskReasons.push("Conditions look orderly");
  const riskLevel = riskScore >= 4 ? "High" : riskScore >= 2 ? "Medium" : "Low";

  // Plain-English explanation
  const dp = priceDigits(price);
  const explanation = [];

  explanation.push(
    ema9[last] > ema21[last]
      ? `Trend: the fast average (EMA9) is above the slower one (EMA21), which points up. Market regime is ${regime.toLowerCase()}.`
      : `Trend: the fast average (EMA9) is below the slower one (EMA21), which points down. Market regime is ${regime.toLowerCase()}.`
  );

  explanation.push(
    `Momentum: RSI is ${rsi[last].toFixed(0)} and MACD is ${macd[last] >= 0 ? "positive" : "negative"}, so buyers are ${
      macd[last] >= 0 && rsi[last] >= 50 ? "currently in control" : macd[last] < 0 && rsi[last] < 50 ? "losing ground to sellers" : "not clearly in control"
    }.`
  );

  explanation.push(
    `Volatility: the average candle range is about ${atrPct.toFixed(2)}% (${volLabel.toLowerCase()}).`
  );

  explanation.push(
    `Levels: recent support is near ${fmt(support, dp)} and resistance near ${fmt(resistance, dp)}.`
  );

  if (signal === "HOLD") {
    explanation.push(
      rsi[last] > 72
        ? "Verdict: price looks stretched to the upside (overbought), so chasing a long is risky. Waiting is the lower-risk choice."
        : rsi[last] < 28
          ? "Verdict: price looks stretched to the downside (oversold), so chasing a short is risky. Waiting is the lower-risk choice."
          : "Verdict: signals disagree with each other, so waiting is the lower-risk choice."
    );
  } else {
    explanation.push(
      `Verdict: ${signal} bias with ${confidence}% confidence. It is invalidated if price closes ${
        signal === "LONG" ? "below" : "above"
      } ${fmt(ema21[last], dp)} (EMA21) or hits the stop in the plan.`
    );
  }
  cautions.forEach((c) => explanation.push(`Caution: ${c}`));

  let reason = "Signals are mixed. Waiting for stronger confirmation.";
  if (signal !== "HOLD") {
    reason = `${signal === "LONG" ? "Bullish" : "Bearish"} confirmation from ${factors
      .slice(0, 4)
      .join(", ")}.`;
  }

  return {
    signal,
    confidence,
    reason,
    factors,
    explanation,
    plan,
    risk: { level: riskLevel, score: riskScore, reasons: riskReasons },
    regime,
    volatility: { label: volLabel, atr, atrPct, ratio: atrRatio },
    levels: { support, resistance },
    rsi: rsi[last],
    ema9: ema9[last],
    ema21: ema21[last],
    macd: macd[last],
    momentum,
    score,
  };
}

// Position sizing from account equity, risk % and a stop distance.
export function sizePosition({
  equity,
  riskPct,
  entry,
  stop,
  side,
  initialMarginBps,
  lotSizeUnits,
}) {
  const result = { ok: false, warnings: [] };
  const eq = Number(equity);
  const risk = Number(riskPct);
  const e = Number(entry);
  const s = Number(stop);

  if (![eq, risk, e, s].every(Number.isFinite) || eq <= 0 || risk <= 0 || e <= 0 || s <= 0) {
    result.warnings.push("Enter equity, risk %, entry and stop.");
    return result;
  }
  if (side === "LONG" && s >= e) {
    result.warnings.push("For a long, the stop must be below the entry.");
    return result;
  }
  if (side === "SHORT" && s <= e) {
    result.warnings.push("For a short, the stop must be above the entry.");
    return result;
  }

  const riskAmount = eq * (risk / 100);
  const stopDistance = Math.abs(e - s);
  let quantity = riskAmount / stopDistance;
  if (lotSizeUnits && lotSizeUnits > 0) {
    quantity = Math.floor(quantity / lotSizeUnits + 1e-9) * lotSizeUnits;
  }
  const notional = quantity * e;
  const leverage = notional / eq;
  const imRatio = Number(initialMarginBps) / 10000;
  const marginRequired = Number.isFinite(imRatio) && imRatio > 0 ? notional * imRatio : null;
  const stopPct = (stopDistance / e) * 100;

  if (quantity <= 0) result.warnings.push("Risk amount is too small for the minimum order size.");
  if (risk > 2) result.warnings.push("Risking more than 2% per trade is aggressive.");
  if (leverage > 10) result.warnings.push(`Effective leverage is ${leverage.toFixed(1)}x, which is very high.`);
  if (marginRequired !== null && marginRequired > eq) {
    result.warnings.push("Required margin exceeds your equity. Reduce size or widen the risk budget.");
  }
  if (stopPct < 0.15) result.warnings.push("The stop is very tight and may be hit by normal noise.");

  return {
    ok: quantity > 0,
    warnings: result.warnings,
    riskAmount,
    quantity,
    notional,
    leverage,
    marginRequired,
    stopPct,
  };
}

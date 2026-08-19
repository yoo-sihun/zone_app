"use client";

import { useApp } from "@/lib/AppContext";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function fmtDot(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function WeekStrip() {
  const { currentDate, today, goPrevDay, goNextDay, goToDate } = useApp();

  const days = [];
  for (let offset = -3; offset <= 3; offset++) {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + offset);
    days.push(d);
  }

  return (
    <div className="weekstrip-wrap">
      <div className="datebar">
        <button className="navbtn" onClick={goPrevDay}>‹</button>
        <div className="dlabel">📅 {fmtDot(currentDate)} ({WEEKDAY_LABELS[currentDate.getDay()]})</div>
        <button className="navbtn" disabled={currentDate >= today} onClick={goNextDay}>›</button>
      </div>
      <div className="weekstrip">
        {days.map((d) => {
          const future = d > today;
          const selected = sameDay(d, currentDate);
          return (
            <button
              key={d.toISOString()}
              className={`weekday-cell ${selected ? "on" : ""}`}
              disabled={future}
              onClick={() => goToDate(d)}
            >
              <span className="weekday-num">{d.getDate()}</span>
              <span className="weekday-label">{WEEKDAY_LABELS[d.getDay()]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

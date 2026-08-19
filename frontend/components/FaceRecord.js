"use client";

import { useRef } from "react";
import { useApp } from "@/lib/AppContext";

export default function FaceRecord() {
  const {
    config, mode, slot, selectedProductId, focusedParentZone, dayData,
    zoomTo, zoomOut, toggleLog, placeDot, deleteDot,
  } = useApp();
  const svgRef = useRef(null);

  if (!config) return null;
  const SUB_TO_PARENT = config.sub_to_parent;

  async function handleClick(e) {
    const svg = svgRef.current;
    let clickedZone = null;
    const target = e.target;
    if (target.classList && target.classList.contains("zone")) {
      clickedZone = target.dataset.z;
    }
    if (!clickedZone) {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      const testPt = svg.createSVGPoint();
      testPt.x = p.x; testPt.y = p.y;
      for (const el of svg.querySelectorAll(".zone")) {
        if (el.isPointInFill(testPt)) { clickedZone = el.dataset.z; break; }
      }
    }
    if (!clickedZone) return;

    const parentZone = SUB_TO_PARENT[clickedZone] || clickedZone;

    if (!focusedParentZone) {
      zoomTo(parentZone);
      return;
    }

    if (focusedParentZone === parentZone) {
      if (mode === "apply") {
        e.stopPropagation();
        await toggleLog(clickedZone);
      } else if (mode === "trouble") {
        const pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        const p = pt.matrixTransform(svg.getScreenCTM().inverse());
        await placeDot(clickedZone, p.x, p.y);
      }
    } else {
      zoomTo(parentZone);
    }
  }

  const zoomedOut = !focusedParentZone;
  const svgClass = ["face-svg", zoomedOut ? "zoomed-out" : "", focusedParentZone ? `focus-${focusedParentZone}` : ""]
    .filter(Boolean).join(" ");

  function isApplied(zone) {
    const slotIds = (dayData.log[zone] && dayData.log[zone][slot]) || [];
    return !!(selectedProductId && slotIds.includes(selectedProductId));
  }

  function zoneClass(zone) {
    return `zone ${isApplied(zone) ? "applied" : ""}`.trim();
  }

  function groupClass(mz) {
    return `zone-group ${focusedParentZone === mz ? "focused" : ""}`.trim();
  }

  return (
    <div className="face-card">
      <div className="face-container-wrap">
        {!zoomedOut && (
          <button className="zoom-out-btn" onClick={(e) => { e.stopPropagation(); zoomOut(); }}>
            ⤢ 전체보기
          </button>
        )}
        <svg ref={svgRef} id="face" className={svgClass} viewBox="0 0 400 440" onClick={handleClick}>
          <path className="outline" d="M200,72 C272,72 322,140 322,232 C322,334 266,398 200,398 C134,398 78,334 78,232 C78,140 128,72 200,72 Z" />

          <g className={groupClass("forehead")} data-mz="forehead">
            <path className={zoneClass("forehead_right")} data-z="forehead_right" d="M104,182 C112,108 152,82 200,82 L200,166 C155,160 120,168 104,182 Z" />
            <path className={zoneClass("forehead_left")} data-z="forehead_left" d="M200,82 C248,82 288,108 296,182 C280,168 245,160 200,166 Z" />
            <text className="zlabel parent-label" x="200" y="135">이마</text>
            <text className="zlabel sub-label" data-sub="forehead_right" x="145" y="135">오른쪽</text>
            <text className="zlabel sub-label" data-sub="forehead_left" x="255" y="135">왼쪽</text>
          </g>

          <g className={groupClass("rcheek")} data-mz="rcheek">
            <path className={zoneClass("rcheek_upper")} data-z="rcheek_upper" d="M110,210 C130,195 155,195 173,197 L173,245 C150,245 130,235 110,225 Z" />
            <path className={zoneClass("rcheek_lower")} data-z="rcheek_lower" d="M110,225 C130,235 150,245 173,245 L173,285 C160,300 145,295 130,280 L115,255 Z" />
            <path className={zoneClass("rcheek_outer")} data-z="rcheek_outer" d="M101,196 C105,200 108,205 110,210 L110,225 L115,255 L130,280 C115,285 105,275 99,266 C93,241 95,216 101,196 Z" />
            <text className="zlabel parent-label" x="133" y="250">오른볼</text>
            <text className="zlabel sub-label" data-sub="rcheek_upper" x="145" y="220">상부</text>
            <text className="zlabel sub-label" data-sub="rcheek_lower" x="145" y="270">하부</text>
            <text className="zlabel sub-label" data-sub="rcheek_outer" x="112" y="240">바깥</text>
          </g>

          <g className={groupClass("lcheek")} data-mz="lcheek">
            <path className={zoneClass("lcheek_upper")} data-z="lcheek_upper" d="M290,210 C270,195 245,195 227,197 L227,245 C250,245 270,235 290,225 Z" />
            <path className={zoneClass("lcheek_lower")} data-z="lcheek_lower" d="M290,225 C270,235 250,245 227,245 L227,285 C240,300 255,295 270,280 L285,255 Z" />
            <path className={zoneClass("lcheek_outer")} data-z="lcheek_outer" d="M299,196 C295,200 292,205 290,210 L290,225 L285,255 L270,280 C285,285 295,275 301,266 C307,241 305,216 299,196 Z" />
            <text className="zlabel parent-label" x="267" y="250">왼볼</text>
            <text className="zlabel sub-label" data-sub="lcheek_upper" x="255" y="220">상부</text>
            <text className="zlabel sub-label" data-sub="lcheek_lower" x="255" y="270">하부</text>
            <text className="zlabel sub-label" data-sub="lcheek_outer" x="288" y="240">바깥</text>
          </g>

          <g className={groupClass("nose")} data-mz="nose">
            <path className={zoneClass("nose_bridge")} data-z="nose_bridge" d="M200,186 L212,245 L188,245 Z" />
            <path className={zoneClass("nose_tip")} data-z="nose_tip" d="M212,245 L221,286 C221,303 210,311 200,311 C190,311 179,303 179,286 L188,245 Z" />
            <text className="zlabel parent-label" x="200" y="252">코</text>
            <text className="zlabel sub-label" data-sub="nose_bridge" x="200" y="215">콧등</text>
            <text className="zlabel sub-label" data-sub="nose_tip" x="200" y="275">코끝</text>
          </g>

          <g className={groupClass("chin")} data-mz="chin">
            <path className={zoneClass("chin_lip")} data-z="chin_lip" d="M151,316 C171,309 229,309 249,316 C245,348 225,350 200,350 C175,350 155,348 151,316 Z" />
            <path className={zoneClass("chin_jaw")} data-z="chin_jaw" d="M151,348 C155,348 175,350 200,350 C225,350 245,348 249,348 C254,356 229,394 200,394 C171,394 146,356 151,348 Z" />
            <text className="zlabel parent-label" x="200" y="355">턱·입주변</text>
            <text className="zlabel sub-label" data-sub="chin_lip" x="200" y="333">입주변</text>
            <text className="zlabel sub-label" data-sub="chin_jaw" x="200" y="375">턱밑</text>
          </g>

          <ellipse className="feat" cx="148" cy="190" rx="15" ry="4" />
          <ellipse className="feat" cx="252" cy="190" rx="15" ry="4" />
          <g id="dots">
            {dayData.dots.map((d) => (
              <circle
                key={d.id}
                className={`dot ${d.type}`}
                cx={d.x} cy={d.y} r="6"
                onClick={async (e) => { e.stopPropagation(); await deleteDot(d.id); }}
              />
            ))}
          </g>
        </svg>

        {zoomedOut && (
          <>
            <button className="hotspot-btn forehead" onClick={(e) => { e.stopPropagation(); zoomTo("forehead"); }}>이마 <span>+</span></button>
            <button className="hotspot-btn rcheek" onClick={(e) => { e.stopPropagation(); zoomTo("rcheek"); }}>오른쪽 볼 <span>+</span></button>
            <button className="hotspot-btn lcheek" onClick={(e) => { e.stopPropagation(); zoomTo("lcheek"); }}>왼쪽 볼 <span>+</span></button>
            <button className="hotspot-btn nose" onClick={(e) => { e.stopPropagation(); zoomTo("nose"); }}>코 <span>+</span></button>
            <button className="hotspot-btn chin" onClick={(e) => { e.stopPropagation(); zoomTo("chin"); }}>턱 <span>+</span></button>
          </>
        )}
      </div>
    </div>
  );
}

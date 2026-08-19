"use client";

export default function FaceHistory({ summary }) {
  const counts = summary?.zone_apply_counts || {};
  const maxCount = Math.max(1, ...Object.values(counts));
  const dots = summary?.dots || [];

  function hzoneStyle(zone) {
    const c = counts[zone] || 0;
    const ratio = c / maxCount;
    const opacity = c > 0 ? 0.18 + 0.72 * ratio : 0.06;
    return { fill: "var(--teal)", fillOpacity: opacity };
  }

  return (
    <div className="face-card">
      <div className="face-container-wrap">
        <svg id="historyFace" viewBox="0 0 400 440">
          {/* Neck */}
          <path d="M165,380 C165,420 155,430 155,430 L245,430 C245,430 235,420 235,380" fill="#FAF9FE" stroke="#D2D0DF" strokeWidth="2" />

          {/* Ears */}
          <path d="M78,200 C68,200 64,220 68,235 C72,250 78,245 78,245" fill="#FFFFFF" stroke="#D2D0DF" strokeWidth="2" />
          <path d="M322,200 C332,200 336,220 332,235 C328,250 322,245 322,245" fill="#FFFFFF" stroke="#D2D0DF" strokeWidth="2" />

          {/* Main Face Outline */}
          <path className="outline" d="M200,72 C272,72 322,140 322,232 C322,334 266,398 200,398 C134,398 78,334 78,232 C78,140 128,72 200,72 Z" />

          {/* Hair Outline */}
          <path d="M78,190 C78,130 110,68 200,68 C290,68 322,130 322,190 C298,160 270,165 240,152 C220,144 200,160 180,150 C150,135 100,165 78,190 Z" fill="#EBE9F5" stroke="#CBD5E1" strokeWidth="1.5" />

          <g className="hzone-group">
            <path className="hzone" data-z="forehead_right" style={hzoneStyle("forehead_right")} d="M104,182 C112,108 152,82 200,82 L200,166 C155,160 120,168 104,182 Z" />
            <path className="hzone" data-z="forehead_left" style={hzoneStyle("forehead_left")} d="M200,82 C248,82 288,108 296,182 C280,168 245,160 200,166 Z" />
          </g>

          <g className="hzone-group">
            <path className="hzone" data-z="rcheek_upper" style={hzoneStyle("rcheek_upper")} d="M110,210 C130,195 155,195 173,197 L173,245 C150,245 130,235 110,225 Z" />
            <path className="hzone" data-z="rcheek_lower" style={hzoneStyle("rcheek_lower")} d="M110,225 C130,235 150,245 173,245 L173,285 C160,300 145,295 130,280 L115,255 Z" />
            <path className="hzone" data-z="rcheek_outer" style={hzoneStyle("rcheek_outer")} d="M101,196 C105,200 108,205 110,210 L110,225 L115,255 L130,280 C115,285 105,275 99,266 C93,241 95,216 101,196 Z" />
          </g>

          <g className="hzone-group">
            <path className="hzone" data-z="lcheek_upper" style={hzoneStyle("lcheek_upper")} d="M290,210 C270,195 245,195 227,197 L227,245 C250,245 270,235 290,225 Z" />
            <path className="hzone" data-z="lcheek_lower" style={hzoneStyle("lcheek_lower")} d="M290,225 C270,235 250,245 227,245 L227,285 C240,300 255,295 270,280 L285,255 Z" />
            <path className="hzone" data-z="lcheek_outer" style={hzoneStyle("lcheek_outer")} d="M299,196 C295,200 292,205 290,210 L290,225 L285,255 L270,280 C285,285 295,275 301,266 C307,241 305,216 299,196 Z" />
          </g>

          <g className="hzone-group">
            <path className="hzone" data-z="nose_bridge" style={hzoneStyle("nose_bridge")} d="M200,186 L212,245 L188,245 Z" />
            <path className="hzone" data-z="nose_tip" style={hzoneStyle("nose_tip")} d="M212,245 L221,286 C221,303 210,311 200,311 C190,311 179,303 179,286 L188,245 Z" />
          </g>

          <g className="hzone-group">
            <path className="hzone" data-z="chin_lip" style={hzoneStyle("chin_lip")} d="M151,316 C171,309 229,309 249,316 C245,348 225,350 200,350 C175,350 155,348 151,316 Z" />
            <path className="hzone" data-z="chin_jaw" style={hzoneStyle("chin_jaw")} d="M151,348 C155,348 175,350 200,350 C225,350 245,348 249,348 C254,356 229,394 200,394 C171,394 146,356 151,348 Z" />
          </g>

          {/* Eyebrows */}
          <path d="M125,180 Q145,172 165,182" fill="none" stroke="#64748B" strokeWidth="3" strokeLinecap="round" />
          <path d="M235,182 Q255,172 275,180" fill="none" stroke="#64748B" strokeWidth="3" strokeLinecap="round" />

          {/* Detailed Eyes */}
          <ellipse cx="145" cy="195" rx="14" ry="7" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
          <circle cx="145" cy="195" r="5" fill="#1E1B4B" />
          <ellipse cx="255" cy="195" rx="14" ry="7" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
          <circle cx="255" cy="195" r="5" fill="#1E1B4B" />

          {/* Nose Outline */}
          <path d="M190,195 L190,245 M210,195 L210,245 M190,245 L210,245" fill="none" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />

          {/* Lips */}
          <path d="M170,325 Q200,318 230,325 Q200,340 170,325 Z" fill="#FEE2E2" stroke="#FDA4AF" strokeWidth="2" />
          <line x1="170" y1="325" x2="230" y2="325" stroke="#FDA4AF" strokeWidth="1.5" />
          <g id="historyDots">
            {dots.map((d, i) => (
              <circle key={i} className={`dot ${d.type}`} cx={d.x} cy={d.y} r="5.5" />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}

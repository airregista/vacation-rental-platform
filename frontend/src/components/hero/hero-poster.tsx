import type { SceneId } from "./scene-types"

const LABELS: Record<SceneId, string> = {
  kashan: "تصویرسازی حیاط ایرانی با بادگیر، حوض فواره و طاق‌نما",
  forest: "تصویرسازی کلبهٔ چوبی و پل چوبی در جنگل هیرکانی",
  desert: "تصویرسازی خانهٔ خشتی یزد با بادگیر، تنور و حیاط",
  mountain: "تصویرسازی پناهگاه سنگی زیر قلهٔ سبلان با چشمهٔ آب گرم",
  zagros: "تصویرسازی سیاه‌چادر عشایری در زاگرس",
  coast: "تصویرسازی خانهٔ ساحلی خلیج فارس با نخل، بادگیر و قایق",
}

function KashanPoster() {
  return (
    <>
      {/* Badgir rising behind the courtyard wall */}
      <rect x="432" y="96" width="58" height="82" fill="var(--hero-plaster-shade)" />
      <rect x="424" y="86" width="74" height="12" rx="3" fill="var(--hero-clay)" />
      {[0, 1, 2].map((index) => (
        <rect
          key={index}
          x={444 + index * 14}
          y="106"
          width="7"
          height="56"
          fill="var(--hero-ink)"
        />
      ))}

      {/* Wall */}
      <rect x="118" y="176" width="364" height="238" rx="6" fill="var(--hero-plaster)" />
      <rect x="112" y="170" width="376" height="12" rx="6" fill="var(--hero-clay)" opacity="0.9" />
      <rect x="112" y="408" width="376" height="10" rx="5" fill="var(--hero-clay)" opacity="0.55" />

      {/* Pointed arch niche */}
      <path
        d="M 222 404 L 222 306 Q 222 232 300 212 Q 378 232 378 306 L 378 404 Z"
        fill="var(--hero-plaster-shade)"
      />
      <path
        d="M 240 404 L 240 312 Q 240 250 300 234 Q 360 250 360 312 L 360 404 Z"
        fill="var(--hero-clay)"
        opacity="0.16"
      />
      <circle cx="300" cy="300" r="11" fill="var(--hero-glow)" />
      <circle cx="300" cy="300" r="20" fill="var(--hero-ember)" opacity="0.35" />

      {/* Floor */}
      <rect x="94" y="414" width="412" height="30" rx="8" fill="var(--hero-sand-deep)" />
      <rect x="112" y="444" width="376" height="24" rx="6" fill="var(--hero-sand)" />

      {/* Pool with a small fountain */}
      <rect x="244" y="420" width="132" height="22" rx="5" fill="var(--hero-clay)" />
      <rect x="250" y="423" width="120" height="15" rx="3" fill="var(--hero-teal)" />
      <ellipse cx="310" cy="430" rx="15" ry="7" fill="var(--hero-cream)" />
      <ellipse cx="310" cy="430" rx="9" ry="4" fill="var(--hero-teal-deep)" />
      <rect x="309" y="416" width="2.5" height="12" rx="1" fill="var(--hero-cream)" />
      <circle cx="310" cy="415" r="2.6" fill="var(--hero-glow)" />
      <rect x="252" y="416" width="116" height="3" rx="1.5" fill="var(--hero-teal)" opacity="0.8" />
      <rect x="252" y="442" width="116" height="3" rx="1.5" fill="var(--hero-teal)" opacity="0.8" />

      {/* Cypress trees */}
      {[
        { x: 158, scale: 1 },
        { x: 448, scale: 0.82 },
      ].map((tree) => (
        <g key={tree.x} transform={`translate(${tree.x} 414) scale(${tree.scale})`}>
          <rect x="-3" y="-22" width="6" height="24" rx="3" fill="var(--hero-wood)" />
          <path d="M 0 -150 L 26 -18 L -26 -18 Z" fill="var(--hero-green)" />
          <path d="M 0 -190 L 19 -110 L -19 -110 Z" fill="var(--hero-green-deep)" />
          <path d="M 0 -218 L 12 -160 L -12 -160 Z" fill="var(--hero-green)" />
        </g>
      ))}

      {/* Pomegranate tree */}
      <g transform="translate(500 414)">
        <rect x="-3" y="-26" width="6" height="28" rx="3" fill="var(--hero-wood)" />
        <circle cx="0" cy="-58" r="24" fill="var(--hero-green)" />
        <circle cx="-19" cy="-48" r="16" fill="var(--hero-green-deep)" />
        <circle cx="17" cy="-46" r="14" fill="var(--hero-green)" />
        <circle cx="8" cy="-40" r="4" fill="var(--hero-red)" />
        <circle cx="-12" cy="-52" r="3.5" fill="var(--hero-red)" />
      </g>

      {/* Rug */}
      <g transform="translate(128 456)">
        <rect x="-24" y="-2" width="92" height="16" rx="3" fill="var(--hero-clay-deep)" />
        <rect
          x="-18"
          y="1"
          width="80"
          height="10"
          rx="2"
          fill="none"
          stroke="var(--hero-cream)"
          strokeWidth="2"
        />
        <path d="M 22 1 L 30 6 L 22 11 L 14 6 Z" fill="var(--hero-cream)" />
      </g>
    </>
  )
}

function ForestPoster() {
  return (
    <>
      <path
        d="M 82 424 Q 300 396 518 424 L 518 470 Q 300 486 82 470 Z"
        fill="var(--hero-green-deep)"
      />
      <ellipse cx="175" cy="330" rx="140" ry="20" fill="var(--hero-mist)" opacity="0.4" />
      <ellipse cx="430" cy="296" rx="130" ry="18" fill="var(--hero-mist)" opacity="0.3" />

      {/* Cabin */}
      <rect x="232" y="300" width="148" height="118" fill="var(--hero-wood)" />
      <path d="M 212 306 L 306 216 L 400 306 Z" fill="var(--hero-clay-deep)" />
      <rect x="292" y="346" width="34" height="72" rx="2" fill="var(--hero-clay-deep)" />
      <rect x="248" y="332" width="32" height="27" rx="2" fill="var(--hero-glow)" />
      <rect x="348" y="332" width="22" height="24" rx="2" fill="var(--hero-ember)" opacity="0.75" />
      <rect x="352" y="238" width="14" height="50" fill="var(--hero-stone)" />
      <circle cx="360" cy="226" r="10" fill="var(--hero-mist)" opacity="0.55" />
      <circle cx="368" cy="208" r="13" fill="var(--hero-mist)" opacity="0.35" />
      <rect x="226" y="416" width="160" height="9" rx="4" fill="var(--hero-wood)" opacity="0.8" />

      {/* Pines */}
      {[
        { x: 138, scale: 1 },
        { x: 470, scale: 0.85 },
        { x: 520, scale: 0.65 },
      ].map((tree) => (
        <g key={tree.x} transform={`translate(${tree.x} 430) scale(${tree.scale})`}>
          <rect x="-4" y="-30" width="8" height="32" fill="var(--hero-wood)" />
          <path d="M 0 -190 L 34 -70 L -34 -70 Z" fill="var(--hero-green-deep)" />
          <path d="M 0 -226 L 27 -120 L -27 -120 Z" fill="var(--hero-green)" />
          <path d="M 0 -252 L 18 -170 L -18 -170 Z" fill="var(--hero-green-deep)" />
        </g>
      ))}

      {/* Stream */}
      <path
        d="M 118 440 Q 210 424 300 446 Q 390 466 478 440"
        stroke="var(--hero-teal)"
        strokeWidth="14"
        fill="none"
        opacity="0.85"
        strokeLinecap="round"
      />
      <path
        d="M 310 420 Q 330 444 352 470"
        stroke="var(--hero-sand-deep)"
        strokeWidth="16"
        fill="none"
        opacity="0.55"
        strokeLinecap="round"
      />

      {/* Footbridge over the stream */}
      <path
        d="M 168 446 L 238 416"
        stroke="var(--hero-wood)"
        strokeWidth="15"
        strokeLinecap="round"
      />
      <path
        d="M 162 444 L 232 414"
        stroke="var(--hero-wood)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M 174 452 L 244 422"
        stroke="var(--hero-wood)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {[0.25, 0.5, 0.75].map((t) => (
        <path
          key={t}
          d={`M ${168 + 70 * t - 7} ${446 - 30 * t + 7} L ${168 + 70 * t + 7} ${446 - 30 * t - 7}`}
          stroke="var(--hero-clay-deep)"
          strokeWidth="2"
          opacity="0.7"
        />
      ))}
      {[
        [162, 444],
        [232, 414],
        [174, 452],
        [244, 422],
      ].map(([x, y], index) => (
        <rect
          key={index}
          x={x - 1.5}
          y={y - 10}
          width="3"
          height="12"
          rx="1.5"
          fill="var(--hero-wood)"
        />
      ))}

      {/* Stacked firewood beside the cabin */}
      {[
        [402, 416],
        [414, 416],
        [426, 416],
        [408, 406],
        [420, 406],
      ].map(([x, y], index) => (
        <g key={index}>
          <circle cx={x} cy={y} r="6.5" fill="var(--hero-wood)" />
          <circle cx={x} cy={y} r="3" fill="var(--hero-clay-deep)" opacity="0.7" />
        </g>
      ))}
      <ellipse cx="438" cy="418" rx="8" ry="5" fill="var(--hero-clay-deep)" />
    </>
  )
}

function DesertPoster() {
  return (
    <>
      <ellipse cx="300" cy="446" rx="220" ry="34" fill="var(--hero-sand-deep)" />
      <ellipse cx="150" cy="470" rx="160" ry="22" fill="var(--hero-clay)" opacity="0.22" />

      {/* Courtyard walls with crenellations */}
      <rect x="92" y="380" width="92" height="52" fill="var(--hero-plaster)" />
      <rect x="88" y="372" width="100" height="9" rx="2" fill="var(--hero-clay)" />
      {[96, 120, 144, 168].map((x) => (
        <rect key={x} x={x} y="362" width="9" height="10" rx="1" fill="var(--hero-plaster)" />
      ))}
      <rect x="434" y="360" width="78" height="72" fill="var(--hero-plaster)" />
      <rect x="430" y="352" width="86" height="9" rx="2" fill="var(--hero-clay)" />
      {[440, 464, 488].map((x) => (
        <rect key={x} x={x} y="342" width="9" height="10" rx="1" fill="var(--hero-plaster)" />
      ))}

      {/* House */}
      <rect x="222" y="286" width="192" height="130" fill="var(--hero-plaster)" />
      <path d="M 246 290 Q 300 208 396 290 Z" fill="var(--hero-plaster-shade)" />
      <rect x="212" y="280" width="212" height="12" rx="3" fill="var(--hero-clay)" />
      {[320, 352, 384].map((y) => (
        <path
          key={y}
          d={`M 226 ${y} H 410`}
          stroke="var(--hero-plaster-shade)"
          strokeWidth="1.5"
          opacity="0.55"
        />
      ))}

      {/* Windcatcher */}
      <rect x="196" y="184" width="46" height="110" fill="var(--hero-sand)" />
      <rect x="190" y="176" width="58" height="10" rx="3" fill="var(--hero-clay)" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={205 + i * 13} y="196" width="7" height="78" fill="var(--hero-ink)" />
      ))}

      {/* Door and lantern */}
      <path
        d="M 292 416 L 292 354 Q 292 322 320 314 Q 348 322 348 354 L 348 416 Z"
        fill="var(--hero-clay-deep)"
      />
      <path
        d="M 302 416 L 302 360 Q 302 336 320 330 Q 338 336 338 360 L 338 416 Z"
        fill="var(--hero-ember)"
        opacity="0.45"
      />

      {/* Pool with tiled rim and fountain */}
      <rect x="246" y="426" width="110" height="22" rx="4" fill="var(--hero-clay)" />
      <rect x="252" y="429" width="98" height="14" rx="3" fill="var(--hero-teal)" />
      <rect x="252" y="424" width="98" height="2.5" rx="1.2" fill="var(--hero-cream)" />
      <rect x="252" y="444" width="98" height="2.5" rx="1.2" fill="var(--hero-cream)" />
      <ellipse cx="301" cy="436" rx="11" ry="5" fill="var(--hero-cream)" />
      <ellipse cx="301" cy="436" rx="7" ry="3" fill="var(--hero-teal-deep)" />
      <rect x="300" y="426" width="2" height="10" fill="var(--hero-cream)" />
      <circle cx="301" cy="425" r="2.2" fill="var(--hero-glow)" />

      {/* Palm */}
      <g transform="translate(468 424)">
        <path d="M -3 0 L 3 0 L 8 -120 L -2 -120 Z" fill="var(--hero-wood)" />
        <path d="M -2 -118 Q -52 -142 -66 -108 Q -34 -112 -2 -104" fill="var(--hero-green)" />
        <path d="M -2 -118 Q -38 -166 -8 -174 Q 2 -144 2 -118" fill="var(--hero-green-deep)" />
        <path d="M 2 -118 Q 50 -150 68 -120 Q 30 -116 2 -104" fill="var(--hero-green)" />
        <path d="M 4 -118 Q 20 -168 44 -160 Q 26 -134 8 -110" fill="var(--hero-green-deep)" />
        <circle cx="0" cy="-104" r="5" fill="var(--hero-gold)" />
        <circle cx="9" cy="-100" r="4" fill="var(--hero-red)" />
      </g>
      <g transform="translate(170 432) scale(0.7)">
        <path d="M -3 0 L 3 0 L 6 -100 L -2 -100 Z" fill="var(--hero-wood)" />
        <path d="M -2 -98 Q -48 -120 -56 -90 Q -26 -96 -2 -86" fill="var(--hero-green-deep)" />
        <path d="M 2 -98 Q 46 -124 56 -96 Q 28 -94 4 -86" fill="var(--hero-green)" />
      </g>

      {/* Bench and dry shrubs */}
      <rect x="118" y="416" width="76" height="18" rx="4" fill="var(--hero-clay)" />
      <rect x="126" y="408" width="58" height="10" rx="3" fill="var(--hero-cream)" />
      <circle cx="390" cy="428" r="12" fill="var(--hero-green-deep)" />
      <circle cx="408" cy="432" r="9" fill="var(--hero-green)" />

      {/* Patterned kilim */}
      <g transform="translate(128 440)">
        <rect width="92" height="24" rx="2" fill="var(--hero-clay-deep)" />
        <rect
          x="5"
          y="4"
          width="82"
          height="16"
          rx="1"
          fill="none"
          stroke="var(--hero-cream)"
          strokeWidth="2"
        />
        <rect x="14" y="8" width="64" height="8" rx="1" fill="var(--hero-teal)" opacity="0.75" />
        <path d="M 46 5 L 54 12 L 46 19 L 38 12 Z" fill="var(--hero-cream)" />
        <path d="M 46 8 L 50 12 L 46 16 L 42 12 Z" fill="var(--hero-red)" />
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <g key={index}>
            <rect x={8 + index * 14} y="-3" width="2" height="4" fill="var(--hero-cream)" />
            <rect x={8 + index * 14} y="23" width="2" height="4" fill="var(--hero-cream)" />
          </g>
        ))}
      </g>

      {/* Clay tandoor with smoke */}
      <g transform="translate(446 448)">
        <path d="M -15 0 L -10 -28 Q 0 -34 10 -28 L 15 0 Z" fill="var(--hero-clay)" />
        <ellipse cx="0" cy="-28" rx="10" ry="4" fill="var(--hero-clay-deep)" />
        <ellipse cx="0" cy="-28" rx="6" ry="2.4" fill="var(--hero-ink)" />
        <circle cx="0" cy="-30" r="2.6" fill="var(--hero-glow)" />
        <circle cx="4" cy="-42" r="5" fill="var(--hero-mist)" opacity="0.45" />
        <circle cx="9" cy="-55" r="7" fill="var(--hero-mist)" opacity="0.3" />
        <circle cx="15" cy="-70" r="9" fill="var(--hero-mist)" opacity="0.18" />
      </g>
    </>
  )
}

function MountainPoster() {
  return (
    <>
      <path d="M 58 336 L 188 158 L 300 300 Z" fill="var(--hero-mist)" />
      <path d="M 188 158 L 300 300 L 238 300 Z" fill="var(--hero-snow)" opacity="0.85" />
      <path d="M 288 324 L 428 172 L 552 332 Z" fill="var(--hero-mist)" opacity="0.75" />
      <path d="M 428 172 L 552 332 L 468 332 Z" fill="var(--hero-snow)" opacity="0.7" />

      <path d="M 88 430 Q 300 406 512 430 L 512 470 Q 300 486 88 470 Z" fill="var(--hero-snow)" />
      <path
        d="M 286 470 Q 292 432 300 424 L 318 424 Q 322 442 326 470 Z"
        fill="var(--hero-plaster-shade)"
        opacity="0.9"
      />
      {[304, 312, 320].map((cx, index) => (
        <ellipse
          key={cx}
          cx={cx}
          cy={440 + index * 12}
          rx="8"
          ry="3.5"
          fill="var(--hero-stone)"
          opacity="0.9"
        />
      ))}

      {/* Low stone refuge with a snow-loaded flat roof */}
      <rect x="218" y="344" width="172" height="82" fill="var(--hero-stone)" />
      <rect x="206" y="318" width="196" height="16" rx="3" fill="var(--hero-snow)" />
      <rect x="210" y="334" width="188" height="10" rx="2" fill="var(--hero-wood)" />
      {[368, 390, 410].map((y) => (
        <path
          key={y}
          d={`M 218 ${y} H 390`}
          stroke="var(--hero-plaster-shade)"
          strokeWidth="2"
          opacity="0.5"
        />
      ))}
      <rect x="292" y="372" width="30" height="54" rx="2" fill="var(--hero-clay-deep)" />
      <rect x="242" y="370" width="30" height="24" rx="2" fill="var(--hero-glow)" />
      <rect
        x="238"
        y="366"
        width="38"
        height="32"
        rx="3"
        fill="none"
        stroke="var(--hero-wood)"
        strokeWidth="3"
      />

      {/* Chimney and its plume */}
      <rect x="336" y="282" width="20" height="38" fill="var(--hero-stone)" />
      <rect x="332" y="276" width="28" height="7" rx="2" fill="var(--hero-stone)" />
      <rect x="340" y="276" width="12" height="3" fill="var(--hero-ink)" opacity="0.7" />
      <circle cx="351" cy="261" r="6" fill="var(--hero-mist)" opacity="0.5" />
      <circle cx="357" cy="243" r="9" fill="var(--hero-mist)" opacity="0.34" />
      <circle cx="366" cy="223" r="12" fill="var(--hero-mist)" opacity="0.2" />

      {/* Split firewood stacked by the wall */}
      <g>
        {[
          [402, 424],
          [414, 424],
          [426, 424],
          [408, 413],
          [420, 413],
        ].map(([x, y], index) => (
          <g key={index}>
            <circle cx={x} cy={y} r="6" fill="var(--hero-wood)" />
            <circle cx={x} cy={y} r="2.6" fill="var(--hero-clay-deep)" opacity="0.7" />
          </g>
        ))}
        <rect x="396" y="405" width="38" height="4" rx="2" fill="var(--hero-snow)" />
      </g>

      {/* Stone bench with a folded blanket */}
      <g transform="translate(212 450)">
        <rect x="0" y="4" width="6" height="16" fill="var(--hero-stone)" />
        <rect x="42" y="4" width="6" height="16" fill="var(--hero-stone)" />
        <rect x="-2" y="-2" width="52" height="7" rx="2" fill="var(--hero-wood)" />
        <rect x="2" y="-6" width="16" height="5" rx="1.5" fill="var(--hero-red)" />
      </g>

      {/* Spring spout and falling water */}
      <rect x="182" y="424" width="5" height="22" fill="var(--hero-wood)" />
      <path
        d="M 186 426 L 164 436"
        stroke="var(--hero-wood)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M 164 439 L 159 446"
        stroke="var(--hero-cream)"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.75"
      />

      {/* Hardy shrubs */}
      <circle cx="430" cy="446" r="7" fill="var(--hero-green-deep)" />
      <circle cx="438" cy="443" r="5" fill="var(--hero-green)" />
      <circle cx="196" cy="420" r="5" fill="var(--hero-green-deep)" />

      {/* Sarein hot spring */}
      <ellipse cx="148" cy="448" rx="46" ry="15" fill="var(--hero-stone)" />
      <ellipse cx="148" cy="445" rx="37" ry="10" fill="var(--hero-teal-deep)" />
      <ellipse cx="148" cy="443" rx="29" ry="6" fill="var(--hero-teal)" opacity="0.75" />
      <circle cx="136" cy="422" r="10" fill="var(--hero-mist)" opacity="0.5" />
      <circle cx="152" cy="406" r="14" fill="var(--hero-mist)" opacity="0.36" />
      <circle cx="170" cy="388" r="18" fill="var(--hero-mist)" opacity="0.24" />

      {/* Drifts */}
      <ellipse cx="438" cy="448" rx="54" ry="12" fill="var(--hero-snow)" />
      <ellipse cx="84" cy="446" rx="38" ry="11" fill="var(--hero-snow)" />
    </>
  )
}

function ZagrosPoster() {
  return (
    <>
      <path d="M 60 360 L 170 240 L 270 350 Z" fill="var(--hero-stone)" opacity="0.55" />
      <path d="M 300 356 L 410 250 L 540 356 Z" fill="var(--hero-stone)" opacity="0.45" />
      <path
        d="M 84 434 Q 300 404 516 434 L 516 470 Q 300 486 84 470 Z"
        fill="var(--hero-sand-deep)"
      />

      {/* Black tent: low body with a woven ridge roof */}
      <rect x="210" y="386" width="184" height="46" fill="var(--hero-tent)" />
      <path d="M 186 390 L 302 298 L 418 390 Z" fill="var(--hero-tent)" />
      <path d="M 302 298 L 418 390 L 402 390 Z" fill="var(--hero-ink)" opacity="0.22" />
      <rect x="216" y="374" width="172" height="7" rx="1" fill="var(--hero-cream)" opacity="0.9" />
      <rect x="216" y="382" width="172" height="3" rx="1" fill="var(--hero-red)" opacity="0.9" />

      {/* Door frame, warm interior and threshold */}
      <rect x="264" y="394" width="76" height="38" fill="var(--hero-wood)" />
      <rect x="272" y="398" width="60" height="34" fill="var(--hero-ink)" />
      <rect x="282" y="404" width="40" height="28" fill="var(--hero-glow)" opacity="0.68" />
      <rect x="266" y="432" width="72" height="4" rx="1" fill="var(--hero-cream)" />

      {/* Front poles and guy ropes */}
      {[220, 384].map((x) => (
        <rect key={x} x={x - 2} y="386" width="4" height="46" rx="1.5" fill="var(--hero-wood)" />
      ))}
      <path d="M 220 386 L 174 446" stroke="var(--hero-ink)" strokeWidth="2.5" />
      <path d="M 384 386 L 430 446" stroke="var(--hero-ink)" strokeWidth="2.5" />

      {/* Kilim with fringes and cushions */}
      <g transform="translate(216 438)">
        <rect width="72" height="19" rx="2" fill="var(--hero-clay-deep)" />
        <rect
          x="4"
          y="3"
          width="64"
          height="13"
          rx="1"
          fill="none"
          stroke="var(--hero-cream)"
          strokeWidth="2"
        />
        <rect x="10" y="6" width="52" height="7" rx="1" fill="var(--hero-red)" />
        {[16, 26, 36, 46, 56].map((x) => (
          <path key={x} d={`M ${x} 7 l 3 2.5 l -3 2.5 l -3 -2.5 Z`} fill="var(--hero-cream)" />
        ))}
        {[0, 1, 2, 3, 4].map((index) => (
          <g key={index}>
            <rect x={8 + index * 15} y="-3" width="2" height="4" fill="var(--hero-cream)" />
            <rect x={8 + index * 15} y="18" width="2" height="4" fill="var(--hero-cream)" />
          </g>
        ))}
      </g>
      <rect x="208" y="446" width="16" height="7" rx="2" fill="var(--hero-cream)" />
      <rect x="290" y="446" width="16" height="7" rx="2" fill="var(--hero-teal)" />

      {/* Fire, tripod and kettle */}
      <circle cx="438" cy="438" r="24" fill="var(--hero-ember)" opacity="0.22" />
      <path d="M 438 416 L 449 440 L 427 440 Z" fill="var(--hero-ember)" />
      <path d="M 438 424 L 444 440 L 432 440 Z" fill="var(--hero-glow)" />
      {[
        [420, 444],
        [456, 444],
        [426, 452],
        [450, 452],
      ].map(([x, y], index) => (
        <circle key={index} cx={x} cy={y} r="5" fill="var(--hero-stone)" />
      ))}
      {[
        [424, 452],
        [452, 452],
        [438, 456],
      ].map(([x, y], index) => (
        <path
          key={index}
          d={`M ${x} ${y} L 438 412`}
          stroke="var(--hero-wood)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}
      <ellipse cx="438" cy="416" rx="7" ry="6" fill="var(--hero-ink)" />
      <path
        d="M 444 414 L 450 408"
        stroke="var(--hero-ink)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M 431 410 Q 438 402 445 410" stroke="var(--hero-ink)" strokeWidth="2" fill="none" />
      <circle cx="438" cy="398" r="5" fill="var(--hero-mist)" opacity="0.45" />
      <circle cx="445" cy="383" r="7" fill="var(--hero-mist)" opacity="0.3" />
      <circle cx="454" cy="366" r="9" fill="var(--hero-mist)" opacity="0.18" />

      {/* Oak */}
      <g transform="translate(146 430)">
        <path d="M -3 0 L 3 0 L 5 -86 L -3 -86 Z" fill="var(--hero-wood)" />
        <circle cx="0" cy="-110" r="34" fill="var(--hero-green-deep)" />
        <circle cx="-32" cy="-96" r="24" fill="var(--hero-green)" />
        <circle cx="30" cy="-98" r="22" fill="var(--hero-green)" />
        <circle cx="6" cy="-136" r="24" fill="var(--hero-green-deep)" />
      </g>

      {/* Sheep */}
      <g transform="translate(500 440)">
        <ellipse cx="0" cy="0" rx="20" ry="12" fill="var(--hero-cream)" />
        <circle cx="18" cy="-6" r="7" fill="var(--hero-tent)" />
        <rect x="-12" y="8" width="4" height="10" fill="var(--hero-tent)" />
        <rect x="8" y="8" width="4" height="10" fill="var(--hero-tent)" />
      </g>
    </>
  )
}

function CoastPoster() {
  return (
    <>
      <rect x="70" y="392" width="460" height="86" rx="10" fill="var(--hero-teal)" />
      <rect x="70" y="392" width="460" height="14" rx="7" fill="var(--hero-cream)" opacity="0.55" />
      {[120, 220, 340, 450].map((x, index) => (
        <path
          key={x}
          d={`M ${x} ${428 + index * 8} q 22 -8 44 0`}
          stroke="var(--hero-cream)"
          strokeWidth="3"
          fill="none"
          opacity="0.4"
        />
      ))}

      {/* House */}
      <rect x="190" y="270" width="176" height="126" fill="var(--hero-coral)" />
      <rect x="182" y="262" width="192" height="12" rx="3" fill="var(--hero-cream)" />
      <rect x="166" y="180" width="42" height="90" fill="var(--hero-plaster)" />
      <rect x="160" y="172" width="54" height="10" rx="3" fill="var(--hero-coral)" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={174 + i * 12} y="192" width="6" height="62" fill="var(--hero-ink)" />
      ))}

      {/* Door, window, porch */}
      <rect x="278" y="334" width="36" height="62" rx="2" fill="var(--hero-wood)" />
      <rect x="232" y="330" width="28" height="24" rx="2" fill="var(--hero-glow)" />
      {[220, 264].map((x) => (
        <g key={x}>
          <rect x={x} y="328" width="10" height="28" rx="1.5" fill="var(--hero-teal-deep)" />
          {[334, 341, 348].map((y) => (
            <rect key={y} x={x + 1} y={y} width="8" height="2.5" fill="var(--hero-cream)" />
          ))}
        </g>
      ))}
      <rect x="196" y="396" width="204" height="12" rx="3" fill="var(--hero-wood)" />
      <rect x="204" y="398" width="188" height="8" rx="2" fill="var(--hero-clay)" opacity="0.55" />
      <rect x="248" y="398" width="104" height="9" rx="2" fill="var(--hero-clay-deep)" />
      <rect x="252" y="400" width="96" height="2" fill="var(--hero-cream)" />
      <rect x="252" y="404" width="96" height="2" fill="var(--hero-teal)" />
      <ellipse cx="300" cy="402" rx="10" ry="3" fill="var(--hero-gold)" opacity="0.9" />
      <path d="M 196 300 L 402 300 L 420 320 L 178 320 Z" fill="var(--hero-cream)" />
      <rect x="198" y="318" width="7" height="82" fill="var(--hero-wood)" />
      <rect x="394" y="318" width="7" height="82" fill="var(--hero-wood)" />

      {/* Hanging lantern under the porch */}
      <g transform="translate(372 320)">
        <path d="M 0 0 L 0 12" stroke="var(--hero-ink)" strokeWidth="2" />
        <rect x="-6" y="12" width="12" height="14" rx="2" fill="var(--hero-wood)" />
        <rect x="-3.5" y="14" width="7" height="9" fill="var(--hero-glow)" />
        <path d="M -8 12 L 0 7 L 8 12 Z" fill="var(--hero-ink)" />
      </g>

      {/* Potted plant by the door */}
      <g transform="translate(258 394)">
        <path d="M -8 0 L -5 -14 L 5 -14 L 8 0 Z" fill="var(--hero-clay)" />
        <ellipse cx="0" cy="-14" rx="6" ry="2" fill="var(--hero-clay-deep)" />
        <circle cx="0" cy="-22" r="8" fill="var(--hero-green)" />
        <circle cx="-6" cy="-18" r="5" fill="var(--hero-green-deep)" />
        <circle cx="6" cy="-19" r="5" fill="var(--hero-green)" />
      </g>

      {/* Palms */}
      {[
        { x: 474, scale: 1 },
        { x: 138, scale: 0.75 },
      ].map((tree) => (
        <g key={tree.x} transform={`translate(${tree.x} 404) scale(${tree.scale})`}>
          <path d="M -3 0 L 3 0 L 7 -116 L -2 -116 Z" fill="var(--hero-wood)" />
          <path d="M -2 -114 Q -52 -138 -64 -104 Q -32 -110 -2 -100" fill="var(--hero-green)" />
          <path d="M -2 -114 Q -34 -164 -6 -172 Q 4 -140 2 -114" fill="var(--hero-green-deep)" />
          <path d="M 2 -114 Q 48 -146 66 -116 Q 28 -112 2 -100" fill="var(--hero-green)" />
          <path d="M 4 -114 Q 18 -164 42 -156 Q 24 -130 8 -106" fill="var(--hero-green-deep)" />
          <circle cx="2" cy="-102" r="5" fill="var(--hero-gold)" />
        </g>
      ))}

      {/* Boat */}
      <g transform="translate(400 438)">
        <path d="M -48 0 Q 0 26 48 0 L 38 16 Q 0 30 -38 16 Z" fill="var(--hero-wood)" />
        <path
          d="M -44 2 Q 0 22 44 2"
          stroke="var(--hero-cream)"
          strokeWidth="3"
          fill="none"
          opacity="0.8"
        />
        <rect x="-2" y="-52" width="4" height="54" fill="var(--hero-wood)" />
        <path d="M 4 -48 L 30 -8 L 4 -8 Z" fill="var(--hero-cream)" opacity="0.92" />
        <path d="M 2 -52 L 18 -47 L 2 -42 Z" fill="var(--hero-red)" />
        <rect
          x="-12"
          y="-3"
          width="22"
          height="4"
          rx="1.5"
          fill="var(--hero-cream)"
          opacity="0.9"
        />
        <path d="M -24 3 L 10 -16" stroke="var(--hero-cream)" strokeWidth="2" opacity="0.65" />
      </g>
    </>
  )
}

const POSTERS = {
  kashan: KashanPoster,
  forest: ForestPoster,
  desert: DesertPoster,
  mountain: MountainPoster,
  zagros: ZagrosPoster,
  coast: CoastPoster,
}

/**
 * Static, dependency-free fallback with the same art direction as each 3D
 * diorama. Shown for reduced-motion users and devices without WebGL.
 */
export function HeroPoster({
  className,
  scene = "kashan",
}: {
  className?: string
  scene?: SceneId
}) {
  const Poster = POSTERS[scene]

  return (
    <svg viewBox="0 0 600 520" className={className} role="img" aria-label={LABELS[scene]}>
      <ellipse cx="300" cy="470" rx="216" ry="26" fill="var(--hero-clay)" opacity="0.16" />
      <circle cx="300" cy="138" r="62" fill="var(--hero-gold)" opacity="0.4" />
      <Poster />
    </svg>
  )
}

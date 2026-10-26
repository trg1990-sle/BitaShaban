// GLSL for the ink. WebGL2 / GLSL ES 3.00.
// Coordinates in the display pass are CSS pixels with y pointing down (like the DOM),
// so rects from getBoundingClientRect() can be passed straight in.

const NOISE = /* glsl */ `
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return s / 0.97;
}
`;

export const VERT = /* glsl */ `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

/**
 * The pointer simulation: one channel of ink density on a small grid.
 * Each step: follow the scroll, drift along a slow curl-noise flow (ink wicking
 * through fibres), diffuse unevenly, evaporate, and add any new ink.
 */
export const SIM = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uPrev;
uniform vec2 uSimRes;
uniform vec2 uA;
uniform vec2 uB;
uniform float uRadius;
uniform float uAmount;
uniform float uDecay;
uniform float uScroll;
uniform float uTime;
out vec4 outColor;
${NOISE}
vec2 curl(vec2 p) {
  float e = 0.05;
  float n1 = vnoise(p + vec2(0.0, e)), n2 = vnoise(p - vec2(0.0, e));
  float n3 = vnoise(p + vec2(e, 0.0)), n4 = vnoise(p - vec2(e, 0.0));
  return vec2(n1 - n2, n4 - n3) / (2.0 * e);
}
void main() {
  vec2 px = 1.0 / uSimRes;
  vec2 uv = gl_FragCoord.xy * px;
  vec2 src = uv - vec2(0.0, uScroll);
  src -= curl(uv * 3.5 + uTime * 0.03) * 0.00045;
  float c = texture(uPrev, src).r;
  float n = texture(uPrev, src + vec2(px.x, 0.0)).r + texture(uPrev, src - vec2(px.x, 0.0)).r
          + texture(uPrev, src + vec2(0.0, px.y)).r + texture(uPrev, src - vec2(0.0, px.y)).r;
  // fibres make the spread uneven
  float wick = 0.08 + 0.22 * vnoise(uv * vec2(90.0, 24.0));
  c = mix(c, n * 0.25, wick);
  c *= uDecay;
  if (uAmount > 0.0) {
    vec2 aspect = vec2(uSimRes.x / uSimRes.y, 1.0);
    vec2 pa = (uv - uA) * aspect, ba = (uB - uA) * aspect;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-7), 0.0, 1.0);
    float d = length(pa - ba * h);
    c += uAmount * exp(-(d * d) / (uRadius * uRadius));
  }
  outColor = vec4(min(c, 1.6), 0.0, 0.0, 1.0);
}
`;

export const DISPLAY = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uDpr;
uniform float uTime;
uniform sampler2D uSim;
uniform float uTrail;
uniform float uHasSim;
uniform vec4 uRegions[4];   // top, bottom, flood front (from top), seed  (CSS px)
uniform int uRegionCount;
uniform float uEdgeAmp;
uniform vec4 uDrop;         // centre x, centre y, bloom radius, dryness 0..1
uniform vec3 uDropFall;     // fall offset above centre, drop radius, active
uniform vec4 uCover;        // centre x, centre y, radius, active
uniform vec2 uDrain;        // front y, active
uniform vec3 uInk;
uniform vec3 uWet;
uniform vec3 uRegion;
uniform vec3 uDropInk;
out vec4 outColor;
${NOISE}

vec4 over(vec4 dst, vec4 src) { return src + dst * (1.0 - src.a); }

float edgeOffset(float x, float seed, float amp) {
  float n = fbm(vec2(x * 0.0032 + seed, uTime * 0.022 + seed * 0.37));
  float f = vnoise(vec2(x * 0.045 + seed * 2.0, uTime * 0.05));
  return (n - 0.5) * 2.0 * amp + (f - 0.5) * amp * 0.2;
}

// Ink seen in a flooded area: uneven wash, granulation, a darker tide-line inside the edge.
vec3 floodColor(vec2 p, float inside) {
  float wash = fbm(p * 0.0021 + vec2(3.1, 7.7));
  vec3 c = mix(uRegion, uRegion * 1.32 + vec3(0.012, 0.01, 0.035), smoothstep(0.38, 0.85, wash) * 0.7);
  c *= 0.955 + 0.07 * vnoise(p * 0.85);
  c = mix(c, uRegion * 0.6, exp(-max(inside, 0.0) / 6.0) * 0.75);
  return c;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uRes;
  vec2 p = vec2(frag.x, uRes.y - frag.y) / uDpr;
  vec4 col = vec4(0.0);

  // 1. pointer ink on the paper
  float t = uHasSim > 0.5 ? texture(uSim, uv).r : 0.0;
  if (t > 0.004) {
    float a = smoothstep(0.012, 0.6, t);
    float rim = smoothstep(0.008, 0.04, t) * (1.0 - smoothstep(0.04, 0.28, t));
    vec3 c = mix(uWet, uInk, smoothstep(0.2, 1.0, t));
    col = vec4(c, 1.0) * clamp((a * 0.85 + rim * 0.3) * uTrail, 0.0, 1.0);
  }

  // 2. flooded regions. CSS paints the inside of each section (so it can never go missing
  //    or lag behind native scrolling); the ink here only grows outward from its edges:
  //    a ragged, slowly bleeding fringe above and below, and the leading edge of a flood.
  float region = 0.0;
  float rim = 0.0;
  float halo = 0.0;
  for (int i = 0; i < 4; i++) {
    if (i >= uRegionCount) break;
    vec4 r = uRegions[i];
    float amp = uEdgeAmp;
    if (r.z <= 0.0) continue;
    float fill = min(r.y, r.x + r.z);
    bool flooding = r.x + r.z < r.y;
    if (p.y < r.x - amp * 2.5 || p.y > fill + amp * 3.5) continue;
    float eTop = amp * (0.3 + 0.7 * clamp(0.5 + edgeOffset(p.x, r.w, 0.5), 0.0, 1.0));
    float eBot = (flooding ? amp * 1.9 : amp) * (0.3 + 0.7 * clamp(0.5 + edgeOffset(p.x, r.w + 13.7, 0.5), 0.0, 1.0));
    float d = min(p.y - (r.x - eTop), (fill + eBot) - p.y);
    // capillary feathering where ink meets dry paper
    float near = exp(-abs(d) / 12.0);
    d += (vnoise(vec2(p.x * 0.16, p.y * 0.04 + r.w)) - 0.5) * 9.0 * near
       + (vnoise(vec2(p.x * 0.6, p.y * 0.2 + r.w)) - 0.5) * 2.5 * near;
    float m = smoothstep(-1.4, 1.4, d);
    region = max(region, m);
    rim = max(rim, m * exp(-max(d, 0.0) / 5.0));
    halo = max(halo, exp(min(d, 0.0) / 11.0) * (1.0 - m));
  }
  if (halo > 0.001) col = over(col, vec4(uWet, 1.0) * halo * 0.2);
  if (region > 0.001) col = over(col, vec4(mix(uRegion, uRegion * 0.62, rim * 0.7), 1.0) * region);

  // 3. the drop: falls, lands, blooms, dries
  if (uDropFall.z > 0.5) {
    vec2 q = p - vec2(uDrop.x, uDrop.y - uDropFall.x);
    q.y *= 0.58;
    float m = smoothstep(0.8, -0.8, length(q) - uDropFall.y);
    col = over(col, vec4(uWet, 1.0) * m);
  }
  if (uDrop.z > 0.5) {
    vec2 q = p - uDrop.xy;
    float d = length(q);
    vec2 dir = q / max(d, 1e-4);
    float R = uDrop.z;
    float wob = (fbm(dir * 1.7 + 9.0 + uTime * 0.006) - 0.5) * 0.42 + (vnoise(p * (6.0 / R)) - 0.5) * 0.14;
    float e = R * (1.0 + wob) - d;
    float m = smoothstep(-0.7, 0.7, e);
    float tide = exp(-max(e, 0.0) / (R * 0.1 + 0.5));
    vec3 c = mix(uWet, uDropInk, clamp(uDrop.w * 0.85 + tide * 0.35 + (1.0 - d / R) * 0.25, 0.0, 1.0));
    c *= 0.95 + 0.08 * vnoise(p * 0.8);
    float h = exp(min(e, 0.0) / (R * 0.3 + 1.5)) * (1.0 - m) * (0.32 - uDrop.w * 0.2);
    col = over(col, vec4(uWet, 1.0) * h);
    col = over(col, vec4(c, 1.0) * m);
    // satellites thrown off at impact
    for (int k = 0; k < 5; k++) {
      float fk = float(k);
      float ang = fk * 2.39996 + 0.7;
      float dist = R * (1.55 + 0.55 * fract(fk * 0.618 + 0.3));
      vec2 o = vec2(cos(ang), sin(ang)) * dist;
      float rr = R * (0.07 + 0.09 * fract(fk * 0.37 + 0.11));
      float sm = smoothstep(0.7, -0.7, length(p - uDrop.xy - o) - rr);
      col = over(col, vec4(mix(uWet, uDropInk, uDrop.w * 0.8), 1.0) * sm);
    }
  }

  // 4. page turns: ink floods from the click, then drains down the sheet
  if (uCover.w > 0.5) {
    vec2 q = p - uCover.xy;
    float d = length(q);
    vec2 dir = q / max(d, 1e-4);
    float R = uCover.z;
    float wob = (fbm(dir * 2.2 + uTime * 0.08) - 0.5) * 0.36 * R + (vnoise(p * 0.035) - 0.5) * 36.0;
    float e = R + wob - d;
    float m = smoothstep(-1.0, 1.0, e);
    col = over(col, vec4(uWet, 1.0) * exp(min(e, 0.0) / 18.0) * (1.0 - m) * 0.35);
    col = over(col, vec4(floodColor(p, e), 1.0) * m);
  }
  if (uDrain.y > 0.5) {
    float front = uDrain.x + edgeOffset(p.x, 51.0, 46.0);
    // rounded fingers of ink left behind as the sheet drains
    float finger = vnoise(vec2(p.x * 0.02, 3.0));
    front -= smoothstep(0.58, 0.95, finger) * 240.0;
    float e = p.y - front;
    e += (vnoise(vec2(p.x * 0.5, p.y * 0.05)) - 0.5) * 10.0 * exp(-abs(e) / 10.0);
    float m = smoothstep(-1.0, 1.0, e);
    col = over(col, vec4(uWet, 1.0) * exp(min(e, 0.0) / 14.0) * (1.0 - m) * 0.3);
    col = over(col, vec4(floodColor(p, e), 1.0) * m);
  }

  outColor = col;
}
`;

import type { Discipline, ReferralStage } from "@/data/types";
import { REFERRAL_STAGES, REFERRAL_STAGE_LABEL } from "@/data/care";
import { staffById } from "@/data/staff";
import { TODAY, formatDate, formatTime } from "@/lib/format";
import { addDays, dayKey, dayPhrase, isoAt, stamp } from "@/features/tasks/time";
import { STAGE_WAITING, dueText, referralState, waitText, type ReferralState } from "./meta";
import type { CareReferral } from "./store";

/**
 * Layout for the "Referral journeys" flow map. Nothing here is decorative:
 *  - x is the real time of each stage (44px per day, IST weeks as columns, "Today" marked);
 *  - the lane is the discipline holding the referral at that stage — the referrer requests and
 *    acknowledges, the receiving discipline accepts, books and completes;
 *  - connectors run only between a referral's own consecutive stages;
 *  - the stage where progress stopped is a ring placed at "now" (or at the booked visit), so the
 *    waiting connector's length is the time it has been waiting.
 * Stages of one referral that happened within ~1.5 days in the same lane share one stop
 * (overlapping marks, like the reference's stacked circles); every exact time is in the tooltip.
 */

export type Lane = "nutrition" | "medical" | "movement";

/** Medical sits in the middle: referrals leave it for nutrition (above) or movement (below) and come back to close the loop. */
export const LANES: { key: Lane; label: string; hint: string }[] = [
  { key: "nutrition", label: "Nutrition", hint: "Nutritionists accept, book and complete referrals sent to nutrition" },
  { key: "medical", label: "Medical", hint: "Referring doctors request and acknowledge; doctors also receive medical referrals" },
  { key: "movement", label: "Movement", hint: "Yoga instructors accept, book and complete referrals sent to movement" },
];

export const DAY_PX = 44;
const DAY_MS = 86_400_000;
const LEFT = 132;
const TOP = 52;
const LANE_HEAD = 28;
const LANE_PAD = 4;
const LANE_GAP = 16;
const TRACK_H = 52;
export const NODE = 32;
export const STACK = 20;
const VISIT = 16;
const MERGE_PX = 60;
const MIN_STEP = 56;
const PILL_W = 236;

const laneOfDiscipline = (d: Discipline | undefined): Lane => (d === "nutrition" ? "nutrition" : d === "movement" ? "movement" : "medical");

/** Who holds the referral at a stage. */
export function laneFor(r: CareReferral, stage: ReferralStage): Lane {
  return stage === "requested" || stage === "acknowledged" ? laneOfDiscipline(staffById(r.fromId)?.discipline) : laneOfDiscipline(r.toDiscipline);
}

export type Mark = { kind: "reached"; stage: ReferralStage; at: string | null; actorId?: string } | { kind: "pending"; stage: ReferralStage };

export interface Stop {
  id: string;
  referralId: string;
  kind: "stages" | "visit" | "pending";
  lane: Lane;
  marks: Mark[];
  /** visit waypoint time (kind "visit") */
  visitAt?: string;
  /** centre x of the first mark */
  cx: number;
  x: number;
  y: number;
  w: number;
  h: number;
  track: number;
  /** text above-right of the stop (date, or waiting time) */
  caption: string;
  /** last stop of its referral — carries the patient label */
  last: boolean;
}

export interface JourneyEdge {
  id: string;
  referralId: string;
  from: string;
  to: string;
  kind: "history" | "waiting";
  label: string;
  detail: string;
}

export interface JourneyLayout {
  stops: Stop[];
  edges: JourneyEdge[];
  states: Record<string, ReferralState>;
  width: number;
  height: number;
  todayX: number;
  lanes: { key: Lane; label: string; hint: string; y: number; top: number; bottom: number; waiting: number }[];
  columns: { x: number; label: string; strong?: boolean }[];
}

const lastCx = (s: Pick<Stop, "cx" | "marks" | "kind">) => (s.kind === "visit" ? s.cx : s.cx + (s.marks.length - 1) * STACK);

/** "45 min" · "5 h" · "3 d 4 h" · "12 d" */
export function spanText(fromIso: string, toIso: string) {
  const ms = Math.max(0, Date.parse(toIso) - Date.parse(fromIso));
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  const rest = h - d * 24;
  return d < 3 && rest ? `${d} d ${rest} h` : `${d} d`;
}

const shortDate = (iso: string) => formatDate(iso, { day: "numeric", month: "short" });

function dateRange(ats: (string | null)[]) {
  const known = ats.filter((a): a is string => !!a);
  if (!known.length) return "Date not recorded";
  const first = known[0];
  const last = known[known.length - 1];
  if (dayKey(first) === dayKey(last)) return shortDate(first);
  const sameMonth = dayKey(first).slice(0, 7) === dayKey(last).slice(0, 7);
  return sameMonth ? `${formatDate(first, { day: "numeric" })}–${shortDate(last)}` : `${shortDate(first)}–${shortDate(last)}`;
}

/** Monday on or before an IST day key. */
function mondayOf(key: string) {
  let k = key;
  for (let i = 0; i < 7 && new Date(isoAt(k, "12:00")).getUTCDay() !== 1; i++) k = addDays(k, -1);
  return k;
}

export function buildJourneys(referrals: CareReferral[]): JourneyLayout {
  const now = TODAY.getTime();
  const states: Record<string, ReferralState> = {};
  const times: number[] = [now];
  for (const r of referrals) {
    const st = referralState(r);
    states[r.id] = st;
    times.push(Date.parse(r.requestedAt));
    for (const s of REFERRAL_STAGES) if (r.stageDates[s]) times.push(Date.parse(r.stageDates[s]!));
    if (r.bookedFor) times.push(Date.parse(r.bookedFor));
  }
  const startKey = mondayOf(dayKey(new Date(Math.min(...times))));
  const start = Date.parse(isoAt(startKey, "00:00"));
  const endKey = dayKey(new Date(Math.max(...times) + DAY_MS));
  const x = (t: number) => LEFT + ((t - start) / DAY_MS) * DAY_PX;
  const todayX = x(now);

  // ---- stops per referral -------------------------------------------------------------
  const perReferral: { r: CareReferral; stops: Stop[] }[] = [];
  for (const r of referrals) {
    const st = states[r.id];
    const stops: Stop[] = [];
    const make = (kind: Stop["kind"], lane: Lane, marks: Mark[], cx: number, extra?: Partial<Stop>): Stop => ({
      id: `${r.id}:${stops.length}`,
      referralId: r.id,
      kind,
      lane,
      marks,
      cx,
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      track: 0,
      caption: "",
      last: false,
      ...extra,
    });
    for (let i = 0; i <= st.idx; i++) {
      const stage = REFERRAL_STAGES[i];
      const at = r.stageDates[stage] ?? (stage === "requested" ? r.requestedAt : null);
      const lane = laneFor(r, stage);
      const prev = stops[stops.length - 1];
      const cx = at ? x(Date.parse(at)) : prev ? lastCx(prev) : x(Date.parse(r.requestedAt));
      const mark: Mark = { kind: "reached", stage, at, actorId: r.actors[stage] };
      if (prev && prev.kind === "stages" && prev.lane === lane && cx - lastCx(prev) < MERGE_PX) prev.marks.push(mark);
      else stops.push(make("stages", lane, [mark], prev && prev.lane === lane ? Math.max(cx, lastCx(prev) + MIN_STEP) : cx));
    }
    if (st.pending) {
      const lane = laneFor(r, st.pending);
      let prev = stops[stops.length - 1];
      // A visit that happened while completion is still unrecorded is a waypoint on the wait.
      if (st.pending === "completed" && r.bookedFor && !st.visitUpcoming && prev?.lane === lane) {
        const vx = x(Date.parse(r.bookedFor));
        if (vx - lastCx(prev) >= 40 && todayX - vx >= MIN_STEP) {
          stops.push(make("visit", lane, [], vx, { visitAt: r.bookedFor }));
          prev = stops[stops.length - 1];
        }
      }
      const target = st.visitUpcoming && r.bookedFor ? x(Date.parse(r.bookedFor)) : todayX;
      const mark: Mark = { kind: "pending", stage: st.pending };
      if (prev && prev.kind === "stages" && prev.lane === lane && target - lastCx(prev) < MIN_STEP) prev.marks.push(mark);
      else stops.push(make("pending", lane, [mark], prev && prev.lane === lane ? Math.max(target, lastCx(prev) + MIN_STEP) : target));
    }
    stops[stops.length - 1].last = true;
    for (const s of stops) {
      if (s.kind === "visit") {
        s.w = VISIT;
        s.h = VISIT;
        s.x = s.cx - VISIT / 2;
        s.caption = `Visit ${shortDate(s.visitAt!)}`;
      } else {
        s.w = NODE + (s.marks.length - 1) * STACK;
        s.h = NODE;
        s.x = s.cx - NODE / 2;
        const reached = s.marks.filter((m): m is Extract<Mark, { kind: "reached" }> => m.kind === "reached");
        // a pending stop is always last, and its end label already says where it stopped
        s.caption = reached.length ? dateRange(reached.map((m) => m.at)) : "";
      }
    }
    perReferral.push({ r, stops });
  }

  // ---- tracks: consecutive stops of a referral in one lane share a track ------------------
  // A segment occupies its stops, the connector runs along its track (the flow map draws a
  // forward connector right → mid-x → left, so the run to/from mid-x sits on each track) and,
  // in a separate band above, the date captions. Two segments share a track only if neither band
  // collides — so a line never passes through another referral's stop on the same track.
  type Band = [number, number];
  type Segment = { lane: Lane; stops: Stop[]; body: Band[]; caps: Band[]; left: number };
  const segments: Segment[] = [];
  for (const { stops } of perReferral) {
    const segOf = new Map<Stop, Segment>();
    let seg: Segment | null = null;
    for (const s of stops) {
      if (!seg || seg.lane !== s.lane) {
        seg = { lane: s.lane, stops: [], body: [], caps: [], left: Infinity };
        segments.push(seg);
      }
      seg.stops.push(s);
      segOf.set(s, seg);
      seg.body.push([s.x, s.x + s.w + (s.last ? 12 + PILL_W : 0)]);
      if (s.caption) seg.caps.push([s.cx + 8, s.cx + 8 + s.caption.length * 6 + 4]);
    }
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i];
      const b = stops[i + 1];
      const sx = a.x + a.w;
      if (a.lane === b.lane) segOf.get(a)!.body.push([sx, b.x]);
      else if (b.x >= sx + 24) {
        const mid = sx + Math.max(20, (b.x - sx) / 2);
        segOf.get(a)!.body.push([sx, mid]);
        segOf.get(b)!.body.push([mid, b.x]);
      }
    }
  }
  for (const seg of segments) seg.left = Math.min(...seg.body.map((b) => b[0]));
  const overlaps = (a: Band[], b: Band[], gap: number) => a.some(([a0, a1]) => b.some(([b0, b1]) => a0 < b1 + gap && b0 < a1 + gap));
  const tracks: Record<Lane, Segment[][]> = { nutrition: [], medical: [], movement: [] };
  for (const seg of [...segments].sort((a, b) => a.left - b.left)) {
    const lane = tracks[seg.lane];
    let t = lane.findIndex((placed) => placed.every((p) => !overlaps(seg.body, p.body, 10) && !overlaps(seg.caps, p.caps, 6)));
    if (t === -1) {
      t = lane.length;
      lane.push([]);
    }
    lane[t].push(seg);
    for (const s of seg.stops) s.track = t;
  }
  // ---- lanes ----------------------------------------------------------------------------
  let top = TOP;
  const lanes = LANES.map((l) => {
    const laneTop = top;
    const bottom = laneTop + LANE_HEAD + Math.max(1, tracks[l.key].length) * TRACK_H + LANE_PAD;
    top = bottom + LANE_GAP;
    const waiting = referrals.filter((r) => states[r.id].pending && laneFor(r, states[r.id].pending!) === l.key).length;
    return { ...l, y: laneTop + 14, top: laneTop, bottom, waiting };
  });
  const laneTop = Object.fromEntries(lanes.map((l) => [l.key, l.top])) as Record<Lane, number>;
  const stops = perReferral.flatMap((p) => p.stops);
  for (const s of stops) {
    // Earlier segments sit farther from the medical lane (top of nutrition, bottom of movement),
    // so later referrals' connectors reach their tracks without crossing older waiting lines.
    const n = Math.max(1, tracks[s.lane].length);
    const row = s.lane === "movement" ? n - 1 - s.track : s.track;
    const centre = laneTop[s.lane] + LANE_HEAD + row * TRACK_H + 31;
    s.y = centre - s.h / 2;
  }

  // ---- edges: only between a referral's own consecutive stops ----------------------------
  const edges: JourneyEdge[] = [];
  for (const { r, stops: rs } of perReferral) {
    const st = states[r.id];
    for (let i = 0; i < rs.length - 1; i++) {
      const a = rs[i];
      const b = rs[i + 1];
      const aLast = [...a.marks].reverse().find((m): m is Extract<Mark, { kind: "reached" }> => m.kind === "reached");
      const aAt = a.kind === "visit" ? a.visitAt! : aLast?.at ?? r.requestedAt;
      if (b.kind === "pending" || (b.kind === "stages" && b.marks[0].kind === "pending")) {
        const waitingOn = staffById(st.waitingOn ?? undefined)?.name ?? "the care team";
        edges.push({
          id: `${a.id}>${b.id}`,
          referralId: r.id,
          from: a.id,
          to: b.id,
          kind: "waiting",
          label: `${STAGE_WAITING[st.pending!]} · ${a.kind === "visit" ? `${spanText(aAt, TODAY.toISOString())} since the visit` : waitText(st.waitingDays)}`,
          detail: st.visitUpcoming && r.bookedFor ? `Visit ${dayPhrase(r.bookedFor)} ${formatTime(r.bookedFor)}${r.room ? ` · ${r.room}` : ""} · ${waitingOn} records the outcome` : `Since ${stamp(st.since)} · ${st.overdue ? "was due" : "due"} ${dueText(r.dueBy)} · waiting on ${waitingOn}`,
        });
      } else if (b.kind === "visit") {
        edges.push({
          id: `${a.id}>${b.id}`,
          referralId: r.id,
          from: a.id,
          to: b.id,
          kind: "history",
          label: `Booked → visit held · ${spanText(aAt, b.visitAt!)}`,
          detail: `Visit ${stamp(b.visitAt!)}${r.room ? ` · ${r.room}` : ""} — completion not recorded since`,
        });
      } else {
        const bFirst = b.marks[0] as Extract<Mark, { kind: "reached" }>;
        const actor = staffById(bFirst.actorId)?.name;
        edges.push({
          id: `${a.id}>${b.id}`,
          referralId: r.id,
          from: a.id,
          to: b.id,
          kind: "history",
          label: `${aLast ? REFERRAL_STAGE_LABEL[aLast.stage] : "Requested"} → ${REFERRAL_STAGE_LABEL[bFirst.stage]}${bFirst.at ? ` · ${spanText(aAt, bFirst.at)}` : ""}`,
          detail: `${bFirst.at ? stamp(bFirst.at) : "Date not recorded"}${actor ? ` · ${REFERRAL_STAGE_LABEL[bFirst.stage].toLowerCase()} by ${actor}` : ""}`,
        });
      }
    }
  }

  // ---- size & columns ---------------------------------------------------------------------
  const right = Math.max(x(Date.parse(isoAt(endKey, "00:00"))), ...segments.flatMap((s) => s.body.map((b) => b[1])), ...segments.flatMap((s) => s.caps.map((b) => b[1])));
  const width = Math.ceil(right + 48);
  const height = Math.ceil((lanes[lanes.length - 1]?.bottom ?? TOP) + 40);
  const columns: JourneyLayout["columns"] = [];
  for (let k = startKey; k <= endKey; k = addDays(k, 7)) {
    const cx = x(Date.parse(isoAt(k, "00:00")));
    if (Math.abs(cx - todayX) > 60) columns.push({ x: cx, label: shortDate(isoAt(k, "12:00")) });
  }
  columns.push({ x: todayX, label: `Today · ${formatTime(TODAY.toISOString())}`, strong: true });
  columns.sort((a, b) => a.x - b.x);

  return { stops, edges, states, width, height, todayX, lanes, columns };
}

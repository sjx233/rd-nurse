import { parse } from "https://deno.land/std@0.111.0/flags/mod.ts";
import { readAll } from "https://deno.land/std@0.111.0/streams/conversion.ts";
import { beatToBar, checkLevel, formatTime, timeToBeat } from "./mod.ts";

interface JoinToStringOptions {
  separator?: string;
  prefix?: string;
  suffix?: string;
  truncate?: {
    after: number;
    with?: string;
  };
}

function joinToString<T>(
  it: Iterable<T>,
  selector: (value: T) => string,
  {
    separator = ", ",
    prefix = "",
    suffix = "",
    truncate: {
      after: limit,
      with: truncated = "...",
    } = { after: Infinity },
  }: JoinToStringOptions = {},
): string {
  let result = prefix;
  let count = 0;
  for (const elem of it) {
    if (++count > 1) {
      result += separator;
    }
    if (count > limit) {
      result += truncated;
      break;
    }
    result += selector(elem);
  }
  result += suffix;
  return result;
}

const {
  "ignore-source": ignoreSource,
  "interruptible-pattern": interruptiblePattern,
  "triangleshot": triangleshot,
  "help": help,
} = parse(Deno.args, {
  boolean: [
    "ignore-source",
    "interruptible-pattern",
    "triangleshot",
    "help",
  ],
  alias: {
    s: "ignore-source",
    p: "interruptible-pattern",
    t: "triangleshot",
    h: "help",
  },
  unknown(_, key) {
    console.error(`Unrecognized option '${key}'
Try --help for more information.`);
    Deno.exit(2);
  },
});
if (help) {
  console.error(`Usage: rd-nurse [options]

Options:
  -s, --ignore-source
    ignore the voice sources of the cues
  -p, --interruptible-pattern
    make squareshots stop oneshot patterns
  -t, --triangleshot
    enable triangleshots
  -h, --help
    show this help message

The level is read from stdin.`);
  Deno.exit(0);
}
const {
  barCache,
  beatCache,
  invalidNormalCues,
  invalidSquareCues,
  unexpectedSkipshots,
  overlappingSkipshots,
  unexpectedFreezeshots,
  overlappingFreezeshots,
  uncuedHits,
  skippedHits,
  missingHits,
} = checkLevel(new TextDecoder().decode(await readAll(Deno.stdin)), {
  ignoreSource,
  interruptiblePattern,
  triangleshot,
});
const errorTypes: [number[], string][] = [
  [invalidNormalCues, "Invalid oneshot cue"],
  [invalidSquareCues, "Invalid squareshot cue"],
  [unexpectedSkipshots, "Unexpected skipshot"],
  [overlappingSkipshots, "Overlapping skipshot"],
  [unexpectedFreezeshots, "Unexpected freezeshot"],
  [overlappingFreezeshots, "Overlapping freezeshot"],
  [uncuedHits, "Uncued hit"],
  [skippedHits, "Skipped hit"],
  [missingHits, "Missing hit"],
];
let errors = 0;
for (const [pos, desc] of errorTypes) {
  if (pos.length === 0) {
    continue;
  }
  errors += pos.length;
  console.log(joinToString(
    pos,
    (time) => formatTime(beatToBar(barCache, timeToBeat(beatCache, time))),
    { separator: ", ", prefix: desc + ": " },
  ));
}
if (errors !== 0) {
  Deno.exit(1);
}

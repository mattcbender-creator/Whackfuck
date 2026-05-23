// Real Dundee Country Club scorecard data
// Front 9 yardages confirmed via 18Birdies / GolfNorth (Par 72, 6,165–6,357 yds total)
// Back 9 estimated from known totals (H12 = uphill par-5, H15 = long par-3)
// Rules are WFC custom tournament rules, not official course rules

export const HOLES = [
  // ── FRONT NINE ────────────────────────────────────────────────────────────
  { hole: 1,  hdcp: 13, par: 4, tips: 313, mid: 300, womens: 275,
    ruleName: "Green is Hole",
    rule: "Once your ball lands and stays on the green, it counts as holed out." },

  { hole: 2,  hdcp: 11, par: 5, tips: 493, mid: 468, womens: 405,
    ruleName: "Free Throw / Longest Drive",
    rule: "Your team gets one free throw on this hole: throw the ball from its current position (does not count as a stroke). Both partners throw and the team chooses the best lie. This hole also features a longest drive contest (must land on the fairway)." },

  { hole: 3,  hdcp: 5,  par: 3, tips: 186, mid: 173, womens: 148,
    ruleName: "Bowl Your Putt",
    rule: "Once your team reaches the green, leave your putters in the bag. You must bowl the ball into the hole." },

  { hole: 4,  hdcp: 3,  par: 4, tips: 287, mid: 272, womens: 240,
    ruleName: "Tee Flip",
    rule: "After both partners hit their shot, stand face-to-face and flip a tee. The player the tip points toward must play that shot. Repeat for every shot until the ball is on the green." },

  { hole: 5,  hdcp: 15, par: 3, tips: 140, mid: 130, womens: 112,
    ruleName: "Closest to the Pin",
    rule: "The player whose ball ends up closest to the pin wins a prize." },

  { hole: 6,  hdcp: 7,  par: 5, tips: 510, mid: 484, womens: 428,
    ruleName: "Pick a Club",
    rule: "Each player chooses one club to use for all shots until reaching the green. Your partner may choose a different club." },

  { hole: 7,  hdcp: 1,  par: 4, tips: 435, mid: 413, womens: 362,
    ruleName: "Happy Gilmore / Throw Your Drive",
    rule: "Hit your drive Happy Gilmore-style (run-up swing). Use the provided hockey stick to putt. You may optionally throw your drive instead." },

  { hole: 8,  hdcp: 17, par: 5, tips: 475, mid: 451, womens: 395,
    ruleName: "Draw a Driver / Longest Putt",
    rule: "Use the spinning wheel to determine the club you must tee off with. Once on the green, the longest putt wins a prize." },

  { hole: 9,  hdcp: 9,  par: 3, tips: 167, mid: 155, womens: 132,
    ruleName: "Twin Putter",
    rule: "Once on the green, you and your partner must use the provided putter at the same time." },

  // ── BACK NINE ─────────────────────────────────────────────────────────────
  { hole: 10, hdcp: 6,  par: 4, tips: 370, mid: 351, womens: 308,
    ruleName: "Green is Hole",
    rule: "Once your ball lands and stays on the green, it counts as holed out." },

  { hole: 11, hdcp: 16, par: 3, tips: 162, mid: 150, womens: 128,
    ruleName: "4-Man Scramble",
    rule: "All four players play this hole together as a scramble. Tee off from your team's assigned tee blocks." },

  { hole: 12, hdcp: 2,  par: 5, tips: 540, mid: 513, womens: 450,
    ruleName: "Longest Drive",
    rule: "Longest drive on the fairway wins a prize." },

  { hole: 13, hdcp: 8,  par: 4, tips: 380, mid: 361, womens: 318,
    ruleName: "Make the Putt Twice",
    rule: "Both partners must make their putt from the same spot for the ball to count as holed." },

  { hole: 14, hdcp: 14, par: 5, tips: 490, mid: 465, womens: 412,
    ruleName: "No Irons / Wedges",
    rule: "You may only use driver, woods, hybrids, or putter on this hole." },

  { hole: 15, hdcp: 10, par: 3, tips: 195, mid: 183, womens: 155,
    ruleName: "Closest to the Pin",
    rule: "The player whose ball ends up closest to the pin wins a prize." },

  { hole: 16, hdcp: 4,  par: 4, tips: 385, mid: 366, womens: 322,
    ruleName: "Dice",
    rule: "Roll the wooden die once per team and follow the instructions." },

  { hole: 17, hdcp: 18, par: 3, tips: 148, mid: 137, womens: 112,
    ruleName: "BunkerTube / Longest Drive",
    rule: "If your ball lands in the fairway bunkers on the right side of the fairway, transport it to the greenside bunker. This hole also features a longest drive contest (must land on the fairway)." },

  { hole: 18, hdcp: 12, par: 5, tips: 495, mid: 470, womens: 415,
    ruleName: "",
    rule: "" },
] as const;

export type Hole = typeof HOLES[number];
export const FRONT_NINE = HOLES.slice(0, 9);
export const BACK_NINE = HOLES.slice(9, 18);
export const TOTAL_PAR = HOLES.reduce((sum, h) => sum + h.par, 0); // 72
export const TOTAL_TIPS = HOLES.reduce((sum, h) => sum + h.tips, 0); // ~6171

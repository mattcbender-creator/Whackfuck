// Real Dundee Country Club scorecard data
// Front 9 yardages confirmed via 18Birdies / GolfNorth (Par 72, 6,165–6,357 yds total)
// Back 9 estimated from known totals (H12 = uphill par-5, H15 = long par-3)
// Rules are WFC custom tournament rules, not official course rules

export const HOLES = [
  // ── FRONT NINE ────────────────────────────────────────────────────────────
  { hole: 1,  hdcp: 13, par: 4, tips: 313, mid: 300, womens: 275,
    ruleName: "Green Is The Hole",
    rule: "Skip the fairway — if your ball lands and stays on the green from your tee shot, the hole is complete. Wagers welcome. Confidence mandatory." },

  { hole: 2,  hdcp: 11, par: 5, tips: 493, mid: 468, womens: 405,
    ruleName: "Free Throw / Longest Drive",
    rule: "Longest drive in the fairway wins a free throw (mulligan) usable on any future hole. Side bet: closest to 200 yds can revoke someone else's tee mulligan. Use it wisely." },

  { hole: 3,  hdcp: 5,  par: 3, tips: 186, mid: 173, womens: 148,
    ruleName: "One Club Only",
    rule: "Pick ONE club off the tee. That's your club for the ENTIRE hole — approach, chip, and putt. The guy who picks driver for a par 3 deserves everything that comes next." },

  { hole: 4,  hdcp: 3,  par: 4, tips: 287, mid: 272, womens: 240,
    ruleName: "Worst Ball",
    rule: "Both players hit tee shots. The team plays from the WORST ball. The suffering is shared. The blame is entirely individual." },

  { hole: 5,  hdcp: 15, par: 3, tips: 140, mid: 130, womens: 112,
    ruleName: "Scramble",
    rule: "Full scramble this hole. Both hit, pick the best, both hit again from there. The catch: you still count every stroke. No mercy in the WFC rulebook." },

  { hole: 6,  hdcp: 7,  par: 5, tips: 510, mid: 484, womens: 428,
    ruleName: "Putt With Your Driver",
    rule: "On the green, you putt using ONLY your driver. Sideways, backwards, whatever — the big stick only. This hole has ended 14 documented friendships since 2019." },

  { hole: 7,  hdcp: 1,  par: 4, tips: 435, mid: 413, womens: 362,
    ruleName: "Captain's Choice",
    rule: "After tee shots, the captain picks which ball to play for the approach. The captain then MUST hit the second shot. Power. Accountability. Regret." },

  { hole: 8,  hdcp: 17, par: 5, tips: 475, mid: 451, womens: 395,
    ruleName: "Long Drive Contest",
    rule: "Longest drive in the fairway wins a 2-stroke reduction on final score. Out of bounds still counts — land it in the short grass or go home." },

  { hole: 9,  hdcp: 9,  par: 3, tips: 167, mid: 155, womens: 132,
    ruleName: "Par Means Free Beer",
    rule: "Make par and the bar covers one round. Birdie? The whole group drinks on your tab — complimentary. Bogey? You watch everyone else drink while you reflect." },

  // ── BACK NINE ─────────────────────────────────────────────────────────────
  { hole: 10, hdcp: 6,  par: 4, tips: 370, mid: 351, womens: 308,
    ruleName: "Sniper Hole",
    rule: "Hit a tree = 2 penalty strokes. Hit TWO trees = you carry someone's bag for the next hole. Historical tree-hit rate: 40%. Stay humble." },

  { hole: 11, hdcp: 16, par: 3, tips: 162, mid: 150, womens: 128,
    ruleName: "Closest To The Pin",
    rule: "Closest tee shot to the pin cancels that team's worst hole score from their card. Accuracy rewarded. Bragging rights eternal." },

  { hole: 12, hdcp: 2,  par: 5, tips: 540, mid: 513, womens: 450,
    ruleName: "Longest Drive Official",
    rule: "Official longest drive measurement this hole. A volunteer marks it. A photo is taken. It is referenced at every subsequent WFC event until someone beats it." },

  { hole: 13, hdcp: 8,  par: 4, tips: 380, mid: 361, womens: 318,
    ruleName: "Alternate Shot",
    rule: "Players alternate every shot for the entire hole. Team decides who tees off. Back and forth from there. Communication is key. Mutual destruction is likely." },

  { hole: 14, hdcp: 14, par: 5, tips: 490, mid: 465, womens: 412,
    ruleName: "One Bounce Counts",
    rule: "Your tee shot must bounce at least once before reaching the green or it doesn't count. Spin it back into the water? Classic. Grip it and skip it." },

  { hole: 15, hdcp: 10, par: 3, tips: 195, mid: 183, womens: 155,
    ruleName: "Sandbagging Penalty",
    rule: "Any team whose handicap is disputed by two or more other groups gets a 1-stroke penalty. Democracy rules. Cheaters pay. The WFC is watching." },

  { hole: 16, hdcp: 4,  par: 4, tips: 385, mid: 366, womens: 322,
    ruleName: "Free Throw Fairway",
    rule: "Each player gets ONE free throw this hole — literally throw the ball with your hand toward the green. Distance is real. Use it at the right moment. Fully legal under WFC rules." },

  { hole: 17, hdcp: 18, par: 3, tips: 148, mid: 137, womens: 112,
    ruleName: "Island Green Penalty",
    rule: "Miss the green entirely = 2-stroke penalty + mandatory replay. It's a par 3. The green is RIGHT THERE. No excuse. Pay the toll. Walk of shame included." },

  { hole: 18, hdcp: 12, par: 5, tips: 495, mid: 470, womens: 415,
    ruleName: "Victory Lap",
    rule: "Final hole. Last year's losing team buys a round regardless of today's result. Today's winning team names the hardest rule for WFC next year. Make it legendary." },
] as const;

export type Hole = typeof HOLES[number];
export const FRONT_NINE = HOLES.slice(0, 9);
export const BACK_NINE = HOLES.slice(9, 18);
export const TOTAL_PAR = HOLES.reduce((sum, h) => sum + h.par, 0); // 72
export const TOTAL_TIPS = HOLES.reduce((sum, h) => sum + h.tips, 0); // ~6171

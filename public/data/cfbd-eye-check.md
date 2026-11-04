# CFBD raw eye-check dump (2026)

Fetched: 2026-11-04T17:10:35.701Z

Source: CollegeFootballData API
- GET /teams/fbs?year=2026
- GET /teams?year=2026
- GET /records?year=2026
- GET /games?year=2026&seasonType=regular (completed only)

Counts: **138** FBS teams, **2839** completed regular-season games, **682** records.

Quality win threshold in our app: opponent current win% **> .500** (strict).
Road win: designated away and not neutral.
FBS win for base: opponent in /teams/fbs for 2026.

## Utah (id 254, Big 12, class=fbs)
Record /records: **8-0** (win% 1.000)

| Week | Opponent | Class | Opp W-L | Opp win% | Site | Score | Result | Counts for |
|---:|---|---|---|---:|---|---|---|---|
| 1 | Idaho | fcs (not FBS list) | 4-5 | 0.444 | Home | 66-14 | W | FCS win void |
| 2 | Arkansas | fbs | 3-5 | 0.375 | Home | 43-10 | W | FBS win +1 |
| 3 | Utah State | fbs | 3-5 | 0.375 | Home | 33-0 | W | FBS win +1 |
| 4 | Iowa State | fbs | 4-4 | 0.500 | Away | 31-17 | W | FBS win +1, road +0.5 |
| 6 | Kansas | fbs | 3-5 | 0.375 | Home | 41-24 | W | FBS win +1 |
| 7 | Colorado | fbs | 3-5 | 0.375 | Away | 27-24 | W | FBS win +1, road +0.5 |
| 8 | Houston | fbs | 6-2 | 0.750 | Home | 21-13 | W | FBS win +1, quality +1 |
| 9 | Cincinnati | fbs | 5-3 | 0.625 | Away | 49-25 | W | FBS win +1, road +0.5, quality +1 |

**Derived (from this table):** FBS wins=7, FCS wins voided=1, road wins=3 (+1.5), quality wins=2. Loss notes: none

## Miami (id 2390, ACC, class=fbs)
Record /records: **8-0** (win% 1.000)

| Week | Opponent | Class | Opp W-L | Opp win% | Site | Score | Result | Counts for |
|---:|---|---|---|---:|---|---|---|---|
| 1 | Stanford | fbs | 4-5 | 0.444 | Away | 45-6 | W | FBS win +1, road +0.5 |
| 2 | Florida A&M | fcs (not FBS list) | 2-7 | 0.222 | Home | 77-7 | W | FCS win void |
| 3 | Wake Forest | fbs | 7-1 | 0.875 | Away | 33-20 | W | FBS win +1, road +0.5, quality +1 |
| 4 | Central Michigan | fbs | 3-5 | 0.375 | Home | 52-3 | W | FBS win +1 |
| 5 | Clemson | fbs | 5-3 | 0.625 | Away | 41-13 | W | FBS win +1, road +0.5, quality +1 |
| 7 | Florida State | fbs | 3-5 | 0.375 | Home | 43-35 | W | FBS win +1 |
| 8 | Pittsburgh | fbs | 6-3 | 0.667 | Home | 52-23 | W | FBS win +1, quality +1 |
| 9 | North Carolina | fbs | 4-4 | 0.500 | Away | 38-35 | W | FBS win +1, road +0.5 |

**Derived (from this table):** FBS wins=7, FCS wins voided=1, road wins=4 (+2.0), quality wins=3. Loss notes: none

## UCLA (id 26, Big Ten, class=fbs)
Record /records: **8-0** (win% 1.000)

| Week | Opponent | Class | Opp W-L | Opp win% | Site | Score | Result | Counts for |
|---:|---|---|---|---:|---|---|---|---|
| 1 | California | fbs | 3-6 | 0.333 | Away | 45-24 | W | FBS win +1, road +0.5 |
| 2 | San Diego State | fbs | 4-5 | 0.444 | Home | 28-10 | W | FBS win +1 |
| 3 | Purdue | fbs | 3-5 | 0.375 | Home | 52-38 | W | FBS win +1 |
| 4 | Maryland | fbs | 2-6 | 0.250 | Away | 54-3 | W | FBS win +1, road +0.5 |
| 6 | Oregon | fbs | 5-3 | 0.625 | Away | 17-15 | W | FBS win +1, road +0.5, quality +1 |
| 7 | Wisconsin | fbs | 5-3 | 0.625 | Home | 17-7 | W | FBS win +1, quality +1 |
| 8 | Michigan State | fbs | 2-6 | 0.250 | Home | 28-10 | W | FBS win +1 |
| 9 | Nevada | fbs | 3-5 | 0.375 | Home | 27-0 | W | FBS win +1 |

**Derived (from this table):** FBS wins=8, FCS wins voided=0, road wins=3 (+1.5), quality wins=2. Loss notes: none

## Indiana (id 84, Big Ten, class=fbs)
Record /records: **8-1** (win% 0.889)

| Week | Opponent | Class | Opp W-L | Opp win% | Site | Score | Result | Counts for |
|---:|---|---|---|---:|---|---|---|---|
| 1 | North Texas | fbs | 6-2 | 0.750 | Home | 52-16 | W | FBS win +1, quality +1 |
| 2 | Howard | fcs (not FBS list) | 4-5 | 0.444 | Home | 55-0 | W | FCS win void |
| 3 | Western Kentucky | fbs | 3-5 | 0.375 | Home | 38-0 | W | FBS win +1 |
| 4 | Northwestern | fbs | 6-2 | 0.750 | Home | 29-23 | W | FBS win +1, quality +1 |
| 5 | Rutgers | fbs | 2-6 | 0.250 | Away | 47-15 | W | FBS win +1, road +0.5 |
| 6 | Nebraska | fbs | 5-3 | 0.625 | Away | 20-17 | W | FBS win +1, road +0.5, quality +1 |
| 7 | Ohio State | fbs | 6-2 | 0.750 | Home | 15-19 | L | std loss -1 |
| 8 | Michigan | fbs | 5-3 | 0.625 | Away | 13-6 | W | FBS win +1, road +0.5, quality +1 |
| 9 | Minnesota | fbs | 5-3 | 0.625 | Home | 23-16 | W | FBS win +1, quality +1 |

**Derived (from this table):** FBS wins=7, FCS wins voided=1, road wins=3 (+1.5), quality wins=5. Loss notes: wk7 std

## Georgia (id 61, SEC, class=fbs)
Record /records: **7-1** (win% 0.875)

| Week | Opponent | Class | Opp W-L | Opp win% | Site | Score | Result | Counts for |
|---:|---|---|---|---:|---|---|---|---|
| 1 | Tennessee State | fcs (not FBS list) | 2-7 | 0.222 | Home | 63-3 | W | FCS win void |
| 2 | Western Kentucky | fbs | 3-5 | 0.375 | Home | 70-20 | W | FBS win +1 |
| 3 | Arkansas | fbs | 3-5 | 0.375 | Away | 45-17 | W | FBS win +1, road +0.5 |
| 4 | Oklahoma | fbs | 4-4 | 0.500 | Home | 41-13 | W | FBS win +1 |
| 5 | Vanderbilt | fbs | 3-5 | 0.375 | Home | 38-14 | W | FBS win +1 |
| 6 | Alabama | fbs | 6-2 | 0.750 | Away | 20-17 | W | FBS win +1, road +0.5, quality +1 |
| 7 | Auburn | fbs | 4-4 | 0.500 | Home | 24-27 | L | std loss -1 |
| 9 | Florida | fbs | 5-3 | 0.625 | Neutral | 27-8 | W | FBS win +1, quality +1 |

**Derived (from this table):** FBS wins=6, FCS wins voided=1, road wins=2 (+1.0), quality wins=2. Loss notes: wk7 std

## BYU (id 252, Big 12, class=fbs)
Record /records: **7-1** (win% 0.875)

| Week | Opponent | Class | Opp W-L | Opp win% | Site | Score | Result | Counts for |
|---:|---|---|---|---:|---|---|---|---|
| 1 | Utah Tech | fcs (not FBS list) | 1-8 | 0.111 | Home | 63-7 | W | FCS win void |
| 2 | Arizona | fbs | 6-2 | 0.750 | Home | 28-17 | W | FBS win +1, quality +1 |
| 3 | Colorado State | fbs | 3-5 | 0.375 | Away | 41-23 | W | FBS win +1, road +0.5 |
| 5 | TCU | fbs | 4-4 | 0.500 | Away | 17-10 | W | FBS win +1, road +0.5 |
| 6 | Iowa State | fbs | 4-4 | 0.500 | Home | 24-10 | W | FBS win +1 |
| 7 | Notre Dame | fbs | 7-1 | 0.875 | Home | 28-24 | W | FBS win +1, quality +1 |
| 8 | UCF | fbs | 4-4 | 0.500 | Away | 31-39 | L | std loss -1 |
| 9 | Arizona State | fbs | 4-4 | 0.500 | Home | 27-20 | W | FBS win +1 |

**Derived (from this table):** FBS wins=6, FCS wins voided=1, road wins=2 (+1.0), quality wins=2. Loss notes: wk8 std

## Notre Dame (id 87, FBS Independents, class=fbs)
Record /records: **7-1** (win% 0.875)

| Week | Opponent | Class | Opp W-L | Opp win% | Site | Score | Result | Counts for |
|---:|---|---|---|---:|---|---|---|---|
| 1 | Wisconsin | fbs | 5-3 | 0.625 | Neutral | 41-13 | W | FBS win +1, quality +1 |
| 2 | Rice | fbs | 1-7 | 0.125 | Home | 52-0 | W | FBS win +1 |
| 3 | Michigan State | fbs | 2-6 | 0.250 | Home | 27-10 | W | FBS win +1 |
| 4 | Purdue | fbs | 3-5 | 0.375 | Away | 49-10 | W | FBS win +1, road +0.5 |
| 5 | North Carolina | fbs | 4-4 | 0.500 | Away | 37-26 | W | FBS win +1, road +0.5 |
| 6 | Stanford | fbs | 4-5 | 0.444 | Home | 58-7 | W | FBS win +1 |
| 7 | BYU | fbs | 7-1 | 0.875 | Away | 24-28 | L | road>.660 -0.5 |
| 9 | Navy | fbs | 2-6 | 0.250 | Neutral | 35-13 | W | FBS win +1 |

**Derived (from this table):** FBS wins=7, FCS wins voided=0, road wins=2 (+1.0), quality wins=1. Loss notes: wk7 road strong

## Alabama (id 333, SEC, class=fbs)
Record /records: **6-2** (win% 0.750)

| Week | Opponent | Class | Opp W-L | Opp win% | Site | Score | Result | Counts for |
|---:|---|---|---|---:|---|---|---|---|
| 1 | East Carolina | fbs | 4-4 | 0.500 | Home | 48-10 | W | FBS win +1 |
| 2 | Kentucky | fbs | 7-1 | 0.875 | Away | 45-17 | W | FBS win +1, road +0.5, quality +1 |
| 3 | Florida State | fbs | 3-5 | 0.375 | Home | 50-36 | W | FBS win +1 |
| 4 | South Carolina | fbs | 5-3 | 0.625 | Home | 49-18 | W | FBS win +1, quality +1 |
| 5 | Mississippi State | fbs | 4-4 | 0.500 | Away | 56-23 | W | FBS win +1, road +0.5 |
| 6 | Georgia | fbs | 7-1 | 0.875 | Home | 17-20 | L | std loss -1 |
| 7 | Tennessee | fbs | 6-2 | 0.750 | Away | 10-26 | L | road>.660 -0.5 |
| 8 | Texas A&M | fbs | 4-4 | 0.500 | Home | 31-20 | W | FBS win +1 |

**Derived (from this table):** FBS wins=6, FCS wins voided=0, road wins=2 (+1.0), quality wins=2. Loss notes: wk6 std; wk7 road strong

## Kentucky (id 96, SEC, class=fbs)
Record /records: **7-1** (win% 0.875)

| Week | Opponent | Class | Opp W-L | Opp win% | Site | Score | Result | Counts for |
|---:|---|---|---|---:|---|---|---|---|
| 1 | Youngstown State | fcs (not FBS list) | 7-2 | 0.778 | Home | 45-13 | W | FCS win void, quality +1 |
| 2 | Alabama | fbs | 6-2 | 0.750 | Home | 17-45 | L | std loss -1 |
| 3 | Texas A&M | fbs | 4-4 | 0.500 | Away | 31-21 | W | FBS win +1, road +0.5 |
| 4 | South Alabama | fbs | 4-4 | 0.500 | Home | 45-21 | W | FBS win +1 |
| 5 | South Carolina | fbs | 5-3 | 0.625 | Away | 35-34 | W | FBS win +1, road +0.5, quality +1 |
| 6 | LSU | fbs | 6-2 | 0.750 | Home | 35-34 | W | FBS win +1, quality +1 |
| 7 | Oklahoma | fbs | 4-4 | 0.500 | Away | 21-13 | W | FBS win +1, road +0.5 |
| 8 | Vanderbilt | fbs | 3-5 | 0.375 | Home | 34-17 | W | FBS win +1 |

**Derived (from this table):** FBS wins=6, FCS wins voided=1, road wins=3 (+1.5), quality wins=3. Loss notes: wk2 std

## Texas Tech (id 2641, Big 12, class=fbs)
Record /records: **7-1** (win% 0.875)

| Week | Opponent | Class | Opp W-L | Opp win% | Site | Score | Result | Counts for |
|---:|---|---|---|---:|---|---|---|---|
| 1 | Abilene Christian | fcs (not FBS list) | 5-4 | 0.556 | Home | 33-10 | W | FCS win void, quality +1 |
| 2 | Oregon State | fbs | 5-3 | 0.625 | Away | 35-24 | W | FBS win +1, road +0.5, quality +1 |
| 3 | Houston | fbs | 6-2 | 0.750 | Home | 28-26 | W | FBS win +1, quality +1 |
| 4 | Sam Houston | fbs | 1-7 | 0.125 | Home | 49-14 | W | FBS win +1 |
| 5 | Colorado | fbs | 3-5 | 0.375 | Away | 29-7 | W | FBS win +1, road +0.5 |
| 7 | Arizona State | fbs | 4-4 | 0.500 | Home | 53-25 | W | FBS win +1 |
| 8 | Cincinnati | fbs | 5-3 | 0.625 | Away | 24-37 | L | std loss -1 |
| 9 | Arizona | fbs | 6-2 | 0.750 | Home | 34-26 | W | FBS win +1, quality +1 |

**Derived (from this table):** FBS wins=6, FCS wins voided=1, road wins=2 (+1.0), quality wins=4. Loss notes: wk8 std

## Ohio State (id 194, Big Ten, class=fbs)
Record /records: **6-2** (win% 0.750)

| Week | Opponent | Class | Opp W-L | Opp win% | Site | Score | Result | Counts for |
|---:|---|---|---|---:|---|---|---|---|
| 1 | Ball State | fbs | 3-5 | 0.375 | Home | 56-3 | W | FBS win +1 |
| 2 | Texas | fbs | 6-2 | 0.750 | Away | 23-24 | L | road>.660 -0.5 |
| 3 | Kent State | fbs | 3-6 | 0.333 | Home | 59-3 | W | FBS win +1 |
| 4 | Illinois | fbs | 5-3 | 0.625 | Home | 42-19 | W | FBS win +1, quality +1 |
| 5 | Iowa | fbs | 6-2 | 0.750 | Away | 31-14 | W | FBS win +1, road +0.5, quality +1 |
| 6 | Maryland | fbs | 2-6 | 0.250 | Home | 45-16 | W | FBS win +1 |
| 7 | Indiana | fbs | 8-1 | 0.889 | Away | 19-15 | W | FBS win +1, road +0.5, quality +1 |
| 9 | USC | fbs | 7-2 | 0.778 | Away | 18-30 | L | road>.660 -0.5 |

**Derived (from this table):** FBS wins=6, FCS wins voided=0, road wins=2 (+1.0), quality wins=3. Loss notes: wk2 road strong; wk9 road strong

## Boise State (id 68, Pac-12, class=fbs)
Record /records: **7-1** (win% 0.875)

| Week | Opponent | Class | Opp W-L | Opp win% | Site | Score | Result | Counts for |
|---:|---|---|---|---:|---|---|---|---|
| 1 | Oregon | fbs | 5-3 | 0.625 | Away | 27-34 | L | std loss -1 |
| 2 | Memphis | fbs | 7-2 | 0.778 | Home | 38-20 | W | FBS win +1, quality +1 |
| 3 | South Dakota | fcs (not FBS list) | 7-3 | 0.700 | Home | 38-24 | W | FCS win void, quality +1 |
| 4 | Western Michigan | fbs | 6-3 | 0.667 | Away | 32-7 | W | FBS win +1, road +0.5, quality +1 |
| 5 | Utah State | fbs | 3-5 | 0.375 | Home | 37-18 | W | FBS win +1 |
| 6 | Fresno State | fbs | 5-3 | 0.625 | Away | 38-31 | W | FBS win +1, road +0.5, quality +1 |
| 8 | Washington State | fbs | 1-8 | 0.111 | Away | 31-10 | W | FBS win +1, road +0.5 |
| 9 | Texas State | fbs | 4-4 | 0.500 | Home | 46-45 | W | FBS win +1 |

**Derived (from this table):** FBS wins=6, FCS wins voided=1, road wins=3 (+1.5), quality wins=4. Loss notes: wk1 std

## Ole Miss (id 145, SEC, class=fbs)
Record /records: **6-2** (win% 0.750)

| Week | Opponent | Class | Opp W-L | Opp win% | Site | Score | Result | Counts for |
|---:|---|---|---|---:|---|---|---|---|
| 1 | Louisville | fbs | 5-3 | 0.625 | Neutral | 41-38 | W | FBS win +1, quality +1 |
| 2 | Charlotte | fbs | 1-7 | 0.125 | Home | 41-9 | W | FBS win +1 |
| 3 | LSU | fbs | 6-2 | 0.750 | Home | 32-24 | W | FBS win +1, quality +1 |
| 4 | Florida | fbs | 5-3 | 0.625 | Away | 28-52 | L | std loss -1 |
| 6 | Vanderbilt | fbs | 3-5 | 0.375 | Away | 52-17 | W | FBS win +1, road +0.5 |
| 7 | Missouri | fbs | 6-2 | 0.750 | Home | 31-3 | W | FBS win +1, quality +1 |
| 8 | Texas | fbs | 6-2 | 0.750 | Away | 27-34 | L | road>.660 -0.5 |
| 9 | Auburn | fbs | 4-4 | 0.500 | Home | 45-15 | W | FBS win +1 |

**Derived (from this table):** FBS wins=6, FCS wins voided=0, road wins=1 (+0.5), quality wins=3. Loss notes: wk4 std; wk8 road strong

## Texas (id 251, SEC, class=fbs)
Record /records: **6-2** (win% 0.750)

| Week | Opponent | Class | Opp W-L | Opp win% | Site | Score | Result | Counts for |
|---:|---|---|---|---:|---|---|---|---|
| 1 | Texas State | fbs | 4-4 | 0.500 | Home | 59-7 | W | FBS win +1 |
| 2 | Ohio State | fbs | 6-2 | 0.750 | Home | 24-23 | W | FBS win +1, quality +1 |
| 3 | UTSA | fbs | 7-1 | 0.875 | Home | 30-6 | W | FBS win +1, quality +1 |
| 4 | Tennessee | fbs | 6-2 | 0.750 | Away | 20-17 | W | FBS win +1, road +0.5, quality +1 |
| 6 | Oklahoma | fbs | 4-4 | 0.500 | Neutral | 24-27 | L | std loss -1 |
| 7 | Florida | fbs | 5-3 | 0.625 | Home | 24-27 | L | std loss -1 |
| 8 | Ole Miss | fbs | 6-2 | 0.750 | Home | 34-27 | W | FBS win +1, quality +1 |
| 9 | Mississippi State | fbs | 4-4 | 0.500 | Home | 31-3 | W | FBS win +1 |

**Derived (from this table):** FBS wins=6, FCS wins voided=0, road wins=1 (+0.5), quality wins=4. Loss notes: wk6 std; wk7 std

## USC (id 30, Big Ten, class=fbs)
Record /records: **7-2** (win% 0.778)

| Week | Opponent | Class | Opp W-L | Opp win% | Site | Score | Result | Counts for |
|---:|---|---|---|---:|---|---|---|---|
| 1 | San José State | fbs | 4-5 | 0.444 | Home | 42-26 | W | FBS win +1 |
| 1 | Fresno State | fbs | 5-3 | 0.625 | Home | 39-0 | W | FBS win +1, quality +1 |
| 2 | Louisiana | fbs | 5-3 | 0.625 | Home | 49-30 | W | FBS win +1, quality +1 |
| 3 | Rutgers | fbs | 2-6 | 0.250 | Away | 42-35 | W | FBS win +1, road +0.5 |
| 4 | Oregon | fbs | 5-3 | 0.625 | Home | 27-41 | L | std loss -1 |
| 5 | Washington | fbs | 5-3 | 0.625 | Home | 25-21 | W | FBS win +1, quality +1 |
| 6 | Penn State | fbs | 4-4 | 0.500 | Away | 31-23 | W | FBS win +1, road +0.5 |
| 8 | Wisconsin | fbs | 5-3 | 0.625 | Away | 7-24 | L | std loss -1 |
| 9 | Ohio State | fbs | 6-2 | 0.750 | Home | 30-18 | W | FBS win +1, quality +1 |

**Derived (from this table):** FBS wins=7, FCS wins voided=0, road wins=2 (+1.0), quality wins=4. Loss notes: wk4 std; wk8 std

## Wake Forest (id 154, ACC, class=fbs)
Record /records: **7-1** (win% 0.875)

| Week | Opponent | Class | Opp W-L | Opp win% | Site | Score | Result | Counts for |
|---:|---|---|---|---:|---|---|---|---|
| 1 | Akron | fbs | 1-8 | 0.111 | Home | 38-16 | W | FBS win +1 |
| 2 | Purdue | fbs | 3-5 | 0.375 | Away | 38-36 | W | FBS win +1, road +0.5 |
| 3 | Miami | fbs | 8-0 | 1.000 | Home | 20-33 | L | std loss -1 |
| 4 | Louisville | fbs | 5-3 | 0.625 | Away | 30-27 | W | FBS win +1, road +0.5, quality +1 |
| 5 | Stanford | fbs | 4-5 | 0.444 | Home | 57-3 | W | FBS win +1 |
| 6 | NC State | fbs | 4-4 | 0.500 | Away | 38-14 | W | FBS win +1, road +0.5 |
| 7 | California | fbs | 3-6 | 0.333 | Away | 41-7 | W | FBS win +1, road +0.5 |
| 9 | Virginia | fbs | 4-5 | 0.444 | Home | 51-7 | W | FBS win +1 |

**Derived (from this table):** FBS wins=7, FCS wins voided=0, road wins=4 (+2.0), quality wins=1. Loss notes: wk3 std

## New Mexico (id 167, Mountain West, class=fbs)
Record /records: **7-1** (win% 0.875)

| Week | Opponent | Class | Opp W-L | Opp win% | Site | Score | Result | Counts for |
|---:|---|---|---|---:|---|---|---|---|
| 1 | Central Michigan | fbs | 3-5 | 0.375 | Home | 38-7 | W | FBS win +1 |
| 2 | Mercyhurst | fcs (not FBS list) | 1-8 | 0.111 | Home | 70-7 | W | FCS win void |
| 3 | Oklahoma | fbs | 4-4 | 0.500 | Away | 6-14 | L | std loss -1 |
| 4 | New Mexico State | fbs | 3-5 | 0.375 | Away | 42-18 | W | FBS win +1, road +0.5 |
| 5 | UTEP | fbs | 1-7 | 0.125 | Home | 61-7 | W | FBS win +1 |
| 7 | Hawai'i | fbs | 2-6 | 0.250 | Away | 21-10 | W | FBS win +1, road +0.5 |
| 8 | North Dakota State | fbs | 7-2 | 0.778 | Home | 21-16 | W | FBS win +1, quality +1 |
| 9 | San José State | fbs | 4-5 | 0.444 | Away | 21-16 | W | FBS win +1, road +0.5 |

**Derived (from this table):** FBS wins=6, FCS wins voided=1, road wins=3 (+1.5), quality wins=1. Loss notes: wk3 std

## Houston (id 248, Big 12, class=fbs)
Record /records: **6-2** (win% 0.750)

| Week | Opponent | Class | Opp W-L | Opp win% | Site | Score | Result | Counts for |
|---:|---|---|---|---:|---|---|---|---|
| 1 | Oregon State | fbs | 5-3 | 0.625 | Home | 33-20 | W | FBS win +1, quality +1 |
| 2 | Southern | fcs (not FBS list) | 4-5 | 0.444 | Home | 77-6 | W | FCS win void |
| 3 | Texas Tech | fbs | 7-1 | 0.875 | Away | 26-28 | L | road>.660 -0.5 |
| 4 | Georgia Southern | fbs | 4-4 | 0.500 | Away | 42-28 | W | FBS win +1, road +0.5 |
| 5 | UCF | fbs | 4-4 | 0.500 | Home | 27-17 | W | FBS win +1 |
| 6 | Kansas State | fbs | 4-4 | 0.500 | Away | 35-16 | W | FBS win +1, road +0.5 |
| 7 | Oklahoma State | fbs | 5-3 | 0.625 | Home | 35-32 | W | FBS win +1, quality +1 |
| 8 | Utah | fbs | 8-0 | 1.000 | Away | 13-21 | L | road>.660 -0.5 |

**Derived (from this table):** FBS wins=5, FCS wins voided=1, road wins=2 (+1.0), quality wins=2. Loss notes: wk3 road strong; wk8 road strong

## Tennessee (id 2633, SEC, class=fbs)
Record /records: **6-2** (win% 0.750)

| Week | Opponent | Class | Opp W-L | Opp win% | Site | Score | Result | Counts for |
|---:|---|---|---|---:|---|---|---|---|
| 1 | Furman | fcs (not FBS list) | 2-7 | 0.222 | Home | 56-9 | W | FCS win void |
| 2 | Georgia Tech | fbs | 2-6 | 0.250 | Away | 45-24 | W | FBS win +1, road +0.5 |
| 3 | Kennesaw State | fbs | 2-6 | 0.250 | Home | 42-9 | W | FBS win +1 |
| 4 | Texas | fbs | 6-2 | 0.750 | Home | 17-20 | L | std loss -1 |
| 5 | Auburn | fbs | 4-4 | 0.500 | Home | 24-14 | W | FBS win +1 |
| 6 | Arkansas | fbs | 3-5 | 0.375 | Away | 24-17 | W | FBS win +1, road +0.5 |
| 7 | Alabama | fbs | 6-2 | 0.750 | Home | 26-10 | W | FBS win +1, quality +1 |
| 8 | South Carolina | fbs | 5-3 | 0.625 | Away | 24-27 | L | std loss -1 |

**Derived (from this table):** FBS wins=5, FCS wins voided=1, road wins=2 (+1.0), quality wins=1. Loss notes: wk4 std; wk8 std

## LSU (id 99, SEC, class=fbs)
Record /records: **6-2** (win% 0.750)

| Week | Opponent | Class | Opp W-L | Opp win% | Site | Score | Result | Counts for |
|---:|---|---|---|---:|---|---|---|---|
| 1 | Clemson | fbs | 5-3 | 0.625 | Home | 51-10 | W | FBS win +1, quality +1 |
| 2 | Louisiana Tech | fbs | 6-2 | 0.750 | Home | 45-14 | W | FBS win +1, quality +1 |
| 3 | Ole Miss | fbs | 6-2 | 0.750 | Away | 24-32 | L | road>.660 -0.5 |
| 4 | Texas A&M | fbs | 4-4 | 0.500 | Home | 35-6 | W | FBS win +1 |
| 5 | McNeese | fcs (not FBS list) | 4-5 | 0.444 | Home | 63-14 | W | FCS win void |
| 6 | Kentucky | fbs | 7-1 | 0.875 | Away | 34-35 | L | road>.660 -0.5 |
| 7 | Mississippi State | fbs | 4-4 | 0.500 | Home | 31-0 | W | FBS win +1 |
| 8 | Auburn | fbs | 4-4 | 0.500 | Away | 38-17 | W | FBS win +1, road +0.5 |

**Derived (from this table):** FBS wins=5, FCS wins voided=1, road wins=1 (+0.5), quality wins=2. Loss notes: wk3 road strong; wk6 road strong

## North Dakota State (id 2449, Mountain West, class=fbs)
Record /records: **7-2** (win% 0.778)

| Week | Opponent | Class | Opp W-L | Opp win% | Site | Score | Result | Counts for |
|---:|---|---|---|---:|---|---|---|---|
| 1 | Jacksonville State | fbs | 6-2 | 0.750 | Home | 33-7 | W | FBS win +1, quality +1 |
| 1 | Fordham | fcs (not FBS list) | 2-7 | 0.222 | Home | 38-0 | W | FCS win void |
| 2 | Air Force | fbs | 6-2 | 0.750 | Away | 38-32 | W | FBS win +1, road +0.5, quality +1 |
| 3 | Sacramento State | fbs | 2-7 | 0.222 | Away | 31-10 | W | FBS win +1, road +0.5 |
| 5 | Wyoming | fbs | 5-3 | 0.625 | Home | 28-0 | W | FBS win +1, quality +1 |
| 6 | UNLV | fbs | 5-3 | 0.625 | Away | 7-13 | L | std loss -1 |
| 7 | Nevada | fbs | 3-5 | 0.375 | Home | 31-17 | W | FBS win +1 |
| 8 | New Mexico | fbs | 7-1 | 0.875 | Away | 16-21 | L | road>.660 -0.5 |
| 9 | UTEP | fbs | 1-7 | 0.125 | Home | 31-7 | W | FBS win +1 |

**Derived (from this table):** FBS wins=6, FCS wins voided=1, road wins=2 (+1.0), quality wins=3. Loss notes: wk6 std; wk8 road strong


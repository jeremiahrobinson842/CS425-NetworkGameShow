# Network Game Show – Frontend Wireframes

This document contains low-fidelity wireframes for the core screens of Network Game Show and identifies which UI components require real-time updates via WebSockets (Socket.io) versus which can use standard HTTP/REST or local state.

Screens covered:

1. Host Dashboard
2. Player Join Screen
3. Lobby Screen
4. Game Screen
5. Results Screen
6. Real-time vs Non-Real-time Summary

---

## 1. Host Dashboard

### 1.1 Layout (Low-Fidelity Wireframe)

```text
+--------------------------------------------------------------+
| Network Game Show - Host Dashboard                           |
+--------------------------------------------------------------+
| [ Game Settings ]                         [ Lobby Players ]  |
|                                                              |
|  Mode: [ Classic v ]                                        |
|  Number of Questions: [ 10 ] (min 5, max 20)                 |
|  Time per Question:  [ 20 ] seconds (10–30)                  |
|                                                              |
|  [ Create Game ]                                             |
|                                                              |
|  Once game is created:                                      |
|    Game Code: [ N Y E 8 F 7 ]  (big, centered, high contrast)|
|                                                              |
|---------------------------------------------+----------------|
| Status: [ Waiting for players to join... ]  | Player List    |
|                                             |  - Player1    |
|                                             |  - Player2     |
|                                             |  - Player3     |
|                                             |                |
|                                             | (scroll if     |
|                                             |  many players) |
+---------------------------------------------+----------------+
| [ Start Game ] (disabled until >= 2 players)                 |
| [ End Game ] (optional, to cancel game)                      |
+--------------------------------------------------------------+
+------------------------------------------------------+
| Network Game Show - Join Game                        |
+------------------------------------------------------+
| Game Code: [      ]                                  |
| Username:  [      ]                                  |
|                                                      |
| [ Join Game ]                                        |
|                                                      |
| Error message area (optional):                       |
|   e.g., "Invalid game code"                          |
+------------------------------------------------------+
+------------------------------------------------------+
| Network Game Show - Lobby                            |
+------------------------------------------------------+
| Game Code: NYE8F7                                    |
| You are: Player1                                  |
+------------------------------------------------------+
| Players in Lobby:                                    |
|  - Player1                                    |
|  - Player2                                           |
|  - Player3                                           |
|                                                      |
| Status: Waiting for host to start...                 |
|                                                      |
| [ Connected ]   (small indicator, e.g., green dot)   |
+------------------------------------------------------+
+------------------------------------------------------+
| Network Game Show - Lobby                            |
+------------------------------------------------------+
| Game Code: NYE8F7                                    |
| Mode: Classic                                        |
| Questions: 10    Time per question: 20s              |
+------------------------------------------------------+
| Players in Lobby:                                    |
|  - Player1                                       |
|  - Player2                                           |
|  - Player3                                           |
|                                                      |
| Status (real-time):                                  |
|  - "Waiting for host to start..."                    |
|  - "Game starting in 3..."                           |
|  - "Game starting in 2..."                           |
|  - "Game starting in 1..."                           |
+------------------------------------------------------+
| Host only: [ Start Game ] (>= 2 players)             |
|            [ End Game ]                              |
+------------------------------------------------------+
+------------------------------------------------------+
| Game Code: NYE8F7              Question 3 of 10      |
+------------------------------------------------------+
| Time Remaining: [ 18s ]                              |
+------------------------------------------------------+
| What is the primary function of a router?            |
|                                                      |
|  [ A ] Connect end devices within the same LAN       |
|                                                      |
|  [ B ] Forward packets between different networks    |
|                                                      |
|  [ C ] Convert analog signals to digital             |
|                                                      |
|  [ D ] Filter frames based on MAC addresses          |
+------------------------------------------------------+
| Your Score: 1200                                     |
| Status:                                              |
|   - "Select an answer..."                            |
|   - "Answer submitted! Waiting for others..."        |
+------------------------------------------------------+
+------------------------------------------------------+
| Game Code: NYE8F7              Question 3 of 10      |
+------------------------------------------------------+
| Time Remaining: [ 0s ]   (timer stops / grayed out)  |
+------------------------------------------------------+
| ✅ Correct answer: [ B ] Forward packets between     |
|    different networks                                |
|                                                      |
| Explanation (2–3 sentences)                          |
|   e.g., "Routers operate at the network layer and    |
|   forward packets between distinct IP networks."     |
+------------------------------------------------------+
| This Question: +120 points (100 base + 20 speed)     |
| Total Score: 1320                                    |
+------------------------------------------------------+
| Mini-Leaderboard (Top 5 / Top 10):                   |
|  1. Player2    1500                                  |
|  2. Player1   1320                                  |
|  3. Player3    900                                   |
|                                                      |
| Next question starting in: [ 5s ] ...                |
+------------------------------------------------------+
+------------------------------------------------------+
| Network Game Show - Final Results                    |
+------------------------------------------------------+
| Final Leaderboard                                    |
|                                                      |
| Rank | Player      | Total Score | % Correct | Avg RT|
|------------------------------------------------------|
|  1   | Player2     | 4200        | 80%       | 1.4s  |
|  2   | Player1    | 3900        | 70%       | 1.6s  |
|  3   | Player3     | 2600        | 60%       | 1.9s  |
| ...                                                  |
+------------------------------------------------------+
| Your Stats                                           |
|                                                      |
|  You are: Player1                                   |
|  Your Rank: 2 / 5                                    |
|  Total Score: 3900                                   |
|  Questions Correct: 7 / 10                           |
|  Average Response Time: 1.6 seconds                  |
+------------------------------------------------------+
| [ Play Again (new game) ]  [ Exit ]                  |
+------------------------------------------------------+

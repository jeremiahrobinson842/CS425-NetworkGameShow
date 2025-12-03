-- sql/schema.sql
-- Schema for Network Game Show database
-- This file defines tables:
--   - questions
--   - games
--   - players
--   - game_participants
--   - answers
--
-- Run this once to create the schema:
--   psql -d your_db_name -f sql/schema.sql

CREATE TABLE IF NOT EXISTS questions (
    id              SERIAL PRIMARY KEY,
    category        VARCHAR(32) NOT NULL,
    text            TEXT NOT NULL,
    option_a        TEXT NOT NULL,
    option_b        TEXT NOT NULL,
    option_c        TEXT NOT NULL,
    option_d        TEXT NOT NULL,
    correct_option  CHAR(1) NOT NULL CHECK (correct_option IN ('A','B','C','D')),
    explanation     TEXT NOT NULL,
    difficulty      VARCHAR(16) NOT NULL CHECK (difficulty IN ('Easy','Medium','Hard'))
);

CREATE TABLE IF NOT EXISTS games (
    id                 SERIAL PRIMARY KEY,
    code               CHAR(6) UNIQUE NOT NULL,
    mode               VARCHAR(16) NOT NULL, -- e.g. 'classic'
    question_count     INT NOT NULL CHECK (question_count BETWEEN 5 AND 20),
    time_per_question  INT NOT NULL CHECK (time_per_question BETWEEN 10 AND 30),
    status             VARCHAR(16) NOT NULL, -- 'waiting','in_progress','completed'
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS players (
    id       SERIAL PRIMARY KEY,
    username VARCHAR(32) NOT NULL
);

CREATE TABLE IF NOT EXISTS game_participants (
    id          SERIAL PRIMARY KEY,
    game_id     INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id   INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    join_time   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    final_score INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS answers (
    id               SERIAL PRIMARY KEY,
    game_id          INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id        INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    question_id      INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    chosen_option    CHAR(1) NOT NULL CHECK (chosen_option IN ('A','B','C','D')),
    is_correct       BOOLEAN NOT NULL,
    response_time_ms INT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

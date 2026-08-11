-- Migration number: 0001 	 2026-08-11T14:14:37.649Z

CREATE TABLE questions (
  id          TEXT PRIMARY KEY,
  text        TEXT NOT NULL,
  category    TEXT NOT NULL,     -- food, animals, school, movies, silly, would-you-rather
  age_band    TEXT NOT NULL,     -- 'kids' | 'family' | 'adult'
  locale      TEXT DEFAULT 'en-AU',
  approved    INTEGER DEFAULT 0,
  created_at  INTEGER
);

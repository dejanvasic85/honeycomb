-- Migration number: 0002 	 2026-08-11T14:15:00.000Z

INSERT OR IGNORE INTO questions (id, text, category, age_band, locale, approved, created_at) VALUES
  ('food-pizza-topping', 'Name a topping you''d put on a pizza.', 'food', 'kids', 'en-AU', 1, unixepoch()),
  ('food-lunchbox-fruit', 'Name a fruit you''d pack in a lunchbox.', 'food', 'kids', 'en-AU', 1, unixepoch()),
  ('food-never-run-out', 'Name a food you''d never want to run out of.', 'food', 'family', 'en-AU', 1, unixepoch()),
  ('food-drive-through', 'Name something you''d order at a fast food drive-through.', 'food', 'family', 'en-AU', 1, unixepoch()),
  ('animals-pet', 'Name an animal you''d want as a pet.', 'animals', 'kids', 'en-AU', 1, unixepoch()),
  ('animals-zoo', 'Name an animal you''d see at the zoo.', 'animals', 'kids', 'en-AU', 1, unixepoch()),
  ('animals-fast', 'Name an animal that''s famous for being fast.', 'animals', 'family', 'en-AU', 1, unixepoch()),
  ('animals-dark', 'Name an animal you wouldn''t want to meet in the dark.', 'animals', 'family', 'en-AU', 1, unixepoch()),
  ('school-more-of', 'Name a subject you''d want more of at school.', 'school', 'kids', 'en-AU', 1, unixepoch()),
  ('school-bag', 'Name something you''d find in a school bag.', 'school', 'kids', 'en-AU', 1, unixepoch()),
  ('school-teacher-job', 'Name a job a teacher does besides teaching.', 'school', 'family', 'en-AU', 1, unixepoch()),
  ('movies-rewatch', 'Name a movie you''ve watched more than once.', 'movies', 'family', 'en-AU', 1, unixepoch()),
  ('movies-animated', 'Name an animated movie everyone in your family has seen.', 'movies', 'family', 'en-AU', 1, unixepoch()),
  ('movies-superhero-team', 'Name a superhero you''d want on your team.', 'movies', 'kids', 'en-AU', 1, unixepoch()),
  ('silly-desert-island', 'Name something you''d bring to a desert island.', 'silly', 'family', 'en-AU', 1, unixepoch()),
  ('silly-goldfish-name', 'Name a silly name for a pet goldfish.', 'silly', 'kids', 'en-AU', 1, unixepoch()),
  ('silly-upside-down', 'Name something that''s more fun upside down.', 'silly', 'kids', 'en-AU', 1, unixepoch()),
  ('wyr-than-homework', 'Name something you''d rather do than homework.', 'would-you-rather', 'kids', 'en-AU', 1, unixepoch()),
  ('wyr-superpower', 'Name a superpower you''d want more than flying.', 'would-you-rather', 'family', 'en-AU', 1, unixepoch()),
  ('wyr-never-again', 'Name a chore you''d rather never do again.', 'would-you-rather', 'family', 'en-AU', 1, unixepoch());

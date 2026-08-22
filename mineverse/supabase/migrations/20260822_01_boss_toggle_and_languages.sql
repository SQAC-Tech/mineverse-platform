-- Add coding question flag and default it to false
ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_coding_question boolean DEFAULT false;

-- Add guardian unlocked toggle to rounds
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS guardian_unlocked boolean DEFAULT false;

-- Add active login IP to teams for session restriction
ALTER TABLE teams ADD COLUMN IF NOT EXISTS active_login_ip text;

-- Update the language options for all coding questions
UPDATE questions 
SET language_options = '{python, java, c, cpp, javascript}'
WHERE type = 'coding' OR is_coding_question = true;

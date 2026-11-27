-- Fix Grade.maxValue to match Subject.maxTJ/maxEX
-- Period grades (type contains 'période') → maxValue = subject.maxTJ
-- Exam grades (type = 'examen') → maxValue = subject.maxEX

-- Fix period grades for subjects with maxTJ=10 (currently maxValue=20)
UPDATE "Grade" g
SET "maxValue" = s."maxTJ"
FROM "Subject" s
WHERE g."subjectId" = s."id"
  AND s."maxTJ" = 10
  AND g."maxValue" = 20
  AND g."type" LIKE '%période%';

-- Fix exam grades for subjects with maxEX=20 (currently maxValue=40)
UPDATE "Grade" g
SET "maxValue" = s."maxEX"
FROM "Subject" s
WHERE g."subjectId" = s."id"
  AND s."maxEX" = 20
  AND g."maxValue" = 40
  AND g."type" = 'examen';

-- Fix period grades for subjects with maxTJ=30 (LECT, currently maxValue might be wrong)
UPDATE "Grade" g
SET "maxValue" = s."maxTJ"
FROM "Subject" s
WHERE g."subjectId" = s."id"
  AND s."maxTJ" = 30
  AND g."maxValue" != 30
  AND g."type" LIKE '%période%';

-- Fix exam grades for subjects with maxEX=60 (LECT)
UPDATE "Grade" g
SET "maxValue" = s."maxEX"
FROM "Subject" s
WHERE g."subjectId" = s."id"
  AND s."maxEX" = 60
  AND g."maxValue" != 60
  AND g."type" = 'examen';

-- Verify
SELECT COUNT(*) FILTER (WHERE g."maxValue" != CASE 
  WHEN g."type" LIKE '%période%' THEN s."maxTJ"
  WHEN g."type" = 'examen' THEN s."maxEX"
  ELSE g."maxValue"
END) as still_wrong
FROM "Grade" g
JOIN "Subject" s ON g."subjectId" = s."id";

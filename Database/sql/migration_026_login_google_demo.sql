-- ===========================================================================
-- MIGRAÇÃO 026 — login com Google + workspace DEMO (modelo "Student View" do Canvas).
--
-- Quem entra com o Google ganha um curso-sandbox próprio (mesmas matérias do
-- curso base, via offerings), uma conta de coordenador (a pessoa) e um "aluno de
-- teste" ligado a ela, além de alunos de exemplo. Tudo isolado por course_id: o
-- coordenador da demo não enxerga nenhum aluno real.
--
-- 1. students.email / students.google_sub: identidade Google (sub é o id estável;
--    o e-mail é só exibição). Únicos quando presentes.
-- 2. students.demo_owner_id: id do coordenador dono do workspace DEMO (o próprio
--    coordenador aponta para si). NULL = conta real. Sem FK de propósito: a
--    leitura no /student/me não pode custar query extra.
--    students.demo_kind: 'coordenador' | 'aluno_teste' | 'exemplo' | 'criado'.
--    Só coordenador <-> aluno_teste podem trocar de visão entre si.
-- 3. courses.is_demo / courses.demo_created_at: marca o curso-sandbox (permite
--    limpeza periódica e regras próprias da demo, como gerar dados de exemplo).
--
-- IDEMPOTENTE (padrão da migration_024): ALTERs guardados por information_schema.
-- Volume existente:
--   docker exec -i ova_db mysql -ueduardo -pPassword-1 ova_db \
--     < Database/sql/migration_026_login_google_demo.sql
-- ===========================================================================
USE ova_db;

SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE students ADD COLUMN email VARCHAR(254) NULL', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'ova_db' AND TABLE_NAME = 'students' AND COLUMN_NAME = 'email');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE students ADD COLUMN google_sub VARCHAR(64) NULL', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'ova_db' AND TABLE_NAME = 'students' AND COLUMN_NAME = 'google_sub');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE students ADD COLUMN demo_owner_id INT NULL', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'ova_db' AND TABLE_NAME = 'students' AND COLUMN_NAME = 'demo_owner_id');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE students ADD COLUMN demo_kind VARCHAR(20) NULL', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'ova_db' AND TABLE_NAME = 'students' AND COLUMN_NAME = 'demo_kind');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE students ADD UNIQUE INDEX uq_students_google_sub (google_sub)', 'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = 'ova_db' AND TABLE_NAME = 'students' AND INDEX_NAME = 'uq_students_google_sub');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE students ADD INDEX idx_students_demo_owner (demo_owner_id)', 'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = 'ova_db' AND TABLE_NAME = 'students' AND INDEX_NAME = 'idx_students_demo_owner');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE courses ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT FALSE', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'ova_db' AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'is_demo');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE courses ADD COLUMN demo_created_at DATETIME NULL', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'ova_db' AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'demo_created_at');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

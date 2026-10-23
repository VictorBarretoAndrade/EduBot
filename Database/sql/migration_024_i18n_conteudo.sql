-- ===========================================================================
-- MIGRAÇÃO 024 (Plano 6 — i18n completo para a apresentação na Holanda)
--
-- 1. Colunas EN que faltavam: nome do curso e das matérias, link de leitura
--    equivalente em inglês, e as mensagens que o Engage-Agent grava em runtime
--    (intervenções, alertas e trilhas de reforço). A API lê com tr(): sem valor
--    EN, cai no PT — nada quebra em volume antigo.
-- 2. Popula o nome do curso, das matérias e os 7 links de leitura que apontavam
--    para páginas em português (verificados: todos respondem 200).
--
-- IDEMPOTENTE (mesmo padrão da migration_001): ALTERs guardados por
-- information_schema; UPDATEs reexecutáveis. Volume existente:
--   docker exec -i ova_db mysql -ueduardo -pPassword-1 ova_db --     < Database/sql/migration_024_i18n_conteudo.sql
-- ===========================================================================
USE ova_db;

-- ---------------------------------------------------------------------------
-- 1. Colunas de tradução
-- ---------------------------------------------------------------------------
SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE courses ADD COLUMN course_name_en TEXT NULL', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'ova_db' AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'course_name_en');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE course_subjects ADD COLUMN subject_name_en TEXT NULL', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'ova_db' AND TABLE_NAME = 'course_subjects' AND COLUMN_NAME = 'subject_name_en');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE resources ADD COLUMN resource_url_en TEXT NULL', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'ova_db' AND TABLE_NAME = 'resources' AND COLUMN_NAME = 'resource_url_en');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE interventions ADD COLUMN description_en TEXT NULL', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'ova_db' AND TABLE_NAME = 'interventions' AND COLUMN_NAME = 'description_en');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE alerts ADD COLUMN message_en TEXT NULL', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'ova_db' AND TABLE_NAME = 'alerts' AND COLUMN_NAME = 'message_en');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE personalized_ova ADD COLUMN title_en VARCHAR(255) NULL', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'ova_db' AND TABLE_NAME = 'personalized_ova' AND COLUMN_NAME = 'title_en');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE personalized_ova ADD COLUMN message_en TEXT NULL', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'ova_db' AND TABLE_NAME = 'personalized_ova' AND COLUMN_NAME = 'message_en');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- ---------------------------------------------------------------------------
-- 2. Curso e matérias
-- ---------------------------------------------------------------------------
UPDATE courses SET course_name_en = 'Computer Engineering' WHERE course_id = 1;
UPDATE course_subjects SET subject_name_en = 'Quantum Computing' WHERE subject_id = 1;
UPDATE course_subjects SET subject_name_en = 'Calculus' WHERE subject_id = 2;
UPDATE course_subjects SET subject_name_en = 'Cloud Computing Fundamentals' WHERE subject_id = 3;

-- ---------------------------------------------------------------------------
-- 3. Leituras externas: versão em inglês da mesma página
-- ---------------------------------------------------------------------------
UPDATE resources SET resource_url_en = 'https://www.ibm.com/topics/quantum-computing' WHERE resource_id = 18;
UPDATE resources SET resource_url_en = 'https://www.khanacademy.org/math/calculus-1/cs1-derivatives-definition-and-basic-rules' WHERE resource_id = 24;
UPDATE resources SET resource_url_en = 'https://www.khanacademy.org/math/calculus-1/cs1-limits-and-continuity' WHERE resource_id = 26;
UPDATE resources SET resource_url_en = 'https://www.khanacademy.org/math/calculus-1/cs1-applications-of-derivatives' WHERE resource_id = 28;
UPDATE resources SET resource_url_en = 'https://aws.amazon.com/what-is-cloud-computing/' WHERE resource_id = 35;
UPDATE resources SET resource_url_en = 'https://azure.microsoft.com/en-us' WHERE resource_id = 37;
UPDATE resources SET resource_url_en = 'https://azure.microsoft.com/en-us/resources/cloud-computing-dictionary/what-is-cloud-computing' WHERE resource_id = 39;

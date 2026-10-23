-- ===========================================================================
-- MIGRAÇÃO 025 (Plano 6) — curso externo com certificado (Cisco NetAcad).
--
-- 1. Tabela `certificate_submissions`: resultado da avaliação do certificado em
--    PDF enviado pelo aluno. O arquivo NÃO é guardado — só o sha256, o tamanho e
--    o veredito (minimização, LGPD/GDPR).
-- 2. Recurso novo do tipo `curso_externo`: "Introduction to Cybersecurity", curso
--    gratuito da Cisco Networking Academy (disponível em português), ligado ao
--    módulo de Computação na Nuvem (ova 4) e à competência 9 (segurança na nuvem).
--    Entra na trilha de prática dessa competência e no passo "Atividades" do módulo.
--
-- IDEMPOTENTE: CREATE TABLE IF NOT EXISTS + INSERT ... ON DUPLICATE KEY UPDATE.
-- Volume existente:
--   docker exec -i ova_db mysql -ueduardo -pPassword-1 ova_db \
--     < Database/sql/migration_025_curso_externo_certificado.sql
-- ===========================================================================
USE ova_db;

CREATE TABLE IF NOT EXISTS certificate_submissions (
    submission_id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    resource_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    sha256 CHAR(64) NOT NULL,
    size_bytes INT NOT NULL,
    status VARCHAR(20) NOT NULL,
    feedback TEXT NULL,
    feedback_en TEXT NULL,
    mock BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL,
    INDEX idx_cert_student_resource (student_id, resource_id),
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (resource_id) REFERENCES resources(resource_id) ON DELETE CASCADE ON UPDATE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO resources (resource_id, ova_id, resource_type, resource_title, resource_url, media_type, duration_seconds, competency_id, resource_title_en, resource_url_en)
VALUES (40, 4, 'curso_externo', 'Curso Cisco: Introduction to Cybersecurity',
        'https://www.netacad.com/courses/introduction-to-cybersecurity', 'link', NULL, 9,
        'Cisco course: Introduction to Cybersecurity',
        'https://www.netacad.com/courses/introduction-to-cybersecurity')
ON DUPLICATE KEY UPDATE
  resource_type = VALUES(resource_type),
  resource_title = VALUES(resource_title),
  resource_url = VALUES(resource_url),
  competency_id = VALUES(competency_id),
  resource_title_en = VALUES(resource_title_en),
  resource_url_en = VALUES(resource_url_en);

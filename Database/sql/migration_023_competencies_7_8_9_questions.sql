-- ===========================================================================
-- MIGRAÇÃO 023: Novas questões para as Competências 7, 8 e 9 (Mínimo de 3 por competência)
--
-- Insere as questões 33 a 38 cobrindo:
--   - Competência 7 (Modelos de Serviço: PaaS e Nível de Controle IaaS/PaaS/SaaS)
--   - Competência 8 (Modelos de Implantação: Nuvem Privada e Cloud Bursting Híbrido)
--   - Competência 9 (Economia e Segurança: OpEx vs CapEx e Governança/MFA contra incidentes)
--
-- Suporte bilíngue nativo (PT e EN). Idempotente via INSERT ... ON DUPLICATE KEY UPDATE.
-- ===========================================================================
USE ova_db;

-- Garante que a coluna statement suporte enunciados longos (assim como statement_en TEXT)
ALTER TABLE questions MODIFY COLUMN statement TEXT;

-- ---------------------------------------------------------------------------
-- Questões 33 e 34 (Competência 7: Modelos de Serviço)
-- ---------------------------------------------------------------------------
INSERT INTO questions (question_id, statement, alternatives, answer, ova_id, competency_id, statement_en, alternatives_en)
VALUES
(33,
 'Um desenvolvedor precisa criar e implantar uma aplicação web rapidamente, focando exclusivamente no código-fonte e na lógica de negócios, sem gerenciar servidores, patches de sistema operacional ou balanceadores de carga. Qual modelo de serviço em nuvem atende a essa necessidade?',
 '{"alternatives": ["IaaS (Infraestrutura como Serviço)", "PaaS (Plataforma como Serviço)", "SaaS (Software como Serviço)", "DaaS (Desktop como Serviço)"]}',
 'b', 4, 7,
 'A developer needs to build and deploy a web application quickly, focusing solely on application code and business logic without managing servers, OS patching, or load balancers. Which cloud service model fits this requirement?',
 '{"alternatives": ["IaaS (Infrastructure as a Service)", "PaaS (Platform as a Service)", "SaaS (Software as a Service)", "DaaS (Desktop as a Service)"]}'
)
ON DUPLICATE KEY UPDATE
  statement = VALUES(statement),
  alternatives = VALUES(alternatives),
  answer = VALUES(answer),
  statement_en = VALUES(statement_en),
  alternatives_en = VALUES(alternatives_en);

INSERT INTO questions (question_id, statement, alternatives, answer, ova_id, competency_id, statement_en, alternatives_en)
VALUES
(34,
 'Ao comparar os três modelos de serviço em nuvem (IaaS, PaaS e SaaS), em qual deles o cliente retém o MAIOR nível de controle sobre a configuração de rede, sistema operacional e instalação de bibliotecas?',
 '{"alternatives": ["SaaS", "PaaS", "IaaS", "O controle do cliente é idêntico nos três modelos"]}',
 'c', 4, 7,
 'When comparing the three cloud service models (IaaS, PaaS, and SaaS), in which one does the customer retain the HIGHEST level of control over network configuration, operating system, and custom library installation?',
 '{"alternatives": ["SaaS", "PaaS", "IaaS", "Customer control is identical across all models"]}'
)
ON DUPLICATE KEY UPDATE
  statement = VALUES(statement),
  alternatives = VALUES(alternatives),
  answer = VALUES(answer),
  statement_en = VALUES(statement_en),
  alternatives_en = VALUES(alternatives_en);

-- ---------------------------------------------------------------------------
-- Questões 35 e 36 (Competência 8: Modelos de Implantação)
-- ---------------------------------------------------------------------------
INSERT INTO questions (question_id, statement, alternatives, answer, ova_id, competency_id, statement_en, alternatives_en)
VALUES
(35,
 'Um hospital público armazena prontuários médicos altamente sensíveis e é obrigado por normas rígidas de soberania e proteção de dados a manter isolamento físico completo e controle exclusivo sobre o hardware. Qual modelo de implantação de nuvem é o mais indicado?',
 '{"alternatives": ["Nuvem Pública multilocatária (multi-tenant)", "Nuvem Privada (dedicada on-premise ou hospedada)", "Nuvem Comunitária aberta", "Nuvem de borda pública não gerenciada"]}',
 'b', 4, 8,
 'A public hospital stores highly sensitive patient records and is mandated by strict data sovereignty and privacy regulations to maintain complete physical isolation and exclusive control over computing hardware. Which cloud deployment model is most suitable?',
 '{"alternatives": ["Multi-tenant Public Cloud", "Private Cloud (dedicated on-premise or hosted)", "Open Community Cloud", "Unmanaged public edge cloud"]}'
)
ON DUPLICATE KEY UPDATE
  statement = VALUES(statement),
  alternatives = VALUES(alternatives),
  answer = VALUES(answer),
  statement_en = VALUES(statement_en),
  alternatives_en = VALUES(alternatives_en);

INSERT INTO questions (question_id, statement, alternatives, answer, ova_id, competency_id, statement_en, alternatives_en)
VALUES
(36,
 'Uma instituição de ensino mantém seus bancos de dados e cadastros confidenciais em data center interno próprio, mas, durante a semana de matrículas e vestibulares (quando o tráfego multiplica por 20), expande temporariamente os servidores de aplicação para a nuvem pública. Como se chama essa estratégia?',
 '{"alternatives": ["Nuvem Privada Estática", "Nuvem Híbrida com expansão sob demanda (cloud bursting)", "Hospedagem Compartilhada Legada", "Nuvem Pública Monolítica"]}',
 'b', 4, 8,
 'An educational institution maintains its confidential databases in its own internal data center, but during enrollment week and admissions surges (when traffic spikes 20x), it dynamically scales its application frontends into the public cloud. What is this deployment strategy called?',
 '{"alternatives": ["Static Private Cloud", "Hybrid Cloud with on-demand bursting (cloud bursting)", "Legacy Shared Hosting", "Monolithic Public Cloud"]}'
)
ON DUPLICATE KEY UPDATE
  statement = VALUES(statement),
  alternatives = VALUES(alternatives),
  answer = VALUES(answer),
  statement_en = VALUES(statement_en),
  alternatives_en = VALUES(alternatives_en);

-- ---------------------------------------------------------------------------
-- Questões 37 e 38 (Competência 9: Benefícios Econômicos e Desafios de Segurança)
-- ---------------------------------------------------------------------------
INSERT INTO questions (question_id, statement, alternatives, answer, ova_id, competency_id, statement_en, alternatives_en)
VALUES
(37,
 'Do ponto de vista contábil e de planejamento financeiro, qual é a principal vantagem da migração de infraestrutura física local para a computação em nuvem?',
 '{"alternatives": ["Substituição de grandes investimentos iniciais em bens de capital (CapEx) por custos operacionais contínuos sob demanda (OpEx)", "Garantia de que a fatura mensal será imutável e fixa, independentemente do consumo real", "Transferência compulsória de 100% da responsabilidade legal dos dados para o provedor", "Eliminação total da necessidade de profissionais especializados em TI"]}',
 'a', 4, 9,
 'From an accounting and financial planning perspective, what is the primary advantage of migrating from on-premise physical infrastructure to cloud computing?',
 '{"alternatives": ["Replacing large upfront capital expenditures (CapEx) with continuous, on-demand operating expenses (OpEx)", "Guaranteeing that monthly billing remains completely static and fixed, regardless of actual usage", "Compulsory transfer of 100% of legal data liability to the cloud vendor", "Complete elimination of the need for specialized IT personnel"]}'
)
ON DUPLICATE KEY UPDATE
  statement = VALUES(statement),
  alternatives = VALUES(alternatives),
  answer = VALUES(answer),
  statement_en = VALUES(statement_en),
  alternatives_en = VALUES(alternatives_en);

INSERT INTO questions (question_id, statement, alternatives, answer, ova_id, competency_id, statement_en, alternatives_en)
VALUES
(38,
 'Incidentes de segurança na nuvem (como vazamentos de credenciais e acessos indevidos) ocorrem com frequência devido a falhas de governança do cliente. Para mitigar esses riscos e proteger dados de estudantes sob leis como LGPD/GDPR, qual é a prática recomendada?',
 '{"alternatives": ["Utilizar a conta raiz (root/admin) para todas as tarefas cotidianas da equipe", "Aplicar o princípio do menor privilégio (PoLP) e autenticação multifator (MFA) obrigatória", "Manter chaves permanentes de API gravadas diretamente no código-fonte", "Desativar a criptografia em repouso para acelerar requisições"]}',
 'b', 4, 9,
 'Cloud security incidents (such as credential leaks and breaches) frequently stem from customer-side governance misconfigurations. To mitigate these risks and safeguard student data under regulations like LGPD/GDPR, which practice is recommended?',
 '{"alternatives": ["Using the root/admin account for all day-to-day engineering tasks", "Enforcing the Principle of Least Privilege (PoLP) and mandatory Multi-Factor Authentication (MFA)", "Hardcoding permanent API access keys directly into application source code", "Disabling encryption-at-rest to speed up database requests"]}'
)
ON DUPLICATE KEY UPDATE
  statement = VALUES(statement),
  alternatives = VALUES(alternatives),
  answer = VALUES(answer),
  statement_en = VALUES(statement_en),
  alternatives_en = VALUES(alternatives_en);

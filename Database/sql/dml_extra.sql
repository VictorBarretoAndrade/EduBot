-- MELHORIA (4.1): seed dos recursos de cada OVA, incluindo vídeo e podcast.
--
-- A hospedagem definitiva dos arquivos ainda NÃO foi decidida: o par
-- (resource_url, media_type) é a abstração que permite trocar depois entre
-- uploads próprios (S3/local) e embeds externos (YouTube/Spotify) sem mudar o
-- schema. As URLs de podcast abaixo são placeholders públicos de teste
-- (media_type 'upload' = arquivo direto tocável pelo player HTML5).
use ova_db;

-- MELHORIA (OVA personalizada): a coluna competency_id classifica cada recurso
-- por competência, transformando `resources` no banco de conteúdo de remediação
-- que o agente EduBot consulta por assunto. Recursos genéricos do OVA
-- (quiz/atividade) ficam com competency_id NULL.
insert into resources
(resource_id, ova_id, resource_type, resource_title, resource_url, media_type, duration_seconds, competency_id)
values
-- OVA 1: Computação Quântica
(1, 1, "texto",     "Leitura: A Jornada Quântica",                   NULL, NULL, NULL, 1),
(2, 1, "video",     "Vídeo: Introdução à Computação Quântica",       "https://www.youtube.com/watch?v=7NWN3wivxhA", "youtube", NULL, 1),
(3, 1, "video",     "Vídeo: Qubits e Superposição",                  "https://www.youtube.com/watch?v=hp4wXxE4fxg", "youtube", NULL, 1),
(4, 1, "podcast",   "Podcast: Conversas Quânticas (ep. 1)",          "https://www.soundhelix.com/examples/audio/SoundHelix-Song-1.mp3", "upload", 372, 2),
(5, 1, "quiz",      "Quiz: Computação Quântica",                     NULL, NULL, NULL, NULL),
(6, 1, "atividade", "Atividade prática: simule um qubit no IBM Quantum Composer", NULL, NULL, NULL, NULL),
-- OVA 2: Cálculo
(7,  2, "texto",     "Leitura: Limites e Derivadas",                 NULL, NULL, NULL, 5),
(8,  2, "video",     "Vídeo: A essência do Cálculo",                 "https://www.youtube.com/watch?v=WUvTyaaNkzM", "youtube", NULL, 4),
(9,  2, "podcast",   "Podcast: Cálculo no dia a dia (ep. 1)",        "https://www.soundhelix.com/examples/audio/SoundHelix-Song-2.mp3", "upload", 425, 5),
(10, 2, "quiz",      "Quiz: Cálculo",                                NULL, NULL, NULL, NULL),
(11, 2, "atividade", "Atividade prática: resolva a lista de limites e envie ao professor", NULL, NULL, NULL, NULL),
-- OVA 3: Cálculo 2
(12, 3, "texto",     "Leitura: Integrais e Aplicações",              NULL, NULL, NULL, 4),
(13, 3, "video",     "Vídeo: Integração — ideia central",            "https://www.youtube.com/watch?v=rfG8ce4nNh0", "youtube", NULL, 4),
(14, 3, "podcast",   "Podcast: Histórias do Cálculo (ep. 2)",        "https://www.soundhelix.com/examples/audio/SoundHelix-Song-3.mp3", "upload", 380, 6),
(15, 3, "quiz",      "Quiz: Cálculo 2",                              NULL, NULL, NULL, NULL),
(16, 3, "atividade", "Atividade prática: modele um problema de otimização", NULL, NULL, NULL, NULL);

-- MELHORIA (OVA personalizada): BANCO DE REMEDIAÇÃO.
-- Recursos extras de reforço, um vídeo + um texto por competência, usados pelo
-- agente para montar a OVA personalizada quando o aluno vai mal naquele assunto.
-- (media_type 'link' = texto externo que o leitor abre em nova aba/embed.)
insert into resources
(resource_id, ova_id, resource_type, resource_title, resource_url, media_type, duration_seconds, competency_id)
values
-- Competência 1 — princípios da computação quântica
(17, 1, "video", "Reforço: Princípios da Computação Quântica em 10 min", "https://www.youtube.com/watch?v=jHoEjvuPoB8", "youtube", NULL, 1),
(18, 1, "texto", "Reforço (texto): O que é computação quântica?",        "https://www.ibm.com/br-pt/topics/quantum-computing", "link", NULL, 1),
-- Competência 2 — aplicações da computação quântica
(19, 1, "video", "Reforço: Aplicações reais da Computação Quântica",     "https://www.youtube.com/watch?v=e3fz3dqhN44", "youtube", NULL, 2),
(20, 1, "texto", "Reforço (texto): Casos de uso da computação quântica", "https://en.wikipedia.org/wiki/Quantum_computing#Applications", "link", NULL, 2),
-- Competência 3 — desafios e limitações
(21, 1, "video", "Reforço: Por que é difícil construir um computador quântico", "https://www.youtube.com/watch?v=g_IaVepNDT4", "youtube", NULL, 3),
(22, 1, "texto", "Reforço (texto): Decoerência e correção de erros",     "https://en.wikipedia.org/wiki/Quantum_decoherence", "link", NULL, 3),
-- Competência 4 — derivadas e integrais
(23, 2, "video", "Reforço: Derivadas do zero (3Blue1Brown)",             "https://www.youtube.com/watch?v=9vKqVkMQHKk", "youtube", NULL, 4),
(24, 2, "texto", "Reforço (texto): Regras de derivação",                 "https://pt.khanacademy.org/math/calculus-1/cs1-derivatives-definition-and-basic-rules", "link", NULL, 4),
-- Competência 5 — limites
(25, 2, "video", "Reforço: Entendendo limites de forma intuitiva",       "https://www.youtube.com/watch?v=kfF40MiS7zA", "youtube", NULL, 5),
(26, 2, "texto", "Reforço (texto): Limites e continuidade",              "https://pt.khanacademy.org/math/calculus-1/cs1-limits-and-continuity", "link", NULL, 5),
-- Competência 6 — máximos e mínimos
(27, 3, "video", "Reforço: Máximos e mínimos com derivadas",             "https://www.youtube.com/watch?v=pInFesXIfg8", "youtube", NULL, 6),
(28, 3, "texto", "Reforço (texto): Otimização e pontos críticos",        "https://pt.khanacademy.org/math/calculus-1/cs1-applications-of-derivatives", "link", NULL, 6);

-- ===========================================================================
-- NOVA DISCIPLINA (roteiro do vídeo, Cena 2): Fundamentos de Computação na Nuvem
-- Disciplina + oferta + OVA + competências + questões + recursos. O leitor de
-- OVA novo renderiza cloud_computing.html automaticamente.
-- ===========================================================================
insert into course_subjects (subject_id, subject_name) values
(3, "Fundamentos de Computação na Nuvem");

insert into offerings (offering_id, course_id, subject_id) values
(3, 1, 3);

insert into ovas (ova_id, ova_name, link, num_interactions, subject_id) values
(4, "Fundamentos de Computação na Nuvem", "cloud_computing.html", 0, 3);

insert into competencies (competency_id, competency_description, subject_id) values
(7, "Compreender os modelos de serviço da computação em nuvem (IaaS, PaaS, SaaS)", 3),
(8, "Distinguir os modelos de implantação: nuvem pública, privada e híbrida", 3),
(9, "Reconhecer benefícios econômicos e desafios de segurança da nuvem", 3);

insert into questions (question_id, statement, alternatives, answer, ova_id, competency_id) values
(27, "Qual modelo de serviço entrega máquinas virtuais, rede e armazenamento, deixando o sistema operacional e as aplicações sob responsabilidade do cliente?",
'{ "alternatives": ["SaaS", "PaaS", "IaaS", "On-premise"] }', "c", 4, 7),
(28, "No modelo SaaS, o que o cliente normalmente gerencia?",
'{ "alternatives": ["A infraestrutura física", "O sistema operacional dos servidores", "Apenas o uso da aplicação", "O ambiente de execução"] }', "c", 4, 7),
(29, "Como se chama o modelo de implantação que combina nuvem pública e privada?",
'{ "alternatives": ["Nuvem comunitária", "Nuvem híbrida", "Nuvem dedicada", "Multi-tenant"] }', "b", 4, 8),
(30, "Uma vantagem da nuvem pública em relação à privada é:",
'{ "alternatives": ["Maior controle sobre o hardware", "Menor custo inicial e maior elasticidade", "Isolamento físico garantido", "Dispensar a internet"] }', "b", 4, 8),
(31, "Qual modelo econômico caracteriza a computação na nuvem?",
'{ "alternatives": ["Licença perpétua", "Pagamento pelo uso (pay-as-you-go)", "Compra de servidores físicos", "Assinatura vitalícia obrigatória"] }', "b", 4, 9),
(32, "No modelo de responsabilidade compartilhada, quem configura acessos e criptografa os dados?",
'{ "alternatives": ["Somente o provedor de nuvem", "O cliente", "O fornecedor de internet", "Ninguém"] }', "b", 4, 9),
(33, "Um desenvolvedor precisa criar e implantar uma aplicação web rapidamente, focando exclusivamente no código-fonte e na lógica de negócios, sem gerenciar servidores, patches de sistema operacional ou balanceadores de carga. Qual modelo de serviço em nuvem atende a essa necessidade?",
'{ "alternatives": ["IaaS (Infraestrutura como Serviço)", "PaaS (Plataforma como Serviço)", "SaaS (Software como Serviço)", "DaaS (Desktop como Serviço)"] }', "b", 4, 7),
(34, "Ao comparar os três modelos de serviço em nuvem (IaaS, PaaS e SaaS), em qual deles o cliente retém o MAIOR nível de controle sobre a configuração de rede, sistema operacional e instalação de bibliotecas?",
'{ "alternatives": ["SaaS", "PaaS", "IaaS", "O controle do cliente é idêntico nos três modelos"] }', "c", 4, 7),
(35, "Um hospital público armazena prontuários médicos altamente sensíveis e é obrigado por normas rígidas de soberania e proteção de dados a manter isolamento físico completo e controle exclusivo sobre o hardware. Qual modelo de implantação de nuvem é o mais indicado?",
'{ "alternatives": ["Nuvem Pública multilocatária (multi-tenant)", "Nuvem Privada (dedicada on-premise ou hospedada)", "Nuvem Comunitária aberta", "Nuvem de borda pública não gerenciada"] }', "b", 4, 8),
(36, "Uma instituição de ensino mantém seus bancos de dados e cadastros confidenciais em data center interno próprio, mas, durante a semana de matrículas e vestibulares (quando o tráfego multiplica por 20), expande temporariamente os servidores de aplicação para a nuvem pública. Como se chama essa estratégia?",
'{ "alternatives": ["Nuvem Privada Estática", "Nuvem Híbrida com expansão sob demanda (cloud bursting)", "Hospedagem Compartilhada Legada", "Nuvem Pública Monolítica"] }', "b", 4, 8),
(37, "Do ponto de vista contábil e de planejamento financeiro, qual é a principal vantagem da migração de infraestrutura física local para a computação em nuvem?",
'{ "alternatives": ["Substituição de grandes investimentos iniciais em bens de capital (CapEx) por custos operacionais contínuos sob demanda (OpEx)", "Garantia de que a fatura mensal será imutável e fixa, independentemente do consumo real", "Transferência compulsória de 100% da responsabilidade legal dos dados para o provedor", "Eliminação total da necessidade de profissionais especializados em TI"] }', "a", 4, 9),
(38, "Incidentes de segurança na nuvem (como vazamentos de credenciais e acessos indevidos) ocorrem com frequência devido a falhas de governança do cliente. Para mitigar esses riscos e proteger dados de estudantes sob leis como LGPD/GDPR, qual é a prática recomendada?",
'{ "alternatives": ["Utilizar a conta raiz (root/admin) para todas as tarefas cotidianas da equipe", "Aplicar o princípio do menor privilégio (PoLP) e autenticação multifator (MFA) obrigatória", "Manter chaves permanentes de API gravadas diretamente no código-fonte", "Desativar a criptografia em repouso para acelerar requisições"] }', "b", 4, 9);

-- Recursos do OVA 4 (consumo rastreado pelos players)
insert into resources
(resource_id, ova_id, resource_type, resource_title, resource_url, media_type, duration_seconds, competency_id)
values
(29, 4, "texto",     "Leitura: O que é Computação na Nuvem",          NULL, NULL, NULL, 7),
(30, 4, "video",     "Vídeo: Computação em nuvem explicada",          "https://www.youtube.com/watch?v=97l0Ahu2efE", "youtube", NULL, 7),
(31, 4, "podcast",   "Podcast: Nuvem na prática (ep. 1)",             "https://www.soundhelix.com/examples/audio/SoundHelix-Song-4.mp3", "upload", 360, 8),
(32, 4, "quiz",      "Quiz: Computação na Nuvem",                     NULL, NULL, NULL, NULL),
(33, 4, "atividade", "Atividade prática: suba uma VM gratuita na AWS/Azure", NULL, NULL, NULL, NULL),
-- Banco de remediação por competência (usado pelo agente de OVA de reforço)
(34, 4, "video", "Reforço: IaaS, PaaS e SaaS em 5 minutos",          "https://www.youtube.com/watch?v=N0SYCyS2xZA", "youtube", NULL, 7),
(35, 4, "texto", "Reforço (texto): O que é computação em nuvem (AWS)", "https://aws.amazon.com/pt/what-is-cloud-computing/", "link", NULL, 7),
(36, 4, "video", "Reforço: Nuvem pública, privada e híbrida",        "https://www.youtube.com/watch?v=ymZo-ZwXFw8", "youtube", NULL, 8),
(37, 4, "texto", "Reforço (texto): Microsoft Azure (portal)", "https://azure.microsoft.com/pt-br", "link", NULL, 8),
(38, 4, "video", "Reforço: Segurança e responsabilidade compartilhada", "https://www.youtube.com/watch?v=97l0Ahu2efE", "youtube", NULL, 9),
(39, 4, "texto", "Reforço (texto): Dicionário — o que é computação em nuvem (Azure)", "https://azure-microsoft-com.translate.goog/en-us/resources/cloud-computing-dictionary/what-is-cloud-computing?_x_tr_sl=en&_x_tr_tl=pt&_x_tr_hl=pt&_x_tr_pto=tc", "link", NULL, 9);

-- MELHORIA (Roteiro Cena 4): papéis. Gabriel (RA 2) vira TUTOR; Sanval (RA 4),
-- que já era admin, recebe o papel 'admin'. Os demais ficam 'aluno' (default).
update students set role = 'tutor' where student_id = 2;
update students set role = 'aluno', is_admin = false where student_id = 4;

-- NOTA: sem seed de atividade — a demo começa do ZERO. O aluno faz o OVA ao
-- vivo (lê, assiste, responde o quiz) e, ao errar questões, o agente EduBot
-- passa a recomendar a OVA de reforço (quiz extra) daquela competência.

# -*- coding: utf-8 -*-
"""Validador Ponta a Ponta do Plano B (Modo Offline + Mock Determinístico).

Verifica em < 2 segundos se todas as cenas da demonstração do Hackathon
funcionam perfeitamente sem internet e sem chamadas externas de LLM/Polly/Crossref.
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Força ambiente do Plano B (Offline + Mock + Sem Polly externo)
os.environ["EDUBOT_LLM_PROVIDER"] = "mock"
os.environ["EDUBOT_OFFLINE"] = "1"
os.environ["EDUBOT_SPEECH"] = "off"

from edubot.agent import llm
llm.PROVIDER = "mock"

from edubot.api.app import app
from edubot.data.models.interventions import Interventions
from edubot.data.models.personalized_ova import PersonalizedOVA, PersonalizedOVAItem
from edubot.data.models.agent_decisions import AgentDecisions


def run_verification():
    t0 = time.time()
    print("=" * 72)
    print("  VERIFICACAO DO PLANO B — MODO OFFLINE + MOCK DETERMINISTICO (EDUBOT)")
    print("=" * 72)

    with app.app_context():
        client = app.test_client()

        # 1. Testar Login dos 6 acessos da Demo
        print("\n[Cena 1] Testando autenticacao dos 6 perfis de demonstracao...")
        credenciais = [
            ("1", "1", "Eduardo (Bom Desempenho)"),
            ("2", "2", "Gabriel (Tutor)"),
            ("3", "3", "Yasmin (Medio Desempenho)"),
            ("4", "4", "Sanval (Coordenador/Admin)"),
            ("5", "5", "Pedro (Risco Critico)"),
            ("6", "6", "Thiago (Perfil Zerado)"),
        ]
        tokens = {}
        for login_val, pwd_val, label in credenciais:
            r = client.post("/login", json={"ra": login_val, "password": pwd_val})
            assert r.status_code == 200, f"Falha no login de {label}: HTTP {r.status_code} -> {r.get_data(as_text=True)}"
            data = json.loads(r.get_data(as_text=True))
            row = data[0] if isinstance(data, list) else data
            assert row.get("token"), f"Token ausente para {label}"
            tokens[login_val] = row["token"]
            print(f"  [OK] {label:32s} -> id={row.get('student')} | role={row.get('role')}")

        # 2. Testar Perfis Calibrados (/student/me)
        print("\n[Cena 2] Verificando estado calibrado dos perfis (/student/me)...")
        for login_val, label in [("1", "Eduardo"), ("3", "Yasmin"), ("5", "Pedro"), ("6", "Thiago")]:
            t_req = time.time()
            r = client.get("/student/me", headers={"Authorization": f"Bearer {tokens[login_val]}"})
            dt_ms = (time.time() - t_req) * 1000
            assert r.status_code == 200, f"Erro em /student/me para {label}"
            p = json.loads(r.get_data(as_text=True))
            consumo = p.get("recursos", {}).get("percentual_consumido")
            erro = p.get("quiz", {}).get("taxa_erro")
            print(f"  [OK] {label:10s} ({dt_ms:5.1f} ms) -> consumo={consumo}% | taxa_erro_quiz={erro}")

        # 3. Testar Chat Tutor Socratico, Recomendacao, Coach e Voz em Modo Offline/Mock
        print("\n[Cena 3] Testando IA em Modo Mock Offline (Chat, Recomendacao, Coach, Voz)...")
        h_yasmin = {"Authorization": f"Bearer {tokens['3']}"}

        t_req = time.time()
        r_chat = client.post("/edubot/tutor-chat", headers=h_yasmin, json={
            "ova_id": 1,
            "messages": [{"role": "user", "content": "O que e um qubit e como funciona a superposicao?"}],
            "context": "## Qubits e Superposicao\nUm qubit pode existir em uma combinacao linear dos estados 0 e 1 simultaneamente gracas a superposicao quantica.",
            "persona": "einstein"
        })
        chat_ms = (time.time() - t_req) * 1000
        assert r_chat.status_code == 200
        d_chat = json.loads(r_chat.get_data(as_text=True))
        assert d_chat.get("mock") is True
        print(f"  [OK] POST /edubot/tutor-chat ({chat_ms:5.1f} ms) [mock={d_chat.get('mock')}] -> {d_chat.get('reply', '')[:75]}...")

        t_req = time.time()
        r_rec = client.get("/edubot/recommendation", headers=h_yasmin)
        rec_ms = (time.time() - t_req) * 1000
        assert r_rec.status_code == 200
        d_rec = json.loads(r_rec.get_data(as_text=True))
        rec_obj = d_rec.get("recommendation") or d_rec.get("recomendacao") or {}
        print(f"  [OK] GET  /edubot/recommendation ({rec_ms:5.1f} ms) [mock={rec_obj.get('mock')}] -> tipo={rec_obj.get('tipo')}")

        t_req = time.time()
        r_speech = client.post("/edubot/speak", headers=h_yasmin, json={"text": "Olá Yasmin!", "lang": "pt"})
        speech_ms = (time.time() - t_req) * 1000
        assert r_speech.status_code == 200
        d_speech = json.loads(r_speech.get_data(as_text=True))
        print(f"  [OK] POST /edubot/speak ({speech_ms:5.1f} ms) -> available={d_speech.get('available')} (fallback Web Speech instantaneo, sem travar na rede)")

        # 4. Testar Loop de Tool-Use (OVA Personalizada) + Artigos Cientificos Offline
        print("\n[Cena 4] Testando Loop de Tool-Use (OVA Personalizada Mock) e Artigos Offline...")
        r_ova = client.post("/edubot/personalized-ova", headers=h_yasmin, json={"competency_id": 1})
        ova_ms = (time.time() - t_req) * 1000
        assert r_ova.status_code in (200, 201), f"Erro em /edubot/personalized-ova: {r_ova.status_code}"
        d_ova = json.loads(r_ova.get_data(as_text=True))
        p_id = d_ova.get("personalized_ova_id")
        assert p_id is not None, "personalized_ova_id nao gerado no modo mock!"
        print(f"  [OK] POST /edubot/personalized-ova ({ova_ms:5.1f} ms) -> id={p_id} | mock={d_ova.get('mock')} | iteracoes={d_ova.get('iteracoes')}")

        # Limpar OVA temporaria criada durante o teste (mantendo a OVA original da Yasmin intacta)
        PersonalizedOVAItem.delete().where(PersonalizedOVAItem.personalized_ova_id == p_id).execute()
        PersonalizedOVA.delete().where(PersonalizedOVA.personalized_ova_id == p_id).execute()
        AgentDecisions.delete().where((AgentDecisions.student_id == 3) & (AgentDecisions.mock == True)).execute()
        Interventions.delete().where((Interventions.student_id == 3) & (Interventions.description.contains("Modo mock"))).execute()

        t_req = time.time()
        r_ext = client.get("/edubot/external-resources?competency_id=1", headers=h_yasmin)
        ext_ms = (time.time() - t_req) * 1000
        assert r_ext.status_code == 200
        d_ext = json.loads(r_ext.get_data(as_text=True))
        artigos = d_ext.get("resultados") or []
        assert len(artigos) >= 3, "Catalogo offline de artigos cientificos nao retornou itens!"
        print(f"  [OK] GET  /edubot/external-resources ({ext_ms:5.1f} ms) -> {len(artigos)} artigos curados offline ('{artigos[0]['titulo'][:50]}...')")

        # 5. Testar Painel do Tutor e Painel do Gestor
        print("\n[Cena 5] Testando Painel do Tutor e Coordenador/Gestor...")
        h_admin = {"Authorization": f"Bearer {tokens['4']}"}
        t_req = time.time()
        r_tut = client.get("/tutor/overview", headers=h_admin)
        tut_ms = (time.time() - t_req) * 1000
        assert r_tut.status_code == 200
        d_tut = json.loads(r_tut.get_data(as_text=True))
        print(f"  [OK] GET  /tutor/overview ({tut_ms:5.1f} ms) -> alunos_em_risco={d_tut.get('resumo', {}).get('alunos_em_risco')} | alertas_abertos={len(d_tut.get('alertas', []))}")

    total_ms = (time.time() - t0) * 1000
    print("\n" + "=" * 72)
    print(f"  SUCESSO TOTAL! Plano B (Offline + Mock) validado em {total_ms:.0f} ms.")
    print("=" * 72)


if __name__ == "__main__":
    run_verification()

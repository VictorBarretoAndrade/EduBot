# MELHORIA (4.1/4.2) — Persistência do rastreamento de consumo.
#
# Antes destas rotas, read_time/perc_scrolled ficavam apenas no localStorage do
# navegador e as tabelas ova_progress/resource_progress nunca eram escritas.
# Estas rotas fecham o ciclo frontend -> backend -> banco:
#
#   GET  /ova/<id>/resources   -> recursos do OVA + progresso do aluno logado
#   POST /progress/ova         -> upsert de leitura/scroll/conclusão do OVA
#   POST /progress/resource    -> upsert de consumo de um recurso (vídeo/podcast/atividade)
#
# Todas exigem o token emitido no login (@require_auth) — o aluno é resolvido
# do token (g.student), nunca do payload, para impedir escrita em nome de outro.

from flask import Blueprint, request, g
from flask_cors import cross_origin
from edubot.api.http import get_payload
from peewee import PeeweeException, fn
import json
import datetime

from edubot.data.models.ovas import OVAs
from edubot.data.models.resources import Resources
from edubot.data.models.ova_progress import OVAProgress
from edubot.data.models.resource_progress import ResourceProgress

from edubot.api.auth import require_auth
from edubot.api.http import get_lang
from edubot.i18n import tr
from edubot.services.proactivity import trigger_evaluation
from edubot.services.events import emit as emit_event

app_progress = Blueprint("progress", __name__)


# Lists every resource of an OVA along with the logged student's progress.
# The frontend uses this to render the media section (video/audio players).
@app_progress.route("/ova/<int:ova_id>/resources", methods=["GET"])
@cross_origin()
@require_auth
def ova_resources(ova_id):
    try:
        lang = get_lang()
        resource_list = []
        for resource in Resources.select().where(Resources.ova_id == ova_id):
            rp = ResourceProgress.get_or_none(
                (ResourceProgress.student_id == g.student) &
                (ResourceProgress.resource_id == resource.resource_id))
            resource_list.append({
                "resource_id": resource.resource_id,
                "resource_type": resource.resource_type,
                "resource_title": tr(resource.resource_title, resource.resource_title_en, lang),
                "resource_url": resource.resource_url,
                "media_type": resource.media_type,
                "duration_seconds": resource.duration_seconds,
                "perc_consumed": rp.perc_consumed if rp else 0,
                "seconds_consumed": rp.seconds_consumed if rp else 0,
                "completed": bool(rp.completed) if rp else False
            })
        return json.dumps(resource_list), 200
    except PeeweeException as err:
        return json.dumps({"Error": f"{err}"}), 500


# Upserts the per-OVA reading progress.
#
# CONTRATO NOVO (A1) — tempo de leitura por DELTA, acumulado no servidor:
#   seconds_delta : segundos lidos DESDE o último sync (o servidor SOMA).
# O front envia o delta a cada ~15s e um último no unload. Antes o front
# mandava o tempo ABSOLUTO da sessão e o backend fazia max(): ler 10min hoje e
# 10min amanhã registrava 10min (a maior sessão), não 20 — a métrica central do
# rastreamento era estruturalmente errada.
#
# `read_time` (absoluto) ainda é aceito como caminho legado (leitor jQuery, que
# manda o valor absoluto): sem seconds_delta, cai no max() antigo até o legado
# ser aposentado (Fase 5). perc_scrolled continua sendo marca d'água (max).
@app_progress.route("/progress/ova", methods=["POST"])
@cross_origin()
@require_auth
def save_ova_progress():
    try:
        data = get_payload()
        ova = OVAs.get_or_none(OVAs.ova_id == data["ova_id"])
        if ova is None:
            return json.dumps({"Error": "Unknown ova_id"}), 400

        progress = OVAProgress.get_or_none(
            (OVAProgress.student_id == g.student) & (OVAProgress.ova_id == ova))
        was_completed = bool(progress.completed) if progress else False
        # delta é o caminho novo; read_time absoluto é o legado
        try:
            seconds_delta = data.get("seconds_delta")
            seconds_delta = max(0, int(seconds_delta)) if seconds_delta is not None else None
            read_time_abs = int(data.get("read_time", 0) or 0)
            perc_scrolled = min(100, int(data.get("perc_scrolled", 0) or 0))
        except (TypeError, ValueError):
            return json.dumps({"Error": "Campos numéricos inválidos"}), 400
        completed = bool(data.get("completed", False))

        if progress is None:
            initial_read = seconds_delta if seconds_delta is not None else read_time_abs
            OVAProgress.create(
                student_id=g.student, ova_id=ova,
                read_time=initial_read, perc_scrolled=perc_scrolled,
                completed=completed, last_access=datetime.datetime.now())
        else:
            # A.6: a acumulação de read_time é feita NO BANCO
            # (COALESCE(read_time,0) + delta), não em Python. Antes era
            # read-modify-write: dois syncs concorrentes (ex.: duas abas do mesmo
            # aluno) liam o mesmo valor e um sobrescrevia o outro, perdendo um
            # delta. COALESCE mantém a portabilidade SQLite/MySQL (evita NULL+n).
            # perc_scrolled/completed seguem por max do pré-read: uma corrida só
            # atrasa a marca d'água, que o próximo sync corrige (auto-heal).
            updates = {
                OVAProgress.perc_scrolled: max(progress.perc_scrolled or 0, perc_scrolled),
                OVAProgress.completed: bool(progress.completed) or completed,
                OVAProgress.last_access: datetime.datetime.now(),
            }
            if seconds_delta is not None:
                # acumula (contrato novo) — atômico
                updates[OVAProgress.read_time] = fn.COALESCE(OVAProgress.read_time, 0) + seconds_delta
            else:
                # legado: valor absoluto, nunca retrocede
                updates[OVAProgress.read_time] = max(progress.read_time or 0, read_time_abs)
            (OVAProgress
             .update(updates)
             .where((OVAProgress.student_id == g.student) & (OVAProgress.ova_id == ova))
             .execute())

        # A13 — proatividade por evento: ao CONCLUIR um OVA (transição), o agente
        # reavalia o aluno e pode empurrar o próximo passo (ex.: quiz pendente,
        # trilha mínima) sem esperar clique. Só na transição, não a cada delta,
        # para não repetir a montagem cara do perfil (A9).
        now_completed = completed or perc_scrolled >= 90
        if now_completed and not was_completed:
            # D.1 — `completed` na transição de conclusão: alimenta a contagem
            # por verbo e a janela de engajamento do outcome (B.6).
            emit_event(g.student, "completed", "ova", ova.ova_id,
                       perc=perc_scrolled)
            trigger_evaluation(g.student, lang=get_lang(), trigger_type="ova_completed")
            # G.1 (Plano 2) — concluir um módulo é esforço: concede XP (1x por
            # OVA/dia). Best-effort, flag-guarded dentro de award.
            try:
                from edubot.services.gamification import award, check_achievements
                award(g.student.student_id, "modulo_concluido", "ova", ova.ova_id)
                check_achievements(g.student.student_id)
            except Exception:
                pass
        # G.3 — ler/estudar conta para a sequência (dia de estudo), independentemente
        # de concluir. Idempotente por dia; best-effort.
        try:
            from edubot.services.gamification import register_daily_activity
            register_daily_activity(g.student.student_id)
        except Exception:
            pass
        return json.dumps("Progress saved"), 200
    except PeeweeException as err:
        return json.dumps({"Error": f"{err}"}), 500


# Upserts the consumption of one resource:
#   video    -> perc_consumed (% watched) + completed
#   podcast  -> seconds_consumed (listening time) + perc/completed when known
#   atividade-> completed (checklist button)
@app_progress.route("/progress/resource", methods=["POST"])
@cross_origin()
@require_auth
def save_resource_progress():
    try:
        data = get_payload()
        resource = Resources.get_or_none(Resources.resource_id == data["resource_id"])
        if resource is None:
            return json.dumps({"Error": "Unknown resource_id"}), 400

        rp = ResourceProgress.get_or_none(
            (ResourceProgress.student_id == g.student) &
            (ResourceProgress.resource_id == resource))
        perc = min(100, int(data.get("perc_consumed", 0) or 0))
        seconds = int(data.get("seconds_consumed", 0) or 0)
        completed = bool(data.get("completed", False))

        if rp is None:
            ResourceProgress.create(
                student_id=g.student, resource_id=resource,
                perc_consumed=perc, seconds_consumed=seconds,
                completed=completed, last_access=datetime.datetime.now())
        else:
            rp.perc_consumed = max(rp.perc_consumed or 0, perc)
            rp.seconds_consumed = max(rp.seconds_consumed or 0, seconds)
            rp.completed = rp.completed or completed
            rp.last_access = datetime.datetime.now()
            rp.save()
        return json.dumps("Resource progress saved"), 200
    except PeeweeException as err:
        return json.dumps({"Error": f"{err}"}), 500

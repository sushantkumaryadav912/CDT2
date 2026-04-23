from __future__ import annotations

import networkx as nx

from backend.core.models import CAREER_FRAMES, GOAL_NODE_MAP, StudentProfile, student_from_input
from backend.services.agent import simulate_monitoring
from backend.services.expert import ExpertSystem, FOLReasoner
from backend.services.ml import ModelArtifactError, predict
from backend.services.nlp import compare_bow_tfidf, process_text
from backend.services.search import AcademicSearchEngine


def _knowledge_graph_skills(student: StudentProfile, skills: list[str]) -> dict:
    career = CAREER_FRAMES.get(student.goal)
    required = career.required_skills if career else []
    return {
        "career_required_skills": required,
        "student_has": skills,
        "skill_gaps": [skill for skill in required if skill not in skills],
    }


def _build_semantic_network_summary() -> dict:
    graph = nx.DiGraph()
    for career, frame in CAREER_FRAMES.items():
        graph.add_node(career, type="career", avg_salary=frame.avg_salary)
        for skill in frame.required_skills:
            graph.add_node(skill, type="skill")
            graph.add_edge(career, skill, relation="requires", weight=0.8)
        for subject in frame.required_subjects:
            graph.add_node(subject, type="subject")
            graph.add_edge(subject, career, relation="leads_to", weight=0.9)
    return {
        "nodes": graph.number_of_nodes(),
        "edges": graph.number_of_edges(),
        "careers": list(CAREER_FRAMES.keys()),
    }


SEMANTIC_NETWORK_SUMMARY = _build_semantic_network_summary()
FOL_REASONER = FOLReasoner(CAREER_FRAMES)
SEARCH_ENGINE = AcademicSearchEngine()
EXPERT_SYSTEM = ExpertSystem()


def _nlp_corpus(student: StudentProfile) -> list[str]:
    corpus = [student.resume_text]
    for frame in CAREER_FRAMES.values():
        corpus.append(" ".join(frame.required_skills + frame.required_subjects))
    return [doc for doc in corpus if (doc or "").strip()]


def run_cdt_pipeline(student_input: dict) -> dict:
    student = student_from_input(student_input)
    nlp_result = process_text(student.resume_text)
    bow_tfidf = compare_bow_tfidf(_nlp_corpus(student), student.resume_text)
    ml_result = predict(student)

    fol_trace = FOL_REASONER.evaluate(student)
    fol_conclusions = [
        {
            "rule": item["rule"],
            "conclusion": item["conclusion"],
            "explanation": item["explanation"],
        }
        for item in fol_trace
    ]

    goal_node = GOAL_NODE_MAP.get(student.goal, "Data Scientist Goal")
    astar = SEARCH_ENGINE.a_star("Start", goal_node)
    bfs = SEARCH_ENGINE.bfs("Start", goal_node)
    dfs = SEARCH_ENGINE.dfs("Start", goal_node)

    expert_result = EXPERT_SYSTEM.infer(student)
    agent_weeks = simulate_monitoring(student, EXPERT_SYSTEM)
    skills = nlp_result["extracted_skills"]

    return {
        "student": student.name,
        "student_id": student.student_id,
        "career": student.goal,
        "input": student_input,
        "nlp": {
            "extracted_skills": skills,
            "token_count": nlp_result["token_count"],
            "tokens_sample": nlp_result["tokens_sample"],
            "tokens": {
                "raw": nlp_result["tokens_raw"],
                "alpha": nlp_result["tokens_alpha"],
                "no_stop": nlp_result["tokens_no_stop"],
                "lemma": nlp_result["tokens_lemma"],
            },
            "pos_tags": nlp_result["pos_tags"],
            "bigrams": nlp_result["bigrams"][:10],
            "trigrams": nlp_result["trigrams"][:10],
            "ngrams": {
                "bigrams": nlp_result["bigrams"][:10],
                "trigrams": nlp_result["trigrams"][:10],
            },
            "clean_text": nlp_result["clean_text"][:100] + ("..." if len(nlp_result["clean_text"]) > 100 else ""),
            "bow_tfidf": bow_tfidf,
        },
        "ml": ml_result,
        "fol": {
            "conclusions": fol_conclusions,
            "rules_fired": len(fol_trace),
            "trace": fol_trace,
        },
        "roadmap": {
            "path": astar["path"],
            "total_cost": astar["total_cost"],
            "steps": len(astar["path"]),
            "bfs_path": bfs["path"],
            "dfs_path": dfs["path"],
            "astar_trace": astar["trace"],
            "bfs_explored": bfs["explored"],
            "dfs_explored": dfs["explored"],
        },
        "expert": expert_result,
        "knowledge_graph": {
            **_knowledge_graph_skills(student, skills),
            "semantic_network": SEMANTIC_NETWORK_SUMMARY,
        },
        "agent": {"weeks": agent_weeks},
    }


def validate_pipeline() -> None:
    sample_input = {
        "name": "Validation Student",
        "cgpa": 7.4,
        "attendance": 82,
        "study_hours_per_week": 24,
        "assignment_score": 71,
        "exam_score": 69,
        "sleep_hours": 6.4,
        "extracurricular": 1,
        "mental_health_score": 6.8,
        "library_visits": 4,
        "online_course_hours": 2.5,
        "peer_study_sessions": 2,
        "semester": 4,
        "goal": "Data Scientist",
        "resume_text": "Python SQL statistics machine learning projects",
    }
    output = run_cdt_pipeline(sample_input)
    assert "career" in output
    assert "ml" in output
    assert "expert" in output


__all__ = ["ModelArtifactError", "run_cdt_pipeline", "validate_pipeline"]

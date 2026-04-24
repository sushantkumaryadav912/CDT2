from __future__ import annotations

import re
from functools import lru_cache
from typing import Any

from nltk import pos_tag
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from nltk.tokenize import word_tokenize
from nltk.util import ngrams
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer

from core.models import SKILL_POOL


@lru_cache(maxsize=1)
def _stop_words() -> set[str]:
    try:
        return set(stopwords.words("english"))
    except LookupError:
        return {
            "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
            "has", "in", "is", "it", "of", "on", "or", "that", "the", "to",
            "was", "were", "with",
        }


@lru_cache(maxsize=1)
def _lemmatizer() -> WordNetLemmatizer:
    return WordNetLemmatizer()


def _tokenize(text: str) -> list[str]:
    try:
        return word_tokenize(text.lower())
    except LookupError:
        return re.findall(r"[a-z]+", text.lower())


def _lemmatize(token: str) -> str:
    try:
        return _lemmatizer().lemmatize(token)
    except LookupError:
        return token


def _pos_tags(tokens: list[str]) -> list[tuple[str, str]]:
    try:
        return pos_tag(tokens)
    except LookupError:
        return [(token, "UNK") for token in tokens]


def extract_skills(text: str, skill_pool: list[str] | None = None) -> list[str]:
    source = text or ""
    matched_skills = []
    for skill in (skill_pool or SKILL_POOL):
        escaped = re.escape(skill)
        pattern = rf"\b{escaped}\b"
        if re.search(pattern, source, flags=re.IGNORECASE):
            matched_skills.append(skill)
            continue
        # Fallback for skills containing punctuation like C++ where \b can miss terminal boundaries.
        alt_pattern = rf"(?<!\w){escaped}(?!\w)"
        if re.search(alt_pattern, source, flags=re.IGNORECASE):
            matched_skills.append(skill)
    return matched_skills


def process_text(text: str) -> dict[str, Any]:
    tokens_raw = _tokenize(text)
    tokens_alpha = [token for token in tokens_raw if token.isalpha()]
    stop_words = _stop_words()
    tokens_no_stop = [token for token in tokens_alpha if token not in stop_words]
    tokens_lemma = [_lemmatize(token) for token in tokens_no_stop]
    bigrams = [" ".join(pair) for pair in ngrams(tokens_lemma, 2)]
    trigrams = [" ".join(group) for group in ngrams(tokens_lemma, 3)]

    return {
        "original": text,
        "tokens_raw": tokens_raw,
        "tokens_alpha": tokens_alpha,
        "tokens_no_stop": tokens_no_stop,
        "tokens_lemma": tokens_lemma,
        "tokens_sample": tokens_lemma[:12],
        "pos_tags": [{"token": token, "tag": tag} for token, tag in _pos_tags(tokens_alpha)],
        "bigrams": bigrams,
        "trigrams": trigrams,
        "clean_text": " ".join(tokens_lemma),
        "token_count": len(tokens_lemma),
        "extracted_skills": extract_skills(text),
    }


def compare_bow_tfidf(corpus: list[str], text: str, top_n: int = 10) -> list[dict[str, float | str]]:
    if not (text or "").strip():
        return []

    clean_corpus = [process_text(doc)["clean_text"] for doc in corpus if (doc or "").strip()]
    clean_corpus = [doc for doc in clean_corpus if doc.strip()]
    clean_text = process_text(text)["clean_text"]
    if not clean_corpus or not clean_text.strip():
        return []

    bow = CountVectorizer(max_features=100)
    tfidf = TfidfVectorizer(max_features=100)
    try:
        bow.fit(clean_corpus)
        tfidf.fit(clean_corpus)
    except ValueError:
        return []

    bow_vec = bow.transform([clean_text]).toarray()[0]
    tfidf_vec = tfidf.transform([clean_text]).toarray()[0]

    words = sorted(set(bow.get_feature_names_out()) | set(tfidf.get_feature_names_out()))
    bow_index = {word: i for i, word in enumerate(bow.get_feature_names_out())}
    tfidf_index = {word: i for i, word in enumerate(tfidf.get_feature_names_out())}
    rows = []
    for word in words:
        bow_score = float(bow_vec[bow_index[word]]) if word in bow_index else 0.0
        tfidf_score = float(tfidf_vec[tfidf_index[word]]) if word in tfidf_index else 0.0
        if bow_score or tfidf_score:
            rows.append({"word": word, "bow": int(bow_score), "tfidf": round(tfidf_score, 4)})
    return sorted(rows, key=lambda row: (-float(row["tfidf"]), -int(row["bow"])))[:top_n]

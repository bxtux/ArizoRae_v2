"""Verify that model_for() returns the expected model for each workflow and provider."""
import pytest
from app.sdk_client import WORKFLOW_MODELS, OPENAI_WORKFLOW_MODELS, model_for


CLAUDE_EXPECTED = {
    "init":           "claude-opus-4-7",
    "recherche":      "claude-opus-4-7",
    "scraper_gen":    "claude-sonnet-4-6",
    "scraper_demo":   "claude-haiku-4-5",
    "scraper_adapt":  "claude-sonnet-4-6",
    "analyse":        "claude-sonnet-4-6",
    "cv":             "claude-sonnet-4-6",
    "lettre":         "claude-sonnet-4-6",
    "entretien":      "claude-opus-4-7",
    "mark_applied":   "claude-haiku-4-5",
    "chat":           "claude-haiku-4-5",
    "chat_escalated": "claude-sonnet-4-6",
}

OPENAI_EXPECTED = {
    "init":           "gpt-4o",
    "recherche":      "gpt-4o",
    "scraper_gen":    "gpt-4o",
    "scraper_demo":   "gpt-4o-mini",
    "scraper_adapt":  "gpt-4o",
    "analyse":        "gpt-4o",
    "cv":             "gpt-4o",
    "lettre":         "gpt-4o",
    "entretien":      "gpt-4o",
    "mark_applied":   "gpt-4o-mini",
    "chat":           "gpt-4o-mini",
    "chat_escalated": "gpt-4o",
}


@pytest.mark.parametrize("workflow,expected", CLAUDE_EXPECTED.items())
def test_claude_model_routing(workflow, expected):
    assert model_for(workflow, "claude") == expected


@pytest.mark.parametrize("workflow,expected", OPENAI_EXPECTED.items())
def test_openai_model_routing(workflow, expected):
    assert model_for(workflow, "openai") == expected


def test_workflow_models_table_complete():
    """WORKFLOW_MODELS must have an entry for every workflow in CLAUDE_EXPECTED."""
    for wf in CLAUDE_EXPECTED:
        assert wf in WORKFLOW_MODELS, f"Missing workflow '{wf}' in WORKFLOW_MODELS"


def test_openai_workflow_models_table_complete():
    """OPENAI_WORKFLOW_MODELS must have an entry for every workflow in OPENAI_EXPECTED."""
    for wf in OPENAI_EXPECTED:
        assert wf in OPENAI_WORKFLOW_MODELS, f"Missing workflow '{wf}' in OPENAI_WORKFLOW_MODELS"


def test_default_provider_is_claude():
    """model_for() defaults to claude when no provider specified."""
    assert model_for("chat") == WORKFLOW_MODELS["chat"]

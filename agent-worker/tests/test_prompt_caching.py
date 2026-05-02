"""Verify that build_cached_system() returns blocks with cache_control ephemeral."""
import uuid
from pathlib import Path
from unittest.mock import patch

import pytest
from app.sdk_client import build_cached_system, build_system_text


FAKE_SKILL_MD = "# SKILL\n\nSome skill content."
FAKE_FACTS = "# FACTS.md\n\nCandidate facts."
FAKE_BULLETS = "# BULLET_LIBRARY.md\n\nBullets."
FAKE_PRESET = "# preset.md\n\nPreset content."
FAKE_PROFILE = f"{FAKE_FACTS}\n\n---\n\n{FAKE_BULLETS}\n\n---\n\n{FAKE_PRESET}"

USER_ID = uuid.uuid4()


@pytest.fixture
def mock_skill_and_profile():
    with (
        patch("app.skill_loader.skill_md", return_value=FAKE_SKILL_MD),
        patch("app.fs.user_profile_blob", return_value=FAKE_PROFILE),
    ):
        yield


def test_build_cached_system_returns_two_blocks(mock_skill_and_profile):
    blocks = build_cached_system(USER_ID)
    assert len(blocks) == 2, f"Expected 2 blocks, got {len(blocks)}"


def test_build_cached_system_first_block_is_skill(mock_skill_and_profile):
    blocks = build_cached_system(USER_ID)
    assert blocks[0]["text"] == FAKE_SKILL_MD


def test_build_cached_system_second_block_is_profile(mock_skill_and_profile):
    blocks = build_cached_system(USER_ID)
    assert blocks[1]["text"] == FAKE_PROFILE


def test_build_cached_system_all_blocks_have_cache_control(mock_skill_and_profile):
    blocks = build_cached_system(USER_ID)
    for i, block in enumerate(blocks):
        assert "cache_control" in block, f"Block {i} missing cache_control"
        assert block["cache_control"] == {"type": "ephemeral"}, (
            f"Block {i} cache_control is {block['cache_control']!r}, expected ephemeral"
        )


def test_build_cached_system_all_blocks_are_text_type(mock_skill_and_profile):
    blocks = build_cached_system(USER_ID)
    for block in blocks:
        assert block["type"] == "text"


def test_build_cached_system_empty_skill_omits_block():
    """If SKILL.md is empty, only the profile block is returned."""
    with (
        patch("app.skill_loader.skill_md", return_value=""),
        patch("app.fs.user_profile_blob", return_value=FAKE_PROFILE),
    ):
        blocks = build_cached_system(USER_ID)
    assert len(blocks) == 1
    assert blocks[0]["text"] == FAKE_PROFILE


def test_build_system_text_concatenates_skill_and_profile(mock_skill_and_profile):
    """build_system_text() returns plain text for OpenAI (no cache_control)."""
    text = build_system_text(USER_ID)
    assert FAKE_SKILL_MD in text
    assert FAKE_PROFILE in text


def test_build_system_text_is_string(mock_skill_and_profile):
    text = build_system_text(USER_ID)
    assert isinstance(text, str)

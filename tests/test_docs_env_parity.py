from pathlib import Path

from app.core.config import Settings

ENV_EXAMPLE = Path(__file__).resolve().parents[1] / ".env.example"


def test_env_example_documents_every_setting() -> None:
    documented: set[str] = set()
    for raw in ENV_EXAMPLE.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        # A commented ``# KEY=value`` example still documents the key; the
        # seed passwords are intentionally shipped commented out.
        if line.startswith("#"):
            line = line.lstrip("#").strip()
        if "=" not in line:
            continue
        documented.add(line.split("=", 1)[0].strip())

    missing = sorted(set(Settings.model_fields) - documented)
    assert missing == [], f".env.example is missing: {missing}"

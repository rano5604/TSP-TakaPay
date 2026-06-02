"""
Summarize issue status updates into Actionable and Status track lines.

Actionable buckets: TO DO, Reopened, Commented (open items only).
Status track buckets: one count per transition label in the history.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Iterable

# Workflow tokens (longest match first when parsing "FROM TO" labels).
_STATUS_TOKENS = (
    "TO DO",
    "IN DEVELOPMENT",
    "IN REVIEW",
    "RESOLVED",
    "REOPEN",
    "REJECTED",
    "DONE",
)

TERMINAL_TARGETS = frozenset({"DONE"})


@dataclass
class StatusUpdate:
    """One workflow transition for an issue."""

    issue_id: str
    label: str  # e.g. "RESOLVED REOPEN", "TO DO IN DEVELOPMENT"


@dataclass
class IssueState:
    last_label: str = ""
    reopened_open: bool = False
    is_open: bool = True
    comments: int = 0


def split_transition(label: str) -> tuple[str, str]:
    """Split a transition label into (from_status, to_status)."""
    text = label.strip()
    for from_status in sorted(_STATUS_TOKENS, key=len, reverse=True):
        prefix = f"{from_status} "
        if text.startswith(prefix):
            to_status = text[len(prefix) :]
            return from_status, to_status
    return text, ""


def _is_reopen_transition(label: str) -> bool:
    """Entering reopen (e.g. RESOLVED REOPEN), not completing it (REOPEN DONE)."""
    _from, to = split_transition(label)
    return to == "REOPEN"


def _is_terminal(label: str) -> bool:
    _from, to = split_transition(label)
    return to in TERMINAL_TARGETS


def apply_update(states: dict[str, IssueState], update: StatusUpdate) -> None:
    state = states.setdefault(update.issue_id, IssueState())
    state.last_label = update.label

    if _is_reopen_transition(update.label):
        state.reopened_open = True
    elif split_transition(update.label) == ("REOPEN", "DONE"):
        state.reopened_open = False

    if _is_terminal(update.label):
        state.is_open = False


def build_issue_states(updates: Iterable[StatusUpdate]) -> dict[str, IssueState]:
    states: dict[str, IssueState] = {}
    for update in updates:
        apply_update(states, update)
    return states


def record_comments(
    states: dict[str, IssueState], comments: Iterable[tuple[str, int]]
) -> None:
    for issue_id, count in comments:
        state = states.setdefault(issue_id, IssueState())
        state.comments += count


def actionable_counts(
    updates: Iterable[StatusUpdate],
    comments: Iterable[tuple[str, int]] = (),
) -> dict[str, int]:
    states = build_issue_states(updates)
    record_comments(states, comments)

    counts = {"TO DO": 0, "Reopened": 0, "Commented": 0}
    for state in states.values():
        if not state.is_open:
            continue
        counts["TO DO"] += 1
        if state.reopened_open:
            counts["Reopened"] += 1
        counts["Commented"] += state.comments

    return counts


def status_track_counts(updates: Iterable[StatusUpdate]) -> Counter[str]:
    return Counter(update.label for update in updates)


def reopened_open_count(updates: Iterable[StatusUpdate]) -> int:
    states = build_issue_states(updates)
    return sum(1 for state in states.values() if state.is_open and state.reopened_open)


def format_actionable(counts: dict[str, int]) -> str:
    return (
        f"Actionable  : {counts['TO DO']} TO DO · "
        f"{counts['Reopened']} Reopened · "
        f"{counts['Commented']} Commented"
    )


def format_status_track(
    counts: Counter[str],
    *,
    reopened_open: int = 0,
) -> str:
    total = sum(counts.values())
    preferred = [
        "TO DO IN DEVELOPMENT",
        "REOPEN DONE",
        "RESOLVED DONE",
        "TO DO DONE",
        "RESOLVED REOPEN",
        "TO DO IN REVIEW",
        "IN REVIEW DONE",
        "REJECTED DONE",
    ]
    seen: set[str] = set()
    parts: list[str] = []
    for key in preferred:
        if counts.get(key):
            parts.append(f"{counts[key]} {key}")
            seen.add(key)
    for key in sorted(counts):
        if key not in seen:
            parts.append(f"{counts[key]} {key}")

    if reopened_open:
        # Current reopened workload (not a historical transition label).
        insert_at = 2 if len(parts) >= 2 else len(parts)
        parts.insert(insert_at, f"{reopened_open} REOPENED")

    body = " · ".join(parts)
    return f"Status track: {total} updates — {body}"


def demo_updates() -> list[StatusUpdate]:
    """12 transitions matching the reported example."""
    return [
        StatusUpdate("1", "TO DO IN DEVELOPMENT"),
        StatusUpdate("2", "TO DO IN DEVELOPMENT"),
        StatusUpdate("3", "REOPEN DONE"),
        StatusUpdate("4", "REOPEN DONE"),
        StatusUpdate("5", "RESOLVED DONE"),
        StatusUpdate("6", "RESOLVED DONE"),
        StatusUpdate("7", "TO DO DONE"),
        StatusUpdate("8", "TO DO DONE"),
        StatusUpdate("9", "RESOLVED REOPEN"),
        StatusUpdate("10", "TO DO IN REVIEW"),
        StatusUpdate("11", "IN REVIEW DONE"),
        StatusUpdate("12", "REJECTED DONE"),
    ]


def demo_comments() -> list[tuple[str, int]]:
    """8 comments on still-open issues (issues 1, 2, 9, 10)."""
    return [("1", 2), ("2", 2), ("9", 2), ("10", 2)]


if __name__ == "__main__":
    updates = demo_updates()
    action = actionable_counts(updates, demo_comments())
    track = status_track_counts(updates)
    reopened = reopened_open_count(updates)
    print(format_actionable(action))
    print(format_status_track(track, reopened_open=reopened))

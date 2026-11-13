from datetime import date, datetime
from zoneinfo import ZoneInfo

TEHRAN_TZ = ZoneInfo("Asia/Tehran")


def now_tehran() -> datetime:
    """Current time in Iran, used for calendar-date decisions."""
    return datetime.now(TEHRAN_TZ)


def today_tehran() -> date:
    """Today's calendar date in Iran, independent of the server timezone."""
    return now_tehran().date()

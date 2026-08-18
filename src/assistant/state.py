import threading
import time


class AssistantState:
    """Thread-safe state manager for Sunday AI session state and security timeouts."""

    def __init__(self, lock_timeout: float = 10.0):
        self._lock = threading.Lock()
        self._is_authenticated = False
        self._current_user = None
        self._is_running = True
        self._last_seen_time = time.time()
        self.lock_timeout = lock_timeout

    @property
    def is_running(self) -> bool:
        with self._lock:
            return self._is_running

    def stop(self):
        with self._lock:
            self._is_running = False

    @property
    def is_authenticated(self) -> bool:
        with self._lock:
            return self._is_authenticated

    @property
    def current_user(self) -> str:
        with self._lock:
            return self._current_user

    def authenticate(self, username: str):
        with self._lock:
            self._is_authenticated = True
            self._current_user = username
            self._last_seen_time = time.time()

    def logout(self):
        with self._lock:
            self._is_authenticated = False
            self._current_user = None

    def update_presence(self):
        """Resets the disappearance countdown timer when an authorized face is visible."""
        with self._lock:
            self._last_seen_time = time.time()

    def check_presence_timeout(self) -> bool:
        """Returns True if the authorized face has been missing longer than the timeout period."""
        with self._lock:
            if not self._is_authenticated:
                return False
            elapsed = time.time() - self._last_seen_time
            if elapsed > self.lock_timeout:
                self._is_authenticated = False
                self._current_user = None
                return True
            return False

    @property
    def remaining_presence_time(self) -> float:
        """Returns remaining seconds before the session locks due to absence."""
        with self._lock:
            if not self._is_authenticated:
                return 0.0
            elapsed = time.time() - self._last_seen_time
            return max(0.0, self.lock_timeout - elapsed)

    @property
    def time_since_last_seen(self) -> float:
        """Returns elapsed seconds since the authorized face was last seen."""
        with self._lock:
            return time.time() - self._last_seen_time
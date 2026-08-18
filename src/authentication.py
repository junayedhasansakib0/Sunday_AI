import time


class AuthenticationManager:

    def __init__(self):

        self.authenticated = False
        self.current_user = None
        self.login_time = None

    def authenticate(self, username):

        if username == "Unknown":

            return False

        self.authenticated = True
        self.current_user = username
        self.login_time = time.time()

        return True

    def logout(self):

        self.authenticated = False
        self.current_user = None
        self.login_time = None

    def is_authenticated(self):

        return self.authenticated

    def get_current_user(self):

        return self.current_user

    def get_session_duration(self):

        if not self.authenticated:
            return 0

        return int(
            time.time() - self.login_time
        )
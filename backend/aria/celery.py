import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "aria.settings")

app = Celery("aria")
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks in all installed apps
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f"Request: {self.request!r}")

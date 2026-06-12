import uuid
from django.db import models
from django.conf import settings


class Debate(models.Model):
    class Status(models.TextChoices):
        PENDING   = "pending",   "Pending"
        RUNNING   = "running",   "Running"
        JUDGING   = "judging",   "Judging"
        COMPLETED = "completed", "Completed"
        FAILED    = "failed",    "Failed"

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user       = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="debates",
    )
    topic      = models.TextField()
    num_rounds = models.IntegerField(default=2)
    interactive_mode = models.BooleanField(default=False)
    user_stance      = models.CharField(max_length=10, blank=True, default="")
    awaiting_stance  = models.BooleanField(default=False)
    status     = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Debate({self.id}) — {self.topic[:60]}"


class AgentOutput(models.Model):
    class Role(models.TextChoices):
        ADVOCATE = "advocate", "Advocate"
        CRITIC   = "critic",   "Critic"
        JUDGE    = "judge",    "Judge"

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    debate       = models.ForeignKey(Debate, on_delete=models.CASCADE, related_name="agent_outputs")
    role         = models.CharField(max_length=20, choices=Role.choices)
    round_number = models.IntegerField(default=1)
    turn         = models.CharField(max_length=10, default="advocate")
    content      = models.TextField(blank=True, default="")

    advocate_score       = models.FloatField(null=True, blank=True)
    critic_score         = models.FloatField(null=True, blank=True)
    advocate_logic_score = models.FloatField(null=True, blank=True)
    critic_logic_score   = models.FloatField(null=True, blank=True)
    verdict              = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]


class Citation(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    agent_output = models.ForeignKey(AgentOutput, on_delete=models.CASCADE, related_name="citations")
    url          = models.URLField(max_length=2000)
    title        = models.CharField(max_length=500, blank=True, default="")
    snippet      = models.TextField(blank=True, default="")
    index        = models.IntegerField(default=1)

    class Meta:
        ordering = ["index"]

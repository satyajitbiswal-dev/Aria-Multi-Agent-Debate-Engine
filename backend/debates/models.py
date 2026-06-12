import uuid
from django.db import models


class Debate(models.Model):
    class Status(models.TextChoices):
        PENDING   = "pending",   "Pending"
        RUNNING   = "running",   "Running"
        JUDGING   = "judging",   "Judging"
        COMPLETED = "completed", "Completed"
        FAILED    = "failed",    "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    topic      = models.TextField()
    num_rounds = models.IntegerField(default=2)   # 1–4, each round = advocate + critic
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

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    debate       = models.ForeignKey(Debate, on_delete=models.CASCADE, related_name="agent_outputs")
    role         = models.CharField(max_length=20, choices=Role.choices)
    round_number = models.IntegerField(default=1)   # 1-based exchange index
    turn         = models.CharField(max_length=10, default="advocate")  # "advocate" | "critic"
    content      = models.TextField(blank=True, default="")

    # Judge only
    advocate_score       = models.FloatField(null=True, blank=True)
    critic_score         = models.FloatField(null=True, blank=True)
    advocate_logic_score = models.FloatField(null=True, blank=True)
    critic_logic_score   = models.FloatField(null=True, blank=True)
    verdict              = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.role} R{self.round_number} | Debate {self.debate_id}"


class Citation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    agent_output = models.ForeignKey(AgentOutput, on_delete=models.CASCADE, related_name="citations")
    url     = models.URLField(max_length=2000)
    title   = models.CharField(max_length=500, blank=True, default="")
    snippet = models.TextField(blank=True, default="")
    index   = models.IntegerField(default=1)

    class Meta:
        ordering = ["index"]

    def __str__(self):
        return f"[{self.index}] {self.title[:60]}"

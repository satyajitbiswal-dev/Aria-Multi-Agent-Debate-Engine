from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("debates", "0004_debate_user"),
    ]

    operations = [
        migrations.AddField(
            model_name="debate",
            name="interactive_mode",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="debate",
            name="user_stance",
            field=models.CharField(blank=True, default="", max_length=10),
        ),
        migrations.AddField(
            model_name="debate",
            name="awaiting_stance",
            field=models.BooleanField(default=False),
        ),
    ]

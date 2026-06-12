from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("debates", "0005_debate_interactive_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="debate",
            name="user_thought",
            field=models.TextField(blank=True, default=""),
        ),
    ]
